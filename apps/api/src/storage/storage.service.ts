import {
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

import { env } from '../config/env.js';
import { createS3Client } from './s3-client.js';

@Injectable()
export class StorageService {
  private readonly client = createS3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  });

  async createUploadUrl(input: {
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
  }) {
    // Browser PUT: do not sign ContentType/ContentLength. Extra signed headers
    // often become SignatureDoesNotMatch; Chrome then reports a CORS failure.
    // Mime type is already stored in Postgres for the document row.
    void input.mimeType;
    void input.sizeBytes;
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: input.storageKey,
    });

    return getSignedUrl(this.client, command, { expiresIn: 60 * 10 });
  }

  async createDownloadUrl(storageKey: string, fileName: string) {
    // RFC 5987: ASCII fallback plus UTF-8 encoded name for Vietnamese filenames.
    const asciiName =
      fileName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, (char) => (char === 'đ' ? 'd' : 'D'))
        .replace(/[^\w.\- ()[\]]+/g, '_') || 'document';
    const utf8Name = encodeURIComponent(fileName);

    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: storageKey,
      ResponseContentDisposition: `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
    });

    return getSignedUrl(this.client, command, { expiresIn: 60 * 10 });
  }
}

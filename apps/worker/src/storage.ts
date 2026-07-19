import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { env } from './config/env.js';

const client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

export async function downloadObject(storageKey: string): Promise<Buffer> {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: storageKey,
    }),
  );

  const body = response.Body;
  if (!body) {
    throw new Error(`Empty object body for ${storageKey}`);
  }

  const bytes = await body.transformToByteArray();
  return Buffer.from(bytes);
}

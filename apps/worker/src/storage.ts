import { GetObjectCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

import { env } from './config/env.js';

function createS3Client(): S3Client {
  const config: S3ClientConfig = { region: env.S3_REGION };

  if (env.S3_ENDPOINT) {
    config.endpoint = env.S3_ENDPOINT;
    config.forcePathStyle = env.S3_FORCE_PATH_STYLE;
  }

  if (env.S3_ACCESS_KEY && env.S3_SECRET_KEY) {
    config.credentials = {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    };
  }

  return new S3Client(config);
}

const client = createS3Client();

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

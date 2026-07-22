import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

export function createS3Client(input: {
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
}): S3Client {
  const config: S3ClientConfig = { region: input.region };

  if (input.endpoint) {
    config.endpoint = input.endpoint;
    config.forcePathStyle = input.forcePathStyle;
  }

  if (input.accessKeyId && input.secretAccessKey) {
    config.credentials = {
      accessKeyId: input.accessKeyId,
      secretAccessKey: input.secretAccessKey,
    };
  }

  return new S3Client(config);
}

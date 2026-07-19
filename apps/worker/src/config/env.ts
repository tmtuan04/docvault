import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';

loadEnv({
  path: resolve(process.cwd(), '../../.env'),
  quiet: true,
});

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  S3_REGION: process.env.S3_REGION ?? 'us-east-1',
  S3_BUCKET: process.env.S3_BUCKET ?? 'documents',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? 'minio',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? 'miniosecret',
  S3_FORCE_PATH_STYLE: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  AI_PROVIDER: (process.env.AI_PROVIDER ?? 'mock') as 'mock' | 'openai',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  OPENAI_EMBEDDING_MODEL:
    process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
} as const;

if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
}

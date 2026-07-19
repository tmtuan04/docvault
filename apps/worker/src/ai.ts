import { createHash } from 'node:crypto';

import { EMBEDDING_DIMENSIONS } from '@document-saas/shared';
import OpenAI from 'openai';

import { env } from './config/env.js';

function mockEmbedding(text: string): number[] {
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);

  if (tokens.length === 0) {
    vector[0] = 1;
    return vector;
  }

  for (const token of tokens) {
    const digest = createHash('sha256').update(token).digest();
    for (let index = 0; index < EMBEDDING_DIMENSIONS; index += 1) {
      const byte = digest[index % digest.length] ?? 0;
      const current = vector[index] ?? 0;
      vector[index] = current + ((byte / 255) * 2 - 1);
    }
  }

  const norm =
    Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;

  return vector.map((value) => value / norm);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  if (env.AI_PROVIDER === 'mock') {
    return texts.map((text) => mockEmbedding(text.slice(0, 8000)));
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: texts.map((text) => text.slice(0, 8000)),
  });

  return response.data
    .sort((left, right) => left.index - right.index)
    .map((item) => item.embedding);
}

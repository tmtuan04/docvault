import { createHash } from 'node:crypto';

import { EMBEDDING_DIMENSIONS } from '@document-saas/shared';
import OpenAI from 'openai';

import { env } from '../config/env.js';

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

function getOpenAI() {
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export async function embedText(text: string): Promise<number[]> {
  const clipped = text.slice(0, 8000);

  if (env.AI_PROVIDER === 'mock') {
    return mockEmbedding(clipped);
  }

  const response = await getOpenAI().embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: clipped,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error('Embedding provider returned an empty result');
  }

  return embedding;
}

export async function answerWithContext(input: {
  question: string;
  contexts: Array<{ documentName: string; content: string }>;
}): Promise<string> {
  if (input.contexts.length === 0) {
    return 'Tôi không tìm thấy thông tin liên quan trong tài liệu của workspace này.';
  }

  if (env.AI_PROVIDER === 'mock') {
    const snippets = input.contexts
      .slice(0, 3)
      .map(
        (context, index) =>
          `${index + 1}. [${context.documentName}] ${context.content.slice(0, 280)}`,
      )
      .join('\n');

    return [
      `Dựa trên các đoạn tài liệu liên quan nhất trong workspace:`,
      '',
      snippets,
      '',
      `(Chế độ AI mock — đặt AI_PROVIDER=openai và OPENAI_API_KEY để dùng model thật.)`,
    ].join('\n');
  }

  const contextBlock = input.contexts
    .map(
      (context, index) =>
        `[#${index + 1} | ${context.documentName}]\n${context.content}`,
    )
    .join('\n\n');

  const response = await getOpenAI().chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'Bạn là trợ lý DocVault. Chỉ trả lời dựa trên các đoạn tài liệu được cung cấp. Nếu không đủ thông tin, hãy nói rõ là không tìm thấy. Trả lời bằng tiếng Việt trừ khi câu hỏi yêu cầu ngôn ngữ khác. Không bịa nguồn.',
      },
      {
        role: 'user',
        content: `Câu hỏi:\n${input.question}\n\nNgữ cảnh:\n${contextBlock}`,
      },
    ],
  });

  return (
    response.choices[0]?.message?.content?.trim() ||
    'Không tạo được câu trả lời từ các nguồn đã tìm thấy.'
  );
}

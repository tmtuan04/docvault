import mammoth from 'mammoth';
import pdf from 'pdf-parse';

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (mimeType === 'application/pdf') {
    const parsed = await pdf(buffer);
    return normalizeText(parsed.text);
  }

  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    return normalizeText(parsed.value);
  }

  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return normalizeText(buffer.toString('utf8'));
  }

  throw new Error(`Unsupported mime type for ingest: ${mimeType}`);
}

export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number },
): string[] {
  const chunkSize = options?.chunkSize ?? 1200;
  const overlap = options?.overlap ?? 200;
  const cleaned = normalizeText(text);

  if (!cleaned) {
    return [];
  }

  if (cleaned.length <= chunkSize) {
    return [cleaned];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    if (end < cleaned.length) {
      const boundary = cleaned.lastIndexOf(' ', end);
      if (boundary > start + Math.floor(chunkSize * 0.6)) {
        end = boundary;
      }
    }

    const piece = cleaned.slice(start, end).trim();
    if (piece) {
      chunks.push(piece);
    }

    if (end >= cleaned.length) {
      break;
    }

    start = Math.max(0, end - overlap);

    // The overlap window can land mid-word; snap forward to the next word
    // boundary so no stored chunk ever starts with a partial word.
    if (start > 0 && cleaned[start - 1] !== ' ') {
      const wordBoundary = cleaned.indexOf(' ', start);
      if (wordBoundary !== -1 && wordBoundary < end) {
        start = wordBoundary + 1;
      }
    }
  }

  return chunks;
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

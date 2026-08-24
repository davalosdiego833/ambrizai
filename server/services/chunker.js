// Splits a document's raw text into overlapping, paragraph-aware chunks
// suitable for embedding + semantic search.

const DEFAULT_CHUNK_SIZE = 1200; // characters
const DEFAULT_OVERLAP = 150; // characters of overlap between consecutive chunks

/**
 * Splits `text` into chunks of roughly `chunkSize` characters, preferring to
 * break on paragraph/line boundaries, with `overlap` characters repeated
 * between consecutive chunks so context isn't lost at the seams.
 */
export function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP) {
  if (!text || !text.trim()) return [];

  // Normalize whitespace a bit, but keep paragraph breaks.
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

  // First split into paragraphs; very long "paragraphs" (e.g. a wall of text
  // with no blank lines) get further split by sentence/line as a fallback.
  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed.length > 40) {
      // Ignore near-empty scraps (e.g. lone page numbers, headers)
      chunks.push(trimmed);
    }
    current = '';
  };

  for (const para of paragraphs) {
    // If a single paragraph is itself bigger than the chunk size, split it
    // further by lines/sentences so we don't produce a giant chunk.
    const pieces = para.length > chunkSize * 1.5 ? splitLongParagraph(para, chunkSize) : [para];

    for (const piece of pieces) {
      if (current.length + piece.length + 2 <= chunkSize) {
        current += (current ? '\n\n' : '') + piece;
      } else {
        pushCurrent();
        // Carry over the tail of the previous chunk as overlap
        const overlapText = chunks.length > 0 ? chunks[chunks.length - 1].slice(-overlap) : '';
        current = overlapText ? `${overlapText}\n\n${piece}` : piece;
      }
    }
  }
  pushCurrent();

  return chunks;
}

function splitLongParagraph(text, chunkSize) {
  // Fall back to splitting on sentence-ish boundaries, then hard-wrap if needed.
  const sentences = text.split(/(?<=[.;:])\s+/);
  const pieces = [];
  let buf = '';
  for (const s of sentences) {
    if (buf.length + s.length + 1 <= chunkSize) {
      buf += (buf ? ' ' : '') + s;
    } else {
      if (buf) pieces.push(buf);
      buf = s.length > chunkSize ? s.slice(0, chunkSize) : s;
    }
  }
  if (buf) pieces.push(buf);
  return pieces;
}

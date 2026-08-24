// Local semantic (vector) index for Ambriz AI's knowledge base.
//
// Instead of picking documents by literal keyword overlap, we embed every
// chunk of every document once (via Gemini's embedding model) and, at query
// time, embed the user's question and rank all chunks by cosine similarity.
// This is what lets the assistant find the right passage even when the
// advisor's wording doesn't match the document's wording.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Note: each embedding model has its own vector space AND its own separate
// free-tier daily quota bucket. If this model's daily quota gets exhausted,
// switching to another embedding model requires rebuilding the index from
// scratch (vectors from different models aren't comparable).
const EMBEDDING_MODEL = 'gemini-embedding-2';
export const EMBEDDING_DIM = 768;
// With billing enabled, the free-tier per-day/per-minute caps no longer
// apply — paid-tier rate limits are much higher. Keep a small courtesy
// pacing gap so we're still a good API citizen, but no need to crawl.
export const BATCH_SIZE = 100;
const BATCH_PACING_MS = 2000;

const VECTORS_FILE = path.join(__dirname, '../data/vector_index.bin');
const META_FILE = path.join(__dirname, '../data/vector_index_meta.json');

let index = null; // { vectors: Float32Array (N * EMBEDDING_DIM), meta: [{ id, relativePath, category, text }] }

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
}

/**
 * Embeds an array of plain-text strings, in batches, with basic retry/backoff.
 * taskType should be TaskType.RETRIEVAL_DOCUMENT when indexing chunks, and
 * TaskType.RETRIEVAL_QUERY when embedding a user's search query.
 */
/**
 * onBatchComplete(batchValues, batchStartIndex), if provided, is called right
 * after each individual API batch succeeds — so callers can persist progress
 * incrementally and never lose more than one in-flight batch to a crash.
 */
export async function embedTexts(texts, taskType = TaskType.RETRIEVAL_DOCUMENT, onBatchComplete = null) {
  const model = getModel();
  if (!model) throw new Error('GEMINI_API_KEY no configurada; no se pueden generar embeddings.');

  const results = [];
  const numBatches = Math.ceil(texts.length / BATCH_SIZE);
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batchNum = i / BATCH_SIZE + 1;
    const batch = texts.slice(i, i + BATCH_SIZE);
    const requests = batch.map((text) => ({
      content: { parts: [{ text }], role: 'user' },
      taskType,
      outputDimensionality: EMBEDDING_DIM,
    }));

    let attempt = 0;
    let batchValues = null;
    // Simple retry with backoff for transient errors (mostly 429s from the
    // free-tier per-minute cap — the fixed pacing below should avoid most of these).
    while (true) {
      try {
        const res = await model.batchEmbedContents({ requests });
        batchValues = res.embeddings.map((e) => e.values);
        break;
      } catch (err) {
        attempt += 1;
        if (attempt > 6) throw err;
        const waitMs = Math.min(90000, 10000 * attempt);
        console.warn(`⚠️ Lote ${batchNum}/${numBatches}: error generando embeddings (intento ${attempt}): ${err.message.slice(0, 150)}. Reintentando en ${waitMs}ms...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    results.push(...batchValues);
    if (onBatchComplete) onBatchComplete(batchValues, i);

    // Pace ourselves to stay under the free-tier per-minute quota.
    if (i + BATCH_SIZE < texts.length) {
      console.log(`⏳ Lote ${batchNum}/${numBatches} embebido (${results.length}/${texts.length} fragmentos). Esperando ${Math.round(BATCH_PACING_MS / 1000)}s por límite de cuota...`);
      await new Promise((r) => setTimeout(r, BATCH_PACING_MS));
    }
  }
  return results;
}

export async function embedQuery(text) {
  const [vec] = await embedTexts([text], TaskType.RETRIEVAL_QUERY);
  return vec;
}

function toFloat32(vectors) {
  const flat = new Float32Array(vectors.length * EMBEDDING_DIM);
  // Normalize each vector at write time so that at search time a plain dot
  // product against a normalized query vector equals cosine similarity.
  vectors.forEach((v, i) => flat.set(normalize(v), i * EMBEDDING_DIM));
  return flat;
}

export function saveIndex(vectors, meta) {
  const flat = toFloat32(vectors);
  fs.writeFileSync(VECTORS_FILE, Buffer.from(flat.buffer));
  fs.writeFileSync(META_FILE, JSON.stringify(meta), 'utf-8');
  index = { vectors: flat, meta };
}

export function indexExists() {
  return fs.existsSync(VECTORS_FILE) && fs.existsSync(META_FILE);
}

export function loadIndex() {
  if (index) return index;
  if (!indexExists()) return null;

  const buf = fs.readFileSync(VECTORS_FILE);
  const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));

  if (meta.length * EMBEDDING_DIM !== vectors.length) {
    console.warn('⚠️ El índice vectorial parece corrupto o desincronizado (metadatos y vectores no coinciden). Se ignorará hasta reconstruirlo.');
    return null;
  }

  index = { vectors, meta };
  return index;
}

/** Loaded index's chunk count, or 0 if not built yet. */
export function getIndexSize() {
  const idx = loadIndex();
  return idx ? idx.meta.length : 0;
}

/**
 * Returns the top-K chunks most semantically similar to `queryVector`.
 * Each result: { score, relativePath, category, text }
 */
export function search(queryVector, topK = 12) {
  const idx = loadIndex();
  if (!idx) return [];

  const { vectors, meta } = idx;
  const n = meta.length;

  // Query vectors from Gemini are already unit-normalized, but normalize
  // defensively so cosine similarity is correct regardless.
  const q = normalize(queryVector);

  const scores = new Array(n);
  for (let i = 0; i < n; i++) {
    const offset = i * EMBEDDING_DIM;
    let dot = 0;
    for (let d = 0; d < EMBEDDING_DIM; d++) {
      dot += vectors[offset + d] * q[d];
    }
    scores[i] = dot; // vectors were stored normalized at index time (see buildVectorIndex)
  }

  const ranked = scores
    .map((score, i) => ({ score, ...meta[i] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return ranked;
}

function normalize(vec) {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) sumSq += vec[i] * vec[i];
  const norm = Math.sqrt(sumSq) || 1;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

export { normalize };

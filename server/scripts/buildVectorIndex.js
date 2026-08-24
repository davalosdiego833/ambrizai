// Builds (or incrementally updates) the semantic vector index over the
// entire knowledge base. Run this manually whenever documents are added,
// removed, or edited in server/data/knowledge/:
//
//   npm run reindex        (from the server/ directory)
//
// It's safe to re-run any time: chunks that haven't changed are skipped
// (matched by a hash of their content), so only new/edited content gets
// sent to the embeddings API.

import 'dotenv/config';
import '../config.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { TaskType } from '@google/generative-ai';
import { getAllCachedDocs } from '../services/knowledge.js';
import { chunkText } from '../services/chunker.js';
import { embedTexts, saveIndex, indexExists, loadIndex, EMBEDDING_DIM } from '../services/vectorStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function categoryFor(relativePath) {
  const top = relativePath.split(path.sep)[0];
  return top || 'general';
}

function chunkId(relativePath, chunkIndex, text) {
  const hash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 16);
  return `${relativePath}::${chunkIndex}::${hash}`;
}

async function main() {
  console.log('📚 Cargando y parseando todos los documentos (PDFs + TXT)...');
  const docs = await getAllCachedDocs();
  console.log(`✅ ${docs.length} documentos cargados.`);

  console.log('✂️  Dividiendo documentos en fragmentos...');
  const allChunks = [];
  for (const doc of docs) {
    const pieces = chunkText(doc.content);
    pieces.forEach((text, i) => {
      allChunks.push({
        id: chunkId(doc.relativePath, i, text),
        relativePath: doc.relativePath,
        category: categoryFor(doc.relativePath),
        chunkIndex: i,
        text,
      });
    });
  }
  console.log(`✅ ${allChunks.length} fragmentos generados en total.`);

  // Figure out which chunks are already embedded (by id) so we only pay for
  // and wait on the new/changed ones.
  const existing = loadIndex();
  const existingIds = new Set(existing ? existing.meta.map((m) => m.id) : []);
  const existingVectorsById = new Map();
  if (existing) {
    existing.meta.forEach((m, i) => {
      existingVectorsById.set(m.id, existing.vectors.slice(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM));
    });
  }

  const newChunks = allChunks.filter((c) => !existingIds.has(c.id));
  console.log(`🆕 ${newChunks.length} fragmentos nuevos o modificados por embeder. (${allChunks.length - newChunks.length} ya estaban indexados)`);

  const finalMeta = [];
  const finalVectors = [];

  // Keep chunks that are unchanged, in the new full order (drops removed/renamed docs automatically).
  for (const c of allChunks) {
    if (existingIds.has(c.id)) {
      finalMeta.push({ id: c.id, relativePath: c.relativePath, category: c.category, text: c.text });
      finalVectors.push(existingVectorsById.get(c.id));
    }
  }

  if (newChunks.length > 0) {
    console.log(`🤖 Generando embeddings para ${newChunks.length} fragmentos nuevos...`);
    await embedTexts(
      newChunks.map((c) => c.text),
      TaskType.RETRIEVAL_DOCUMENT,
      (batchValues, batchStartIndex) => {
        // Persist after every real API batch (not just every 200) so a
        // crash mid-run never loses more than the one in-flight batch.
        batchValues.forEach((vec, j) => {
          const c = newChunks[batchStartIndex + j];
          finalMeta.push({ id: c.id, relativePath: c.relativePath, category: c.category, text: c.text });
          finalVectors.push(vec);
        });
        saveIndex(finalVectors, finalMeta);
      }
    );
  } else {
    saveIndex(finalVectors, finalMeta);
  }

  console.log(`✅ Índice vectorial listo: ${finalMeta.length} fragmentos indexados.`);
  const vf = path.join(__dirname, '../data/vector_index.bin');
  const mf = path.join(__dirname, '../data/vector_index_meta.json');
  console.log(`   ${vf} (${(fs.statSync(vf).size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`   ${mf} (${(fs.statSync(mf).size / 1024 / 1024).toFixed(1)} MB)`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('❌ Error construyendo el índice vectorial:', err);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_DIR = path.join(__dirname, '../data/knowledge');
const CACHE_FILE = path.join(__dirname, '../data/pdf_cache.json');

// Ensure knowledge directory exists
if (!fs.existsSync(KNOWLEDGE_DIR)) {
  fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
}

// Load persistent PDF cache from disk
let pdfCache = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    pdfCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    console.log('📦 Caché persistente de PDFs cargada desde disco.');
  }
} catch (err) {
  console.error('Error al cargar caché persistente de PDFs:', err);
}

// Helper function to recursively read files in a directory
function getAllFiles(dirPath, arrayOfFiles = []) {
  try {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
      // Skip hidden files like .DS_Store
      if (file.startsWith('.')) return;
      
      const absolutePath = path.join(dirPath, file);
      if (fs.statSync(absolutePath).isDirectory()) {
        getAllFiles(absolutePath, arrayOfFiles);
      } else {
        arrayOfFiles.push(absolutePath);
      }
    });
  } catch (err) {
    console.error('Error reading directory recursively:', err);
  }
  return arrayOfFiles;
}

let cachedDocs = null; // Array of { path: string, relativePath: string, ext: string, content: string }
let isBuildingCache = false;

async function buildKnowledgeCache() {
  if (isBuildingCache) return;
  isBuildingCache = true;
  try {
    const allFiles = getAllFiles(KNOWLEDGE_DIR);
    console.log('🔄 Cargando caché de conocimientos en memoria...');
    const docs = [];
    let cacheUpdated = false;

    for (const filePath of allFiles) {
      const ext = path.extname(filePath).toLowerCase();
      const relativePath = path.relative(KNOWLEDGE_DIR, filePath);

      if (ext === '.txt' || ext === '.md') {
        const content = fs.readFileSync(filePath, 'utf-8');
        docs.push({
          path: filePath,
          relativePath,
          ext,
          content
        });
      } else if (ext === '.pdf') {
        try {
          const stats = fs.statSync(filePath);
          const mtimeMs = stats.mtimeMs;
          const size = stats.size;

          // Match by size or presence of cached content (mtimeMs changes on git clone/deploy)
          if (pdfCache[relativePath] && (pdfCache[relativePath].size === size || pdfCache[relativePath].content)) {
            docs.push({
              path: filePath,
              relativePath,
              ext,
              content: pdfCache[relativePath].content
            });
          } else {
            console.log(`📄 Procesando PDF nuevo o modificado: ${relativePath}...`);
            const dataBuffer = fs.readFileSync(filePath);
            const uint8Array = new Uint8Array(dataBuffer);
            const parser = new PDFParse({ data: uint8Array });
            const parsedResult = await parser.getText();
            const textContent = typeof parsedResult === 'string' ? parsedResult : (parsedResult?.text || '');
            docs.push({
              path: filePath,
              relativePath,
              ext,
              content: textContent
            });
            pdfCache[relativePath] = {
              mtimeMs,
              size,
              content: textContent
            };
            cacheUpdated = true;
          }
        } catch (pdfErr) {
          console.error(`Error procesando PDF ${relativePath}:`, pdfErr);
        }
      }
    }

    cachedDocs = docs;
    if (cacheUpdated) {
      try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(pdfCache), 'utf-8');
        console.log('💾 Caché persistente de PDFs actualizada en disco.');
      } catch (writeErr) {
        console.error('Error al guardar caché de PDFs:', writeErr);
      }
    }
    console.log(`✅ Base de conocimientos en memoria lista. Total documentos: ${cachedDocs.length}`);
  } catch (err) {
    console.error('Error al construir caché de conocimientos:', err);
  } finally {
    isBuildingCache = false;
  }
}

export async function getKnowledgeContext(query = null, history = []) {
  try {
    if (!cachedDocs) {
      await buildKnowledgeCache();
    }

    if (cachedDocs.length === 0) {
      return 'No hay documentos de conocimiento cargados aún.';
    }

    // Separate text/markdown base configurations from searchable PDFs
    const baseDocs = cachedDocs.filter(doc => doc.ext === '.txt' || doc.ext === '.md');
    const pdfDocs = cachedDocs.filter(doc => doc.ext === '.pdf');

    // If no query is provided, return baseline process documents
    if (!query) {
      let context = '';
      for (const doc of baseDocs) {
        context += `\n\n=== DOCUMENTO: ${doc.relativePath} ===\n${doc.content}\n=== FIN DE DOCUMENTO ===\n`;
      }
      for (const doc of pdfDocs) {
        context += `\n\n=== DOCUMENTO PDF: ${doc.relativePath} ===\n${doc.content}\n=== FIN DE DOCUMENTO ===\n`;
      }
      return context;
    }

    const cleanQuery = query.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ");

    const isSocialGreeting = /^(hola|buenos\s+dias|buenas\s+tardes|buenas\s+noches|que\s+tal|saludos|quien\s+eres|hola\s+ambriz|gracias|excelente|ayuda)$/i.test(cleanQuery.trim());
    if (isSocialGreeting) {
      const procDoc = baseDocs.find(d => d.relativePath.includes('procesos_generales.txt'));
      return procDoc ? `=== DOCUMENTO: procesos_generales.txt ===\n${procDoc.content}\n=== FIN DE DOCUMENTO ===` : 'Asistente Ambriz AI - Promotoría Ambriz';
    }

    const isCampaignQuery = ['campana', 'campanas', 'campaña', 'campañas', 'convencion', 'convenciones', 'graduacion', 'graduación', 'mdrt', 'concurso', 'concursos', 'bono', 'bonos', 'diamante'].some(k => cleanQuery.includes(k));

    // Build filtered text context: include general process files, only include campaign files if query is campaign-related
    let context = '';
    for (const doc of baseDocs) {
      const normPath = doc.relativePath.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isCampaignFile = normPath.includes('campan') || normPath.includes('convencion') || normPath.includes('mdrt') || normPath.includes('graduacion') || normPath.includes('cuaderno');
      if (isCampaignFile && !isCampaignQuery) {
        // Skip campaign text files for product / process queries
        continue;
      }
      context += `\n\n=== DOCUMENTO: ${doc.relativePath} ===\n${doc.content}\n=== FIN DE DOCUMENTO ===\n`;
    }

    // Detect mentioned products in query to prioritize their folders
    const PRODUCTS = [
      { key: 'campanas', keywords: ['campana', 'campanas', 'campaña', 'campañas', 'graduacion', 'graduación', 'mdrt', 'aspirante 1', 'aspirante 2', 'aspirante', 'cumbre', 'legion centurion', 'legión centurión', 'rda', 'convenciones'] },
      { key: 'medicos a tu lado', keywords: ['medicos a tu lado', 'médicos a tu lado', 'doctores'] },
      { key: 'alfa medical', keywords: ['alfa medical', 'alfa', 'flex', 'pleno', 'integro', 'practico'] },
      { key: 'suma proteccion', keywords: ['suma proteccion', 'suma protección', 'deducible exceso'] },
      { key: 'fair play', keywords: ['fair play', 'fairplay', 'traspaso', 'traspasos', 'malas practicas', 'malas prácticas'] },
      { key: 'cuaderno de concursos', keywords: ['cuaderno', 'concurso', 'concursos', 'bono', 'bonos'] },
      { key: 'comisiones', keywords: ['comision', 'comisiones', 'comisiona', 'comisionar', 'porcentaje'] },
      { key: 'vida mujer', keywords: ['vida mujer', 'mujer', 'dote', 'dotes'] },
      { key: 'imagina ser', keywords: ['imagina ser', 'imagina', 'ppr', 'retiro'] },
      { key: 'nuevo plenitud', keywords: ['nuevo plenitud', 'plenitud'] },
      { key: 'objetivo vida', keywords: ['objetivo vida', 'objetivo'] },
      { key: 'orvi 99', keywords: ['orvi 99', 'orvi'] },
      { key: 'segubeca', keywords: ['segubeca', 'beca', 'estudios'] },
      { key: 'star dotal', keywords: ['star dotal', 'dotal'] },
      { key: 'star temporal', keywords: ['star temporal', 'temporal', 'hombre clave'] },
      { key: 'gastos medicos', keywords: ['gastos medicos', 'gastos médicos', 'gmm', 'hospital', 'reembolso', 'maternidad', 'tabulador'] }
    ];

    const mentionedProducts = [];
    PRODUCTS.forEach(p => {
      const isMentioned = p.keywords.some(k => {
        const cleanK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return cleanQuery.includes(cleanK);
      }) || cleanQuery.includes(p.key);
      if (isMentioned) {
        mentionedProducts.push(p.key);
      }
    });

    // If no product is mentioned in the current query, scan the chat history (starting from the most recent)
    if (mentionedProducts.length === 0 && history && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        const msgText = (history[i].text || '').toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s]/g, " ");

        for (const p of PRODUCTS) {
          const isMentioned = p.keywords.some(k => {
            const cleanK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return msgText.includes(cleanK);
          }) || msgText.includes(p.key);
          if (isMentioned) {
            mentionedProducts.push(p.key);
          }
        }
        // Stop scanning further back if we found the active product in this turn
        if (mentionedProducts.length > 0) {
          break;
        }
      }
    }

    const stopWords = new Set([
      "como", "cómo", "hago", "un", "de", "en", "una", "y", "el", "la", "los", "las", 
      "para", "con", "del", "por", "que", "qué", "cual", "cuál", "cuales", "cuáles", "son", "se", "mi", 
      "mis", "su", "sus", "hacer", "puedo", "donde", "dónde", "quien", "quién", "si", "no", "o", "a", "al",
      "dame", "dime", "informacion", "información", "sobre", "acerca", "quiero", "saber", "favor", "porfa", "fa",
      "hola", "buenos", "dias", "tardes", "noches", "ayuda", "ayudame", "necesito"
    ]);

    const keywords = cleanQuery.split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !stopWords.has(w));

    if (keywords.length === 0) {
      // If no valid keywords, return base text documents
      return context;
    }

    // Rank PDF documents based on keyword occurrence and product mapping
    const rankedPdfs = pdfDocs.map(doc => {
      let score = 0;
      const docPathLower = doc.relativePath.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const cleanDocPath = docPathLower.replace(/^portafolio de productos vida\//, "");
      const docContentLower = doc.content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // Strictly penalize Campaign / Cuaderno de Concursos PDFs if the query is NOT about campaigns
      const isCampaignPdf = docPathLower.includes('campan') || docPathLower.includes('convencion') || docPathLower.includes('mdrt') || docPathLower.includes('graduacion') || docPathLower.includes('cuaderno');
      if (isCampaignPdf && !isCampaignQuery) {
        score -= 5000;
      }

      // Sub-product groups for category hierarchy
      const gmmSubproducts = new Set(['alfa medical', 'suma proteccion', 'medicos a tu lado']);
      const vidaSubproducts = new Set(['vida mujer', 'imagina ser', 'nuevo plenitud', 'objetivo vida', 'orvi 99', 'segubeca', 'star dotal', 'star temporal']);

      // Determine if this file belongs to a specific product
      let docProductKey = null;
      for (const p of PRODUCTS) {
        if (docPathLower.includes(p.key)) {
          docProductKey = p.key;
          break;
        }
      }

      // Apply product alignment rules with precise category hierarchy
      if (mentionedProducts.length > 0 && docProductKey) {
        const isCompatible = mentionedProducts.some(m => {
          if (m === docProductKey) return true;
          if (gmmSubproducts.has(m) && docProductKey === 'gastos medicos') return true;
          if (vidaSubproducts.has(m) && docProductKey === 'vida') return true;
          return false;
        });

        if (isCompatible) {
          // Strong boost for matching or category-aligned products
          score += 1500;
          // Priority boost for Product Manuals / Functional Guides
          if (docPathLower.includes('manual') || docPathLower.includes('funcionamiento') || docPathLower.includes('conoce tu producto') || docPathLower.includes('guia')) {
            score += 500;
          }
        } else {
          // Penalize documents of OTHER specific sub-products (e.g. searching Orvi and matching Imagina Ser)
          score -= 1000;
        }
      }

      keywords.forEach(kw => {
        // High priority if keyword is in the file title/path (excluding root folder name)
        if (cleanDocPath.includes(kw)) {
          score += 200;
        }
        // Count occurrences in contents
        const regex = new RegExp(kw, 'g');
        const matches = docContentLower.match(regex);
        if (matches) {
          score += matches.length * 2;
        }
      });

      return { doc, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

    // Get top 3 matching PDFs to ensure full coverage while keeping context compact and fast
    const selectedPdfs = rankedPdfs.slice(0, 3).map(item => item.doc);

    console.log(`🔍 Búsqueda de Contexto para: "${query}"`);
    console.log(`   Palabras clave: [${keywords.join(', ')}]`);
    if (mentionedProducts.length > 0) {
      console.log(`   Productos detectados: [${mentionedProducts.join(', ')}]`);
    }
    console.log(`   PDFs seleccionados: ${selectedPdfs.map(d => d.relativePath).join(', ') || 'Ninguno'}`);

    for (const doc of selectedPdfs) {
      const docContent = extractRelevantContent(doc.content, keywords, 6000);
      context += `\n\n=== DOCUMENTO PDF: ${doc.relativePath} ===\n${docContent}\n=== FIN DE DOCUMENTO ===\n`;
    }

    return context;
  } catch (err) {
    console.error('Error al leer el conocimiento:', err);
    return 'Error al cargar los documentos de conocimiento.';
  }
}

function extractRelevantContent(content, keywords, maxChars = 6000) {
  if (!content || content.length <= maxChars) return content;
  
  const paragraphs = content.split(/(?:\r?\n){2,}/);
  const blocks = paragraphs.length > 5 ? paragraphs : content.split(/(?:\r?\n)/);
  
  const scored = blocks.map((block, idx) => {
    let score = 0;
    const blockLower = block.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Penalize table of contents / index blocks
    if (blockLower.includes("tabla de contenido") || blockLower.includes("indice") || blockLower.includes("cómo usar esta guia") || blockLower.includes("introduccion")) {
      score -= 15;
    }

    keywords.forEach(kw => {
      if (kw && blockLower.includes(kw)) {
        score += 15;
      }
    });
    return { idx, block, score };
  });

  const matching = scored.filter(b => b.score > 0).sort((a, b) => b.score - a.score);

  if (matching.length === 0) {
    return content.slice(0, maxChars) + '\n... [Extracto inicial del documento]';
  }

  const selectedIndices = new Set();
  let currentLen = 0;

  for (const item of matching) {
    if (currentLen >= maxChars) break;
    const idxsToAdd = [item.idx - 1, item.idx, item.idx + 1].filter(i => i >= 0 && i < blocks.length);
    for (const i of idxsToAdd) {
      if (!selectedIndices.has(i)) {
        selectedIndices.add(i);
        currentLen += blocks[i].length;
        if (currentLen >= maxChars) break;
      }
    }
  }

  const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
  return sortedIndices.map(i => blocks[i]).join('\n\n') + (currentLen < content.length ? '\n... [Extracto relevante del documento]' : '');
}

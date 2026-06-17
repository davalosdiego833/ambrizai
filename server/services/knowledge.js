import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_DIR = path.join(__dirname, '../data/knowledge');

// Ensure knowledge directory exists
if (!fs.existsSync(KNOWLEDGE_DIR)) {
  fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
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
let lastLoadTime = 0;

export async function getKnowledgeContext(query = null) {
  try {
    const allFiles = getAllFiles(KNOWLEDGE_DIR);
    
    // Find the latest modification time of all files
    let maxMtime = 0;
    for (const filePath of allFiles) {
      try {
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs > maxMtime) {
          maxMtime = stats.mtimeMs;
        }
      } catch (e) {
        // Ignore stats errors
      }
    }

    // If cache is empty or files have been modified, load docs into memory
    if (!cachedDocs || maxMtime > lastLoadTime) {
      console.log('🔄 Reconstruyendo el caché de conocimientos (esto puede tardar unos segundos)...');
      const docs = [];

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
            const dataBuffer = fs.readFileSync(filePath);
            const uint8Array = new Uint8Array(dataBuffer);
            const parser = new PDFParse({ data: uint8Array });
            const parsedPdf = await parser.getText();
            docs.push({
              path: filePath,
              relativePath,
              ext,
              content: parsedPdf.text
            });
          } catch (pdfErr) {
            console.error(`Error al procesar PDF ${relativePath}:`, pdfErr);
          }
        }
      }

      cachedDocs = docs;
      lastLoadTime = Date.now();
      console.log('✅ Caché de conocimientos cargado con éxito. Total de documentos:', cachedDocs.length);
    }

    if (cachedDocs.length === 0) {
      return 'No hay documentos de conocimiento cargados aún.';
    }

    // Separate text/markdown base configurations from searchable PDFs
    const baseDocs = cachedDocs.filter(doc => doc.ext === '.txt' || doc.ext === '.md');
    const pdfDocs = cachedDocs.filter(doc => doc.ext === '.pdf');

    // Build baseline context (always included)
    let context = '';
    for (const doc of baseDocs) {
      context += `\n\n=== DOCUMENTO: ${doc.relativePath} ===\n${doc.content}\n=== FIN DE DOCUMENTO ===\n`;
    }

    // If no query is provided, return all documents (fallback)
    if (!query) {
      for (const doc of pdfDocs) {
        context += `\n\n=== DOCUMENTO PDF: ${doc.relativePath} ===\n${doc.content}\n=== FIN DE DOCUMENTO ===\n`;
      }
      return context;
    }

    // Normalize and extract keywords from the user query
    const cleanQuery = query.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9\s]/g, " "); // remove special characters
    
    const stopWords = new Set([
      "como", "hago", "un", "de", "en", "una", "y", "el", "la", "los", "las", 
      "para", "con", "del", "por", "que", "cual", "cuales", "son", "se", "mi", 
      "mis", "su", "sus", "hacer", "puedo", "donde", "quien", "si", "no", "o", "a", "al"
    ]);

    const keywords = cleanQuery.split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !stopWords.has(w));

    if (keywords.length === 0) {
      // If no valid keywords, return only base text documents
      return context;
    }

    // Rank PDF documents based on keyword occurrence
    const rankedPdfs = pdfDocs.map(doc => {
      let score = 0;
      const docPathLower = doc.relativePath.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const docContentLower = doc.content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      keywords.forEach(kw => {
        // High priority if keyword is in the file title/path
        if (docPathLower.includes(kw)) {
          score += 100;
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

    // Get the top 2 matching PDFs to keep prompt context highly optimized
    const selectedPdfs = rankedPdfs.slice(0, 2).map(item => item.doc);

    console.log(`🔍 Búsqueda de Contexto para: "${query}"`);
    console.log(`   Palabras clave: [${keywords.join(', ')}]`);
    console.log(`   PDFs seleccionados: ${selectedPdfs.map(d => d.relativePath).join(', ') || 'Ninguno'}`);

    for (const doc of selectedPdfs) {
      context += `\n\n=== DOCUMENTO PDF: ${doc.relativePath} ===\n${doc.content}\n=== FIN DE DOCUMENTO ===\n`;
    }

    return context;
  } catch (err) {
    console.error('Error al leer el conocimiento:', err);
    return 'Error al cargar los documentos de conocimiento.';
  }
}

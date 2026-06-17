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

let cachedContext = null;
let lastLoadTime = 0;

export async function getKnowledgeContext() {
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

    // If cache exists and no files have been modified since last load, return cache
    if (cachedContext && maxMtime <= lastLoadTime) {
      return cachedContext;
    }

    console.log('🔄 Reconstruyendo el caché de conocimientos (esto puede tardar unos segundos)...');
    let context = '';

    for (const filePath of allFiles) {
      const ext = path.extname(filePath).toLowerCase();
      const relativePath = path.relative(KNOWLEDGE_DIR, filePath);

      if (ext === '.txt' || ext === '.md') {
        const content = fs.readFileSync(filePath, 'utf-8');
        context += `\n\n=== DOCUMENTO: ${relativePath} ===\n${content}\n=== FIN DE DOCUMENTO ===\n`;
      } else if (ext === '.pdf') {
        try {
          const dataBuffer = fs.readFileSync(filePath);
          const uint8Array = new Uint8Array(dataBuffer);
          const parser = new PDFParse({ data: uint8Array });
          const parsedPdf = await parser.getText();
          context += `\n\n=== DOCUMENTO PDF: ${relativePath} ===\n${parsedPdf.text}\n=== FIN DE DOCUMENTO ===\n`;
        } catch (pdfErr) {
          console.error(`Error al procesar PDF ${relativePath}:`, pdfErr);
        }
      }
    }

    cachedContext = context || 'No hay documentos de conocimiento cargados aún.';
    lastLoadTime = Date.now();
    console.log('✅ Caché de conocimientos actualizado con éxito.');
    return cachedContext;
  } catch (err) {
    console.error('Error al leer el conocimiento:', err);
    return cachedContext || 'Error al cargar los documentos de conocimiento.';
  }
}

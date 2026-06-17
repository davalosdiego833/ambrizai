import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KNOWLEDGE_DIR = path.join(__dirname, 'data/knowledge');

function getAllFiles(dirPath, arrayOfFiles = []) {
  try {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
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

async function testAllFiles() {
  console.log('=== INICIANDO VALIDACIÓN DE ARCHIVOS DE CONOCIMIENTO ===');
  console.log(`Buscando en: ${KNOWLEDGE_DIR}\n`);

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.error(`❌ La carpeta de conocimientos no existe en: ${KNOWLEDGE_DIR}`);
    return;
  }

  const allFiles = getAllFiles(KNOWLEDGE_DIR);
  console.log(`Se encontraron ${allFiles.length} archivos para analizar.\n`);

  const results = [];

  for (const filePath of allFiles) {
    const ext = path.extname(filePath).toLowerCase();
    const relativePath = path.relative(KNOWLEDGE_DIR, filePath);
    const stats = fs.statSync(filePath);
    const sizeKb = (stats.size / 1024).toFixed(2);

    const fileResult = {
      path: relativePath,
      sizeKb,
      extension: ext,
      readable: false,
      charCount: 0,
      wordCount: 0,
      status: 'No procesado',
      error: null
    };

    if (stats.size === 0) {
      fileResult.status = '❌ Archivo vacío (0 bytes)';
      results.push(fileResult);
      continue;
    }

    if (ext === '.txt' || ext === '.md') {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        fileResult.readable = true;
        fileResult.charCount = content.length;
        fileResult.wordCount = content.trim().split(/\s+/).filter(Boolean).length;
        fileResult.status = fileResult.charCount > 10 ? '✅ Leído correctamente' : '⚠️ Archivo con muy poco contenido';
      } catch (err) {
        fileResult.status = '❌ Error de lectura de archivo';
        fileResult.error = err.message;
      }
    } else if (ext === '.pdf') {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const uint8Array = new Uint8Array(dataBuffer);
        const parser = new PDFParse({ data: uint8Array });
        const parsedPdf = await parser.getText();
        const text = parsedPdf.text || '';
        
        fileResult.readable = true;
        fileResult.charCount = text.length;
        
        const cleanText = text.trim();
        fileResult.wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;

        if (fileResult.charCount < 50) {
          // Likely scanned PDF or image-only PDF
          fileResult.status = '⚠️ PDF escaneado o sin texto seleccionable (imagen)';
        } else {
          fileResult.status = '✅ Leído correctamente';
        }
      } catch (err) {
        fileResult.status = '❌ Error al parsear PDF';
        fileResult.error = err.message;
      }
    } else {
      fileResult.status = 'ℹ️ Extensión no soportada (se omitirá)';
    }

    results.push(fileResult);
  }

  console.log('=== RESULTADOS DE LA VALIDACIÓN ===\n');
  
  const readSuccess = results.filter(r => r.status === '✅ Leído correctamente');
  const readWarnings = results.filter(r => r.status.startsWith('⚠️'));
  const readErrors = results.filter(r => r.status.startsWith('❌'));
  const unsupported = results.filter(r => r.status.startsWith('ℹ️'));

  console.log(`Leídos correctamente: ${readSuccess.length}`);
  console.log(`Con advertencias (ej. escaneados/imágenes/vacíos): ${readWarnings.length}`);
  console.log(`Con errores: ${readErrors.length}`);
  console.log(`No soportados: ${unsupported.length}\n`);

  console.log('--- DETALLE POR ARCHIVO ---');
  results.forEach(r => {
    console.log(`- [${r.status}] ${r.path} (${r.sizeKb} KB) - Caracteres: ${r.charCount}, Palabras: ${r.wordCount}`);
    if (r.error) {
      console.log(`    Detalle de error: ${r.error}`);
    }
  });

  // Write a JSON report file
  fs.writeFileSync(
    path.join(__dirname, 'data/knowledge_validation_report.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(`\nReporte guardado en data/knowledge_validation_report.json`);
}

testAllFiles().catch(console.error);

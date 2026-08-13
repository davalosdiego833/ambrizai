import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import { getKnowledgeContext } from './services/knowledge.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: true, // Permitir cualquier origen (https://ai.ambrizydavalos.com, localhost, etc.)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Determine static paths
const publicHtmlPath = path.join(__dirname, '../../public_html');
const clientDistPath = path.join(__dirname, '../client/dist');

// Serve static files from React build directory
if (fs.existsSync(publicHtmlPath) && fs.existsSync(path.join(publicHtmlPath, 'index.html'))) {
  app.use(express.static(publicHtmlPath));
} else {
  app.use(express.static(clientDistPath));
}

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Fallback to index.html for SPA routing (except for /api routes)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    const fallbackHtml = (fs.existsSync(publicHtmlPath) && fs.existsSync(path.join(publicHtmlPath, 'index.html')))
      ? path.join(publicHtmlPath, 'index.html')
      : path.join(clientDistPath, 'index.html');
    res.sendFile(fallbackHtml);
  } else {
    res.status(404).json({ message: 'Ruta de API no encontrada' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error interno del servidor', error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
  
  // Pre-cargar la base de conocimientos al iniciar el servidor
  console.log('⚡ Iniciando pre-carga de la base de conocimientos...');
  getKnowledgeContext()
    .then(() => {
      console.log('✅ Base de conocimientos pre-cargada con éxito.');
    })
    .catch((err) => {
      console.error('❌ Error al pre-cargar la base de conocimientos:', err);
    });
});

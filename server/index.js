import 'dotenv/config'; // Load .env first (local dev / server .env)
import './config.js'; // Then fill in safe non-secret defaults for whatever is still missing
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

// Last-resort safety net: log and keep running instead of letting one
// unexpected error (a bug we haven't found yet, a flaky write, whatever)
// crash the whole process. This is exactly the class of bug that took the
// app down repeatedly — a single broken request shouldn't cost service for
// every advisor using it. This never replaces fixing the actual bug once
// it shows up in the logs below; it just stops "one bad request" from
// becoming "everyone is locked out for hours."
process.on('uncaughtException', (err) => {
  console.error('❌ EXCEPCIÓN NO CAPTURADA (el servidor sigue corriendo, pero esto se debe investigar):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ PROMESA RECHAZADA SIN MANEJAR (el servidor sigue corriendo, pero esto se debe investigar):', reason);
});

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

// Health check for uptime monitors (UptimeRobot, etc.) — deliberately public
// and does nothing but confirm the Node process is alive and Express is
// routing requests, so a plain "expect 200" monitor works with no special
// configuration (no auth, no accepted-status-code tricks needed).
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

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

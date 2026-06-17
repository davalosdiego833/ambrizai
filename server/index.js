import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Allow React dev server ports
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets or simple welcome message
app.get('/', (req, res) => {
  res.json({ message: 'Ambriz AI API — Sistema de conocimiento administrativo para asesores SMNYL' });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error interno del servidor', error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
});

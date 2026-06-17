import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, '../data/users.json');

export default function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Acceso no autorizado: No se proporcionó token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ambriz_ai_jwt_secret_key_2026_super_secure');
    
    // Check if user is blocked in users.json
    if (fs.existsSync(USERS_FILE)) {
      try {
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
        const user = users.find(u => u.id === decoded.id);
        if (user && user.blocked) {
          return res.status(403).json({ message: 'Tu cuenta ha sido bloqueada por el administrador' });
        }
      } catch (err) {
        console.error('Error checking blocked status in middleware:', err);
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

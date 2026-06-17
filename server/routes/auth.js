import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import authMiddleware from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, '../data/users.json');

const router = express.Router();

// Helper to read users DB
const readUsersDB = () => {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading users DB:', err);
    return [];
  }
};

// Helper to write users DB
const writeUsersDB = (data) => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing users DB:', err);
  }
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'El correo y la contraseña son requeridos' });
  }

  try {
    const users = readUsersDB();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (user.blocked) {
      return res.status(403).json({ message: 'El usuario está bloqueado por el administrador' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'ambriz_ai_jwt_secret_key_2026_super_secure',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Admin User Management Routes (Master User Diego Ambriz)
// Check if role is 'Director'
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'Director') {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado: Se requiere rol de Director' });
  }
};

// List all users (for Admin)
router.get('/admin/users', authMiddleware, adminOnly, (req, res) => {
  const users = readUsersDB();
  // We return passwordPlain, email, name, role, blocked, id
  res.json(users);
});

// Create new user (for Admin)
router.post('/admin/users', authMiddleware, adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Todos los campos son requeridos' });
  }

  try {
    const users = readUsersDB();
    const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      id: `usr_${Date.now()}`,
      email: email.toLowerCase(),
      passwordHash,
      passwordPlain: password,
      name,
      role,
      blocked: false
    };

    users.push(newUser);
    writeUsersDB(users);

    res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      blocked: newUser.blocked
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
});

// Toggle block user (for Admin)
router.put('/admin/users/:id/block', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params;
  const { blocked } = req.body;

  if (blocked === undefined) {
    return res.status(400).json({ message: 'El estado de bloqueo es requerido' });
  }

  const users = readUsersDB();
  const userIndex = users.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  if (id === req.user.id) {
    return res.status(400).json({ message: 'No puedes bloquearte a ti mismo' });
  }

  users[userIndex].blocked = blocked;
  writeUsersDB(users);

  res.json({ success: true, message: blocked ? 'Usuario bloqueado' : 'Usuario desbloqueado' });
});

// Delete user (for Admin)
router.delete('/admin/users/:id', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params;

  const users = readUsersDB();
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  if (id === req.user.id) {
    return res.status(400).json({ message: 'No puedes eliminarte a ti mismo' });
  }

  const updatedUsers = users.filter((u) => u.id !== id);
  writeUsersDB(updatedUsers);

  res.json({ success: true, message: 'Usuario eliminado' });
});

export default router;

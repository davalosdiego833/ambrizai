import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import authMiddleware from '../middleware/auth.js';
import { streamChatResponse } from '../services/gemini.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHATS_FILE = path.join(__dirname, '../data/chats.json');
const FOLDERS_FILE = path.join(__dirname, '../data/folders.json');

// Ensure directory and files exist
if (!fs.existsSync(path.dirname(CHATS_FILE))) {
  fs.mkdirSync(path.dirname(CHATS_FILE), { recursive: true });
}
if (!fs.existsSync(CHATS_FILE)) {
  fs.writeFileSync(CHATS_FILE, JSON.stringify({}), 'utf-8');
}
if (!fs.existsSync(FOLDERS_FILE)) {
  fs.writeFileSync(FOLDERS_FILE, JSON.stringify({}), 'utf-8');
}

const router = express.Router();

// Helper to read chats database
const readChatsDB = () => {
  try {
    const data = fs.readFileSync(CHATS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading chats DB:', err);
    return {};
  }
};

// Helper to write chats database
const writeChatsDB = (data) => {
  try {
    fs.writeFileSync(CHATS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing chats DB:', err);
  }
};

// Helper to read folders database
const readFoldersDB = () => {
  try {
    const data = fs.readFileSync(FOLDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading folders DB:', err);
    return {};
  }
};

// Helper to write folders database
const writeFoldersDB = (data) => {
  try {
    fs.writeFileSync(FOLDERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing folders DB:', err);
  }
};

// Protect all chat routes
router.use(authMiddleware);

// ======================================
// FOLDER ROUTES
// ======================================

// Get all folders for current user
router.get('/folders', (req, res) => {
  const userId = req.user.id;
  const fDb = readFoldersDB();
  const userFolders = fDb[userId] || [];
  res.json(userFolders);
});

// Create folder
router.post('/folders', (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'El nombre de la carpeta es requerido' });
  }

  const fDb = readFoldersDB();
  if (!fDb[userId]) {
    fDb[userId] = [];
  }

  const newFolder = {
    id: `fold_${Date.now()}`,
    name,
    createdAt: new Date().toISOString()
  };

  fDb[userId].push(newFolder);
  writeFoldersDB(fDb);

  res.json(newFolder);
});

// Rename folder
router.put('/folders/:folderId', (req, res) => {
  const userId = req.user.id;
  const { folderId } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'El nombre de la carpeta es requerido' });
  }

  const fDb = readFoldersDB();
  const userFolders = fDb[userId] || [];
  const folder = userFolders.find(f => f.id === folderId);

  if (!folder) {
    return res.status(404).json({ message: 'Carpeta no encontrada' });
  }

  folder.name = name;
  writeFoldersDB(fDb);

  res.json(folder);
});

// Delete folder (desvincula los chats)
router.delete('/folders/:folderId', (req, res) => {
  const userId = req.user.id;
  const { folderId } = req.params;

  const fDb = readFoldersDB();
  if (!fDb[userId]) {
    return res.status(404).json({ message: 'Carpeta no encontrada' });
  }

  fDb[userId] = fDb[userId].filter(f => f.id !== folderId);
  writeFoldersDB(fDb);

  // Update chats to remove folderId link
  const cDb = readChatsDB();
  const userChats = cDb[userId] || [];
  userChats.forEach(c => {
    if (c.folderId === folderId) {
      c.folderId = null;
    }
  });
  writeChatsDB(cDb);

  res.json({ success: true, message: 'Carpeta eliminada y chats desvinculados' });
});

// ======================================
// CHAT ROUTES
// ======================================

// Get chat history for current user
router.get('/history', (req, res) => {
  const userId = req.user.id;
  const db = readChatsDB();
  const userChats = db[userId] || [];
  const { q } = req.query;

  let filteredChats = userChats;
  if (q) {
    const searchLower = q.toLowerCase();
    filteredChats = userChats.filter(c => {
      const titleMatch = c.title && c.title.toLowerCase().includes(searchLower);
      const messageMatch = c.messages && c.messages.some(m => m.text && m.text.toLowerCase().includes(searchLower));
      return titleMatch || messageMatch;
    });
  }
  
  // Return only metadata (no message content for listing) to save bandwidth
  const chatList = filteredChats.map((c) => ({
    id: c.id,
    title: c.title,
    folderId: c.folderId || null,
    createdAt: c.createdAt,
  }));

  res.json(chatList);
});

// Create new chat
router.post('/', (req, res) => {
  const userId = req.user.id;
  const { title, folderId } = req.body;
  const db = readChatsDB();

  if (!db[userId]) {
    db[userId] = [];
  }

  const newChat = {
    id: `chat_${Date.now()}`,
    title: title || 'Nuevo chat',
    folderId: folderId || null,
    messages: [],
    createdAt: new Date().toISOString(),
  };

  db[userId].unshift(newChat);
  writeChatsDB(db);

  res.json({
    id: newChat.id,
    title: newChat.title,
    folderId: newChat.folderId,
    createdAt: newChat.createdAt,
  });
});

// Move chat to folder
router.put('/:chatId/folder', (req, res) => {
  const userId = req.user.id;
  const { chatId } = req.params;
  const { folderId } = req.body;

  const db = readChatsDB();
  const userChats = db[userId] || [];
  const chat = userChats.find(c => c.id === chatId);

  if (!chat) {
    return res.status(404).json({ message: 'Chat no encontrado' });
  }

  chat.folderId = folderId || null;
  writeChatsDB(db);

  res.json({ success: true, folderId: chat.folderId });
});

// Rename chat
router.put('/:chatId/rename', (req, res) => {
  const userId = req.user.id;
  const { chatId } = req.params;
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'El título es requerido' });
  }

  const db = readChatsDB();
  const userChats = db[userId] || [];
  const chat = userChats.find(c => c.id === chatId);

  if (!chat) {
    return res.status(404).json({ message: 'Chat no encontrado' });
  }

  chat.title = title;
  writeChatsDB(db);

  res.json({ success: true, title: chat.title });
});

// Delete chat
router.delete('/:chatId', (req, res) => {
  const userId = req.user.id;
  const { chatId } = req.params;
  const db = readChatsDB();

  if (!db[userId]) {
    return res.status(404).json({ message: 'Chat no encontrado' });
  }

  db[userId] = db[userId].filter((c) => c.id !== chatId);
  writeChatsDB(db);

  res.json({ success: true, message: 'Chat eliminado' });
});

// Get messages for a specific chat
router.get('/:chatId/messages', (req, res) => {
  const userId = req.user.id;
  const { chatId } = req.params;
  const db = readChatsDB();
  
  const userChats = db[userId] || [];
  const chat = userChats.find((c) => c.id === chatId);

  if (!chat) {
    return res.status(404).json({ message: 'Chat no encontrado' });
  }

  res.json(chat.messages);
});

// Send message & stream response via Server-Sent Events (SSE)
router.post('/message', (req, res) => {
  const userId = req.user.id;
  const { chatId, text } = req.body;

  if (!chatId || !text) {
    return res.status(400).json({ message: 'Falta chatId o texto' });
  }

  const db = readChatsDB();
  const userChats = db[userId] || [];
  const chatIndex = userChats.findIndex((c) => c.id === chatId);

  if (chatIndex === -1) {
    return res.status(404).json({ message: 'Chat no encontrado' });
  }

  const chat = userChats[chatIndex];

  // 1. Save user message in database
  const userMessage = {
    id: `msg_u_${Date.now()}`,
    sender: 'user',
    text,
    timestamp: new Date().toISOString(),
  };
  chat.messages.push(userMessage);

  // If the chat had no messages, rename chat title to the user's first query
  if (chat.title === 'Nuevo chat' && chat.messages.length === 1) {
    chat.title = text.length > 30 ? `${text.slice(0, 30)}...` : text;
  }

  writeChatsDB(db);

  // 2. Set headers for Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let botMessageContent = '';
  
  // Callback when a chunk arrives
  const onChunk = (chunk) => {
    botMessageContent += chunk;
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
  };

  // Callback when streaming finishes
  const onDone = () => {
    // Save bot message to the persistent store
    const botMessage = {
      id: `msg_b_${Date.now()}`,
      sender: 'bot',
      text: botMessageContent,
      timestamp: new Date().toISOString(),
    };
    
    // Refresh DB instance to prevent race conditions during long-running streams
    const finalDb = readChatsDB();
    const finalChat = finalDb[userId]?.find((c) => c.id === chatId);
    if (finalChat) {
      finalChat.messages.push(botMessage);
      // Update title if needed
      if (finalChat.title === 'Nuevo chat' || finalChat.title === 'Nuevo chat...') {
        finalChat.title = text.length > 30 ? `${text.slice(0, 30)}...` : text;
      }
      writeChatsDB(finalDb);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  };

  // Callback on stream error
  const onError = (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message || 'Error en streaming' })}\n\n`);
    res.end();
  };

  // 3. Initiate stream
  // Pass the conversational history excluding the user's last message (since that is passed as userMessage)
  const conversationHistory = chat.messages.slice(0, -1);
  streamChatResponse(conversationHistory, text, onChunk, onDone, onError);
});

export default router;

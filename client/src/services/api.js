const API_URL = '/api';

// Helper to get auth header
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

const checkAuthResponse = (res) => {
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
    throw new Error('Sesión expirada. Redirigiendo a inicio de sesión...');
  }
  return res;
};

export const api = {
  async login(email, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Error al iniciar sesión');
    }
    
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  },

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  async getChats(q = '') {
    const url = q ? `${API_URL}/chat/history?q=${encodeURIComponent(q)}` : `${API_URL}/chat/history`;
    const res = await fetch(url, {
      headers: getHeaders(),
    });
    checkAuthResponse(res);
    if (!res.ok) throw new Error('Error al obtener chats');
    return res.json();
  },

  async createChat(title) {
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title }),
    });
    checkAuthResponse(res);
    if (!res.ok) throw new Error('Error al crear chat');
    return res.json();
  },

  async deleteChat(chatId) {
    const res = await fetch(`${API_URL}/chat/${chatId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    checkAuthResponse(res);
    if (!res.ok) throw new Error('Error al eliminar chat');
    return res.json();
  },

  async getChatMessages(chatId) {
    const res = await fetch(`${API_URL}/chat/${chatId}/messages`, {
      headers: getHeaders(),
    });
    checkAuthResponse(res);
    if (!res.ok) throw new Error('Error al obtener mensajes');
    return res.json();
  },

  // Streaming message request with mobile resilience
  async sendMessageStream(chatId, text, onChunk, onError, onDone, onSources, onFollowUps, onTextDone) {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ chatId, text }),
      });

      checkAuthResponse(res);

      if (!res.ok) {
        let errorMsg = 'Error al enviar mensaje';
        try {
          const errData = await res.json();
          errorMsg = errData.message || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      if (!res.body || !res.body.getReader) {
        // Fallback for browsers/WebViews without ReadableStream support
        const fullText = await res.text();
        const lines = fullText.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) onChunk(parsed.text);
              if (parsed.sources && onSources) onSources(parsed.sources);
              if (parsed.followUps && onFollowUps) onFollowUps(parsed.followUps);
              if (parsed.textDone && onTextDone) onTextDone();
            } catch (e) {}
          }
        }
        onDone();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let hasReceivedChunks = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process SSE format: "data: {...}\n\n"
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                onError(new Error(parsed.error));
                return;
              }
              if (parsed.text) {
                hasReceivedChunks = true;
                onChunk(parsed.text);
              }
              if (parsed.sources && onSources) onSources(parsed.sources);
              if (parsed.followUps && onFollowUps) onFollowUps(parsed.followUps);
              if (parsed.textDone && onTextDone) onTextDone();
            } catch (e) {
              console.error('Error parsing stream chunk:', e);
            }
          }
        }
      }

      // Flush decoder remaining bytes
      buffer += decoder.decode();

      // Check if there is remaining content in buffer
      if (buffer.trim().startsWith('data: ')) {
        const dataStr = buffer.trim().slice(6);
        if (dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              onError(new Error(parsed.error));
              return;
            }
            if (parsed.text) {
              hasReceivedChunks = true;
              onChunk(parsed.text);
            }
            if (parsed.sources && onSources) onSources(parsed.sources);
            if (parsed.followUps && onFollowUps) onFollowUps(parsed.followUps);
            if (parsed.textDone && onTextDone) onTextDone();
          } catch (e) {}
        }
      }

      onDone();
    } catch (err) {
      console.error('API sendMessageStream error:', err);
      onError(err);
    }
  },

  // Folder endpoints
  async getFolders() {
    const res = await fetch(`${API_URL}/chat/folders`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Error al obtener carpetas');
    return res.json();
  },

  async createFolder(name) {
    const res = await fetch(`${API_URL}/chat/folders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Error al crear carpeta');
    return res.json();
  },

  async renameFolder(folderId, name) {
    const res = await fetch(`${API_URL}/chat/folders/${folderId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Error al renombrar carpeta');
    return res.json();
  },

  async deleteFolder(folderId) {
    const res = await fetch(`${API_URL}/chat/folders/${folderId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Error al eliminar carpeta');
    return res.json();
  },

  async moveChatToFolder(chatId, folderId) {
    const res = await fetch(`${API_URL}/chat/${chatId}/folder`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ folderId }),
    });
    if (!res.ok) throw new Error('Error al mover chat de carpeta');
    return res.json();
  },

  async renameChat(chatId, title) {
    const res = await fetch(`${API_URL}/chat/${chatId}/rename`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('Error al renombrar chat');
    return res.json();
  },

  // Admin user management endpoints
  async adminGetUsers() {
    const res = await fetch(`${API_URL}/auth/admin/users`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Error al obtener lista de usuarios');
    return res.json();
  },

  async adminCreateUser(name, email, password, role) {
    const res = await fetch(`${API_URL}/auth/admin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, email, password, role }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al crear usuario');
    }
    return res.json();
  },

  async adminUpdateUser(userId, name, email, password, role) {
    const res = await fetch(`${API_URL}/auth/admin/users/${userId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name, email, password, role }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al actualizar usuario');
    }
    return res.json();
  },

  async adminToggleBlock(userId, blocked) {
    const res = await fetch(`${API_URL}/auth/admin/users/${userId}/block`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ blocked }),
    });
    if (!res.ok) throw new Error('Error al cambiar estado de bloqueo');
    return res.json();
  },

  async adminDeleteUser(userId) {
    const res = await fetch(`${API_URL}/auth/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Error al eliminar usuario');
    return res.json();
  }
};

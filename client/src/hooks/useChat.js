import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

export default function useChat(user) {
  const [chats, setChats] = useState([]);
  const [folders, setFolders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  const justCreatedChatRef = useRef(null);

  // Fetch chats on mount / user change / query change
  const fetchChats = useCallback(async (query = '') => {
    if (!user) return;
    try {
      const chatList = await api.getChats(query);
      setChats(chatList);
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  }, [user]);

  // Fetch folders on mount / user change
  const fetchFolders = useCallback(async () => {
    if (!user) return;
    try {
      const folderList = await api.getFolders();
      setFolders(folderList);
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchChats(searchQuery);
  }, [fetchChats, searchQuery]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Fetch messages when activeChatId changes
  useEffect(() => {
    if (activeChatId && activeChatId === justCreatedChatRef.current) {
      // Avoid fetching for a brand-new chat we just created,
      // as it will be populated by the sending action
      justCreatedChatRef.current = null;
      return;
    }

    const fetchMessages = async () => {
      if (!activeChatId) {
        setMessages([]);
        return;
      }
      setLoading(true);
      try {
        const msgList = await api.getChatMessages(activeChatId);
        setMessages(msgList);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [activeChatId]);

  const selectChat = (chatId) => {
    setActiveChatId(chatId);
  };

  const createNewChat = async (title = 'Nuevo chat') => {
    try {
      const newChat = await api.createChat(title);
      setChats((prev) => [newChat, ...prev]);
      justCreatedChatRef.current = newChat.id;
      setActiveChatId(newChat.id);
      return newChat;
    } catch (err) {
      console.error('Error creating chat:', err);
      throw err;
    }
  };

  const deleteChat = async (chatId) => {
    try {
      await api.deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error deleting chat:', err);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || sending) return;
    
    let currentChatId = activeChatId;
    setSending(true);

    try {
      // 1. If no active chat, create one first
      if (!currentChatId) {
        const title = text.length > 30 ? `${text.slice(0, 30)}...` : text;
        const newChat = await createNewChat(title);
        currentChatId = newChat.id;
      }

      // 2. Add user message locally
      const userMsg = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // 3. Add initial empty bot message for streaming
      const botMsgId = `bot-${Date.now()}`;
      const botMsg = {
        id: botMsgId,
        sender: 'bot',
        text: '',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);

      // 4. Send message and read stream
      let streamedText = '';
      await api.sendMessageStream(
        currentChatId,
        text,
        (chunk) => {
          streamedText += chunk;
          setMessages((prev) =>
            prev.map((msg) => (msg.id === botMsgId ? { ...msg, text: streamedText } : msg))
          );
        },
        (err) => {
          console.error('Streaming error:', err);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMsgId
                ? { ...msg, text: 'Lo siento, hubo un error al obtener la respuesta. Por favor intenta de nuevo.' }
                : msg
            )
          );
          setSending(false);
        },
        () => {
          setSending(false);
          // Refresh chat list to update titles if it was a new chat
          fetchChats(searchQuery);
        }
      );
    } catch (err) {
      console.error('Error in sendMessage:', err);
      setSending(false);
    }
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
  };

  const createFolder = async (name) => {
    try {
      const newFolder = await api.createFolder(name);
      setFolders((prev) => [...prev, newFolder]);
      return newFolder;
    } catch (err) {
      console.error('Error creating folder:', err);
      throw err;
    }
  };

  const renameFolder = async (folderId, name) => {
    try {
      const updated = await api.renameFolder(folderId, name);
      setFolders((prev) => prev.map((f) => (f.id === folderId ? updated : f)));
      return updated;
    } catch (err) {
      console.error('Error renaming folder:', err);
      throw err;
    }
  };

  const deleteFolder = async (folderId) => {
    try {
      await api.deleteFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setChats((prev) => prev.map((c) => (c.folderId === folderId ? { ...c, folderId: null } : c)));
    } catch (err) {
      console.error('Error deleting folder:', err);
      throw err;
    }
  };

  const moveChatToFolder = async (chatId, folderId) => {
    try {
      await api.moveChatToFolder(chatId, folderId);
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, folderId: folderId || null } : c)));
    } catch (err) {
      console.error('Error moving chat to folder:', err);
      throw err;
    }
  };

  const renameChat = async (chatId, title) => {
    try {
      await api.renameChat(chatId, title);
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)));
    } catch (err) {
      console.error('Error renaming chat:', err);
      throw err;
    }
  };

  return {
    chats,
    folders,
    searchQuery,
    setSearchQuery,
    activeChatId,
    messages,
    loading,
    sending,
    selectChat,
    createNewChat,
    deleteChat,
    sendMessage,
    handleNewChat,
    createFolder,
    renameFolder,
    deleteFolder,
    moveChatToFolder,
    renameChat,
  };
}

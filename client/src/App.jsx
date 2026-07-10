import { useState } from 'react';
import useAuth from './hooks/useAuth';
import useChat from './hooks/useChat';
import AnimatedBackground from './components/Layout/AnimatedBackground';
import Sidebar from './components/Sidebar/Sidebar';
import Header from './components/Layout/Header';
import ChatWindow from './components/Chat/ChatWindow';
import ChatInput from './components/Chat/ChatInput';
import Login from './components/Auth/Login';

export default function App() {
  const { user, loading: authLoading, login, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const {
    chats,
    folders,
    searchQuery,
    setSearchQuery,
    activeChatId,
    messages,
    loading: chatLoading,
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
  } = useChat(user);

  if (authLoading) {
    return (
      <div className="login-screen">
        <AnimatedBackground />
        <div style={{ zIndex: 1, textAlign: 'center' }}>
          <div className="typing-indicator" style={{ display: 'inline-flex', gap: 6 }}>
            <div className="typing-dot" style={{ width: 12, height: 12 }}></div>
            <div className="typing-dot" style={{ width: 12, height: 12 }}></div>
            <div className="typing-dot" style={{ width: 12, height: 12 }}></div>
          </div>
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Cargando portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  return (
    <>
      <AnimatedBackground />
      <div className="app-layout">
        <Sidebar
          chats={chats}
          folders={folders}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeChatId={activeChatId}
          onSelectChat={(chatId) => {
            selectChat(chatId);
            setSidebarOpen(false);
          }}
          onNewChat={() => {
            handleNewChat();
            setSidebarOpen(false);
          }}
          onDeleteChat={deleteChat}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onMoveChatToFolder={moveChatToFolder}
          onRenameChat={renameChat}
          user={user}
          onLogout={logout}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
        />
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
        <div className="main-content">
          <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <ChatWindow
            messages={messages}
            isLoading={sending}
            onQuickAction={sendMessage}
          />
          <ChatInput
            onSendMessage={sendMessage}
            disabled={sending}
          />
        </div>
      </div>
    </>
  );
}

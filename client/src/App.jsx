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
          onSelectChat={selectChat}
          onNewChat={handleNewChat}
          onDeleteChat={deleteChat}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onMoveChatToFolder={moveChatToFolder}
          onRenameChat={renameChat}
          user={user}
          onLogout={logout}
        />
        <div className="main-content">
          <Header />
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

import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';

export default function Sidebar({
  chats,
  folders,
  searchQuery,
  onSearchChange,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveChatToFolder,
  onRenameChat,
  user,
  onLogout,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Renaming folders
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // Renaming chats
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');

  // Moving chats
  const [movingChatId, setMovingChatId] = useState(null);
  const movePopoverRef = useRef(null);

  // Admin Modal
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Close move popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (movePopoverRef.current && !movePopoverRef.current.contains(event.target)) {
        setMovingChatId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFolderCollapse = (folderId) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleCreateFolderSubmit = async (e) => {
    if (e.key === 'Enter') {
      if (!newFolderName.trim()) return;
      try {
        await onCreateFolder(newFolderName.trim());
        setNewFolderName('');
        setShowFolderInput(false);
      } catch (err) {
        alert('Error al crear la carpeta');
      }
    } else if (e.key === 'Escape') {
      setShowFolderInput(false);
      setNewFolderName('');
    }
  };

  const startRenameFolder = (folder, e) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleRenameFolderSubmit = async (folderId, e) => {
    if (e.key === 'Enter') {
      if (!editingFolderName.trim()) return;
      try {
        await onRenameFolder(folderId, editingFolderName.trim());
        setEditingFolderId(null);
      } catch (err) {
        alert('Error al renombrar la carpeta');
      }
    } else if (e.key === 'Escape') {
      setEditingFolderId(null);
    }
  };

  const startRenameChat = (chat, e) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingChatTitle(chat.title);
  };

  const handleRenameChatSubmit = async (chatId, e) => {
    if (e.key === 'Enter') {
      if (!editingChatTitle.trim()) return;
      try {
        await onRenameChat(chatId, editingChatTitle.trim());
        setEditingChatId(null);
      } catch (err) {
        alert('Error al renombrar el chat');
      }
    } else if (e.key === 'Escape') {
      setEditingChatId(null);
    }
  };

  // Group chats by folder
  const chatsByFolder = folders.reduce((acc, folder) => {
    acc[folder.id] = chats.filter((c) => c.folderId === folder.id);
    return acc;
  }, {});

  const unassignedChats = chats.filter((c) => !c.folderId);

  return (
    <>
      <aside className="sidebar">
        {/* Header with Search Toggle */}
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-glow"></div>
            <div className="logo-icon logo-sm">A</div>
          </div>
          <div className="logo-text">
            <h1 className="gradient-text">Ambriz AI</h1>
            <span>Asistente SMNYL</span>
          </div>

          <button
            className="sidebar-search-btn"
            onClick={() => setSearchOpen(!searchOpen)}
            title="Buscar conversaciones"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </div>

        {/* Search input field */}
        {searchOpen && (
          <div className="sidebar-search-container">
            <input
              type="text"
              className="sidebar-search-input"
              placeholder="Buscar chats o mensajes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* New Chat Button */}
        <button className="new-chat-btn" onClick={onNewChat}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Nuevo chat</span>
        </button>

        {/* Folder List / Hierarchy */}
        <div className="chat-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          {/* Folders Section */}
          <div className="folders-section">
            <div className="folders-header">
              <span className="folders-title">Carpetas</span>
              <button
                className="create-folder-btn"
                onClick={() => setShowFolderInput(true)}
                title="Nueva carpeta"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  <line x1="12" y1="11" x2="12" y2="17"></line>
                  <line x1="9" y1="14" x2="15" y2="14"></line>
                </svg>
              </button>
            </div>

            {showFolderInput && (
              <div style={{ padding: '0 10px 8px' }}>
                <input
                  type="text"
                  className="sidebar-search-input"
                  placeholder="Nombre y Enter..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={handleCreateFolderSubmit}
                  autoFocus
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {folders.map((folder) => {
                const folderChats = chatsByFolder[folder.id] || [];
                const isCollapsed = collapsedFolders[folder.id];

                return (
                  <div key={folder.id} className="folder-item">
                    <div
                      className="folder-header"
                      onClick={() => toggleFolderCollapse(folder.id)}
                    >
                      {/* Chevron icon */}
                      <span style={{ marginRight: 6, display: 'flex', alignItems: 'center' }}>
                        {isCollapsed ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        )}
                      </span>

                      {/* Folder SVG icon */}
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </span>

                      {editingFolderId === folder.id ? (
                        <input
                          type="text"
                          className="inline-edit-input"
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => handleRenameFolderSubmit(folder.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => setEditingFolderId(null)}
                          autoFocus
                        />
                      ) : (
                        <span className="folder-title-text">{folder.name}</span>
                      )}

                      {/* Folder hover actions */}
                      <div className="folder-actions">
                        <button
                          className="folder-action-btn"
                          onClick={(e) => startRenameFolder(folder, e)}
                          title="Renombrar carpeta"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
                          </svg>
                        </button>
                        <button
                          className="folder-action-btn delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`¿Seguro que deseas eliminar la carpeta "${folder.name}"? Los chats no se eliminarán.`)) {
                              onDeleteFolder(folder.id);
                            }
                          }}
                          title="Eliminar carpeta"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Chats in Folder */}
                    {!isCollapsed && (
                      <div className="folder-chats-container">
                        {folderChats.length === 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '6px 12px' }}>
                            Carpeta vacía
                          </span>
                        )}
                        {folderChats.map((chat) => (
                          <div
                            key={chat.id}
                            className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                            onClick={() => onSelectChat(chat.id)}
                          >
                            <span className="chat-item-icon">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                              </svg>
                            </span>

                            {editingChatId === chat.id ? (
                              <input
                                type="text"
                                className="inline-edit-input"
                                value={editingChatTitle}
                                onChange={(e) => setEditingChatTitle(e.target.value)}
                                onKeyDown={(e) => handleRenameChatSubmit(chat.id, e)}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={() => setEditingChatId(null)}
                                autoFocus
                              />
                            ) : (
                              <span className="chat-item-text">{chat.title}</span>
                            )}

                            {/* Chat option controls */}
                            <div className="chat-item-actions">
                              <button
                                className="chat-action-btn"
                                onClick={(e) => startRenameChat(chat, e)}
                                title="Renombrar chat"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
                                </svg>
                              </button>
                              <button
                                className="chat-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMovingChatId(chat.id);
                                }}
                                title="Mover a carpeta"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M10 18l6-6-6-6"></path>
                                  <path d="M16 12H3"></path>
                                </svg>
                              </button>
                              <button
                                className="chat-action-btn delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('¿Seguro que deseas eliminar esta conversación?')) {
                                    onDeleteChat(chat.id);
                                  }
                                }}
                                title="Eliminar chat"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </button>
                            </div>

                            {/* Move to Folder Popover */}
                            {movingChatId === chat.id && (
                              <div
                                className="move-popover"
                                ref={movePopoverRef}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="move-popover-title">Mover a...</div>
                                <div
                                  className="move-option"
                                  onClick={() => {
                                    onMoveChatToFolder(chat.id, null);
                                    setMovingChatId(null);
                                  }}
                                >
                                  (Sin carpeta)
                                </div>
                                {folders.map((f) => (
                                  <div
                                    key={f.id}
                                    className="move-option"
                                    onClick={() => {
                                      onMoveChatToFolder(chat.id, f.id);
                                      setMovingChatId(null);
                                    }}
                                  >
                                    {f.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unassigned Chats (Recientes / Libres) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="sidebar-section-title" style={{ paddingLeft: 12 }}>
              Conversaciones Libres
            </span>
            {unassignedChats.length === 0 && (
              <p style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                No hay chats independientes
              </p>
            )}
            {unassignedChats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                onClick={() => onSelectChat(chat.id)}
              >
                <span className="chat-item-icon">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </span>

                {editingChatId === chat.id ? (
                  <input
                    type="text"
                    className="inline-edit-input"
                    value={editingChatTitle}
                    onChange={(e) => setEditingChatTitle(e.target.value)}
                    onKeyDown={(e) => handleRenameChatSubmit(chat.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => setEditingChatId(null)}
                    autoFocus
                  />
                ) : (
                  <span className="chat-item-text">{chat.title}</span>
                )}

                {/* Chat option controls */}
                <div className="chat-item-actions">
                  <button
                    className="chat-action-btn"
                    onClick={(e) => startRenameChat(chat, e)}
                    title="Renombrar chat"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
                    </svg>
                  </button>
                  <button
                    className="chat-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMovingChatId(chat.id);
                    }}
                    title="Mover a carpeta"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 18l6-6-6-6"></path>
                      <path d="M16 12H3"></path>
                    </svg>
                  </button>
                  <button
                    className="chat-action-btn delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('¿Seguro que deseas eliminar esta conversación?')) {
                        onDeleteChat(chat.id);
                      }
                    }}
                    title="Eliminar chat"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>

                {/* Move to Folder Popover */}
                {movingChatId === chat.id && (
                  <div
                    className="move-popover"
                    ref={movePopoverRef}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="move-popover-title">Mover a...</div>
                    <div
                      className="move-option"
                      onClick={() => {
                        onMoveChatToFolder(chat.id, null);
                        setMovingChatId(null);
                      }}
                    >
                      (Sin carpeta)
                    </div>
                    {folders.map((f) => (
                      <div
                        key={f.id}
                        className="move-option"
                        onClick={() => {
                          onMoveChatToFolder(chat.id, f.id);
                          setMovingChatId(null);
                        }}
                      >
                        {f.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* User Card with Admin Toggle */}
        <div className="sidebar-user">
          <div className="user-avatar">{user?.name?.[0] || 'U'}</div>
          <div className="user-info">
            <div className="user-name">{user?.name || 'Usuario'}</div>
            <div className="user-role">{user?.role || 'Asesor'}</div>
          </div>

          {/* Admin Shield Button for Maestro User */}
          {user?.role === 'Director' && (
            <button
              className="admin-sidebar-btn"
              onClick={() => setShowAdminModal(true)}
              title="Panel de Administración"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
          )}

          <button className="logout-btn" onClick={onLogout} title="Cerrar sesión">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </aside>

      {/* Admin Panel Modal */}
      {showAdminModal && (
        <AdminModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} />
      )}
    </>
  );
}

// Private AdminModal Component
function AdminModal({ isOpen, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminSearch, setAdminSearch] = useState('');
  
  // Create / Edit user form state
  const [editingUserId, setEditingUserId] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Asesor');

  // Password visibility map
  const [revealPasswords, setRevealPasswords] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersList = await api.adminGetUsers();
      setUsers(usersList);
      setErrorMessage('');
    } catch (err) {
      console.error(err);
      setErrorMessage('Error al cargar la lista de usuarios. Asegúrate de tener permisos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (!name || !email || !password || !role) {
      setErrorMessage('Todos los campos son requeridos');
      return;
    }
    try {
      if (editingUserId) {
        await api.adminUpdateUser(editingUserId, name, email, password, role);
        setSuccessMessage('Usuario actualizado exitosamente');
        setEditingUserId(null);
      } else {
        await api.adminCreateUser(name, email, password, role);
        setSuccessMessage('Usuario creado exitosamente');
      }
      setName('');
      setEmail('');
      setPassword('');
      setRole('Asesor');
      fetchUsers();
    } catch (err) {
      setErrorMessage(err.message || 'Error al procesar la solicitud');
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('Asesor');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleToggleBlock = async (userId, currentlyBlocked) => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await api.adminToggleBlock(userId, !currentlyBlocked);
      setSuccessMessage(`Usuario ${currentlyBlocked ? 'desbloqueado' : 'bloqueado'} con éxito`);
      fetchUsers();
    } catch (err) {
      setErrorMessage(err.message || 'Error al cambiar estado de bloqueo');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${userName}"?`)) {
      return;
    }
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await api.adminDeleteUser(userId);
      setSuccessMessage('Usuario eliminado permanentemente');
      fetchUsers();
    } catch (err) {
      setErrorMessage(err.message || 'Error al eliminar usuario');
    }
  };

  const togglePasswordReveal = (userId) => {
    setRevealPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const filteredUsers = users.filter((u) => {
    const q = adminSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Panel de Administración - Ambriz AI</h2>
          <button className="admin-close-btn" onClick={onClose} title="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="admin-modal-content">
          {errorMessage && (
            <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: 8, fontSize: 13, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div style={{ padding: 12, background: 'rgba(22, 163, 74, 0.1)', color: 'var(--text-success)', borderRadius: 8, fontSize: 13, border: '1px solid rgba(22, 163, 74, 0.2)' }}>
              {successMessage}
            </div>
          )}

          <div className="admin-grid-layout">
            
            {/* User Database Section */}
            <div className="admin-card">
              <h3 className="admin-card-title">Base de Datos de Usuarios</h3>
              
              <input
                type="text"
                className="user-search-input"
                placeholder="Buscar por nombre o correo..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
              />

              <div className="user-list-wrapper">
                {loading ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Cargando usuarios...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No se encontraron usuarios
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const revealPass = revealPasswords[u.id];
                    return (
                      <div key={u.id} className="user-item-row">
                        <div className="user-row-info">
                          <span className="user-row-name">
                            {u.name}
                            <span className={`user-role-badge ${u.role === 'Director' ? 'director' : ''}`}>
                              {u.role}
                            </span>
                            {u.blocked && (
                              <span className="user-blocked-badge">Bloqueado</span>
                            )}
                          </span>
                          <span className="user-row-email">{u.email}</span>
                          <span className="user-row-password">
                            Contraseña:{' '}
                            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                              {revealPass ? u.passwordPlain : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordReveal(u.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center', color: 'var(--text-secondary)' }}
                              title={revealPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                            >
                              {revealPass ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                  <line x1="1" y1="1" x2="23" y2="23"></line>
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                  <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                              )}
                            </button>
                          </span>
                        </div>

                        <div className="user-row-actions">
                          {/* Edit user details */}
                          <button
                            className="admin-btn edit-btn"
                            onClick={() => {
                              setEditingUserId(u.id);
                              setName(u.name);
                              setEmail(u.email);
                              setPassword(u.passwordPlain || '');
                              setRole(u.role);
                              setErrorMessage('');
                              setSuccessMessage('');
                            }}
                            title="Editar datos del usuario"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
                            </svg>
                          </button>

                          {/* Block/Unblock toggle */}
                          <button
                            className={`admin-btn ${u.blocked ? 'block-btn' : 'unblock-btn'}`}
                            onClick={() => handleToggleBlock(u.id, u.blocked)}
                            title={u.blocked ? 'Desbloquear usuario' : 'Bloquear usuario'}
                          >
                            {u.blocked ? (
                              // Unblock icon
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                              </svg>
                            ) : (
                              // Block icon
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                              </svg>
                            )}
                          </button>

                          {/* Delete user */}
                          <button
                            className="admin-btn delete-btn"
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            title="Eliminar usuario permanentemente"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Create New User Section */}
            <div className="admin-card">
              <h3 className="admin-card-title">{editingUserId ? 'Editar Datos de Usuario' : 'Añadir Nuevo Usuario'}</h3>
              
              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Nombre Completo</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder="Ej. Juan Pérez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Correo Electrónico</label>
                  <input
                    type="email"
                    className="admin-form-input"
                    placeholder="correo@ambriz.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Contraseña</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder="Contraseña inicial"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Rol del Sistema</label>
                  <select
                    className="admin-form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="Asesor">Asesor</option>
                    <option value="Director">Director</option>
                  </select>
                </div>

                <button type="submit" className="admin-submit-btn">
                  {editingUserId ? 'Actualizar Cuenta' : 'Crear Cuenta de Usuario'}
                </button>
                {editingUserId && (
                  <button
                    type="button"
                    className="admin-submit-btn"
                    onClick={handleCancelEdit}
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                  >
                    Cancelar Edición
                  </button>
                )}
              </form>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

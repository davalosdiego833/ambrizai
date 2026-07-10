export default function Header({ onToggleSidebar }) {
  return (
    <div className="header">
      <div className="header-left">
        <button className="menu-btn" onClick={onToggleSidebar} title="Menu" aria-label="Abrir panel de chats">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <span className="header-title">Chat actual</span>
        <div className="model-badge">
          <span className="dot"></span>
          Ambriz AI v1.0
        </div>
      </div>
    </div>
  );
}

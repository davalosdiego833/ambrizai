export default function TypingIndicator() {
  return (
    <div className="message bot">
      <div className="message-avatar bot">A</div>
      <div className="message-content" style={{ padding: '8px 12px' }}>
        <div className="typing-indicator">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
        </div>
      </div>
    </div>
  );
}

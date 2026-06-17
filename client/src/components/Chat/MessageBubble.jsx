import { useState } from 'react';

export default function MessageBubble({ message }) {
  const { sender, text, timestamp } = message;
  const isBot = sender === 'bot';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple formatter to convert markdown-like syntax to HTML/React
  const formatText = (rawText) => {
    if (!rawText) return '';
    
    const lines = rawText.split('\n');
    let inList = false;
    let listItems = [];
    const formattedElements = [];

    lines.forEach((line, index) => {
      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        if (!inList) {
          inList = true;
          listItems = [];
        }
        // Extract content and handle bold text
        const content = line.trim().substring(2);
        listItems.push(parseInlineFormatting(content, `li-${index}`));
        return;
      }

      // If we were in a list and now we are not, close the list
      if (inList && !line.trim().startsWith('- ') && !line.trim().startsWith('* ')) {
        inList = false;
        formattedElements.push(
          <ul key={`list-${index}`}>
            {listItems.map((item, idx) => <li key={idx}>{item}</li>)}
          </ul>
        );
      }

      // Heading or bold subheadings (e.g. ### Title)
      if (line.trim().startsWith('### ')) {
        formattedElements.push(
          <h4 key={`h-${index}`} style={{ margin: '12px 0 6px 0', color: 'var(--text-accent)' }}>
            {parseInlineFormatting(line.trim().substring(4), `h-${index}`)}
          </h4>
        );
        return;
      }

      // Empty line
      if (line.trim() === '') {
        return;
      }

      // Normal paragraph
      formattedElements.push(
        <p key={`p-${index}`}>
          {parseInlineFormatting(line, `p-${index}`)}
        </p>
      );
    });

    // Handle case where file ends with active list
    if (inList) {
      formattedElements.push(
        <ul key="list-end">
          {listItems.map((item, idx) => <li key={idx}>{item}</li>)}
        </ul>
      );
    }

    return formattedElements;
  };

  const parseInlineFormatting = (inlineText, baseKey) => {
    // Regex for bold text: **text**
    const parts = inlineText.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${baseKey}-${index}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={`${baseKey}-${index}`} className="inline-code">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className={`message ${isBot ? 'bot' : 'user'}`}>
      <div className={`message-avatar ${isBot ? 'bot' : 'user'}`}>
        {isBot ? 'A' : 'U'}
      </div>
      
      <div className="message-content">
        <div className="message-text-wrapper">
          {formatText(text)}
        </div>
        
        {isBot && text && (
          <div className="message-actions">
            <button className="action-btn" onClick={handleCopy} title="Copiar respuesta">
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-success)' }}>
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

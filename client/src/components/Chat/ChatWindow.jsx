import { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import WelcomeScreen from './WelcomeScreen';
import TypingIndicator from './TypingIndicator';

export default function ChatWindow({ messages, isLoading, onQuickAction }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom when messages change or loading state changes
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="chat-area">
      {messages.length === 0 ? (
        <WelcomeScreen onQuickAction={onQuickAction} />
      ) : (
        messages.map((msg) => {
          if (msg.sender === 'bot' && !msg.text) return null;
          return <MessageBubble key={msg.id} message={msg} />;
        })
      )}
      
      {isLoading && <TypingIndicator />}
      
      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
}

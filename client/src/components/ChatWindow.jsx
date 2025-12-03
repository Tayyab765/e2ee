import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

export default function ChatWindow({ messages, meId, typing }) {
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      <div ref={listRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-0.5 scroll-smooth">
        {messages.map(m => (
          <MessageBubble key={m.id || m.timestamp} message={m} isOwn={m.senderId === meId} />
        ))}
        {typing ? <TypingIndicator /> : null}
      </div>
    </div>
  );
}

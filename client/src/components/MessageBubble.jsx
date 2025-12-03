import React from 'react';

export default function MessageBubble({ message, isOwn }) {
  const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const base = 'inline-block max-w-[70%] rounded-[20px] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words shadow-sm';
  const own = 'bg-purple-600 text-white rounded-br-md';
  const other = 'bg-white text-gray-800 border border-gray-200 rounded-bl-md';
  
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`${base} ${isOwn ? own : other}`}>
        {message.type === 'file' ? (
          <div>
            <div className="font-semibold">Encrypted file</div>
            <div className="text-xs opacity-80">Attachment placeholder (encrypted)</div>
          </div>
        ) : (
          <div>{message.text}</div>
        )}
      </div>
    </div>
  );
}

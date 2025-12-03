import React from 'react';

export default function TypingIndicator() {
  return (
    <div className="flex items-center space-x-1 px-3 py-1 text-xs text-gray-600">
      <span className="animate-bounce">•</span>
      <span className="animate-bounce [animation-delay:100ms]">•</span>
      <span className="animate-bounce [animation-delay:200ms]">•</span>
      <span>typing…</span>
    </div>
  );
}

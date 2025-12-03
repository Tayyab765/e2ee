import React from 'react';
import Avatar from './Avatar';

export default function ContactList({ contacts, activeId, onSelect }) {
  return (
    <div className="h-full overflow-y-auto divide-y divide-gray-200">
      {contacts.map(c => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          className={`w-full flex items-center space-x-3 px-3 py-3 text-left hover:bg-gray-50 ${activeId === c.id ? 'bg-gray-100' : ''}`}
        >
          <Avatar name={c.name} online={c.online} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900">{c.name}</span>
              {c.lastMessage && (
                <span className="text-xs text-gray-500">{new Date(c.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {c.lastMessage ? (c.lastMessage.type === 'file' ? 'Encrypted file' : c.lastMessage.text) : 'No messages yet'}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

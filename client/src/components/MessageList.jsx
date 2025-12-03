import React from 'react';

export default function MessageList({ items }) {
  return (
    <div style={{ border: '1px solid #ddd', padding: 8, height: 240, overflowY: 'auto' }}>
      {items.map((m, i) => (
        <div key={i}>
          <small>{new Date(m.ts).toLocaleTimeString()} [{m.from}]</small>
          <div>{m.text}</div>
        </div>
      ))}
    </div>
  );
}

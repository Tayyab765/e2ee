import React, { useState } from 'react';

export default function Composer({ onSend }) {
  const [text, setText] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder='Type a message' />
      <button onClick={() => { onSend(text); setText(''); }}>Send</button>
    </div>
  );
}

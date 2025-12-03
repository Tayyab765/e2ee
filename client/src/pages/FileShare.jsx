import React, { useState } from 'react';
import { hkdf, randBytes, aesGcmEncrypt, b64 } from '../crypto/webcrypto.js';

export default function FileShare({ http, socket, sessionKey, meId, peerId }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploadedId, setUploadedId] = useState('');

  async function encryptAndUpload() {
    if (!file) return;
    setBusy(true); setUploadedId('');
    try {
      console.log('[file] encrypt+upload start', { name: file.name, size: file.size, type: file.type });
      const chunkSize = 64 * 1024;
      const buf = await file.arrayBuffer();
      const fileNonce = randBytes(16);
      const fileKey = await hkdf(sessionKey, fileNonce, new TextEncoder().encode('e2eeV1-file'), 32);
      const chunks = [];
      for (let off = 0, idx = 0; off < buf.byteLength; off += chunkSize, idx++) {
        const part = buf.slice(off, Math.min(off + chunkSize, buf.byteLength));
        const iv = randBytes(12);
        const total = Math.ceil(buf.byteLength / chunkSize);
        const aad = new TextEncoder().encode(JSON.stringify({ meId, peerId, idx, total }));
        const ct = await aesGcmEncrypt(fileKey, iv, part, aad);
        chunks.push({ index: idx, iv: b64(iv), ciphertext: b64(ct) });
        if (idx % 50 === 0) console.log('[file] encrypted chunk', idx, '/', total);
      }
      const payload = { sessionId: `${meId}:${peerId}`, receiverId: peerId, fileName: file.name, fileSize: file.size, mimeType: file.type, fileNonce: b64(fileNonce), chunks };
      const res = await http.post('/files/json', payload);
      console.log('[file] upload complete, fileId', res.data.fileId);
      setUploadedId(res.data.fileId);
      try {
        if (socket && res.data.fileId) {
          console.log('[file] notifying peer via socket', { to: peerId, fileId: res.data.fileId });
          socket.emit('file:send', { toUserId: peerId, fileId: res.data.fileId, meta: { name: file.name, size: file.size, type: file.type } });
        } else {
          console.warn('[file] socket not available, peer not notified');
        }
      } catch (e) {
        console.warn('[file] socket notify failed', e);
      }
    } catch (e) {
      console.error('[file] upload failed', e);
      alert('Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: '1px solid #eee', marginTop: 16, paddingTop: 8 }}>
      <h4>Encrypted File Share</h4>
      <input type='file' onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button disabled={!file || busy} onClick={encryptAndUpload}>Encrypt + Upload</button>
      {uploadedId && <div>Uploaded fileId: {uploadedId}</div>}
    </div>
  );
}

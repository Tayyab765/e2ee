import React, { useEffect, useMemo, useRef, useState } from 'react';
import io from 'socket.io-client';
import { api } from '../api/http.js';
import Composer from '../components/Composer.jsx';
import MessageList from '../components/MessageList.jsx';
import FileShare from './FileShare.jsx';
import { genEphemeralECDH, exportPublicJwk, importPublicJwkECDSA, importPublicJwkECDH, deriveSessionBits, hkdf, aesGcmEncrypt, aesGcmDecrypt, randBytes, utf8, b64, ub64 } from '../crypto/webcrypto.js';
import { savePrivateKey, loadPrivateKey, loadPublicKey } from '../crypto/keystore.js';
import ModernChatLayout from '../components/ModernChatLayout.jsx';
import '../index.css';

export default function Chat({ session, onLogout }) {
  const [peerName, setPeerName] = useState('');
  const [peerInfo, setPeerInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sess, setSess] = useState(null); // { key, seq, peerId }
  const [handshakeStatus, setHandshakeStatus] = useState('idle'); // idle | initiating | waiting | confirmed | error
  const [handshakeError, setHandshakeError] = useState('');

  const http = useMemo(() => api(session.token), [session.token]);
  const socket = useMemo(() => {
    console.log('[socket] creating socket for user', session.user.id);
    return io('https://localhost:4000', {
      auth: { userId: session.user.id },
      secure: true,
      rejectUnauthorized: false
    });
  }, [session.user.id]);
  const kex = useRef(new Map()); // peerId -> { confirmKey, transcript, sessionKey }
  const kexTimer = useRef(null);
  const replay = useRef(new Map()); // peerId -> { lastSeq: 0, lastTs: 0, seen: Set<number> }

  useEffect(() => {
    function onConnect() {
      console.log('[socket] connected, id=', socket.id);
    }
    function onConnectError(err) {
      console.error('[socket] connect_error', err);
    }
    function onDisconnect(reason) {
      console.log('[socket] disconnected:', reason);
    }
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [socket]);

  async function lookupPeer() {
    console.log('[kex] looking up peer', peerName);
    const res = await http.get(`/keys/lookup/${encodeURIComponent(peerName)}`);
    console.log('[kex] lookup result', res.data);
    setPeerInfo(res.data);
  }

  async function startHandshake() {
    console.log('[kex] starting handshake with', peerInfo);
    setHandshakeStatus('initiating');
    setHandshakeError('');
    console.log('[kex] startHandshake');
    const meId = session.user.id;
    console.log('[kex] meId:', meId);
    if (!peerInfo) { console.warn('[kex] no peer selected'); setHandshakeStatus('error'); setHandshakeError('No peer selected'); return; }
    console.log('[kex] peerInfo:', peerInfo);
    const peerId = peerInfo.userId;

    console.log('[kex] startHandshake ->', { meId, peerId });
    const identityPriv = await loadPrivateKey('identity:priv', { name: 'ECDSA', namedCurve: 'P-256' });
    const identityPub = await loadPublicKey('identity:pub', { name: 'ECDSA', namedCurve: 'P-256' }, ['verify']);
    const myIdentityPubJwk = await crypto.subtle.exportKey('jwk', identityPub);

    const epkA = await genEphemeralECDH();
    await savePrivateKey('ephemeral:priv', epkA.privateKey);
    const epkAJwk = await exportPublicJwk(epkA.publicKey);
    const nonceA = randBytes(16);
    const tsA = Date.now();
    const seqA = 1;

    const sigData = new TextEncoder().encode(JSON.stringify({ meId, peerId, epkAJwk, nonceA: b64(nonceA), tsA, seqA }));
    const sigA = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, identityPriv, sigData);
    console.log('[kex:init] emit to', peerId);
    // Attach listener before emitting to avoid races
    const onResp = async (payload) => {
      console.log('[kex:resp] received', payload);
      if (payload.fromUserId !== peerId) return;
      const { epkBJwk, nonceB, tsB, seqB, sigB, myIdentityPubJwk: peerIdentityPubJwk, macB } = payload.data || {};

      const peerIdPub = await importPublicJwkECDSA(peerIdentityPubJwk);
      const verifyData = new TextEncoder().encode(JSON.stringify({ meId, peerId, epkAJwk, epkBJwk, nonceA: b64(nonceA), nonceB, tsB, seqB }));
      const disableSig = localStorage.getItem('disableSig') === 'true';
      const ok = disableSig ? true : await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, peerIdPub, Uint8Array.from(atob(sigB), c => c.charCodeAt(0)), verifyData);
      if (!ok) { console.error('[kex:resp] signature invalid'); setHandshakeStatus('error'); setHandshakeError('Handshake signature invalid'); socket.off('handshake:resp', onResp); return; }

      const peerEpkB = await importPublicJwkECDH(epkBJwk);
      const ephPriv = await loadPrivateKey('ephemeral:priv', { name: 'ECDH', namedCurve: 'P-256' });
      const ssBits = await deriveSessionBits(ephPriv, peerEpkB);

      const salt = await crypto.subtle.digest('SHA-256', new Uint8Array([...new Uint8Array(ub64(b64(nonceA))), ...new Uint8Array(ub64(nonceB))]));
      const sessionKey = await hkdf(ssBits, salt, new TextEncoder().encode('e2eeV1-session'), 32);
      const confirmKey = await hkdf(ssBits, salt, new TextEncoder().encode('e2eeV1-confirm'), 32);

      // Key confirm (A side)
      const transcript = new TextEncoder().encode(JSON.stringify({ epkAJwk, nonceA: b64(nonceA), tsA, seqA, epkBJwk, nonceB, tsB, seqB }));
      const hKey = await crypto.subtle.importKey('raw', confirmKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
      const th = await crypto.subtle.digest('SHA-256', transcript);
      // Verify macB from responder first
      const macBBytes = Uint8Array.from(atob(macB), c => c.charCodeAt(0));
      const okMacB = await crypto.subtle.verify('HMAC', hKey, macBBytes, new TextEncoder().encode('KC-B|' + b64(th)));
      if (!okMacB) { console.error('[kex:resp] macB invalid'); setHandshakeStatus('error'); setHandshakeError('Key confirmation failed (macB)'); socket.off('handshake:resp', onResp); return; }
      const macA = await crypto.subtle.sign('HMAC', hKey, new TextEncoder().encode('KC-A|' + b64(th)));
      console.log('[kex:confirm] sending macA to', peerId);
      socket.emit('handshake:confirm', { toUserId: peerId, data: { macA: b64(macA) } });

      setSess({ key: sessionKey, seq: 0, peerId });
      setHandshakeStatus('confirmed');
      socket.off('handshake:resp', onResp);
      if (kexTimer.current) { clearTimeout(kexTimer.current); kexTimer.current = null; }
    };
    socket.on('handshake:resp', onResp);
    socket.emit('handshake:init', { toUserId: peerId, data: { epkAJwk, nonceA: b64(nonceA), tsA, seqA, sigA: b64(sigA), myIdentityPubJwk } });
    setHandshakeStatus('waiting');
    // timeout for diagnostics
    if (kexTimer.current) clearTimeout(kexTimer.current);
    kexTimer.current = setTimeout(() => {
      console.warn('[kex] timeout waiting for handshake:resp');
      setHandshakeStatus('error');
      setHandshakeError('Timeout waiting for handshake response');
      socket.off('handshake:resp', onResp);
    }, 15000);
  }

  // Responder logic: on receiving handshake:init, verify and respond with KEX2 + macB
  useEffect(() => {
    function onInit(payload) {
      const fromId = payload.fromUserId;
      const { epkAJwk, nonceA, tsA, seqA, sigA, myIdentityPubJwk: peerIdentityPubJwk } = payload.data || {};
      console.log('[kex:init] received from', fromId, payload);
      (async () => {
        try {
          // Verify signature from initiator
          const peerIdPub = await importPublicJwkECDSA(peerIdentityPubJwk);
          const meId = fromId; // matches initiator meId
          const peerId = session.user.id; // matches initiator peerId
          const sigData = new TextEncoder().encode(JSON.stringify({ meId, peerId, epkAJwk, nonceA, tsA, seqA }));
          const disableSig = localStorage.getItem('disableSig') === 'true';
          const ok = disableSig ? true : await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, peerIdPub, Uint8Array.from(atob(sigA), c => c.charCodeAt(0)), sigData);
          if (!ok) { console.warn('[kex:init] signature invalid'); return; }

          // Prepare response
          const epkB = await genEphemeralECDH();
          const epkBJwk = await exportPublicJwk(epkB.publicKey);
          const nonceBBytes = randBytes(16);
          const nonceB = b64(nonceBBytes);
          const tsB = Date.now();
          const seqB = 1;

          const peerEpkA = await importPublicJwkECDH(epkAJwk);
          const ssBits = await deriveSessionBits(epkB.privateKey, peerEpkA);
          const salt = await crypto.subtle.digest('SHA-256', new Uint8Array([...new Uint8Array(ub64(nonceA)), ...nonceBBytes]));
          const sessionKey = await hkdf(ssBits, salt, new TextEncoder().encode('e2eeV1-session'), 32);
          const confirmKey = await hkdf(ssBits, salt, new TextEncoder().encode('e2eeV1-confirm'), 32);

          const transcript = new TextEncoder().encode(JSON.stringify({ epkAJwk, nonceA, tsA, seqA, epkBJwk, nonceB, tsB, seqB }));
          const th = await crypto.subtle.digest('SHA-256', transcript);

          // Sign KEX2
          const identityPriv = await loadPrivateKey('identity:priv', { name: 'ECDSA', namedCurve: 'P-256' });
          const sigBData = new TextEncoder().encode(JSON.stringify({ meId, peerId, epkAJwk, epkBJwk, nonceA, nonceB, tsB, seqB }));
          const sigB = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, identityPriv, sigBData);

          const hKey = await crypto.subtle.importKey('raw', confirmKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
          const macB = await crypto.subtle.sign('HMAC', hKey, new TextEncoder().encode('KC-B|' + b64(th)));

          const myIdentityPub = await loadPublicKey('identity:pub', { name: 'ECDSA', namedCurve: 'P-256' }, ['verify']);
          const myIdentityPubJwkSelf = await crypto.subtle.exportKey('jwk', myIdentityPub);

          // Remember for confirm phase
          kex.current.set(fromId, { confirmKey, transcript, sessionKey });
          console.log('[kex:resp] sending to', fromId);
          socket.emit('handshake:resp', { toUserId: fromId, data: { epkBJwk, nonceB, tsB, seqB, sigB: b64(sigB), myIdentityPubJwk: myIdentityPubJwkSelf, macB: b64(macB) } });
        } catch (e) {
          console.warn('[kex:init] failed', e);
        }
      })();
    }

    function onConfirm(payload) {
      const fromId = payload.fromUserId;
      const { macA } = payload.data || {};
      console.log('[kex:confirm] received from', fromId, payload);
      (async () => {
        try {
          const state = kex.current.get(fromId);
          if (!state) return;
          const { confirmKey, transcript, sessionKey } = state;
          const th = await crypto.subtle.digest('SHA-256', transcript);
          const hKey = await crypto.subtle.importKey('raw', confirmKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
          const ok = await crypto.subtle.verify('HMAC', hKey, Uint8Array.from(atob(macA), c => c.charCodeAt(0)), new TextEncoder().encode('KC-A|' + b64(th)));
          if (!ok) { console.warn('[kex:confirm] macA invalid'); return; }
          setSess({ key: sessionKey, seq: 0, peerId: fromId });
          setHandshakeStatus('confirmed');
          kex.current.delete(fromId);
        } catch (e) { console.warn('Failed to verify confirm', e); }
      })();
    }

    socket.on('handshake:init', onInit);
    socket.on('handshake:confirm', onConfirm);
    return () => {
      socket.off('handshake:init', onInit);
      socket.off('handshake:confirm', onConfirm);
    };
  }, [socket, session.user.id]);

  async function sendMessage(text) {
    if (!sess) return;
    const seq = sess.seq + 1;
    const ts = Date.now();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aadObj = { senderId: session.user.id, receiverId: sess.peerId, seq, ts };
    const aad = new TextEncoder().encode(JSON.stringify(aadObj));
    const ciphertext = await aesGcmEncrypt(sess.key, iv, new TextEncoder().encode(JSON.stringify({ text, ts, seq })), aad);

    // Relay via server (metadata only)
    socket.emit('message:send', { toUserId: sess.peerId, seq, ts, iv: b64(iv), aad: b64(aad), ciphertext: b64(ciphertext) });

    // Store on server as well
    await http.post('/messages', {
      sessionId: `${session.user.id}:${sess.peerId}`,
      receiverId: sess.peerId,
      seq,
      ts,
      iv: b64(iv),
      aad: b64(aad),
      ciphertext: b64(ciphertext)
    });

    setMessages((m) => [...m, { from: 'me', text, ts }]);
    setSess({ ...sess, seq });
  }

  useEffect(() => {
    async function onMessageDeliver(payload) {
      console.log('[msg] deliver', payload);
      if (!sess || payload.fromUserId !== sess.peerId) return;
      try {
        const iv = new Uint8Array(ub64(payload.iv));
        const aadBytes = new Uint8Array(ub64(payload.aad));
        const ct = new Uint8Array(ub64(payload.ciphertext));
        const aadObj = JSON.parse(new TextDecoder().decode(aadBytes));
        const seq = aadObj.seq;
        const ts = aadObj.ts;
        const now = Date.now();
        let state = replay.current.get(sess.peerId);
        if (!state) { state = { lastSeq: 0, lastTs: 0, seen: new Set() }; replay.current.set(sess.peerId, state); }
        const tooOld = ts < state.lastTs || (now - ts) > 5 * 60 * 1000; // older than last or older than 5 minutes
        const dupSeq = state.seen.has(seq) || seq <= state.lastSeq;
        if (tooOld || dupSeq) {
          console.warn('[replay] rejected message', { seq, ts, lastSeq: state.lastSeq, lastTs: state.lastTs, now });
          setMessages((m) => [...m, { from: 'system', text: `[replay] Rejected message seq=${seq} ts=${ts}`, ts: now }]);
          return; // do not decrypt
        }
        const ptBuf = await aesGcmDecrypt(sess.key, iv, ct, aadBytes);
        const { text } = JSON.parse(new TextDecoder().decode(ptBuf));
        // advance window
        state.lastSeq = Math.max(state.lastSeq, seq);
        state.lastTs = Math.max(state.lastTs, ts);
        state.seen.add(seq);
        if (state.seen.size > 1000) {
          // prune to last 500
          const arr = Array.from(state.seen).sort((a,b)=>a-b).slice(-500);
          state.seen = new Set(arr);
        }
        setMessages((m) => [...m, { from: 'peer', text, ts }]);
      } catch (e) {
        console.warn('[msg] decrypt failed', e);
      }
    }
    
    socket.on('message:deliver', onMessageDeliver);
    return () => {
      socket.off('message:deliver', onMessageDeliver);
    };
  }, [socket, sess]);

  // Handle file delivery notifications -> fetch, decrypt, and download
  useEffect(() => {
    async function onFileDeliver(payload) {
      console.log('[file] deliver event', payload);
      if (!sess || payload.fromUserId !== sess.peerId) { console.warn('[file] no active session or wrong sender'); return; }
      const fileId = payload.fileId;
      try {
        console.log('[file] fetching file doc', fileId);
        const res = await http.get(`/files/${fileId}`);
        const doc = res.data;
        const total = doc.chunks?.length || 0;
        console.log('[file] doc received', { total, name: doc.fileName, size: doc.fileSize, type: doc.mimeType });
        const fileNonce = new Uint8Array(ub64(doc.fileNonce));
        const fileKey = await hkdf(sess.key, fileNonce, new TextEncoder().encode('e2eeV1-file'), 32);
        const parts = [];
        for (let i = 0; i < doc.chunks.length; i++) {
          const ch = doc.chunks[i];
          const iv = new Uint8Array(ub64(ch.iv));
          const aad = new TextEncoder().encode(JSON.stringify({ meId: doc.senderId, peerId: doc.receiverId, idx: ch.index, total }));
          const ct = new Uint8Array(ub64(ch.ciphertext));
          try {
            const pt = await aesGcmDecrypt(fileKey, iv, ct, aad);
            parts.push(new Uint8Array(pt));
            if (i % 50 === 0) console.log('[file] decrypted chunk', i, '/', total);
          } catch (e) {
            console.error('[file] chunk decrypt failed at', i, e);
            throw e;
          }
        }
        const size = parts.reduce((n, p) => n + p.byteLength, 0);
        const all = new Uint8Array(size);
        let off = 0; for (const p of parts) { all.set(p, off); off += p.byteLength; }
        const blob = new Blob([all], { type: doc.mimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = doc.fileName || 'download.bin';
        document.body.appendChild(a); a.click(); a.remove();
        setMessages((m) => [...m, { from: 'peer', text: `[file] ${doc.fileName} received`, ts: Date.now() }]);
        console.log('[file] download triggered');
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (e) {
        console.error('[file] delivery handling failed', e);
      }
    }
    socket.on('file:deliver', onFileDeliver);
    return () => {
      socket.off('file:deliver', onFileDeliver);
    };
  }, [socket, sess, http]);

  // Adapt existing state to ModernChatLayout props without changing logic
  const contacts = useMemo(() => {
    const items = [];
    if (peerInfo) {
      items.push({
        id: peerInfo.userId,
        name: peerInfo.username || peerName || 'Peer',
        online: true,
        lastMessage: messages.length ? { timestamp: messages[messages.length - 1].ts, type: 'text', text: messages[messages.length - 1].text } : null,
      });
    }
    return items;
  }, [peerInfo, peerName, messages]);

  const normalizedMessages = useMemo(() => {
    return messages.map((m) => ({
      id: m.id || `${m.ts}-${m.text?.substring(0, 20) || 'msg'}`,
      senderId: m.from === 'me' ? session.user.id : (m.from === 'peer' ? (sess?.peerId || 'peer-id') : m.from),
      text: m.text,
      timestamp: m.ts,
      type: m.type || 'text'
    }));
  }, [messages, session.user.id, sess]);

  return (
    <div className="min-h-screen app-gradient">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
          <div className="text-gray-900 font-medium">Welcome, {session.user.username}</div>
          <button className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg shadow-sm" onClick={onLogout}>Logout</button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 mb-3 border border-gray-200">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
            <input className="flex-1 bg-gray-50 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-200" placeholder='Enter peer username' value={peerName} onChange={(e) => setPeerName(e.target.value)} />
            <div className="flex gap-2">
              <button className="flex-1 lg:flex-none text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-medium shadow-sm" onClick={lookupPeer}>Lookup</button>
              <button className="flex-1 lg:flex-none text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled={!peerInfo} onClick={startHandshake}>Start Handshake</button>
            </div>
          </div>
          <div className="text-xs text-gray-600 mt-2 px-1">Status: <span className="font-medium">{handshakeStatus}</span>{handshakeError ? <span className="text-red-600"> • {handshakeError}</span> : ''}</div>
        </div>

        <ModernChatLayout
          contacts={contacts}
          activeContactId={peerInfo?.userId}
          onSelectContact={(c) => { setPeerName(c.name); setPeerInfo({ userId: c.id, username: c.name }); }}
          messages={normalizedMessages}
          meId={session.user.id}
          typing={false}
          onSendMessage={sendMessage}
        />

        {sess && (
          <div className="mt-3 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
            <FileShare http={http} socket={socket} sessionKey={sess.key} meId={session.user.id} peerId={sess.peerId} />
          </div>
        )}
      </div>
    </div>
  );
}

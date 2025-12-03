import { genEphemeralECDH, importPublicJwkECDSA, importPublicJwkECDH, exportPublicJwk, deriveSessionBits, hkdf, hmacSha256, randBytes, utf8, b64 } from './webcrypto.js';

// Transcript hash helper (simple SHA-256 over concatenated fields)
async function sha256(data) {
  return crypto.subtle.digest('SHA-256', data);
}

function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(new Uint8Array(p), off); off += p.byteLength; }
  return out.buffer;
}

export async function initiateHandshake({ myIdentityPriv, myIdentityPubJwk, peerIdentityPubJwk, socket, toUserId }) {
  const context = utf8('e2eeV1-KEX');
  const epkA = await genEphemeralECDH();
  const epkAJwk = await exportPublicJwk(epkA.publicKey);
  const nonceA = randBytes(16);
  const tsA = Date.now();
  const seqA = 1;

  // Sign: context | toUserId | epkAJwk | nonceA | tsA | seqA
  const peerIdBytes = utf8(String(toUserId));
  const sigData = concat(context, utf8('KEX1'), peerIdBytes, utf8(JSON.stringify(epkAJwk)), nonceA, utf8(String(tsA)), utf8(String(seqA)));
  const sigA = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, myIdentityPriv, sigData);

  socket.emit('handshake:init', {
    toUserId,
    data: {
      epkAJwk, nonceA: b64(nonceA), tsA, seqA, sigA: b64(sigA), myIdentityPubJwk
    }
  });

  return { context, epkA, epkAJwk, nonceA, tsA, seqA };
}

export async function respondHandshake({ myIdentityPriv, myIdentityPubJwk, fromUserId, payload }) {
  const { epkAJwk, nonceA, tsA, seqA, sigA, myIdentityPubJwk: peerIdentityPubJwk } = payload;
  const context = utf8('e2eeV1-KEX');

  const peerIdPub = await importPublicJwkECDSA(peerIdentityPubJwk);
  const peerEpkA = await importPublicJwkECDH(epkAJwk);

  const sigDataA = new TextEncoder().encode('');
  const verifyData = concat(context, utf8('KEX1'), utf8(String(fromUserId)), utf8(JSON.stringify(epkAJwk)), new Uint8Array(atob(nonceA).split('').map(c => c.charCodeAt(0))).buffer, utf8(String(tsA)), utf8(String(seqA)));
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, peerIdPub, Uint8Array.from(atob(sigA), c => c.charCodeAt(0)), verifyData);
  if (!ok) throw new Error('Invalid handshake signature from peer');

  const epkB = await genEphemeralECDH();
  const epkBJwk = await exportPublicJwk(epkB.publicKey);
  const nonceB = randBytes(16);
  const tsB = Date.now();
  const seqB = 1;

  // derive shared secret
  const ssBits = await deriveSessionBits(epkB.privateKey, peerEpkA);
  const salt = await crypto.subtle.digest('SHA-256', concat(Uint8Array.from(atob(nonceA), c => c.charCodeAt(0)).buffer, nonceB));
  const sessionKey = await hkdf(ssBits, salt, utf8('e2eeV1-session'), 32);
  const confirmKey = await hkdf(ssBits, salt, utf8('e2eeV1-confirm'), 32);

  const transcriptHash = await sha256(concat(utf8(JSON.stringify({ epkAJwk, nonceA, tsA, seqA })), utf8(JSON.stringify({ epkBJwk, nonceB: b64(nonceB), tsB, seqB }))));

  // Sign KEX2
  const sigDataB = concat(context, utf8('KEX2'), utf8(String(fromUserId)), utf8(JSON.stringify(epkAJwk)), utf8(JSON.stringify(epkBJwk)), Uint8Array.from(atob(nonceA), c => c.charCodeAt(0)).buffer, nonceB, utf8(String(tsB)), utf8(String(seqB)));
  const sigB = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, myIdentityPriv, sigDataB);

  const macB = await hmacSha256(confirmKey, concat(utf8('KC-B'), transcriptHash));

  return {
    out: { epkB, sessionKey, confirmKey },
    payload: {
      epkBJwk, nonceB: b64(nonceB), tsB, seqB, sigB: b64(sigB), myIdentityPubJwk, macB: b64(macB)
    }
  };
}

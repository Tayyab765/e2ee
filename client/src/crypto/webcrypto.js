// Web Crypto helpers: ECDSA P-256, ECDH P-256, AES-GCM-256, HKDF, HMAC-SHA-256

export async function genIdentityKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
}

export async function genEphemeralECDH() {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

export async function exportPublicJwk(key) {
  return crypto.subtle.exportKey('jwk', key);
}

export async function importPublicJwkECDSA(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
}
export async function importPublicJwkECDH(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

export async function sign(identityPrivateKey, data) {
  return crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, identityPrivateKey, data);
}

export async function verify(identityPublicKey, signature, data) {
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, identityPublicKey, signature, data);
}

export async function deriveSessionBits(myECDHPrivate, peerECDHPublic) {
  return crypto.subtle.deriveBits({ name: 'ECDH', public: peerECDHPublic }, myECDHPrivate, 256);
}

export async function hkdf(ikm, salt, info, length = 32) {
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    ikmKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return raw.slice(0, length);
}

export async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, data);
}

export async function aesGcmEncrypt(keyBytes, iv, plaintext, aad) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  return crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plaintext);
}

export async function aesGcmDecrypt(keyBytes, iv, ciphertext, aad) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, ciphertext);
}

export function randBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function utf8(s) { return new TextEncoder().encode(s); }
export function deutf8(b) { return new TextDecoder().decode(b); }

export function b64(b) { return btoa(String.fromCharCode(...new Uint8Array(b))); }
export function ub64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

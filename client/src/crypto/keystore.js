import { openDB } from 'idb';

const DB_NAME = 'e2eev1-keys';
const STORE = 'keys';

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE);
    }
  });
}

export async function savePrivateKey(name, cryptoKey) {
  const jwk = await window.crypto.subtle.exportKey('jwk', cryptoKey);
  const d = await db();
  await d.put(STORE, jwk, name);
}

export async function loadPrivateKey(name, alg) {
  const d = await db();
  const jwk = await d.get(STORE, name);
  if (!jwk) return null;
  return window.crypto.subtle.importKey('jwk', jwk, alg, true, alg.name === 'ECDH' ? ['deriveKey', 'deriveBits'] : ['sign']);
}

export async function savePublicKey(name, cryptoKey) {
  const jwk = await window.crypto.subtle.exportKey('jwk', cryptoKey);
  const d = await db();
  await d.put(STORE, jwk, name);
}

export async function loadPublicKey(name, alg, keyUsages) {
  const d = await db();
  const jwk = await d.get(STORE, name);
  if (!jwk) return null;
  return window.crypto.subtle.importKey('jwk', jwk, alg, true, keyUsages);
}

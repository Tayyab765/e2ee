import React, { useState } from 'react';
import { api } from '../api/http.js';
import { genIdentityKeyPair, exportPublicJwk } from '../crypto/webcrypto.js';
import { savePrivateKey, savePublicKey } from '../crypto/keystore.js';

export default function Register({ onRegistered }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const idPair = await genIdentityKeyPair();
      await savePrivateKey('identity:priv', idPair.privateKey);
      await savePublicKey('identity:pub', idPair.publicKey);
      const identityJwk = await exportPublicJwk(idPair.publicKey);

      // For initial publish, we reuse identity key as placeholder for ecdh pub (client will generate ECDH ephemeral per session)
      const res = await api().post('/auth/register', { username, password, publicKeys: { identity: JSON.stringify(identityJwk), ecdh: JSON.stringify(identityJwk) } });
      if (res.data?.ok) onRegistered?.();
    } catch (e) {
      setErr('Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
        <input
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
          placeholder='Choose a username'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type='password'
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
          placeholder='Create a password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button disabled={busy} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-2.5 rounded-lg transition-colors shadow-md">
        {busy ? 'Creating account...' : 'Register'}
      </button>
      {err && <div className="text-red-600 text-sm text-center">{err}</div>}
      <p className="text-xs text-gray-500 text-center">🔐 Keys are generated and stored locally via IndexedDB</p>
    </form>
  );
}

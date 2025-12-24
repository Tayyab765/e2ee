# End-to-End Encrypted Chat Application

This is a secure chat application with end-to-end encryption.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F<YOUR_GITHUB_USERNAME>%2F<YOUR_REPO_NAME>)

## Video Demonstration

[Watch the video demonstration on Loom](https://www.loom.com/share/66f7bfcf066a406da58b490f3a41b9ff)

## Deployment Links

-   **Client (Vercel):** [https://e2ee-d5b301w44-tayyab765s-projects.vercel.app/](https://e2ee-d5b301w44-tayyab765s-projects.vercel.app/)
-   **Server (Railway):** [https://e2ee-production.up.railway.app/api](https://e2ee-production.up.railway.app/api)

# e2eeV1 – End-to-End Encrypted Messaging and File Sharing

This project is a complete applied Information Security system implementing end-to-end encryption (E2EE) for text and file sharing. It uses a custom authenticated key exchange (AKE) built on ECDH with identity signatures (ECDSA), AES-256-GCM for confidentiality and integrity, strict anti-replay protections, and comprehensive auditing.

## Goals
- Messages/files never exist in plaintext outside sender/receiver devices.
- Server stores only ciphertext and metadata (IV, AAD, sender/receiver, timestamps).
- Hybrid crypto: identity signatures (ECDSA P-256) + key agreement (ECDH P-256) + symmetric encryption (AES-256-GCM).
- Custom AKE with key confirmation and replay protections.
- Attack simulations (MITM, replay) and security logging.

## Tech
- Frontend: React + Vite, Web Crypto API (SubtleCrypto), IndexedDB (idb)
- Backend: Node.js + Express, MongoDB (Mongoose), Socket.io (realtime), bcrypt (password hashing)

## Protocol Overview

### Identity and Keys
- Identity signing key pair (ECDSA P-256) generated client-side at registration.
- Ephemeral ECDH key pairs (P-256) generated per session during the handshake.
- Public identity keys are published to the server; private keys never leave the client.

### Custom AKE (Authenticated ECDH with Key Confirmation)
1. A -> B (via server/socket):
   - epkA (A's ephemeral ECDH public key), nonceA, tsA, seqA
   - sigA = Sign_A(ECDSA, context | A | B | epkA | nonceA | tsA | seqA)
2. B verifies sigA using A's identity public key (from server), then:
   - B -> A: epkB, nonceB, tsB, seqB
   - sigB = Sign_B(ECDSA, context | A | B | epkA | epkB | nonceA | nonceB | tsB | seqB)
3. Both compute shared secret: ss = ECDH(skA_ephemeral, pkB_ephemeral) = ECDH(skB_ephemeral, pkA_ephemeral)
4. Derive keys with HKDF-SHA-256:
   - salt = SHA-256(nonceA || nonceB)
   - sessionKey = HKDF(ss, salt, info = "e2eeV1-session", len = 32)
   - confirmKey = HKDF(ss, salt, info = "e2eeV1-confirm", len = 32)
5. Key Confirmation:
   - A -> B: macA = HMAC-SHA-256(confirmKey, "KC-A" || transcriptHash)
   - B verifies macA; B -> A: macB = HMAC-SHA-256(confirmKey, "KC-B" || transcriptHash)
   - A verifies macB. If both pass, session is established.

### Messaging (E2EE)
- For each message m:
  - seq incremented; ts included; fresh 96-bit IV (random).
  - AAD = encode(senderId | receiverId | sessionId | seq | ts)
  - c = AES-256-GCM(sessionKey, IV, plaintext = JSON{m, ts, seq}, AAD)
- Server stores {ciphertext, iv, aad, metadata}. No plaintext is sent or stored.

### File Sharing (E2EE)
- Client encrypts file chunks (e.g., 64 KiB) with AES-256-GCM.
- Per-file key derived from sessionKey: fileKey = HKDF(sessionKey, salt = fileNonce, info = "e2eeV1-file", 32).
- Each chunk gets its own random IV and GCM tag. Server stores encrypted chunks only.

### Replay Protection
- Nonces + timestamps + per-session sequence numbers in handshake and messages.
- Receiver maintains seen window and monotonic seq; rejects duplicates or stale ts.
- Server logs suspected replay attempts (metadata-only) but cannot decrypt content.

### Logging & Auditing
- Authentication attempts (success/fail), key exchange attempts, failed decrypts,
  detected replay attacks, invalid signatures, server metadata access.

## Running Locally (Windows PowerShell)

Prerequisites:
- Node.js 18+
- MongoDB (Atlas URI or local instance)

1) Server setup
```
cd server
copy .env.example .env
# Edit .env to set MONGO_URI and JWT_SECRET
npm install
npm run dev
```

2) Client setup
```
cd ../client
npm install
npm run dev
```

The client dev server proxies API requests to the server. For production, use HTTPS.

## Security Notes
- All cryptographic operations are client-side using Web Crypto.
- Private keys never leave the client; only public identity keys are uploaded.
- AES-GCM only; fresh, non-repeating IVs; enforce timestamp checks on signatures.
- The server cannot decrypt messages/files; it stores ciphertext and metadata only.

## Attacks Demo
- `attacks/mitm_proxy.js`: attempts to alter handshake ephemeral keys; signature checks must fail.
- `attacks/replay_client.js`: replays prior ciphertext to the receiver; client rejects via seq/timestamp validation.

## License
For academic use in this course project.

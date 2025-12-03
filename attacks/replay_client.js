// Node script: fetch latest encrypted message and re-send it to demonstrate replay rejection
// Usage (PowerShell):
//   node attacks/replay_client.js <API_BASE> <JWT_TOKEN> <peerUserId>
// Example:
//   node attacks/replay_client.js http://localhost:4000 "<your_jwt>" 692ebc91c71bc0b4775bf0b5

import axios from 'axios';
import jwt from 'jsonwebtoken';
import { io } from 'socket.io-client';

function usage() {
	console.log('Usage: node attacks/replay_client.js <API_BASE> <JWT_TOKEN> <peerUserId>');
}

async function main() {
	const [,, API_BASE, JWT_TOKEN, PEER_ID] = process.argv;
	if (!API_BASE || !JWT_TOKEN || !PEER_ID) { usage(); process.exit(1); }

	let myUserId;
	try {
		const decoded = jwt.decode(JWT_TOKEN);
		myUserId = decoded?.sub;
		if (!myUserId) throw new Error('JWT missing sub');
	} catch (e) {
		console.error('[replay] invalid JWT', e);
		process.exit(1);
	}

	console.log('[replay] me=', myUserId, 'peer=', PEER_ID);

	const api = axios.create({ baseURL: API_BASE + '/api', headers: { Authorization: `Bearer ${JWT_TOKEN}` } });
	try {
		const res = await api.get(`/messages/between/${PEER_ID}?limit=1`);
		const msgs = res.data?.messages || [];
		if (msgs.length === 0) {
			console.error('[replay] no prior messages to replay');
			process.exit(2);
		}
		const m = msgs[msgs.length - 1];
		console.log('[replay] got message id=', m._id, 'seq=', m.seq, 'ts=', m.ts);

		const socket = io(API_BASE, { auth: { userId: myUserId } });
		socket.on('connect', () => {
			console.log('[replay] socket connected as', myUserId, 'id=', socket.id);
			const payload = {
				toUserId: PEER_ID,
				seq: m.seq,
				ts: new Date(m.ts).getTime(),
				iv: m.iv,
				aad: m.aad,
				ciphertext: m.ciphertext
			};
			console.log('[replay] emitting message:send with captured payload');
			socket.emit('message:send', payload);
			setTimeout(() => { console.log('[replay] done'); process.exit(0); }, 2000);
		});
		socket.on('connect_error', (err) => {
			console.error('[replay] socket connect_error', err);
		});
	} catch (e) {
		console.error('[replay] failed to fetch or send', e?.response?.data || e.message);
		process.exit(1);
	}
}

main();
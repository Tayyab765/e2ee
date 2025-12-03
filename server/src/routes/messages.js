import express from 'express';
import Message from '../models/Message.js';
import { authRequired } from '../middleware/auth.js';
import { audit } from '../middleware/logger.js';
import { noteMessage } from '../lib/replayStore.js';

const router = express.Router();

// Store encrypted message metadata-only
router.post('/', authRequired, async (req, res) => {
  try {
    const { sessionId, receiverId, ciphertext, iv, aad, seq, ts } = req.body || {};
    if (!sessionId || !receiverId || !ciphertext || !iv || !aad || typeof seq !== 'number' || !ts) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const dateTs = new Date(ts);
    const isReplay = noteMessage(sessionId, receiverId, seq, dateTs.getTime());
    const msg = await Message.create({ sessionId, senderId: req.user.id, receiverId, ciphertext, iv, aad, seq, ts: dateTs });
    audit('message.store', { sessionId, msgId: msg._id, replaySuspected: isReplay }, req.user);
    res.json({ ok: true, id: msg._id, replaySuspected: isReplay });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch last N messages between two users (metadata-only)
router.get('/between/:peerId', authRequired, async (req, res) => {
  const { peerId } = req.params;
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  try {
    const msgs = await Message.find({
      $or: [
        { senderId: req.user.id, receiverId: peerId },
        { senderId: peerId, receiverId: req.user.id }
      ]
    }).sort({ createdAt: -1 }).limit(limit);
    audit('message.fetch', { count: msgs.length, peerId }, req.user);
    res.json({ messages: msgs.reverse() });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

import express from 'express';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { audit } from '../middleware/logger.js';

const router = express.Router();

// Upload or update public keys (identity + ecdh)
router.post('/publish', authRequired, async (req, res) => {
  const { identity, ecdh } = req.body || {};
  if (!identity || !ecdh) return res.status(400).json({ error: 'Missing keys' });
  try {
    await User.updateOne({ _id: req.user.id }, { $set: { publicKeys: { identity, ecdh } } });
    audit('keys.publish', { userId: req.user.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Lookup another user's public keys by username
router.get('/lookup/:username', authRequired, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: 'User not found' });
    audit('keys.lookup', { by: req.user.id, target: user._id });
    res.json({ userId: user._id, username: user.username, publicKeys: user.publicKeys });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

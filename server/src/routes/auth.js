import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { audit } from '../middleware/logger.js';
import { requireFields } from '../utils/validation.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  const err = requireFields(req.body, ['username', 'password', 'publicKeys']);
  if (err) return res.status(400).json({ error: err });
  const { username, password, publicKeys } = req.body;
  try {
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: 'Username taken' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, passwordHash, publicKeys });
    audit('auth.register', { username, userId: user._id });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const err = requireFields(req.body, ['username', 'password']);
  if (err) return res.status(400).json({ error: err });
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) { audit('auth.login.fail', { username }); return res.status(401).json({ error: 'Invalid credentials' }); }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) { audit('auth.login.fail', { username }); return res.status(401).json({ error: 'Invalid credentials' }); }
    const token = jwt.sign({ sub: user._id.toString(), username: user.username, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '12h' });
    audit('auth.login.success', { userId: user._id });
    return res.json({ token, user: { id: user._id, username: user.username } });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;

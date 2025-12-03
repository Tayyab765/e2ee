import express from 'express';
import Log from '../models/Log.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// Minimal: expose logs to authenticated users for demo; restrict in production
router.get('/', authRequired, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const logs = await Log.find({}).sort({ ts: -1 }).limit(limit);
  res.json({ logs });
});

export default router;

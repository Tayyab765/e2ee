import express from 'express';
import multer from 'multer';
import File from '../models/File.js';
import { authRequired } from '../middleware/auth.js';
import { audit } from '../middleware/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Upload encrypted file manifest + chunks (JSON)
router.post('/json', authRequired, express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { sessionId, receiverId, fileName, fileSize, mimeType, fileNonce, chunks } = req.body || {};
    if (!sessionId || !receiverId || !fileName || !fileSize || !fileNonce || !Array.isArray(chunks)) {
      return res.status(400).json({ error: 'Invalid file payload' });
    }
    const doc = await File.create({ sessionId, senderId: req.user.id, receiverId, fileName, fileSize, mimeType, fileNonce, chunks });
    audit('file.store', { fileId: doc._id, sessionId }, req.user);
    res.json({ ok: true, fileId: doc._id });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Download encrypted file (JSON format)
router.get('/:fileId', authRequired, async (req, res) => {
  try {
    const doc = await File.findById(req.params.fileId);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.senderId.toString() !== req.user.id && doc.receiverId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    audit('file.fetch', { fileId: doc._id }, req.user);
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

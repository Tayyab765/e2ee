import mongoose from 'mongoose';

const SessionStateSchema = new mongoose.Schema({
  sessionId: { type: String, unique: true },
  aUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Server stores only metadata: last seq per user to aid replay detection logging
  seqA: { type: Number, default: 0 },
  seqB: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('SessionState', SessionStateSchema);

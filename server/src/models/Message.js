import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ciphertext: { type: String, required: true }, // base64
  iv: { type: String, required: true }, // base64 (12 bytes)
  aad: { type: String, required: true }, // base64
  seq: { type: Number, required: true },
  ts: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Message', MessageSchema);

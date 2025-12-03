import mongoose from 'mongoose';

const FileChunkSchema = new mongoose.Schema({
  index: Number,
  iv: String,       // base64
  ciphertext: String // base64
}, { _id: false });

const FileSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fileName: String,
  fileSize: Number,
  mimeType: String,
  fileNonce: String, // base64, used in HKDF
  chunks: [FileChunkSchema],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('File', FileSchema);

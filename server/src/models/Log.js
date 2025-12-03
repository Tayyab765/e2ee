import mongoose from 'mongoose';

const LogSchema = new mongoose.Schema({
  event: { type: String, index: true },
  details: { type: Object },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  ts: { type: Date, default: Date.now }
});

export default mongoose.model('Log', LogSchema);

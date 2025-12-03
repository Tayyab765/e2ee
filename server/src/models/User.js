import mongoose from 'mongoose';

const PublicKeysSchema = new mongoose.Schema({
  identity: { type: String, required: true }, // JWK or SPKI PEM string (public only)
  ecdh: { type: String, required: true }     // JWK or raw base64 (public only)
}, { _id: false });

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, index: true },
  passwordHash: { type: String, required: true },
  publicKeys: { type: PublicKeysSchema, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);

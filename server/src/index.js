import express from 'express';
import https from "https";
import fs from "fs";
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Server } from "socket.io";
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import keyRoutes from './routes/keys.js';
import messageRoutes from './routes/messages.js';
import fileRoutes from './routes/files.js';
import logRoutes from './routes/logs.js';
import { requestLogger } from './middleware/logger.js';
import { registerChat } from './sockets/chat.js';

dotenv.config();

const app = express();
const allowedOrigins = new Set([
  'https://localhost:5173', // Always allow local client for development
  'http://localhost:5173',
  'https://e2ee-six.vercel.app/',
  process.env.CLIENT_ORIGIN,
].filter(Boolean));
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.options('*', cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(requestLogger);

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/logs', logRoutes);

const sslOptions = {
  key: fs.readFileSync("./cert/key.pem"),
  cert: fs.readFileSync("./cert/cert.pem"),
};

const httpsServer = https.createServer(sslOptions, app);
const io = new Server(httpsServer, {
  cors: {
    origin: [
      "https://localhost:5173",
      "http://localhost:5173",
      "https://e2ee-six.vercel.app/",
      process.env.CLIENT_ORIGIN,
    ].filter(Boolean),
    methods: ["GET", "POST"],
  },
});
registerChat(io);

const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGO_URI).then(() => {
  httpsServer.listen(PORT, () => console.log(`HTTPS server running on https://localhost:${PORT}`));
}).catch(err => {
  console.error('Mongo connection failed', err);
  process.exit(1);
});

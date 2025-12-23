import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { Server } from "socket.io";
import http from "http";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import keyRoutes from "./routes/keys.js";
import messageRoutes from "./routes/messages.js";
import fileRoutes from "./routes/files.js";
import logRoutes from "./routes/logs.js";
import { requestLogger } from "./middleware/logger.js";
import { registerChat } from "./sockets/chat.js";

dotenv.config();

const app = express();

/* ✅ Allowed origins (NO trailing slash) */
const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://localhost:5173",
  "https://e2ee-six.vercel.app",
  "https://e2ee-9s4gc2bn6-tayyab765s-projects.vercel.app",
  process.env.CLIENT_ORIGIN,
].filter(Boolean));

/* ✅ CORS — FIRST */
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Postman / curl
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

/* ✅ Explicit preflight handler (CRITICAL) */
app.options("*", (req, res) => {
  res.sendStatus(204);
});

/* ✅ Middleware */
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(requestLogger);

/* ✅ Health check */
app.get("/health", (req, res) => res.json({ ok: true }));

/* ✅ Routes */
app.use("/api/auth", authRoutes);
app.use("/api/keys", keyRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/logs", logRoutes);

/* ✅ HTTP server (Railway-compatible) */
const server = http.createServer(app);

/* ✅ Socket.IO */
const io = new Server(server, {
  cors: {
    origin: Array.from(allowedOrigins),
    methods: ["GET", "POST"],
    credentials: true,
  },
});
registerChat(io);

/* ✅ Railway PORT */
const PORT = process.env.PORT || 3000;

connectDB(process.env.MONGO_URI)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Mongo connection failed", err);
    process.exit(1);
  });

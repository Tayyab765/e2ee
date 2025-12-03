import { Events } from '../utils/constants.js';
import { audit } from '../middleware/logger.js';

// Socket.io relays for handshake and E2EE messages (metadata only)
export function registerChat(io) {
  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (!userId) { socket.disconnect(true); return; }
    socket.join(userId);
    audit('socket.connect', { userId });

    socket.on(Events.HANDSHAKE_INIT, (payload) => {
      // payload: { toUserId, data }
      audit('handshake.init', { from: userId, to: payload?.toUserId });
      io.to(payload?.toUserId).emit(Events.HANDSHAKE_INIT, { fromUserId: userId, data: payload?.data });
    });

    socket.on(Events.HANDSHAKE_RESP, (payload) => {
      audit('handshake.resp', { from: userId, to: payload?.toUserId });
      io.to(payload?.toUserId).emit(Events.HANDSHAKE_RESP, { fromUserId: userId, data: payload?.data });
    });

    socket.on(Events.HANDSHAKE_CONFIRM, (payload) => {
      audit('handshake.confirm', { from: userId, to: payload?.toUserId });
      io.to(payload?.toUserId).emit(Events.HANDSHAKE_CONFIRM, { fromUserId: userId, data: payload?.data });
    });

    socket.on(Events.MESSAGE_SEND, (payload) => {
      audit('message.relay', { from: userId, to: payload?.toUserId, seq: payload?.seq });
      io.to(payload?.toUserId).emit(Events.MESSAGE_DELIVER, { fromUserId: userId, ...payload });
    });

    socket.on(Events.FILE_SEND, (payload) => {
      audit('file.relay', { from: userId, to: payload?.toUserId, chunks: payload?.chunks?.length });
      io.to(payload?.toUserId).emit(Events.FILE_DELIVER, { fromUserId: userId, ...payload });
    });

    socket.on('disconnect', () => {
      audit('socket.disconnect', { userId });
    });
  });
}

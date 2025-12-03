export const sessionState = {
  token: null,
  me: null,
  socket: null,
  sessions: new Map() // key: peerUserId -> { sessionKey, seq }
};

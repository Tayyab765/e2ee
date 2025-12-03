// Server-side helper for detecting apparent replays in metadata (best-effort only).
// True replay enforcement is client-side; server only logs.
const recent = new Map(); // key: sessionId:receiverId -> { seqSet: Set, lastTs: number }

export function noteMessage(sessionId, receiverId, seq, tsMs) {
  const key = `${sessionId}:${receiverId}`;
  const now = Date.now();
  let state = recent.get(key);
  if (!state) {
    state = { seqSet: new Set(), lastTs: 0, created: now };
    recent.set(key, state);
  }
  const isReplay = state.seqSet.has(seq) || tsMs < state.lastTs;
  state.seqSet.add(seq);
  state.lastTs = Math.max(state.lastTs, tsMs);
  // prune occasionally
  if (state.seqSet.size > 1000) {
    state.seqSet = new Set(Array.from(state.seqSet).slice(-500));
  }
  return isReplay;
}

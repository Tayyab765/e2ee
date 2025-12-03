import Log from '../models/Log.js';
import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
function ensureLogFile() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '', { encoding: 'utf8' });
  } catch {}
}
ensureLogFile();

function writeFileLog(line) {
  try {
    fs.appendFileSync(LOG_FILE, line + '\n', { encoding: 'utf8' });
  } catch {}
}

export function audit(event, details = {}, user = null) {
  const entry = new Log({ event, details, userId: user?.id || null, ts: new Date() });
  const line = JSON.stringify({ ts: new Date().toISOString(), event, userId: user?.id || null, details });
  writeFileLog(line);
  return entry.save().catch(() => {});
}

export function requestLogger(req, res, next) {
  res.on('finish', () => {
    const info = {
      method: req.method,
      path: req.path,
      status: res.statusCode
    };
    audit('http', info, req.user || null);
  });
  next();
}

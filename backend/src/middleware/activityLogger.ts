import fs from 'fs';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

const LOG_FILE = process.env.ACTIVITY_LOG || '/var/log/mechatronics/activity.log';

const REDACTED_KEYS = new Set(['password', 'passwordHash', 'token', 'secret', 'authorization', 'currentPassword', 'newPassword']);

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => redact(v, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = REDACTED_KEYS.has(k) ? '***' : redact(v, depth + 1);
  }
  return result;
}

function appendLog(entry: object) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(LOG_FILE, line, () => {});
}

export function activityLogger(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.path.startsWith('/api/') || req.path === '/api/health') {
    return next();
  }

  const start = Date.now();
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';

  // Capture body before it can be mutated
  const body = req.body && Object.keys(req.body).length > 0 ? redact(req.body) : null;

  res.on('finish', () => {
    appendLog({
      ts: new Date().toISOString(),
      userId: req.user?.userId ?? null,
      email: req.user?.email ?? null,
      role: req.user?.role ?? null,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
      ip,
      body,
    });
  });

  next();
}

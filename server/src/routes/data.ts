import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminDb } from '../lib/firebase-admin';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';
import { auditDataChange } from '../lib/auditLogger';

const router  = Router();
const COLLECTION = 'hmal-data';

const dataLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,                  // per session — polling 10 keys every 3 s = ~200/min
  keyGenerator: (req) => (req.cookies as Record<string, string>)?.__session ?? req.ip ?? 'unknown',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const ALLOWED_KEYS = new Set([
  'hmal-soldiers-v2',
  'hmal-schedule',
  'hmal-columns-v1',
  'hmal-task-templates',
  'hmal-task-assignments',
  'hmal-task-roles',
  'hmal-task-groups',
  'hmal-cert-source-col',
  'hmal-task-order',
  'hmal-dashboard-config',
  'hmal-soldier-sort-order',
  'schedule-auto-transitions',
]);

const KEY_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  'hmal-soldiers-v2':          v => Array.isArray(v),
  'hmal-schedule':             v => typeof v === 'object' && v !== null && !Array.isArray(v),
  'hmal-columns-v1':           v => Array.isArray(v),
  'hmal-task-templates':       v => Array.isArray(v),
  'hmal-task-assignments':     v => typeof v === 'object' && v !== null && !Array.isArray(v),
  'hmal-task-roles':           v => typeof v === 'object' && v !== null && !Array.isArray(v),
  'hmal-task-groups':          v => Array.isArray(v),
  'hmal-cert-source-col':      v => typeof v === 'string' || v === null,
  'hmal-task-order':           v => Array.isArray(v),
  'hmal-dashboard-config':     v => typeof v === 'object' && v !== null && !Array.isArray(v),
  'hmal-soldier-sort-order':   v => Array.isArray(v),
  'schedule-auto-transitions': v => typeof v === 'boolean' || v === null,
};

function validateKey(key: string, res: Parameters<Parameters<Router['get']>[1]>[1]): boolean {
  if (!ALLOWED_KEYS.has(key)) {
    res.status(400).json({ error: 'Invalid key' });
    return false;
  }
  return true;
}

router.get('/:key', requireAuth, dataLimiter, async (req, res) => {
  const key = req.params.key;
  if (!validateKey(key, res)) return;
  logger.log(`[Firestore] READ ← getting doc "${key}"`);
  try {
    const snap  = await adminDb.collection(COLLECTION).doc(key).get();
    const value = snap.exists ? snap.data()?.value ?? null : null;
    const preview = value === null ? 'null' : Array.isArray(value)
      ? `Array(${(value as unknown[]).length})`
      : typeof value === 'object'
        ? `Object(${Object.keys(value as object).length} keys)`
        : String(value);
    logger.log(`[Firestore] READ → "${key}" returned: ${preview}`);
    res.json({ value });
  } catch (err) {
    logger.error(`[Firestore] READ error for "${key}":`, err);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

router.put('/:key', requireAuth, dataLimiter, async (req, res) => {
  const key   = req.params.key;
  if (!validateKey(key, res)) return;
  const value = req.body?.value;
  const preview = value === undefined ? 'undefined (body missing!)' : Array.isArray(value)
    ? `Array(${(value as unknown[]).length})`
    : typeof value === 'object'
      ? `Object(${Object.keys(value as object).length} keys)`
      : String(value);
  logger.log(`[Client→Server] PUT received for "${key}": ${preview}`);
  if (value === undefined) {
    logger.error(`[Server] PUT /${key} — req.body:`, req.body);
    res.status(400).json({ error: 'Missing value in request body' });
    return;
  }
  const validator = KEY_VALIDATORS[key];
  if (!validator || !validator(value)) {
    res.status(400).json({ error: 'Invalid value shape for key' });
    return;
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > 500_000) {
    res.status(413).json({ error: 'Value too large' });
    return;
  }
  try {
    const snap   = await adminDb.collection(COLLECTION).doc(key).get();
    const before = snap.exists ? (snap.data()?.value ?? null) : null;

    logger.log(`[Server→Firestore] WRITE → "${key}"`);
    await adminDb.collection(COLLECTION).doc(key).set({ value });
    logger.log(`[Firestore] WRITE ✓ "${key}" saved successfully`);

    auditDataChange(key, before, value, req).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    logger.error(`[Firestore] WRITE error for "${key}":`, err);
    res.status(500).json({ error: 'Failed to write data' });
  }
});

router.get('/:key/stream', requireAuth, dataLimiter, (req, res) => {
  const key = req.params.key;
  if (!validateKey(key, res)) return;
  logger.log(`[SSE] Client connected — subscribing to Firestore "${key}"`);

  res.setHeader('Content-Type',       'text/event-stream');
  res.setHeader('Cache-Control',      'no-cache');
  res.setHeader('Connection',         'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': heartbeat\n\n');
  }, 20_000);

  const unsubscribe = adminDb
    .collection(COLLECTION)
    .doc(key)
    .onSnapshot(
      (snap) => {
        const value   = snap.exists ? snap.data()?.value ?? null : null;
        const preview = value === null ? 'null' : Array.isArray(value)
          ? `Array(${(value as unknown[]).length})`
          : typeof value === 'object'
            ? `Object(${Object.keys(value as object).length} keys)`
            : String(value);
        logger.log(`[Firestore→SSE] snapshot for "${key}": ${preview} — pushing to client`);
        res.write(`data: ${JSON.stringify({ value })}\n\n`);
      },
      (err) => {
        logger.error(`[Firestore→SSE] error for "${key}":`, err);
        res.end();
      }
    );

  req.on('close', () => {
    logger.log(`[SSE] Client disconnected — unsubscribing from "${key}"`);
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;

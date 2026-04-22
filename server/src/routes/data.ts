import { Router } from 'express';
import { adminDb } from '../lib/firebase-admin';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

const router  = Router();
const COLLECTION = 'hmal-data';

router.get('/:key', requireAuth, async (req, res) => {
  const key = req.params.key;
  logger.log(`[Firestore] READ ← getting doc "${key}"`);
  try {
    const snap = await adminDb.collection(COLLECTION).doc(key).get();
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

router.put('/:key', requireAuth, async (req, res) => {
  const key = req.params.key;
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
  try {
    logger.log(`[Server→Firestore] WRITE → "${key}"`);
    await adminDb.collection(COLLECTION).doc(key).set({ value });
    logger.log(`[Firestore] WRITE ✓ "${key}" saved successfully`);
    res.json({ ok: true });
  } catch (err) {
    logger.error(`[Firestore] WRITE error for "${key}":`, err);
    res.status(500).json({ error: 'Failed to write data' });
  }
});

router.get('/:key/stream', requireAuth, (req, res) => {
  const key = req.params.key;
  logger.log(`[SSE] Client connected — subscribing to Firestore "${key}"`);

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const unsubscribe = adminDb
    .collection(COLLECTION)
    .doc(key)
    .onSnapshot(
      (snap) => {
        const value = snap.exists ? snap.data()?.value ?? null : null;
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
    unsubscribe();
  });
});

export default router;

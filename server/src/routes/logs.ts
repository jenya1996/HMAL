import { Router } from 'express';
import { adminDb } from '../lib/firebase-admin';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { logger } from '../lib/logger';

const router           = Router();
const AUDIT_COLLECTION = 'audit-logs';

// GET /api/logs?limit=200&from=ISO&to=ISO
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? '200', 10), 500);
    const from  = req.query.from as string | undefined;
    const to    = req.query.to   as string | undefined;

    let query: FirebaseFirestore.Query = adminDb
      .collection(AUDIT_COLLECTION)
      .orderBy('timestamp', 'desc');

    if (from) query = query.where('timestamp', '>=', from);
    if (to)   query = query.where('timestamp', '<=', to);

    query = query.limit(limit);

    const snap = await query.get();
    const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ logs });
  } catch (err) {
    logger.error('[Logs] fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET /api/logs/stream  — SSE: push each new audit log entry as it arrives
router.get('/stream', requireAuth, requireAdmin, (req, res) => {
  res.setHeader('Content-Type',       'text/event-stream');
  res.setHeader('Cache-Control',      'no-cache');
  res.setHeader('Connection',         'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Subscribe to the most-recent document only; push additions to the client
  const unsubscribe = adminDb
    .collection(AUDIT_COLLECTION)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .onSnapshot(
      (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const log = { id: change.doc.id, ...change.doc.data() };
            res.write(`data: ${JSON.stringify({ log })}\n\n`);
          }
        });
      },
      (err) => {
        logger.error('[Logs SSE] error:', err);
        res.end();
      }
    );

  req.on('close', () => unsubscribe());
});

export default router;

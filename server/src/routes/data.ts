import { Router } from 'express';
import { adminDb } from '../lib/firebase-admin';
import { requireAuth } from '../middleware/auth';

const router  = Router();
const COLLECTION = 'hmal-data';

router.get('/:key', requireAuth, async (req, res) => {
  const snap = await adminDb.collection(COLLECTION).doc(req.params.key).get();
  res.json({ value: snap.exists ? snap.data()?.value ?? null : null });
});

router.put('/:key', requireAuth, async (req, res) => {
  await adminDb.collection(COLLECTION).doc(req.params.key).set({ value: req.body.value });
  res.json({ ok: true });
});

// Server-Sent Events — streams Firestore changes to the client in real time
router.get('/:key/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const unsubscribe = adminDb
    .collection(COLLECTION)
    .doc(req.params.key)
    .onSnapshot((snap) => {
      const value = snap.exists ? snap.data()?.value ?? null : null;
      res.write(`data: ${JSON.stringify({ value })}\n\n`);
    });

  req.on('close', unsubscribe);
});

export default router;

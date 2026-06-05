import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminDb } from '../lib/firebase-admin';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

const router = Router();
const USER_PREFS_COLLECTION = 'hmal-user-prefs';
const GLOBAL_COLLECTION     = 'hmal-data';

const prefsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: (req) => (req.cookies as Record<string, string>)?.__session ?? req.ip ?? 'unknown',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const ALLOWED_PREF_KEYS = new Set([
  'dashboard-config',
  'idle-timeout',
  'soldier-table-state',
  'schedule-table-state',
]);

const PREF_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  'dashboard-config':    v => typeof v === 'object' && v !== null && !Array.isArray(v),
  'idle-timeout':        v => typeof v === 'number' && v >= 300_000 && v <= 7_200_000,
  'soldier-table-state':  v => typeof v === 'object' && v !== null && !Array.isArray(v)
                               && 'search' in (v as object) && 'filters' in (v as object),
  'schedule-table-state': v => typeof v === 'object' && v !== null && !Array.isArray(v)
                               && 'search' in (v as object) && 'filters' in (v as object),
};

const MIGRATION_SEEDS: Record<string, string> = {
  'dashboard-config': 'hmal-dashboard-config',
};

router.get('/:key', requireAuth, prefsLimiter, async (req, res) => {
  const key = req.params.key;
  if (!ALLOWED_PREF_KEYS.has(key)) { res.status(400).json({ error: 'Invalid key' }); return; }
  const uid = (req as any).uid as string;
  logger.log(`[Prefs] GET uid=${uid} key="${key}"`);
  try {
    const snap    = await adminDb.collection(USER_PREFS_COLLECTION).doc(uid).get();
    const existing = snap.exists ? (snap.data()?.value as Record<string, unknown> | undefined) : undefined;

    if (existing && key in existing) {
      res.json({ value: existing[key] });
      return;
    }

    const seedDoc = MIGRATION_SEEDS[key];
    if (seedDoc) {
      const globalSnap = await adminDb.collection(GLOBAL_COLLECTION).doc(seedDoc).get();
      const seedValue  = globalSnap.exists ? (globalSnap.data()?.value ?? null) : null;
      if (seedValue !== null) {
        await adminDb.collection(USER_PREFS_COLLECTION).doc(uid).set(
          { value: { ...(existing ?? {}), [key]: seedValue } },
          { merge: true }
        );
        logger.log(`[Prefs] seeded uid=${uid} key="${key}" from global`);
        res.json({ value: seedValue });
        return;
      }
    }

    res.json({ value: null });
  } catch (err) {
    logger.error(`[Prefs] GET error uid=${uid} key="${key}":`, err);
    res.status(500).json({ error: 'Failed to read preference' });
  }
});

router.put('/:key', requireAuth, prefsLimiter, async (req, res) => {
  const key = req.params.key;
  if (!ALLOWED_PREF_KEYS.has(key)) { res.status(400).json({ error: 'Invalid key' }); return; }
  const value = req.body?.value;
  if (value === undefined) { res.status(400).json({ error: 'Missing value in request body' }); return; }
  const validator = PREF_VALIDATORS[key];
  if (!validator || !validator(value)) { res.status(400).json({ error: 'Invalid value shape for key' }); return; }
  if (JSON.stringify(value).length > 100_000) { res.status(413).json({ error: 'Value too large' }); return; }
  const uid = (req as any).uid as string;
  logger.log(`[Prefs] PUT uid=${uid} key="${key}"`);
  try {
    await adminDb.collection(USER_PREFS_COLLECTION).doc(uid).set(
      { value: { [key]: value } },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error(`[Prefs] PUT error uid=${uid} key="${key}":`, err);
    res.status(500).json({ error: 'Failed to write preference' });
  }
});

export default router;

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminAuth } from '../lib/firebase-admin';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { logger } from '../lib/logger';
import { writeAuditLog, getClientIp } from '../lib/auditLogger';

const router = Router();
const SESSION_DURATION_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

const failedAttempts = new Map<string, { count: number; firstAt: number }>();
const LOCKOUT_MAX = 10;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

const loginLimiter = rateLimit({
  windowMs:       15 * 60 * 1000, // 15 minutes
  max:            20,
  standardHeaders: 'draft-7',
  legacyHeaders:  false,
  message:        { error: 'Too many login attempts, please try again later.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const attempts = failedAttempts.get(email);
  if (attempts && attempts.count >= LOCKOUT_MAX && Date.now() - attempts.firstAt < LOCKOUT_WINDOW_MS) {
    res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
    return;
  }

  const ip        = getClientIp(req);
  const userAgent = req.headers['user-agent'] ?? '';
  const meta      = { ip, userAgent };
  const ts        = new Date().toISOString();

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );

    if (!response.ok) {
      const prev = failedAttempts.get(email);
      if (prev && Date.now() - prev.firstAt < LOCKOUT_WINDOW_MS) {
        failedAttempts.set(email, { count: prev.count + 1, firstAt: prev.firstAt });
      } else {
        failedAttempts.set(email, { count: 1, firstAt: Date.now() });
      }
      await writeAuditLog({ timestamp: ts, userId: 'unknown', userEmail: email,
        action: 'LOGIN_FAILED', category: 'auth',
        description: `Failed login attempt for ${email}`, meta });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    failedAttempts.delete(email);
    const { idToken } = (await response.json()) as { idToken: string };
    const decoded     = await adminAuth.verifyIdToken(idToken);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });

    res.cookie('__session', sessionCookie, {
      maxAge:   SESSION_DURATION_MS,
      httpOnly: true,
      secure:   true,
      sameSite: 'strict',
    });

    await writeAuditLog({ timestamp: ts, userId: decoded.uid, userEmail: email,
      action: 'LOGIN', category: 'auth',
      description: `User logged in`, meta });

    res.json({ ok: true });
  } catch (err) {
    logger.error('[auth] login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', async (req, res) => {
  const token = req.cookies?.__session;
  if (token) {
    try {
      const decoded = await adminAuth.verifySessionCookie(token, false);
      // Revoke all refresh tokens so the session is invalidated server-side
      await adminAuth.revokeRefreshTokens(decoded.uid);
      await writeAuditLog({
        timestamp: new Date().toISOString(),
        userId:    decoded.uid,
        userEmail: decoded.email ?? 'unknown',
        action: 'LOGOUT', category: 'auth',
        description: `User logged out`,
        meta: { ip: getClientIp(req), userAgent: req.headers['user-agent'] ?? '' },
      });
    } catch { /* expired cookie — still log out */ }
  }
  res.clearCookie('__session', {
    httpOnly: true,
    secure:   true,
    sameSite: 'strict',
  });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = (req as any).user;
  res.json({ uid: user.uid, admin: !!user.admin });
});

// Admin-only: create a new Firebase Auth account for a soldier.
// Requires the caller to have the Firebase custom claim { admin: true }.
// Bootstrap the first admin via: adminAuth.setCustomUserClaims(uid, { admin: true })
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const actor = (req as any).user;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    res.status(400).json({ error: 'Password must be at least 8 characters and contain an uppercase letter and a number' });
    return;
  }

  try {
    const newUser = await adminAuth.createUser({ email, password });
    await writeAuditLog({
      timestamp: new Date().toISOString(),
      userId:    actor?.uid   ?? 'unknown',
      userEmail: actor?.email ?? 'unknown',
      action: 'USER_CREATED', category: 'auth',
      description: `Created login account for ${email}`,
      details: { newUserId: newUser.uid, newUserEmail: email },
      meta: { ip: getClientIp(req), userAgent: req.headers['user-agent'] ?? '' },
    });
    res.json({ uid: newUser.uid });
  } catch (err: any) {
    logger.error('[auth] create user error:', err);
    res.status(400).json({ error: err.message ?? 'Failed to create user' });
  }
});

// Admin-only: list all Firebase Auth users with their admin claim status
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users: { uid: string; email: string; admin: boolean }[] = [];
    let pageToken: string | undefined;
    do {
      const result = await adminAuth.listUsers(1000, pageToken);
      for (const u of result.users) {
        users.push({ uid: u.uid, email: u.email ?? '', admin: !!(u.customClaims as any)?.admin });
      }
      pageToken = result.pageToken;
    } while (pageToken);
    res.json({ users });
  } catch (err: any) {
    logger.error('[auth] list users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Admin-only: grant or revoke the admin claim on a user
router.patch('/users/:uid/admin', requireAuth, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  const { admin } = req.body as { admin: boolean };
  const actor = (req as any).user;

  if (typeof admin !== 'boolean') {
    res.status(400).json({ error: 'admin must be a boolean' });
    return;
  }
  // Prevent self-demotion
  if (!admin && uid === actor.uid) {
    res.status(400).json({ error: 'You cannot remove your own admin privileges' });
    return;
  }

  try {
    const target = await adminAuth.getUser(uid);
    await adminAuth.setCustomUserClaims(uid, { admin });
    await writeAuditLog({
      timestamp: new Date().toISOString(),
      userId:    actor?.uid   ?? 'unknown',
      userEmail: actor?.email ?? 'unknown',
      action:    admin ? 'ADMIN_GRANTED' : 'ADMIN_REVOKED',
      category:  'auth',
      description: `${admin ? 'Granted' : 'Revoked'} admin for ${target.email ?? uid}`,
      details: { targetUid: uid, targetEmail: target.email },
      meta: { ip: getClientIp(req), userAgent: req.headers['user-agent'] ?? '' },
    });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('[auth] set admin claim error:', err);
    res.status(400).json({ error: err.message ?? 'Failed to update admin claim' });
  }
});

export default router;

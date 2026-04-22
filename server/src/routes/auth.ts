import { Router } from 'express';
import { adminAuth } from '../lib/firebase-admin';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

const router = Router();
const SESSION_DURATION_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );

    if (!response.ok) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const { idToken } = (await response.json()) as { idToken: string };
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });

    res.cookie('session', sessionCookie, {
      maxAge:   SESSION_DURATION_MS,
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error('[auth] login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('session', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ uid: (req as any).uid });
});

router.post('/users', requireAuth, async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  try {
    const user = await adminAuth.createUser({ email, password });
    res.json({ uid: user.uid });
  } catch (err: any) {
    logger.error('[auth] create user error:', err);
    res.status(400).json({ error: err.message ?? 'Failed to create user' });
  }
});

export default router;

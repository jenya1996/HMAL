import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.__session;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const decoded = await adminAuth.verifySessionCookie(token, true);
    (req as any).uid  = decoded.uid;
    (req as any).user = decoded;
    logger.log(`[Auth] ✓ verified uid=${decoded.uid}`);
    next();
  } catch (err) {
    logger.error('[Auth] ✗ invalid session cookie:', err);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

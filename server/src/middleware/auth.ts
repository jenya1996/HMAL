import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.session;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const decoded = await adminAuth.verifySessionCookie(token, true);
    (req as any).uid  = decoded.uid;
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

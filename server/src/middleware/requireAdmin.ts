import { Request, Response, NextFunction } from 'express';

/**
 * Requires the authenticated user to have the Firebase custom claim { admin: true }.
 * Always apply requireAuth before this middleware.
 *
 * Bootstrap: set the claim once via Firebase Admin SDK:
 *   adminAuth.setCustomUserClaims(uid, { admin: true });
 * or via the Firebase console under Authentication > Users > Edit user > Custom claims.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user?.admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

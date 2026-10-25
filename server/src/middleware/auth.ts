import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDB } from '../db';

export const JWT_SECRET = process.env.JWT_SECRET || 'eventsphere_super_secure_jwt_secret_change_in_prod_32chars_min';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'ORGANIZER' | 'ATTENDEE';
  status: 'ACTIVE' | 'SUSPENDED';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      correlationId?: string;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || req.cookies?.token;

  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    
    // Verify user is still active in DB
    const db = await getDB();
    const userRes = await db.query(
      `SELECT "id", "email", "name", "role", "status" FROM "User" WHERE "id" = $1`,
      [decoded.id]
    );

    if (userRes.rowCount === 0 || userRes.rows[0].status === 'SUSPENDED') {
      req.user = undefined;
      return next();
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    req.user = undefined;
    next();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication Required',
      message: 'You must be signed in to perform this action.',
    });
    return;
  }
  next();
}

export function requireRole(...roles: Array<'ADMIN' | 'ORGANIZER' | 'ATTENDEE'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication Required',
        message: 'You must be signed in.',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required role: ${roles.join(' or ')}. Current role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}

/**
 * Tenant Isolation check:
 * Validates that an event belongs directly to the authenticated organizer,
 * or allows platform ADMINs to moderate.
 */
export async function requireEventOwnership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication Required' });
    return;
  }

  if (req.user.role === 'ADMIN') {
    return next();
  }

  const eventId = req.params.id || req.body.eventId;
  if (!eventId) {
    res.status(400).json({ error: 'Missing event identifier' });
    return;
  }

  const db = await getDB();
  const eventRes = await db.query(
    `SELECT "id", "organizerId" FROM "Event" WHERE "id" = $1`,
    [eventId]
  );

  if (eventRes.rowCount === 0) {
    res.status(404).json({ error: 'Event Not Found' });
    return;
  }

  const event = eventRes.rows[0];
  if (event.organizerId !== req.user.id) {
    res.status(403).json({
      error: 'Tenant Access Denied',
      message: 'You do not have permission to manage this event or view its private tenant data.',
    });
    return;
  }

  next();
}

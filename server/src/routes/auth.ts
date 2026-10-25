import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDB } from '../db';
import { generateToken, requireAuth, AuthUser } from '../middleware/auth';

const router = Router();

const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ORGANIZER', 'ATTENDEE']).default('ATTENDEE'), // Public registration CANNOT register as ADMIN!
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.issues.map((e: any) => e.message),
      });
      return;
    }

    const { name, email, password, role } = parseResult.data;
    const db = await getDB();

    // Check duplicate email
    const existing = await db.query(`SELECT "id" FROM "User" WHERE LOWER("email") = LOWER($1)`, [email]);
    if (existing.rowCount > 0) {
      res.status(409).json({
        error: 'Email In Use',
        message: 'An account with this email address already exists.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${role.toLowerCase().slice(0, 3)}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await db.query(
      `INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "status")
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
      [userId, name, email.toLowerCase(), passwordHash, role]
    );

    const user: AuthUser = {
      id: userId,
      name,
      email: email.toLowerCase(),
      role: role as any,
      status: 'ACTIVE',
    };

    const token = generateToken(user);

    // Set secure cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Record audit log
    await db.query(
      `INSERT INTO "AuditLog" ("id", "userId", "action", "resourceType", "resourceId", "details")
       VALUES ($1, $2, 'USER_REGISTER', 'USER', $3, $4)`,
      [`aud_${Date.now()}`, userId, userId, `User registered with role ${role}`]
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user,
    });
  } catch (err: any) {
    console.error('[Auth] Registration error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Could not complete registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.issues.map((e: any) => e.message),
      });
      return;
    }

    const { email, password } = parseResult.data;
    const db = await getDB();

    const userRes = await db.query(
      `SELECT "id", "name", "email", "passwordHash", "role", "status" 
       FROM "User" 
       WHERE LOWER("email") = LOWER($1)`,
      [email]
    );

    if (userRes.rowCount === 0) {
      res.status(401).json({
        error: 'Invalid Credentials',
        message: 'Invalid email or password.',
      });
      return;
    }

    const dbUser = userRes.rows[0];

    if (dbUser.status === 'SUSPENDED') {
      res.status(403).json({
        error: 'Account Suspended',
        message: 'Your account has been suspended by an administrator. Please contact support.',
      });
      return;
    }

    const passwordValid = await bcrypt.compare(password, dbUser.passwordHash);
    if (!passwordValid) {
      res.status(401).json({
        error: 'Invalid Credentials',
        message: 'Invalid email or password.',
      });
      return;
    }

    const user: AuthUser = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status,
    };

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await db.query(
      `INSERT INTO "AuditLog" ("id", "userId", "action", "resourceType", "resourceId", "details")
       VALUES ($1, $2, 'USER_LOGIN', 'USER', $3, 'Successful login')`,
      [`aud_${Date.now()}`, user.id, user.id]
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user,
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Could not log in.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({ user: req.user });
});

export default router;

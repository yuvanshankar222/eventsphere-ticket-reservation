import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { invalidateEventCache } from '../cache/redis';

const router = Router();

// Platform Admin authorization only
router.use(requireAuth);
router.use(requireRole('ADMIN'));

// GET /api/admin/dashboard (Platform-wide health & metrics)
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();

    // User breakdown
    const userStats = await db.query(
      `SELECT 
        COUNT(*) as "totalUsers",
        COUNT(CASE WHEN "role" = 'ORGANIZER' THEN 1 END) as "totalOrganizers",
        COUNT(CASE WHEN "role" = 'ATTENDEE' THEN 1 END) as "totalAttendees",
        COUNT(CASE WHEN "status" = 'SUSPENDED' THEN 1 END) as "suspendedUsers"
       FROM "User"`
    );

    // Event breakdown
    const eventStats = await db.query(
      `SELECT 
        COUNT(*) as "totalEvents",
        COUNT(CASE WHEN "status" = 'PUBLISHED' THEN 1 END) as "publishedEvents",
        COUNT(CASE WHEN "status" = 'DRAFT' THEN 1 END) as "draftEvents",
        COUNT(CASE WHEN "status" = 'CANCELLED' THEN 1 END) as "cancelledEvents"
       FROM "Event"`
    );

    // Platform revenue & transactions
    const paymentStats = await db.query(
      `SELECT 
        COUNT(CASE WHEN "status" = 'SUCCEEDED' THEN 1 END) as "successfulTransactions",
        COUNT(CASE WHEN "status" = 'FAILED' THEN 1 END) as "failedTransactions",
        COALESCE(SUM(CASE WHEN "status" = 'SUCCEEDED' THEN "amount" ELSE 0 END), 0) as "platformRevenue"
       FROM "Payment"`
    );

    res.status(200).json({
      metrics: {
        totalUsers: parseInt(userStats.rows[0]?.totalUsers || '0', 10),
        totalOrganizers: parseInt(userStats.rows[0]?.totalOrganizers || '0', 10),
        totalAttendees: parseInt(userStats.rows[0]?.totalAttendees || '0', 10),
        suspendedUsers: parseInt(userStats.rows[0]?.suspendedUsers || '0', 10),
        totalEvents: parseInt(eventStats.rows[0]?.totalEvents || '0', 10),
        publishedEvents: parseInt(eventStats.rows[0]?.publishedEvents || '0', 10),
        draftEvents: parseInt(eventStats.rows[0]?.draftEvents || '0', 10),
        cancelledEvents: parseInt(eventStats.rows[0]?.cancelledEvents || '0', 10),
        successfulTransactions: parseInt(paymentStats.rows[0]?.successfulTransactions || '0', 10),
        failedTransactions: parseInt(paymentStats.rows[0]?.failedTransactions || '0', 10),
        platformRevenue: parseFloat(paymentStats.rows[0]?.platformRevenue || '0'),
        currency: 'INR',
      },
    });
  } catch (err: any) {
    console.error('[Admin] Dashboard error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/users
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const { role, status, search, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let sql = `SELECT "id", "name", "email", "role", "status", "createdAt" FROM "User" WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      sql += ` AND "role" = $${paramIndex++}`;
      params.push(role);
    }

    if (status) {
      sql += ` AND "status" = $${paramIndex++}`;
      params.push(status);
    }

    if (search) {
      sql += ` AND (LOWER("name") LIKE $${paramIndex} OR LOWER("email") LIKE $${paramIndex})`;
      params.push(`%${(search as string).toLowerCase()}%`);
      paramIndex++;
    }

    sql += ` ORDER BY "createdAt" DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limitNum, offset);

    const result = await db.query(sql, params);
    const countRes = await db.query(`SELECT COUNT(*) as count FROM "User"`);

    res.status(200).json({
      users: result.rows,
      total: parseInt(countRes.rows[0]?.count || '0', 10),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err: any) {
    console.error('[Admin] Users list error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/admin/users/:id/status (Suspend or Reactivate)
const UserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.string().optional(),
});

router.patch('/users/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parseResult = UserStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation Error', details: parseResult.error.issues.map((e: any) => e.message) });
      return;
    }

    const { status, reason } = parseResult.data;
    const db = await getDB();

    // Prevent admin from suspending themselves
    if (id === req.user!.id) {
      res.status(400).json({ error: 'Cannot Alter Own Status', message: 'You cannot suspend your own administrative account.' });
      return;
    }

    await db.query(
      `UPDATE "User" SET "status" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2`,
      [status, id]
    );

    // Record in Audit Log
    await db.query(
      `INSERT INTO "AuditLog" ("id", "userId", "action", "resourceType", "resourceId", "details")
       VALUES ($1, $2, 'USER_STATUS_CHANGE', 'USER', $3, $4)`,
      [
        `aud_${Date.now()}`,
        req.user!.id,
        id,
        `Changed user status to ${status}. Reason: ${reason || 'Administrative action'}`,
      ]
    );

    res.status(200).json({ message: `User status updated to ${status}`, userId: id, status });
  } catch (err: any) {
    console.error('[Admin] User status error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/events (Platform-wide moderation)
router.get('/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const result = await db.query(
      `SELECT e.*, u."name" as "organizerName", u."email" as "organizerEmail",
              COALESCE(SUM(t."soldQuantity"), 0) as "soldTickets",
              COALESCE(SUM(t."totalQuantity"), 0) as "totalCapacity"
       FROM "Event" e
       JOIN "User" u ON e."organizerId" = u."id"
       LEFT JOIN "TicketType" t ON e."id" = t."eventId"
       GROUP BY e."id", u."name", u."email"
       ORDER BY e."createdAt" DESC
       LIMIT 100`
    );

    res.status(200).json({ events: result.rows });
  } catch (err: any) {
    console.error('[Admin] Events list error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const result = await db.query(
      `SELECT a.*, u."name" as "userName", u."email" as "userEmail"
       FROM "AuditLog" a
       LEFT JOIN "User" u ON a."userId" = u."id"
       ORDER BY a."createdAt" DESC
       LIMIT 100`
    );

    res.status(200).json({ auditLogs: result.rows });
  } catch (err: any) {
    console.error('[Admin] Audit logs error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

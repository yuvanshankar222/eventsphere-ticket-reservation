import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB } from '../db';
import { requireAuth, requireRole, requireEventOwnership } from '../middleware/auth';
import { getCached, setCached, invalidateEventCache, CACHE_KEYS } from '../cache/redis';

const router = Router();

const EventInputSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(2, 'Category is required'),
  venue: z.string().min(2, 'Venue is required'),
  city: z.string().min(2, 'City is required'),
  fullAddress: z.string().min(5, 'Full address is required'),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid start date'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid end date'),
  timeZone: z.string().default('Asia/Kolkata'),
  imageUrl: z.string().url('Must be a valid image URL'),
  salesStartTime: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid sales start time'),
  salesCutoffTime: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid sales cutoff time'),
});

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');
  return `${base}-${Math.random().toString(36).substring(2, 6)}`;
}

// GET /api/events (Public Event Discovery with Redis caching)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, city, search, minPrice, maxPrice, page = '1', limit = '12' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 12));
    const offset = (pageNum - 1) * limitNum;

    const cacheKey = CACHE_KEYS.EVENTS_LIST(
      Buffer.from(JSON.stringify({ category, city, search, minPrice, maxPrice, pageNum, limitNum })).toString('base64')
    );

    const cachedData = await getCached<any>(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      res.status(200).json(cachedData);
      return;
    }

    const db = await getDB();

    let sql = `
      SELECT 
        e."id", e."title", e."slug", e."description", e."category", e."venue", 
        e."city", e."startDate", e."endDate", e."timeZone", e."imageUrl", 
        e."salesStartTime", e."salesCutoffTime", e."status",
        u."name" as "organizerName",
        COALESCE(MIN(t."price"), 0) as "startingPrice",
        COALESCE(SUM(t."totalQuantity" - t."soldQuantity" - t."heldQuantity"), 0) as "availableTickets"
      FROM "Event" e
      JOIN "User" u ON e."organizerId" = u."id"
      LEFT JOIN "TicketType" t ON e."id" = t."eventId" AND t."isActive" = true
      WHERE e."status" = 'PUBLISHED'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      sql += ` AND LOWER(e."category") = LOWER($${paramIndex++})`;
      params.push(category);
    }

    if (city) {
      sql += ` AND LOWER(e."city") = LOWER($${paramIndex++})`;
      params.push(city);
    }

    if (search) {
      sql += ` AND (LOWER(e."title") LIKE $${paramIndex} OR LOWER(e."description") LIKE $${paramIndex} OR LOWER(e."venue") LIKE $${paramIndex})`;
      params.push(`%${(search as string).toLowerCase()}%`);
      paramIndex++;
    }

    sql += ` GROUP BY e."id", u."name"`;

    if (minPrice || maxPrice) {
      const havingConditions: string[] = [];
      if (minPrice) {
        havingConditions.push(`COALESCE(MIN(t."price"), 0) >= $${paramIndex++}`);
        params.push(parseFloat(minPrice as string));
      }
      if (maxPrice) {
        havingConditions.push(`COALESCE(MIN(t."price"), 0) <= $${paramIndex++}`);
        params.push(parseFloat(maxPrice as string));
      }
      sql += ` HAVING ${havingConditions.join(' AND ')}`;
    }

    sql += ` ORDER BY e."startDate" ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limitNum, offset);

    const result = await db.query(sql, params);

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM "Event" WHERE "status" = 'PUBLISHED'`;
    const countRes = await db.query(countSql);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const payload = {
      events: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    // Cache result with 5-minute TTL
    await setCached(cacheKey, payload, 300);
    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(payload);
  } catch (err: any) {
    console.error('[Events] Error fetching events:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve events.' });
  }
});

// GET /api/events/:id (Public Event Detail with live ticket categories)
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();

    // Check if UUID or slug
    const isUuid = id.startsWith('evt_') || id.includes('-');
    const eventRes = await db.query(
      `SELECT e.*, u."name" as "organizerName", u."email" as "organizerEmail"
       FROM "Event" e
       JOIN "User" u ON e."organizerId" = u."id"
       WHERE (e."id" = $1 OR e."slug" = $1)`,
      [id]
    );

    if (eventRes.rowCount === 0) {
      res.status(404).json({ error: 'Event Not Found', message: 'No event was found matching this identifier.' });
      return;
    }

    const event = eventRes.rows[0];

    // Non-organizers and public users can ONLY view PUBLISHED events
    if (event.status !== 'PUBLISHED') {
      const isOwner = req.user && (req.user.id === event.organizerId || req.user.role === 'ADMIN');
      if (!isOwner) {
        res.status(404).json({ error: 'Event Not Found', message: 'This event is not publicly available.' });
        return;
      }
    }

    // Fetch associated ticket tiers
    const ticketsRes = await db.query(
      `SELECT 
        "id", "name", "description", "price", "currency", 
        "totalQuantity", "soldQuantity", "heldQuantity",
        ("totalQuantity" - "soldQuantity" - "heldQuantity") as "availableQuantity",
        "salesStartTime", "salesCutoffTime", "purchaseLimit", "isActive"
       FROM "TicketType"
       WHERE "eventId" = $1 AND "isActive" = true
       ORDER BY "price" ASC`,
      [event.id]
    );

    res.status(200).json({
      event,
      ticketTypes: ticketsRes.rows,
    });
  } catch (err: any) {
    console.error('[Events] Detail error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve event.' });
  }
});

// POST /api/events (Organizer only)
router.post('/', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = EventInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.issues.map((e: any) => e.message),
      });
      return;
    }

    const data = parseResult.data;
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const salesStart = new Date(data.salesStartTime);
    const salesCutoff = new Date(data.salesCutoffTime);

    if (endDate <= startDate) {
      res.status(400).json({ error: 'Validation Error', message: 'End date must be after start date.' });
      return;
    }

    if (salesCutoff <= salesStart) {
      res.status(400).json({ error: 'Validation Error', message: 'Sales cutoff time must be after sales start time.' });
      return;
    }

    const db = await getDB();
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slug = generateSlug(data.title);

    await db.query(
      `INSERT INTO "Event" (
        "id", "title", "slug", "description", "category", "venue", "city", 
        "fullAddress", "startDate", "endDate", "timeZone", "imageUrl", 
        "status", "salesStartTime", "salesCutoffTime", "organizerId"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'DRAFT', $13, $14, $15)`,
      [
        eventId,
        data.title,
        slug,
        data.description,
        data.category,
        data.venue,
        data.city,
        data.fullAddress,
        startDate,
        endDate,
        data.timeZone,
        data.imageUrl,
        salesStart,
        salesCutoff,
        req.user!.id,
      ]
    );

    // Invalidate Redis cache
    await invalidateEventCache();

    // Audit log
    await db.query(
      `INSERT INTO "AuditLog" ("id", "userId", "action", "resourceType", "resourceId", "details")
       VALUES ($1, $2, 'EVENT_CREATE', 'EVENT', $3, $4)`,
      [`aud_${Date.now()}`, req.user!.id, eventId, `Created event: ${data.title}`]
    );

    res.status(201).json({
      message: 'Event created successfully as DRAFT',
      event: {
        id: eventId,
        slug,
        ...data,
        status: 'DRAFT',
        organizerId: req.user!.id,
      },
    });
  } catch (err: any) {
    console.error('[Events] Create error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create event.' });
  }
});

// PUT /api/events/:id (Organizer only, with strict tenant ownership validation)
router.put('/:id', requireAuth, requireRole('ORGANIZER', 'ADMIN'), requireEventOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = EventInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.issues.map((e: any) => e.message),
      });
      return;
    }

    const { id } = req.params;
    const data = parseResult.data;
    const db = await getDB();

    await db.query(
      `UPDATE "Event" 
       SET "title" = $1, "description" = $2, "category" = $3, "venue" = $4, 
           "city" = $5, "fullAddress" = $6, "startDate" = $7, "endDate" = $8, 
           "timeZone" = $9, "imageUrl" = $10, "salesStartTime" = $11, 
           "salesCutoffTime" = $12, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $13`,
      [
        data.title,
        data.description,
        data.category,
        data.venue,
        data.city,
        data.fullAddress,
        new Date(data.startDate),
        new Date(data.endDate),
        data.timeZone,
        data.imageUrl,
        new Date(data.salesStartTime),
        new Date(data.salesCutoffTime),
        id,
      ]
    );

    await invalidateEventCache(id);

    res.status(200).json({
      message: 'Event updated successfully',
      eventId: id,
    });
  } catch (err: any) {
    console.error('[Events] Update error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update event.' });
  }
});

// POST /api/events/:id/publish (Organizer only)
router.post('/:id/publish', requireAuth, requireRole('ORGANIZER', 'ADMIN'), requireEventOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();

    // Check that at least one ticket type exists before publishing
    const ticketCheck = await db.query(
      `SELECT COUNT(*) as count FROM "TicketType" WHERE "eventId" = $1 AND "isActive" = true`,
      [id]
    );

    if (parseInt(ticketCheck.rows[0]?.count || '0', 10) === 0) {
      res.status(400).json({
        error: 'Publication Incomplete',
        message: 'Cannot publish an event without at least one active ticket category.',
      });
      return;
    }

    await db.query(
      `UPDATE "Event" 
       SET "status" = 'PUBLISHED', "updatedAt" = CURRENT_TIMESTAMP 
       WHERE "id" = $1`,
      [id]
    );

    await invalidateEventCache(id);

    await db.query(
      `INSERT INTO "AuditLog" ("id", "userId", "action", "resourceType", "resourceId", "details")
       VALUES ($1, $2, 'EVENT_PUBLISH', 'EVENT', $3, 'Published event to public catalog')`,
      [`aud_${Date.now()}`, req.user!.id, id]
    );

    res.status(200).json({ message: 'Event published successfully', eventId: id, status: 'PUBLISHED' });
  } catch (err: any) {
    console.error('[Events] Publish error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to publish event.' });
  }
});

// DELETE /api/events/:id (Organizer only)
router.delete('/:id', requireAuth, requireRole('ORGANIZER', 'ADMIN'), requireEventOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();

    // Check if event has confirmed orders
    const ordersRes = await db.query(
      `SELECT COUNT(*) as count FROM "Order" WHERE "eventId" = $1 AND "status" = 'CONFIRMED'`,
      [id]
    );

    const hasOrders = parseInt(ordersRes.rows[0]?.count || '0', 10) > 0;
    if (hasOrders) {
      // Historical integrity protection: CANCEL rather than deleting
      await db.query(
        `UPDATE "Event" 
         SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP 
         WHERE "id" = $1`,
        [id]
      );
      await invalidateEventCache(id);
      res.status(200).json({
        message: 'Event has existing attendee orders. Status transitioned to CANCELLED to preserve financial records.',
        status: 'CANCELLED',
      });
      return;
    }

    await db.query(`UPDATE "Event" SET "status" = 'CANCELLED' WHERE "id" = $1`, [id]);
    await invalidateEventCache(id);
    res.status(200).json({ message: 'Event successfully cancelled', eventId: id });
  } catch (err: any) {
    console.error('[Events] Delete error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete event.' });
  }
});

export default router;

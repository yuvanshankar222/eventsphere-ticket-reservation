import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB } from '../db';
import { requireAuth, requireRole, requireEventOwnership } from '../middleware/auth';
import { invalidateEventCache } from '../cache/redis';

const router = Router();

const TicketTypeInputSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().min(5, 'Description is required'),
  price: z.number().min(0, 'Price must be non-negative'),
  currency: z.string().default('INR'),
  totalQuantity: z.number().int().positive('Total quantity must be a positive integer'),
  salesStartTime: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid sales start time'),
  salesCutoffTime: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid sales cutoff time'),
  purchaseLimit: z.number().int().min(1).max(20).default(5),
});

// GET /api/events/:id/tickets
router.get('/events/:id/tickets', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();

    const result = await db.query(
      `SELECT 
        "id", "eventId", "name", "description", "price", "currency", 
        "totalQuantity", "soldQuantity", "heldQuantity",
        ("totalQuantity" - "soldQuantity" - "heldQuantity") as "availableQuantity",
        "salesStartTime", "salesCutoffTime", "purchaseLimit", "isActive", 
        "createdAt", "updatedAt"
       FROM "TicketType"
       WHERE "eventId" = $1
       ORDER BY "price" ASC`,
      [id]
    );

    res.status(200).json({ ticketTypes: result.rows });
  } catch (err: any) {
    console.error('[Tickets] List error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/events/:id/tickets (Organizer only)
router.post('/events/:id/tickets', requireAuth, requireRole('ORGANIZER', 'ADMIN'), requireEventOwnership, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: eventId } = req.params;
    const parseResult = TicketTypeInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.issues.map((e: any) => e.message),
      });
      return;
    }

    const data = parseResult.data;
    const db = await getDB();
    const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await db.query(
      `INSERT INTO "TicketType" (
        "id", "eventId", "name", "description", "price", "currency", 
        "totalQuantity", "soldQuantity", "heldQuantity", "salesStartTime", 
        "salesCutoffTime", "purchaseLimit", "isActive"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, $8, $9, $10, true)`,
      [
        ticketId,
        eventId,
        data.name,
        data.description,
        data.price,
        data.currency,
        data.totalQuantity,
        new Date(data.salesStartTime),
        new Date(data.salesCutoffTime),
        data.purchaseLimit,
      ]
    );

    await invalidateEventCache(eventId);

    res.status(201).json({
      message: 'Ticket category created successfully',
      ticketType: {
        id: ticketId,
        eventId,
        ...data,
        soldQuantity: 0,
        heldQuantity: 0,
        availableQuantity: data.totalQuantity,
        isActive: true,
      },
    });
  } catch (err: any) {
    console.error('[Tickets] Create error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/tickets/:id (Organizer only, with tenant ownership validation)
router.put('/:id', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();

    // Check ownership
    const ticketRes = await db.query(
      `SELECT t.*, e."organizerId" 
       FROM "TicketType" t 
       JOIN "Event" e ON t."eventId" = e."id" 
       WHERE t."id" = $1`,
      [id]
    );

    if (ticketRes.rowCount === 0) {
      res.status(404).json({ error: 'Ticket Category Not Found' });
      return;
    }

    const ticket = ticketRes.rows[0];
    if (req.user!.role !== 'ADMIN' && ticket.organizerId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden', message: 'You do not own this event.' });
      return;
    }

    const parseResult = TicketTypeInputSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation Error', details: parseResult.error.issues.map((e: any) => e.message) });
      return;
    }

    const update = parseResult.data;

    // Check invariant: totalQuantity cannot be reduced below (soldQuantity + heldQuantity)
    if (update.totalQuantity !== undefined) {
      const committed = ticket.soldQuantity + ticket.heldQuantity;
      if (update.totalQuantity < committed) {
        res.status(400).json({
          error: 'Capacity Invariant Violation',
          message: `Cannot reduce total quantity to ${update.totalQuantity}. At least ${committed} tickets are already committed (${ticket.soldQuantity} sold, ${ticket.heldQuantity} held).`,
        });
        return;
      }
    }

    await db.query(
      `UPDATE "TicketType" 
       SET "name" = COALESCE($1, "name"),
           "description" = COALESCE($2, "description"),
           "price" = COALESCE($3, "price"),
           "totalQuantity" = COALESCE($4, "totalQuantity"),
           "salesStartTime" = COALESCE($5, "salesStartTime"),
           "salesCutoffTime" = COALESCE($6, "salesCutoffTime"),
           "purchaseLimit" = COALESCE($7, "purchaseLimit"),
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $8`,
      [
        update.name ?? null,
        update.description ?? null,
        update.price ?? null,
        update.totalQuantity ?? null,
        update.salesStartTime ? new Date(update.salesStartTime) : null,
        update.salesCutoffTime ? new Date(update.salesCutoffTime) : null,
        update.purchaseLimit ?? null,
        id,
      ]
    );

    await invalidateEventCache(ticket.eventId);

    res.status(200).json({ message: 'Ticket category updated successfully', ticketId: id });
  } catch (err: any) {
    console.error('[Tickets] Update error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/tickets/:id (Organizer only)
router.delete('/:id', requireAuth, requireRole('ORGANIZER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();

    const ticketRes = await db.query(
      `SELECT t.*, e."organizerId" 
       FROM "TicketType" t 
       JOIN "Event" e ON t."eventId" = e."id" 
       WHERE t."id" = $1`,
      [id]
    );

    if (ticketRes.rowCount === 0) {
      res.status(404).json({ error: 'Ticket Category Not Found' });
      return;
    }

    const ticket = ticketRes.rows[0];
    if (req.user!.role !== 'ADMIN' && ticket.organizerId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Soft deactivate to avoid breaking historical records
    await db.query(`UPDATE "TicketType" SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`, [id]);
    await invalidateEventCache(ticket.eventId);

    res.status(200).json({ message: 'Ticket category deactivated successfully', ticketId: id });
  } catch (err: any) {
    console.error('[Tickets] Delete error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

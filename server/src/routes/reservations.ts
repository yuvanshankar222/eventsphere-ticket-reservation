import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB, DBTransaction } from '../db';
import { requireAuth } from '../middleware/auth';
import { invalidateEventCache } from '../cache/redis';

const router = Router();

const ReservationItemInputSchema = z.object({
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

const CreateReservationSchema = z.object({
  eventId: z.string().min(1),
  items: z.array(ReservationItemInputSchema).min(1, 'At least one ticket must be selected'),
  idempotencyKey: z.string().optional(),
});

// POST /api/reservations (Concurrency-Safe Reservation Engine)
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = CreateReservationSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.issues.map((e: any) => e.message),
      });
      return;
    }

    const { eventId, items, idempotencyKey } = parseResult.data;
    const userId = req.user!.id;
    const db = await getDB();

    // Idempotency check if header or body key is passed
    const clientKey = idempotencyKey || (req.headers['idempotency-key'] as string);
    if (clientKey) {
      const existingKey = await db.query(
        `SELECT "responseStatus", "responseBody" FROM "IdempotencyKey" WHERE "key" = $1 AND "userId" = $2`,
        [clientKey, userId]
      );
      if (existingKey.rowCount > 0) {
        const cached = existingKey.rows[0];
        res.status(cached.responseStatus).json(JSON.parse(cached.responseBody));
        return;
      }
    }

    // Record initial booking attempt
    await db.query(
      `INSERT INTO "BookingAttempt" ("id", "eventId", "userId", "status")
       VALUES ($1, $2, $3, 'INITIATED')`,
      [`attp_init_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, eventId, userId]
    );

    // 1. Validate Event status and sales window
    const eventRes = await db.query(
      `SELECT "id", "title", "status", "salesStartTime", "salesCutoffTime", "timeZone" 
       FROM "Event" 
       WHERE "id" = $1`,
      [eventId]
    );

    if (eventRes.rowCount === 0) {
      res.status(404).json({ error: 'Event Not Found' });
      return;
    }

    const event = eventRes.rows[0];
    if (event.status !== 'PUBLISHED') {
      res.status(400).json({
        error: 'Event Not Bookable',
        message: 'Tickets can only be reserved for published events.',
      });
      return;
    }

    const now = new Date();
    const salesStart = new Date(event.salesStartTime);
    const salesCutoff = new Date(event.salesCutoffTime);

    if (now < salesStart) {
      res.status(400).json({
        error: 'Sales Not Started',
        message: `Ticket sales for this event begin on ${salesStart.toISOString()}.`,
      });
      return;
    }

    if (now > salesCutoff) {
      res.status(400).json({
        error: 'Sales Ended',
        message: 'Ticket sales for this event have closed.',
      });
      return;
    }

    // Consistent sorting of ticket IDs to prevent database deadlocks
    const sortedItems = [...items].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId));
    const ticketIds = sortedItems.map((i) => i.ticketTypeId);

    // 2. Start PostgreSQL Transaction with row-level locking
    const reservationResult = await db.transaction(async (tx: DBTransaction) => {
      // Step 4: Lock ticket rows in consistent alphabetical order with SELECT ... FOR UPDATE
      const lockedTicketsRes = await tx.query(
        `SELECT "id", "eventId", "name", "price", "currency", "totalQuantity", 
                "soldQuantity", "heldQuantity", "purchaseLimit", "isActive", 
                "salesStartTime", "salesCutoffTime"
         FROM "TicketType"
         WHERE "id" = ANY($1::text[]) AND "eventId" = $2
         ORDER BY "id" ASC
         FOR UPDATE`,
        [ticketIds, eventId]
      );

      if (lockedTicketsRes.rowCount !== ticketIds.length) {
        throw {
          status: 400,
          error: 'Invalid Ticket Selection',
          message: 'One or more selected ticket categories are invalid or do not belong to this event.',
        };
      }

      const lockedTicketsMap = new Map(lockedTicketsRes.rows.map((t) => [t.id, t]));

      // Check user purchase limits and availability
      let totalReservationAmount = 0;
      const reservationItemsData: Array<{
        ticketTypeId: string;
        ticketName: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }> = [];

      for (const item of sortedItems) {
        const ticket = lockedTicketsMap.get(item.ticketTypeId);
        if (!ticket || !ticket.isActive) {
          throw {
            status: 400,
            error: 'Ticket Inactive',
            message: `Ticket category ${ticket?.name || item.ticketTypeId} is no longer active.`,
          };
        }

        // Per-user purchase limit check
        // Check active reservations or confirmed orders for this user & ticket
        const existingPurchasesRes = await tx.query(
          `SELECT COALESCE(SUM(ri."quantity"), 0) as count
           FROM "ReservationItem" ri
           JOIN "Reservation" r ON ri."reservationId" = r."id"
           WHERE r."userId" = $1 AND ri."ticketTypeId" = $2 AND r."status" IN ('ACTIVE', 'CHECKOUT_PENDING', 'CONFIRMED')`,
          [userId, item.ticketTypeId]
        );

        const alreadyBooked = parseInt(existingPurchasesRes.rows[0]?.count || '0', 10);
        if (alreadyBooked + item.quantity > ticket.purchaseLimit) {
          throw {
            status: 400,
            error: 'Purchase Limit Exceeded',
            message: `Purchase limit for ${ticket.name} is ${ticket.purchaseLimit}. You already have ${alreadyBooked} in active hold/confirmed bookings.`,
          };
        }

        // Step 5: Authoritative inventory check inside transaction
        const available = ticket.totalQuantity - ticket.soldQuantity - ticket.heldQuantity;
        if (available < item.quantity) {
          throw {
            status: 409, // HTTP 409 Conflict as mandated by spec
            error: 'Insufficient Inventory',
            message: `Only ${available} ticket(s) remain for ${ticket.name}. Requested: ${item.quantity}.`,
          };
        }

        const price = parseFloat(ticket.price);
        const subtotal = price * item.quantity;
        totalReservationAmount += subtotal;

        reservationItemsData.push({
          ticketTypeId: ticket.id,
          ticketName: ticket.name,
          quantity: item.quantity,
          unitPrice: price,
          subtotal,
        });
      }

      // Step 6 & 7: Atomically transition inventory Available -> Held and create reservation
      for (const item of sortedItems) {
        await tx.query(
          `UPDATE "TicketType"
           SET "heldQuantity" = "heldQuantity" + $1, "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $2`,
          [item.quantity, item.ticketTypeId]
        );
      }

      // Exactly 10-minute hold window from current server/DB transaction timestamp
      const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await tx.query(
        `INSERT INTO "Reservation" ("id", "eventId", "userId", "status", "expiresAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'ACTIVE', $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [reservationId, eventId, userId, expiresAt]
      );

      for (const item of reservationItemsData) {
        await tx.query(
          `INSERT INTO "ReservationItem" ("id", "reservationId", "ticketTypeId", "quantity", "unitPrice")
           VALUES ($1, $2, $3, $4, $5)`,
          [
            `resi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            reservationId,
            item.ticketTypeId,
            item.quantity,
            item.unitPrice,
          ]
        );
      }

      // Record successful booking attempt
      await tx.query(
        `INSERT INTO "BookingAttempt" ("id", "eventId", "userId", "status")
         VALUES ($1, $2, $3, 'RESERVED')`,
        [`attp_res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, eventId, userId]
      );

      return {
        reservationId,
        eventId,
        eventTitle: event.title,
        status: 'ACTIVE',
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds: 600,
        items: reservationItemsData,
        totalAmount: totalReservationAmount,
        currency: 'INR',
      };
    });

    // Invalidate event cache so listing reflects newly held inventory
    await invalidateEventCache(eventId);

    const responsePayload = {
      message: 'Reservation created successfully. Inventory held for 10 minutes.',
      reservation: reservationResult,
    };

    // Store idempotency key if provided
    if (clientKey) {
      await db.query(
        `INSERT INTO "IdempotencyKey" ("id", "key", "userId", "requestPath", "responseStatus", "responseBody", "expiresAt")
         VALUES ($1, $2, $3, '/api/reservations', 201, $4, $5)
         ON CONFLICT ("key") DO NOTHING`,
        [
          `idmp_${Date.now()}`,
          clientKey,
          userId,
          JSON.stringify(responsePayload),
          new Date(Date.now() + 24 * 60 * 60 * 1000),
        ]
      );
    }

    res.status(201).json(responsePayload);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.error, message: err.message });
      return;
    }
    console.error('[Reservations] Concurrency error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Could not complete reservation.' });
  }
});

// GET /api/reservations/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();

    const resResult = await db.query(
      `SELECT r.*, e."title" as "eventTitle", e."imageUrl", e."venue", e."city", e."startDate"
       FROM "Reservation" r
       JOIN "Event" e ON r."eventId" = e."id"
       WHERE r."id" = $1`,
      [id]
    );

    if (resResult.rowCount === 0) {
      res.status(404).json({ error: 'Reservation Not Found' });
      return;
    }

    const reservation = resResult.rows[0];

    // Authorization: attendee or admin or organizer of event
    if (reservation.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Calculate server-side remaining expiration seconds
    const now = Date.now();
    const expiresAtMs = new Date(reservation.expiresAt).getTime();
    const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - now) / 1000));

    // If active but expired on server, return EXPIRED state
    let effectiveStatus = reservation.status;
    if (effectiveStatus === 'ACTIVE' && remainingSeconds <= 0) {
      effectiveStatus = 'EXPIRED';
    }

    const itemsResult = await db.query(
      `SELECT ri."id", ri."ticketTypeId", ri."quantity", ri."unitPrice", 
              t."name" as "ticketName", (ri."quantity" * ri."unitPrice") as "subtotal"
       FROM "ReservationItem" ri
       JOIN "TicketType" t ON ri."ticketTypeId" = t."id"
       WHERE ri."reservationId" = $1`,
      [id]
    );

    const totalAmount = itemsResult.rows.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

    res.status(200).json({
      reservation: {
        ...reservation,
        status: effectiveStatus,
        remainingSeconds,
        items: itemsResult.rows,
        totalAmount,
        currency: 'INR',
      },
    });
  } catch (err: any) {
    console.error('[Reservations] Get error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/reservations/:id/cancel
router.post('/:id/cancel', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();

    await db.transaction(async (tx: DBTransaction) => {
      const resResult = await tx.query(
        `SELECT "id", "eventId", "userId", "status" FROM "Reservation" WHERE "id" = $1 FOR UPDATE`,
        [id]
      );

      if (resResult.rowCount === 0) {
        throw { status: 404, message: 'Reservation Not Found' };
      }

      const reservation = resResult.rows[0];
      if (reservation.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
        throw { status: 403, message: 'Forbidden' };
      }

      if (reservation.status !== 'ACTIVE' && reservation.status !== 'CHECKOUT_PENDING') {
        throw {
          status: 400,
          message: `Cannot cancel reservation in ${reservation.status} state. Only active holds can be cancelled.`,
        };
      }

      // Fetch items and release held quantity
      const itemsRes = await tx.query(
        `SELECT "ticketTypeId", "quantity" FROM "ReservationItem" WHERE "reservationId" = $1`,
        [id]
      );

      for (const item of itemsRes.rows) {
        await tx.query(
          `UPDATE "TicketType" 
           SET "heldQuantity" = GREATEST(0, "heldQuantity" - $1), "updatedAt" = CURRENT_TIMESTAMP 
           WHERE "id" = $2`,
          [item.quantity, item.ticketTypeId]
        );
      }

      await tx.query(
        `UPDATE "Reservation" 
         SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP 
         WHERE "id" = $1`,
        [id]
      );

      await invalidateEventCache(reservation.eventId);
    });

    res.status(200).json({ message: 'Reservation cancelled and held tickets released back to inventory.' });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('[Reservations] Cancel error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

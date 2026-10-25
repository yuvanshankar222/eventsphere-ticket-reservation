import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDB, DBTransaction } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

const CreateOrderSchema = z.object({
  reservationId: z.string().min(1),
});

// POST /api/orders (Create Order from active reservation)
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = CreateOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation Error', details: parseResult.error.issues.map((e: any) => e.message) });
      return;
    }

    const { reservationId } = parseResult.data;
    const userId = req.user!.id;
    const db = await getDB();

    const orderResult = await db.transaction(async (tx: DBTransaction) => {
      // 1. Lock and check reservation
      const resRes = await tx.query(
        `SELECT r.*, e."id" as "evId" 
         FROM "Reservation" r 
         JOIN "Event" e ON r."eventId" = e."id" 
         WHERE r."id" = $1 
         FOR UPDATE`,
        [reservationId]
      );

      if (resRes.rowCount === 0) {
        throw { status: 404, message: 'Reservation Not Found' };
      }

      const reservation = resRes.rows[0];
      if (reservation.userId !== userId) {
        throw { status: 403, message: 'Forbidden. This reservation belongs to another user.' };
      }

      if (reservation.status !== 'ACTIVE' && reservation.status !== 'CHECKOUT_PENDING') {
        throw {
          status: 400,
          message: `Cannot initiate order for reservation with status ${reservation.status}.`,
        };
      }

      // 2. Strict expiration check using server time
      const now = new Date();
      if (new Date(reservation.expiresAt) <= now) {
        throw {
          status: 410, // 410 Gone
          message: 'Reservation has expired. The held inventory is no longer available.',
        };
      }

      // Check if order already exists for this reservation
      const existingOrderRes = await tx.query(
        `SELECT "id", "orderNumber", "status", "totalAmount" FROM "Order" WHERE "reservationId" = $1`,
        [reservationId]
      );

      if (existingOrderRes.rowCount > 0) {
        return existingOrderRes.rows[0];
      }

      // 3. Fetch items and calculate stable server total
      const itemsRes = await tx.query(
        `SELECT ri."ticketTypeId", ri."quantity", ri."unitPrice", t."name" as "ticketName"
         FROM "ReservationItem" ri
         JOIN "TicketType" t ON ri."ticketTypeId" = t."id"
         WHERE ri."reservationId" = $1`,
        [reservationId]
      );

      let totalAmount = 0;
      const orderItemsData: Array<{
        ticketTypeId: string;
        ticketName: string;
        unitPrice: number;
        quantity: number;
        subtotal: number;
      }> = [];

      for (const item of itemsRes.rows) {
        const unitPrice = parseFloat(item.unitPrice);
        const subtotal = unitPrice * item.quantity;
        totalAmount += subtotal;
        orderItemsData.push({
          ticketTypeId: item.ticketTypeId,
          ticketName: item.ticketName,
          unitPrice,
          quantity: item.quantity,
          subtotal,
        });
      }

      const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const orderNumber = `ESPH-2026-${Math.floor(100000 + Math.random() * 900000)}`;

      await tx.query(
        `INSERT INTO "Order" ("id", "orderNumber", "attendeeId", "reservationId", "eventId", "status", "totalAmount", "currency")
         VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, 'INR')`,
        [orderId, orderNumber, userId, reservationId, reservation.eventId, totalAmount]
      );

      for (const oi of orderItemsData) {
        await tx.query(
          `INSERT INTO "OrderItem" ("id", "orderId", "ticketTypeId", "ticketNameSnapshot", "unitPriceSnapshot", "quantity", "subtotal")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            `ordi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            orderId,
            oi.ticketTypeId,
            oi.ticketName,
            oi.unitPrice,
            oi.quantity,
            oi.subtotal,
          ]
        );
      }

      // Update reservation status to CHECKOUT_PENDING
      await tx.query(
        `UPDATE "Reservation" SET "status" = 'CHECKOUT_PENDING', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
        [reservationId]
      );

      return {
        id: orderId,
        orderNumber,
        reservationId,
        eventId: reservation.eventId,
        status: 'PENDING',
        totalAmount,
        currency: 'INR',
        items: orderItemsData,
      };
    });

    res.status(201).json({ message: 'Order created successfully. Ready for payment.', order: orderResult });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('[Orders] Create error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/orders/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();

    const orderRes = await db.query(
      `SELECT o.*, e."title" as "eventTitle", e."venue", e."city", e."startDate", e."imageUrl",
              u."name" as "attendeeName", u."email" as "attendeeEmail"
       FROM "Order" o
       JOIN "Event" e ON o."eventId" = e."id"
       JOIN "User" u ON o."attendeeId" = u."id"
       WHERE o."id" = $1 OR o."orderNumber" = $1`,
      [id]
    );

    if (orderRes.rowCount === 0) {
      res.status(404).json({ error: 'Order Not Found' });
      return;
    }

    const order = orderRes.rows[0];

    // Authorization check
    const isOwner = order.attendeeId === req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';
    const isEventOrganizer = req.user!.role === 'ORGANIZER' && (await (async () => {
      const orgCheck = await db.query(`SELECT "organizerId" FROM "Event" WHERE "id" = $1`, [order.eventId]);
      return orgCheck.rows[0]?.organizerId === req.user!.id;
    })());

    if (!isOwner && !isAdmin && !isEventOrganizer) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const itemsRes = await db.query(
      `SELECT * FROM "OrderItem" WHERE "orderId" = $1`,
      [order.id]
    );

    const paymentRes = await db.query(
      `SELECT "id", "paymentReference", "amount", "status", "createdAt" FROM "Payment" WHERE "orderId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [order.id]
    );

    res.status(200).json({
      order: {
        ...order,
        items: itemsRes.rows,
        payment: paymentRes.rows[0] || null,
      },
    });
  } catch (err: any) {
    console.error('[Orders] Detail error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/orders (Organizers see orders for their events, Admin sees all)
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const userId = req.user!.id;
    const role = req.user!.role;

    let sql = `
      SELECT o."id", o."orderNumber", o."status", o."totalAmount", o."currency", o."createdAt",
             e."title" as "eventTitle", e."id" as "eventId",
             u."name" as "attendeeName", u."email" as "attendeeEmail"
      FROM "Order" o
      JOIN "Event" e ON o."eventId" = e."id"
      JOIN "User" u ON o."attendeeId" = u."id"
    `;

    const params: any[] = [];
    if (role === 'ORGANIZER') {
      sql += ` WHERE e."organizerId" = $1`;
      params.push(userId);
    } else if (role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    sql += ` ORDER BY o."createdAt" DESC LIMIT 100`;

    const result = await db.query(sql, params);
    res.status(200).json({ orders: result.rows });
  } catch (err: any) {
    console.error('[Orders] List error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/attendee/bookings (Attendee view of personal booking history)
router.get('/attendee/bookings', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const userId = req.user!.id;

    const result = await db.query(
      `SELECT o."id", o."orderNumber", o."status", o."totalAmount", o."currency", o."createdAt",
              e."id" as "eventId", e."title" as "eventTitle", e."venue", e."city", e."startDate", e."imageUrl",
              p."paymentReference", p."status" as "paymentStatus",
              (SELECT COUNT(*) FROM "OrderItem" oi WHERE oi."orderId" = o."id") as "ticketCount"
       FROM "Order" o
       JOIN "Event" e ON o."eventId" = e."id"
       LEFT JOIN "Payment" p ON o."id" = p."orderId"
       WHERE o."attendeeId" = $1
       ORDER BY o."createdAt" DESC`,
      [userId]
    );

    res.status(200).json({ bookings: result.rows });
  } catch (err: any) {
    console.error('[Bookings] Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

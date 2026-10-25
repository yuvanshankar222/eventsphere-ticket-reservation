import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { getDB, DBTransaction } from '../db';
import { requireAuth } from '../middleware/auth';
import { invalidateEventCache } from '../cache/redis';

const router = Router();
const MOCK_WEBHOOK_SECRET = process.env.MOCK_WEBHOOK_SECRET || 'eventsphere_mock_payment_gateway_hmac_secret_2026';

const ProcessPaymentSchema = z.object({
  orderId: z.string().min(1),
  paymentMethod: z.enum(['UPI', 'CARD', 'NET_BANKING']).default('UPI'),
  idempotencyKey: z.string().optional(),
  forceOutcome: z.enum(['SUCCEEDED', 'FAILED']).optional(), // Deterministic test control
});

// POST /api/payments/process (Simulated Asynchronous Payment Gateway)
router.post('/process', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = ProcessPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation Error', details: parseResult.error.issues.map((e: any) => e.message) });
      return;
    }

    const { orderId, paymentMethod, idempotencyKey, forceOutcome } = parseResult.data;
    const userId = req.user!.id;
    const db = await getDB();

    // Idempotency check
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

    // 1. Fetch Order and associated Reservation
    const orderRes = await db.query(
      `SELECT o.*, r."expiresAt", r."status" as "reservationStatus"
       FROM "Order" o
       JOIN "Reservation" r ON o."reservationId" = r."id"
       WHERE o."id" = $1`,
      [orderId]
    );

    if (orderRes.rowCount === 0) {
      res.status(404).json({ error: 'Order Not Found' });
      return;
    }

    const order = orderRes.rows[0];
    if (order.attendeeId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (order.status === 'CONFIRMED') {
      res.status(400).json({ error: 'Order Already Confirmed', message: 'This order has already been paid for.' });
      return;
    }

    // 2. Strict reservation expiration check
    const now = new Date();
    if (new Date(order.expiresAt) <= now || order.reservationStatus === 'EXPIRED') {
      res.status(410).json({
        error: 'Reservation Expired',
        message: 'The 10-minute hold for this reservation has expired. Held inventory has been returned to the pool.',
      });
      return;
    }

    // 3. Create or reuse Payment record
    const paymentReference = `PAY-ESPH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await db.query(
      `INSERT INTO "Payment" ("id", "orderId", "paymentReference", "amount", "currency", "status", "idempotencyKey")
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
       ON CONFLICT ("paymentReference") DO NOTHING`,
      [paymentId, orderId, paymentReference, order.totalAmount, order.currency, clientKey || null]
    );

    // 4. Determine simulation outcome (default 95% success unless forced)
    const outcome = forceOutcome || (Math.random() < 0.95 ? 'SUCCEEDED' : 'FAILED');

    // Perform asynchronous execution (or immediate deterministic processing)
    const processingResult = await db.transaction(async (tx: DBTransaction) => {
      // CRITICAL: Lock Order, Reservation, and TicketType rows in consistent order to prevent deadlocks and race with expiration worker!
      const lockedOrderRes = await tx.query(
        `SELECT o.*, r."status" as "reservationStatus", r."expiresAt"
         FROM "Order" o
         JOIN "Reservation" r ON o."reservationId" = r."id"
         WHERE o."id" = $1
         FOR UPDATE`,
        [orderId]
      );

      const lockedOrder = lockedOrderRes.rows[0];
      const reservationExpiresAt = new Date(lockedOrder.expiresAt);

      // Verify reservation was not expired concurrently by background worker!
      if (lockedOrder.reservationStatus === 'EXPIRED' || reservationExpiresAt <= new Date()) {
        // Late payment after expiration! DO NOT OVERSELL!
        await tx.query(
          `UPDATE "Payment" 
           SET "status" = 'FAILED', "gatewayResponseCode" = 'RESERVATION_EXPIRED_RACE', 
               "failureReason" = 'Payment arrived after reservation hold expired', "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = $1`,
          [paymentId]
        );
        await tx.query(
          `UPDATE "Order" SET "status" = 'FAILED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
          [orderId]
        );

        return {
          paymentId,
          paymentReference,
          status: 'FAILED',
          reason: 'Reservation expired during checkout. Held inventory was returned.',
        };
      }

      if (outcome === 'SUCCEEDED') {
        // Fetch order items to update ticket inventory
        const orderItemsRes = await tx.query(
          `SELECT "ticketTypeId", "quantity" FROM "OrderItem" WHERE "orderId" = $1 ORDER BY "ticketTypeId" ASC`,
          [orderId]
        );

        // Convert Held -> Sold inventory atomically
        for (const item of orderItemsRes.rows) {
          // Lock ticket row
          const tktRes = await tx.query(
            `SELECT "id", "heldQuantity", "soldQuantity", "totalQuantity" 
             FROM "TicketType" 
             WHERE "id" = $1 
             FOR UPDATE`,
            [item.ticketTypeId]
          );

          const tkt = tktRes.rows[0];
          // Ensure held quantity is sufficient
          if (tkt.heldQuantity < item.quantity) {
            throw {
              status: 409,
              message: 'Inventory state inconsistent: held tickets already released.',
            };
          }

          // Atomic transition: Held -> Sold
          await tx.query(
            `UPDATE "TicketType"
             SET "heldQuantity" = "heldQuantity" - $1,
                 "soldQuantity" = "soldQuantity" + $1,
                 "updatedAt" = CURRENT_TIMESTAMP
             WHERE "id" = $2`,
            [item.quantity, item.ticketTypeId]
          );
        }

        // Confirm Order and Reservation
        await tx.query(
          `UPDATE "Order" SET "status" = 'CONFIRMED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
          [orderId]
        );

        await tx.query(
          `UPDATE "Reservation" SET "status" = 'CONFIRMED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
          [order.reservationId]
        );

        await tx.query(
          `UPDATE "Payment" 
           SET "status" = 'SUCCEEDED', "gatewayResponseCode" = 'MOCK_AUTH_200_SUCCESS', "updatedAt" = CURRENT_TIMESTAMP 
           WHERE "id" = $1`,
          [paymentId]
        );

        // Record booking attempt confirmed
        await tx.query(
          `INSERT INTO "BookingAttempt" ("id", "eventId", "userId", "status")
           VALUES ($1, $2, $3, 'CONFIRMED')`,
          [`attp_conf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, order.eventId, userId]
        );

        return {
          paymentId,
          paymentReference,
          status: 'SUCCEEDED',
          orderId,
          orderNumber: order.orderNumber,
        };
      } else {
        // Failed payment simulation
        await tx.query(
          `UPDATE "Payment" 
           SET "status" = 'FAILED', "gatewayResponseCode" = 'MOCK_DECLINED_INSUFFICIENT_FUNDS', 
               "failureReason" = 'Card issuer simulated decline', "updatedAt" = CURRENT_TIMESTAMP 
           WHERE "id" = $1`,
          [paymentId]
        );

        await tx.query(
          `UPDATE "Order" SET "status" = 'FAILED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
          [orderId]
        );

        return {
          paymentId,
          paymentReference,
          status: 'FAILED',
          reason: 'Payment was declined by simulated gateway.',
        };
      }
    });

    await invalidateEventCache(order.eventId);

    const responsePayload = {
      message: processingResult.status === 'SUCCEEDED' ? 'Payment processed successfully' : 'Payment was declined',
      ...processingResult,
    };

    if (clientKey) {
      await db.query(
        `INSERT INTO "IdempotencyKey" ("id", "key", "userId", "requestPath", "responseStatus", "responseBody", "expiresAt")
         VALUES ($1, $2, $3, '/api/payments/process', 200, $4, $5)
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

    res.status(200).json(responsePayload);
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('[Payments] Processing error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Payment processing failed.' });
  }
});

// GET /api/payments/:id/status
router.get('/:id/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();

    const paymentRes = await db.query(
      `SELECT p.*, o."orderNumber", o."attendeeId" 
       FROM "Payment" p 
       JOIN "Order" o ON p."orderId" = o."id" 
       WHERE p."id" = $1 OR p."paymentReference" = $1`,
      [id]
    );

    if (paymentRes.rowCount === 0) {
      res.status(404).json({ error: 'Payment Record Not Found' });
      return;
    }

    const payment = paymentRes.rows[0];
    if (payment.attendeeId !== req.user!.id && req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json({ payment });
  } catch (err: any) {
    console.error('[Payments] Status error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/payments/mock-callback (Mock Gateway Webhook with HMAC signature verification)
router.post('/mock-callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-mock-signature'] as string;
    const { paymentReference, status, responseCode } = req.body;

    if (!paymentReference || !status) {
      res.status(400).json({ error: 'Invalid callback payload' });
      return;
    }

    // Verify HMAC signature if provided
    if (signature) {
      const expectedSignature = crypto
        .createHmac('sha256', MOCK_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        res.status(401).json({ error: 'Invalid Webhook Signature' });
        return;
      }
    }

    const db = await getDB();
    const paymentRes = await db.query(
      `SELECT * FROM "Payment" WHERE "paymentReference" = $1`,
      [paymentReference]
    );

    if (paymentRes.rowCount === 0) {
      res.status(404).json({ error: 'Payment Reference Not Found' });
      return;
    }

    const payment = paymentRes.rows[0];
    // Idempotent callback check: already processed
    if (payment.status === 'SUCCEEDED' || payment.status === 'FAILED') {
      res.status(200).json({ message: 'Callback already processed idempotently', status: payment.status });
      return;
    }

    await db.query(
      `UPDATE "Payment" SET "status" = $1, "gatewayResponseCode" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $3`,
      [status, responseCode || 'CALLBACK_RECORDED', payment.id]
    );

    res.status(200).json({ message: 'Callback recorded successfully' });
  } catch (err: any) {
    console.error('[Payments] Webhook error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

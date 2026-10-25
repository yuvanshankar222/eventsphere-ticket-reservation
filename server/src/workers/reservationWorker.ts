import { getDB, DBTransaction } from '../db';
import { invalidateEventCache } from '../cache/redis';

let isReconciliationRunning = false;
let workerIntervalHandle: NodeJS.Timeout | null = null;

/**
 * Atomically expires a specific reservation and releases held ticket quantities back to available inventory.
 * Uses PostgreSQL row-level locking to guarantee idempotency and prevent racing with payment confirmation.
 */
export async function processExpiredReservation(reservationId: string): Promise<boolean> {
  const db = await getDB();

  return await db.transaction(async (tx: DBTransaction) => {
    // 1. Lock the reservation row with FOR UPDATE
    const resResult = await tx.query(
      `SELECT "id", "eventId", "userId", "status", "expiresAt" 
       FROM "Reservation" 
       WHERE "id" = $1 
       FOR UPDATE`,
      [reservationId]
    );

    if (resResult.rowCount === 0) {
      return false;
    }

    const reservation = resResult.rows[0];

    // CRITICAL: Never expire already CONFIRMED reservations or already EXPIRED/CANCELLED reservations!
    if (reservation.status === 'CONFIRMED' || reservation.status === 'EXPIRED' || reservation.status === 'CANCELLED') {
      return false;
    }

    // Check expiration timestamp (using DB/server time)
    const now = new Date();
    const expiresAt = new Date(reservation.expiresAt);
    if (expiresAt.getTime() > now.getTime()) {
      // Not yet expired
      return false;
    }

    // 2. Fetch all reservation items
    const itemsResult = await tx.query(
      `SELECT "ticketTypeId", "quantity" 
       FROM "ReservationItem" 
       WHERE "reservationId" = $1`,
      [reservationId]
    );

    // 3. Mark the reservation as EXPIRED
    await tx.query(
      `UPDATE "Reservation" 
       SET "status" = 'EXPIRED', "updatedAt" = CURRENT_TIMESTAMP 
       WHERE "id" = $1`,
      [reservationId]
    );

    // 4. Release held inventory for each ticket category atomically
    for (const item of itemsResult.rows) {
      // Lock ticket row and safely decrement heldQuantity
      await tx.query(
        `UPDATE "TicketType" 
         SET "heldQuantity" = GREATEST(0, "heldQuantity" - $1), "updatedAt" = CURRENT_TIMESTAMP 
         WHERE "id" = $2`,
        [item.quantity, item.ticketTypeId]
      );
    }

    // 5. Record booking attempt update
    await tx.query(
      `INSERT INTO "BookingAttempt" ("id", "eventId", "userId", "status")
       VALUES ($1, $2, $3, 'EXPIRED')`,
      [`attp_exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, reservation.eventId, reservation.userId]
    );

    // 6. Invalidate public cache for this event
    await invalidateEventCache(reservation.eventId);

    console.log(`[Worker] Successfully released expired reservation: ${reservationId}`);
    return true;
  });
}

/**
 * Periodic database reconciliation scanner that discovers and processes all overdue reservations.
 */
export async function runReservationReconciliation(): Promise<number> {
  if (isReconciliationRunning) return 0;
  isReconciliationRunning = true;

  try {
    const db = await getDB();
    const expiredCandidates = await db.query(
      `SELECT "id" 
       FROM "Reservation" 
       WHERE "status" IN ('ACTIVE', 'CHECKOUT_PENDING') 
         AND "expiresAt" <= CURRENT_TIMESTAMP 
       LIMIT 50`
    );

    let processedCount = 0;
    for (const row of expiredCandidates.rows) {
      try {
        const released = await processExpiredReservation(row.id);
        if (released) processedCount++;
      } catch (err: any) {
        console.error(`[Worker] Error expiring reservation ${row.id}:`, err.message);
      }
    }

    return processedCount;
  } catch (err: any) {
    console.error('[Worker] Error during reservation reconciliation sweep:', err.message);
    return 0;
  } finally {
    isReconciliationRunning = false;
  }
}

/**
 * Starts the background worker loop.
 */
export function startReservationWorker(intervalMs = 5000) {
  if (workerIntervalHandle) return;

  console.log(`[Worker] Reservation expiration worker service started (Interval: ${intervalMs}ms).`);
  workerIntervalHandle = setInterval(async () => {
    await runReservationReconciliation();
  }, intervalMs);

  // Run immediately on start
  runReservationReconciliation().catch(() => {});
}

export function stopReservationWorker() {
  if (workerIntervalHandle) {
    clearInterval(workerIntervalHandle);
    workerIntervalHandle = null;
    console.log('[Worker] Reservation worker stopped.');
  }
}

// Standalone CLI execution entry point if executed directly
if (process.argv[1] && process.argv[1].endsWith('reservationWorker.ts')) {
  console.log('[Worker Process] Initializing standalone reservation cleanup worker...');
  startReservationWorker(3000);
}

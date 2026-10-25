import test from 'node:test';
import assert from 'node:assert/strict';
import { getDB, DBTransaction } from '../server/src/db';

test('database concurrency: simultaneous reservation attempts on limited inventory', async () => {
  const db = await getDB();

  // Create isolated test event and ticket category with exactly 5 available tickets
  const testEventId = `evt_test_conc_${Date.now()}`;
  const testTicketId = `tkt_test_conc_${Date.now()}`;
  const totalCapacity = 5;

  await db.query(
    `INSERT INTO "Event" (
      "id", "title", "slug", "description", "category", "venue", "city", 
      "fullAddress", "startDate", "endDate", "imageUrl", "status", 
      "salesStartTime", "salesCutoffTime", "organizerId"
    )
    VALUES ($1, 'Concurrency Test Event', $2, 'Test Desc', 'Technology', 'Test Venue', 'Bengaluru', 'Address', NOW(), NOW() + INTERVAL '1 day', 'https://example.com/img.jpg', 'PUBLISHED', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', 'usr_org_apex')`,
    [testEventId, `slug-conc-${Date.now()}`]
  );

  await db.query(
    `INSERT INTO "TicketType" (
      "id", "eventId", "name", "description", "price", "currency", 
      "totalQuantity", "soldQuantity", "heldQuantity", "salesStartTime", 
      "salesCutoffTime", "purchaseLimit", "isActive"
    )
    VALUES ($1, $2, 'Limited Tier', 'Test Desc', 1000.00, 'INR', $3, 0, 0, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', 10, true)`,
    [testTicketId, testEventId, totalCapacity]
  );

  // Simulate 10 simultaneous user requests each trying to reserve 1 ticket when only 5 exist
  const simulatedAttempts = 10;
  const requestedPerAttempt = 1;

  async function attemptReserve(userId: string): Promise<boolean> {
    try {
      return await db.transaction(async (tx: DBTransaction) => {
        // Atomic row locking
        const lockRes = await tx.query(
          `SELECT "id", "totalQuantity", "soldQuantity", "heldQuantity" 
           FROM "TicketType" 
           WHERE "id" = $1 
           FOR UPDATE`,
          [testTicketId]
        );

        const ticket = lockRes.rows[0];
        const available = ticket.totalQuantity - ticket.soldQuantity - ticket.heldQuantity;

        if (available < requestedPerAttempt) {
          return false; // Insufficient inventory
        }

        // Allocate
        await tx.query(
          `UPDATE "TicketType" 
           SET "heldQuantity" = "heldQuantity" + $1 
           WHERE "id" = $2`,
          [requestedPerAttempt, testTicketId]
        );

        return true;
      });
    } catch {
      return false;
    }
  }

  const results = await Promise.all(
    Array.from({ length: simulatedAttempts }, (_, i) => attemptReserve(`usr_test_${i}`))
  );

  const successfulReservations = results.filter((r) => r === true).length;
  const rejectedReservations = results.filter((r) => r === false).length;

  console.log(`[Concurrency Test] ${successfulReservations} succeeded, ${rejectedReservations} rejected.`);

  // Verify that EXACTLY 5 reservations succeeded and 5 were rejected
  assert.equal(successfulReservations, totalCapacity, 'Exactly 5 reservations must succeed');
  assert.equal(rejectedReservations, simulatedAttempts - totalCapacity, 'Remaining 5 must be rejected');

  // Verify final database inventory state
  const finalStateRes = await db.query(
    `SELECT "totalQuantity", "soldQuantity", "heldQuantity" FROM "TicketType" WHERE "id" = $1`,
    [testTicketId]
  );

  const finalTicket = finalStateRes.rows[0];
  assert.equal(finalTicket.heldQuantity, totalCapacity);
  assert.equal(finalTicket.soldQuantity, 0);
  assert.equal(finalTicket.totalQuantity, 5);
  assert.ok(
    finalTicket.soldQuantity + finalTicket.heldQuantity <= finalTicket.totalQuantity,
    'Capacity invariant strictly maintained'
  );
});

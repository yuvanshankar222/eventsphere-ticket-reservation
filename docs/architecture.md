# EventSphere — Multi-Tenant Architecture & Technical Specification

## 1. System Overview
EventSphere is a production-grade multi-tenant event ticket reservation platform engineered with strict financial invariants, concurrency protection, and tenant isolation.

### Key Tenets
1. **Concurrency-Safe Reservation Engine**: Prevents ticket overselling under massive simultaneous checkout volume using PostgreSQL transactions and row-level locking (`SELECT ... FOR UPDATE`).
2. **Ten-Minute Automated Expiration**: Ticket allocations are held for exactly 10 minutes. An asynchronous background worker reclaims overdue inventory safely without duplicate processing.
3. **Multi-Tenant Isolation**: Organizers operate within isolated organizational boundaries. Tenant identity is derived server-side from authenticated sessions.
4. **Resilient Two-Tier Caching**: High-read endpoints (events catalog and event details) are cached in Redis with automated invalidation and an in-memory distributed fallback.

---

## 2. Invariants & Mathematical Guarantees

For any ticket category $T$:
$$\text{availableQuantity} + \text{heldQuantity} + \text{soldQuantity} = \text{totalQuantity}$$
$$\text{heldQuantity} \ge 0, \quad \text{soldQuantity} \ge 0, \quad \text{soldQuantity} + \text{heldQuantity} \le \text{totalQuantity}$$

### Inventory State Machine
- **Available $\rightarrow$ Held**: Occurs when an attendee creates a reservation.
- **Held $\rightarrow$ Sold**: Occurs when payment succeeds and order is confirmed.
- **Held $\rightarrow$ Available**: Occurs when a reservation expires, is explicitly cancelled, or payment permanently fails.
- **Confirmed orders cannot be released or expired.**

---

## 3. Concurrency & Deadlock Prevention

When a reservation includes multiple ticket types:
1. Ticket IDs are sorted in ascending alphabetical order before querying.
2. PostgreSQL acquires row locks sequentially:
   ```sql
   SELECT "id", "totalQuantity", "soldQuantity", "heldQuantity", "purchaseLimit"
   FROM "TicketType"
   WHERE "id" = ANY($1) AND "eventId" = $2
   ORDER BY "id" ASC
   FOR UPDATE;
   ```
3. Consistent locking order prevents cyclic wait graph conditions (deadlocks).
4. If available inventory is insufficient for any requested item, the transaction immediately rolls back and issues `HTTP 409 Conflict`.

---

## 4. Payment Settlement & Race Condition Resolution

When a payment completes while the reservation expiration worker is running:
- The payment transition acquires an exclusive transaction lock on the `Order` and `Reservation`.
- It re-evaluates `Reservation.status` and `Reservation.expiresAt`.
- If the reservation was already marked `EXPIRED`, the payment transition transitions the payment to `FAILED` with failure reason `LATE_PAYMENT_RESERVATION_EXPIRED` to prevent overselling.

---

## 5. Seed Accounts (Development & Demo)

| Role | Email | Password |
|---|---|---|
| Platform Admin | `admin@eventsphere.com` | `AdminPass123!` |
| Organizer 1 (Apex Events) | `apex.events@eventsphere.com` | `OrganizerPass123!` |
| Organizer 2 (SoundWave Live) | `soundwave.live@eventsphere.com` | `OrganizerPass123!` |
| Attendee (Yuvan Shankar) | `attendee@eventsphere.com` | `AttendeePass123!` |

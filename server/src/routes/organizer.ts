import { Router, Request, Response } from 'express';
import { getDB } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Ensure only authenticated ORGANIZER or ADMIN can access
router.use(requireAuth);
router.use(requireRole('ORGANIZER', 'ADMIN'));

// GET /api/organizer/dashboard (Tenant-isolated aggregate metrics)
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const organizerId = req.user!.id;

    // 1. Events metrics
    const eventsRes = await db.query(
      `SELECT 
        COUNT(*) as "totalEvents",
        COUNT(CASE WHEN "status" = 'PUBLISHED' THEN 1 END) as "publishedEvents",
        COUNT(CASE WHEN "status" = 'DRAFT' THEN 1 END) as "draftEvents"
       FROM "Event"
       WHERE "organizerId" = $1`,
      [organizerId]
    );

    // 2. Ticket inventory metrics
    const ticketsRes = await db.query(
      `SELECT 
        COALESCE(SUM(t."soldQuantity"), 0) as "totalSold",
        COALESCE(SUM(t."heldQuantity"), 0) as "totalHeld",
        COALESCE(SUM(t."totalQuantity" - t."soldQuantity" - t."heldQuantity"), 0) as "totalAvailable"
       FROM "TicketType" t
       JOIN "Event" e ON t."eventId" = e."id"
       WHERE e."organizerId" = $1 AND t."isActive" = true`,
      [organizerId]
    );

    // 3. Orders & Revenue metrics (only CONFIRMED orders)
    const ordersRes = await db.query(
      `SELECT 
        COUNT(CASE WHEN o."status" = 'CONFIRMED' THEN 1 END) as "completedOrders",
        COUNT(CASE WHEN o."status" = 'PENDING' THEN 1 END) as "pendingOrders",
        COUNT(CASE WHEN o."status" = 'FAILED' THEN 1 END) as "failedOrders",
        COALESCE(SUM(CASE WHEN o."status" = 'CONFIRMED' THEN o."totalAmount" ELSE 0 END), 0) as "grossRevenue"
       FROM "Order" o
       JOIN "Event" e ON o."eventId" = e."id"
       WHERE e."organizerId" = $1`,
      [organizerId]
    );

    // 4. Conversion rate calculation
    const attemptsRes = await db.query(
      `SELECT 
        COUNT(*) as "totalAttempts",
        COUNT(CASE WHEN ba."status" = 'CONFIRMED' THEN 1 END) as "confirmedAttempts"
       FROM "BookingAttempt" ba
       JOIN "Event" e ON ba."eventId" = e."id"
       WHERE e."organizerId" = $1`,
      [organizerId]
    );

    const totalAttempts = parseInt(attemptsRes.rows[0]?.totalAttempts || '0', 10);
    const confirmedAttempts = parseInt(attemptsRes.rows[0]?.confirmedAttempts || '0', 10);
    const conversionRate = totalAttempts > 0 ? ((confirmedAttempts / totalAttempts) * 100).toFixed(1) : '0.0';

    res.status(200).json({
      metrics: {
        totalEvents: parseInt(eventsRes.rows[0]?.totalEvents || '0', 10),
        publishedEvents: parseInt(eventsRes.rows[0]?.publishedEvents || '0', 10),
        draftEvents: parseInt(eventsRes.rows[0]?.draftEvents || '0', 10),
        totalSoldTickets: parseInt(ticketsRes.rows[0]?.totalSold || '0', 10),
        totalHeldTickets: parseInt(ticketsRes.rows[0]?.totalHeld || '0', 10),
        availableTickets: parseInt(ticketsRes.rows[0]?.totalAvailable || '0', 10),
        completedOrders: parseInt(ordersRes.rows[0]?.completedOrders || '0', 10),
        pendingOrders: parseInt(ordersRes.rows[0]?.pendingOrders || '0', 10),
        failedOrders: parseInt(ordersRes.rows[0]?.failedOrders || '0', 10),
        grossRevenue: parseFloat(ordersRes.rows[0]?.grossRevenue || '0'),
        currency: 'INR',
        conversionRate: parseFloat(conversionRate),
      },
    });
  } catch (err: any) {
    console.error('[Organizer] Dashboard error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/organizer/analytics (Detailed charts data)
router.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const organizerId = req.user!.id;
    const { eventId } = req.query;

    let eventFilterSql = 'e."organizerId" = $1';
    const params: any[] = [organizerId];

    if (eventId) {
      eventFilterSql += ' AND e."id" = $2';
      params.push(eventId);
    }

    // 1. Revenue over time (by date)
    const revenueOverTimeRes = await db.query(
      `SELECT 
        TO_CHAR(o."createdAt", 'YYYY-MM-DD') as "date",
        COALESCE(SUM(o."totalAmount"), 0) as "revenue",
        COUNT(o."id") as "orders"
       FROM "Order" o
       JOIN "Event" e ON o."eventId" = e."id"
       WHERE ${eventFilterSql} AND o."status" = 'CONFIRMED'
       GROUP BY TO_CHAR(o."createdAt", 'YYYY-MM-DD')
       ORDER BY "date" ASC
       LIMIT 30`,
      params
    );

    // 2. Tickets sold by category
    const categoryDistributionRes = await db.query(
      `SELECT 
        t."name" as "category",
        COALESCE(SUM(t."soldQuantity"), 0) as "sold",
        COALESCE(SUM(t."heldQuantity"), 0) as "held",
        COALESCE(SUM(t."totalQuantity" - t."soldQuantity" - t."heldQuantity"), 0) as "available"
       FROM "TicketType" t
       JOIN "Event" e ON t."eventId" = e."id"
       WHERE ${eventFilterSql} AND t."isActive" = true
       GROUP BY t."name"
       ORDER BY "sold" DESC`,
      params
    );

    // 3. Revenue by event
    const revenueByEventRes = await db.query(
      `SELECT 
        e."id", e."title",
        COALESCE(SUM(CASE WHEN o."status" = 'CONFIRMED' THEN o."totalAmount" ELSE 0 END), 0) as "revenue",
        COUNT(CASE WHEN o."status" = 'CONFIRMED' THEN 1 END) as "ordersCount"
       FROM "Event" e
       LEFT JOIN "Order" o ON e."id" = o."eventId"
       WHERE e."organizerId" = $1
       GROUP BY e."id", e."title"
       ORDER BY "revenue" DESC`,
      [organizerId]
    );

    // 4. Booking attempts breakdown
    const attemptsBreakdownRes = await db.query(
      `SELECT 
        ba."status",
        COUNT(*) as "count"
       FROM "BookingAttempt" ba
       JOIN "Event" e ON ba."eventId" = e."id"
       WHERE ${eventFilterSql}
       GROUP BY ba."status"`,
      params
    );

    res.status(200).json({
      revenueOverTime: revenueOverTimeRes.rows,
      ticketsByCategory: categoryDistributionRes.rows,
      revenueByEvent: revenueByEventRes.rows,
      bookingAttempts: attemptsBreakdownRes.rows,
    });
  } catch (err: any) {
    console.error('[Organizer] Analytics error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/organizer/events (All events owned by this organizer)
router.get('/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const organizerId = req.user!.id;

    const result = await db.query(
      `SELECT e.*, 
        COALESCE(SUM(t."soldQuantity"), 0) as "totalSold",
        COALESCE(SUM(t."totalQuantity"), 0) as "totalCapacity",
        COALESCE(SUM(CASE WHEN o."status" = 'CONFIRMED' THEN o."totalAmount" ELSE 0 END), 0) as "totalRevenue"
       FROM "Event" e
       LEFT JOIN "TicketType" t ON e."id" = t."eventId"
       LEFT JOIN "Order" o ON e."id" = o."eventId"
       WHERE e."organizerId" = $1
       GROUP BY e."id"
       ORDER BY e."createdAt" DESC`,
      [organizerId]
    );

    res.status(200).json({ events: result.rows });
  } catch (err: any) {
    console.error('[Organizer] Events list error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/organizer/orders (Orders for this organizer's events)
router.get('/orders', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const organizerId = req.user!.id;

    const result = await db.query(
      `SELECT o.*, e."title" as "eventTitle", u."name" as "attendeeName", u."email" as "attendeeEmail"
       FROM "Order" o
       JOIN "Event" e ON o."eventId" = e."id"
       JOIN "User" u ON o."attendeeId" = u."id"
       WHERE e."organizerId" = $1
       ORDER BY o."createdAt" DESC
       LIMIT 100`,
      [organizerId]
    );

    res.status(200).json({ orders: result.rows });
  } catch (err: any) {
    console.error('[Organizer] Orders error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

import bcrypt from 'bcryptjs';
import type { DBClient } from './index';

export async function seedDatabase(db: DBClient) {
  console.log('[Seed] Seeding realistic demonstration data...');

  const adminPassHash = await bcrypt.hash('AdminPass123!', 10);
  const organizerPassHash = await bcrypt.hash('OrganizerPass123!', 10);
  const attendeePassHash = await bcrypt.hash('AttendeePass123!', 10);

  // 1. Insert Users
  const users = [
    {
      id: 'usr_admin_01',
      email: 'admin@eventsphere.com',
      name: 'Platform Administrator',
      passwordHash: adminPassHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    {
      id: 'usr_org_apex',
      email: 'apex.events@eventsphere.com',
      name: 'Apex Event Management',
      passwordHash: organizerPassHash,
      role: 'ORGANIZER',
      status: 'ACTIVE',
    },
    {
      id: 'usr_org_soundwave',
      email: 'soundwave.live@eventsphere.com',
      name: 'SoundWave Global Live',
      passwordHash: organizerPassHash,
      role: 'ORGANIZER',
      status: 'ACTIVE',
    },
    {
      id: 'usr_att_yuvan',
      email: 'attendee@eventsphere.com',
      name: 'Yuvan Shankar',
      passwordHash: attendeePassHash,
      role: 'ATTENDEE',
      status: 'ACTIVE',
    },
    {
      id: 'usr_att_priya',
      email: 'priya@eventsphere.com',
      name: 'Priya Sharma',
      passwordHash: attendeePassHash,
      role: 'ATTENDEE',
      status: 'ACTIVE',
    },
  ];

  for (const u of users) {
    await db.query(
      `INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "status")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("email") DO NOTHING`,
      [u.id, u.email, u.name, u.passwordHash, u.role, u.status]
    );
  }

  // 2. Insert Events
  const events = [
    {
      id: 'evt_ai_summit_2026',
      title: 'Global AI & Cloud Summit 2026',
      slug: 'global-ai-cloud-summit-2026',
      description: 'The premier conference for artificial intelligence engineers, cloud architects, and enterprise leaders. Three days of keynotes, architectural deep-dives, hands-on labs, and executive networking.',
      category: 'Technology',
      venue: 'BIEC Convention & Exhibition Centre',
      city: 'Bengaluru',
      fullAddress: '10th Mile, Tumkur Road, Madavara Post, Dasanapura Hobli, Bengaluru, Karnataka 562123',
      startDate: new Date('2026-11-15T09:00:00Z'),
      endDate: new Date('2026-11-17T18:00:00Z'),
      timeZone: 'Asia/Kolkata',
      imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      status: 'PUBLISHED',
      salesStartTime: new Date('2026-08-01T00:00:00Z'),
      salesCutoffTime: new Date('2026-11-14T23:59:59Z'),
      organizerId: 'usr_org_apex',
    },
    {
      id: 'evt_soundwave_goa_2026',
      title: 'SoundWave Electro Beach Festival',
      slug: 'soundwave-electro-beach-festival-2026',
      description: 'Experience 48 hours of world-class electronic music, beachfront stages, visual arts, and international headliners on the sun-soaked shores of Vagator Beach.',
      category: 'Music & Concerts',
      venue: 'Vagator Beach Arena',
      city: 'Goa',
      fullAddress: 'Vagator Beach Road, Anjuna, Bardez, Goa 403509',
      startDate: new Date('2026-12-18T16:00:00Z'),
      endDate: new Date('2026-12-20T23:00:00Z'),
      timeZone: 'Asia/Kolkata',
      imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
      status: 'PUBLISHED',
      salesStartTime: new Date('2026-07-01T00:00:00Z'),
      salesCutoffTime: new Date('2026-12-18T12:00:00Z'),
      organizerId: 'usr_org_soundwave',
    },
    {
      id: 'evt_fintech_conclave_2026',
      title: 'Fintech Frontier Conclave 2026',
      slug: 'fintech-frontier-conclave-2026',
      description: 'Where banking pioneers, decentralized finance innovators, and regulators discuss the future of digital payments, neo-banking, and algorithmic financial markets.',
      category: 'Business & Finance',
      venue: 'Grand Ballroom, Trident Hotel',
      city: 'Mumbai',
      fullAddress: 'Nariman Point, Marine Drive, Mumbai, Maharashtra 400021',
      startDate: new Date('2026-11-28T09:30:00Z'),
      endDate: new Date('2026-11-29T17:30:00Z'),
      timeZone: 'Asia/Kolkata',
      imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
      status: 'PUBLISHED',
      salesStartTime: new Date('2026-08-15T00:00:00Z'),
      salesCutoffTime: new Date('2026-11-27T23:59:59Z'),
      organizerId: 'usr_org_apex',
    },
    {
      id: 'evt_food_wine_expo_2026',
      title: 'International Gourmet Food & Culinary Expo',
      slug: 'international-gourmet-food-culinary-expo-2026',
      description: 'A sensory celebration showcasing Michelin-starred masterclasses, artisanal vineyard tastings, and sustainable gastronomy demonstrations from over 30 countries.',
      category: 'Food & Drink',
      venue: 'Pragati Maidan Convention Hall 5',
      city: 'New Delhi',
      fullAddress: 'Mathura Road, Railway Colony, New Delhi, Delhi 110002',
      startDate: new Date('2026-12-05T10:00:00Z'),
      endDate: new Date('2026-12-07T20:00:00Z'),
      timeZone: 'Asia/Kolkata',
      imageUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
      status: 'PUBLISHED',
      salesStartTime: new Date('2026-09-01T00:00:00Z'),
      salesCutoffTime: new Date('2026-12-05T08:00:00Z'),
      organizerId: 'usr_org_soundwave',
    },
    {
      id: 'evt_apex_draft_conf',
      title: 'Apex Strategy & Technology Preview 2027',
      slug: 'apex-strategy-technology-preview-2027',
      description: 'Private unreleased corporate planning summit.',
      category: 'Business & Finance',
      venue: 'Leela Palace Convention Hall',
      city: 'Bengaluru',
      fullAddress: 'Old Airport Road, Bengaluru, Karnataka 560008',
      startDate: new Date('2027-01-20T09:00:00Z'),
      endDate: new Date('2027-01-21T18:00:00Z'),
      timeZone: 'Asia/Kolkata',
      imageUrl: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80',
      status: 'DRAFT', // DRAFT: Must never appear publicly!
      salesStartTime: new Date('2026-12-01T00:00:00Z'),
      salesCutoffTime: new Date('2027-01-19T23:59:59Z'),
      organizerId: 'usr_org_apex',
    },
  ];

  for (const e of events) {
    await db.query(
      `INSERT INTO "Event" (
        "id", "title", "slug", "description", "category", "venue", "city", 
        "fullAddress", "startDate", "endDate", "timeZone", "imageUrl", 
        "status", "salesStartTime", "salesCutoffTime", "organizerId"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT ("slug") DO NOTHING`,
      [
        e.id,
        e.title,
        e.slug,
        e.description,
        e.category,
        e.venue,
        e.city,
        e.fullAddress,
        e.startDate,
        e.endDate,
        e.timeZone,
        e.imageUrl,
        e.status,
        e.salesStartTime,
        e.salesCutoffTime,
        e.organizerId,
      ]
    );
  }

  // 3. Insert Ticket Categories
  const ticketTypes = [
    // AI Summit Tickets
    {
      id: 'tkt_ai_vip',
      eventId: 'evt_ai_summit_2026',
      name: 'VIP Executive Pass',
      description: 'Full 3-day access, VIP lounge, reserved front seating, speaker dinner access & workshop recordings.',
      price: 15000.0,
      currency: 'INR',
      totalQuantity: 50,
      soldQuantity: 14,
      heldQuantity: 0,
      salesStartTime: new Date('2026-08-01T00:00:00Z'),
      salesCutoffTime: new Date('2026-11-14T23:59:59Z'),
      purchaseLimit: 2,
    },
    {
      id: 'tkt_ai_standard',
      eventId: 'evt_ai_summit_2026',
      name: 'Standard All-Access Conference Pass',
      description: 'Access to all main stages, exhibition hall, networking lunch, and digital certificate.',
      price: 4500.0,
      currency: 'INR',
      totalQuantity: 200,
      soldQuantity: 82,
      heldQuantity: 0,
      salesStartTime: new Date('2026-08-01T00:00:00Z'),
      salesCutoffTime: new Date('2026-11-14T23:59:59Z'),
      purchaseLimit: 5,
    },
    {
      id: 'tkt_ai_student',
      eventId: 'evt_ai_summit_2026',
      name: 'Student & Academic Pass',
      description: 'Subsidized rate for verified college students, PhD researchers, and university faculty.',
      price: 1500.0,
      currency: 'INR',
      totalQuantity: 100,
      soldQuantity: 36,
      heldQuantity: 0,
      salesStartTime: new Date('2026-08-01T00:00:00Z'),
      salesCutoffTime: new Date('2026-11-14T23:59:59Z'),
      purchaseLimit: 2,
    },
    // SoundWave Festival Tickets
    {
      id: 'tkt_sw_vip',
      eventId: 'evt_soundwave_goa_2026',
      name: '3-Day Backstage VIP Pass',
      description: 'Backstage viewing deck, fast-track entry, complimentary cocktail tokens, and artist lounge entry.',
      price: 8999.0,
      currency: 'INR',
      totalQuantity: 150,
      soldQuantity: 65,
      heldQuantity: 0,
      salesStartTime: new Date('2026-07-01T00:00:00Z'),
      salesCutoffTime: new Date('2026-12-18T12:00:00Z'),
      purchaseLimit: 4,
    },
    {
      id: 'tkt_sw_ga',
      eventId: 'evt_soundwave_goa_2026',
      name: 'General Admission Weekend Pass',
      description: 'Full 3-day beach access across all electronic & techno stages.',
      price: 2999.0,
      currency: 'INR',
      totalQuantity: 500,
      soldQuantity: 184,
      heldQuantity: 0,
      salesStartTime: new Date('2026-07-01T00:00:00Z'),
      salesCutoffTime: new Date('2026-12-18T12:00:00Z'),
      purchaseLimit: 6,
    },
    // Fintech Conclave Tickets
    {
      id: 'tkt_ft_delegate',
      eventId: 'evt_fintech_conclave_2026',
      name: 'Executive Delegate Pass',
      description: 'Access to keynote sessions, regulatory panel roundtables, and gala dinner.',
      price: 12000.0,
      currency: 'INR',
      totalQuantity: 120,
      soldQuantity: 40,
      heldQuantity: 0,
      salesStartTime: new Date('2026-08-15T00:00:00Z'),
      salesCutoffTime: new Date('2026-11-27T23:59:59Z'),
      purchaseLimit: 5,
    },
    // Food Expo Tickets
    {
      id: 'tkt_fe_tasting',
      eventId: 'evt_food_wine_expo_2026',
      name: 'Tasting & Gourmet Discovery Pass',
      description: 'Entry to all exhibition pavilions, 10 complimentary gourmet tasting tokens, souvenir glass.',
      price: 3200.0,
      currency: 'INR',
      totalQuantity: 300,
      soldQuantity: 75,
      heldQuantity: 0,
      salesStartTime: new Date('2026-09-01T00:00:00Z'),
      salesCutoffTime: new Date('2026-12-05T08:00:00Z'),
      purchaseLimit: 4,
    },
  ];

  for (const t of ticketTypes) {
    await db.query(
      `INSERT INTO "TicketType" (
        "id", "eventId", "name", "description", "price", "currency", 
        "totalQuantity", "soldQuantity", "heldQuantity", "salesStartTime", 
        "salesCutoffTime", "purchaseLimit", "isActive"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
      ON CONFLICT ("id") DO NOTHING`,
      [
        t.id,
        t.eventId,
        t.name,
        t.description,
        t.price,
        t.currency,
        t.totalQuantity,
        t.soldQuantity,
        t.heldQuantity,
        t.salesStartTime,
        t.salesCutoffTime,
        t.purchaseLimit,
      ]
    );
  }

  // 4. Sample Confirmed Order & Reservation for attendee Yuvan Shankar
  const sampleResId = 'res_seed_confirmed_01';
  const sampleOrderId = 'ord_seed_confirmed_01';
  const samplePayId = 'pay_seed_confirmed_01';

  await db.query(
    `INSERT INTO "Reservation" ("id", "eventId", "userId", "status", "expiresAt", "createdAt")
     VALUES ($1, $2, $3, 'CONFIRMED', $4, $5)
     ON CONFLICT ("id") DO NOTHING`,
    [
      sampleResId,
      'evt_ai_summit_2026',
      'usr_att_yuvan',
      new Date(Date.now() + 10 * 60 * 1000),
      new Date('2026-09-10T10:00:00Z'),
    ]
  );

  await db.query(
    `INSERT INTO "ReservationItem" ("id", "reservationId", "ticketTypeId", "quantity", "unitPrice")
     VALUES ('resi_seed_01', $1, 'tkt_ai_standard', 2, 4500.00)
     ON CONFLICT ("id") DO NOTHING`,
    [sampleResId]
  );

  await db.query(
    `INSERT INTO "Order" ("id", "orderNumber", "attendeeId", "reservationId", "eventId", "status", "totalAmount", "currency", "createdAt")
     VALUES ($1, 'ESPH-2026-89410', 'usr_att_yuvan', $2, 'evt_ai_summit_2026', 'CONFIRMED', 9000.00, 'INR', $3)
     ON CONFLICT ("id") DO NOTHING`,
    [sampleOrderId, sampleResId, new Date('2026-09-10T10:05:00Z')]
  );

  await db.query(
    `INSERT INTO "OrderItem" ("id", "orderId", "ticketTypeId", "ticketNameSnapshot", "unitPriceSnapshot", "quantity", "subtotal")
     VALUES ('ordi_seed_01', $1, 'tkt_ai_standard', 'Standard All-Access Conference Pass', 4500.00, 2, 9000.00)
     ON CONFLICT ("id") DO NOTHING`,
    [sampleOrderId]
  );

  await db.query(
    `INSERT INTO "Payment" ("id", "orderId", "paymentReference", "amount", "currency", "status", "gatewayResponseCode", "createdAt")
     VALUES ($1, $2, 'PAY-ESPH-9923841', 9000.00, 'INR', 'SUCCEEDED', 'MOCK_GW_SUCCESS_AUTH', $3)
     ON CONFLICT ("id") DO NOTHING`,
    [samplePayId, sampleOrderId, new Date('2026-09-10T10:05:15Z')]
  );

  // 5. Booking Attempts for conversion rate analytics
  const attempts = [
    { id: 'attp_01', eventId: 'evt_ai_summit_2026', userId: 'usr_att_yuvan', status: 'CONFIRMED' },
    { id: 'attp_02', eventId: 'evt_ai_summit_2026', userId: 'usr_att_priya', status: 'CONFIRMED' },
    { id: 'attp_03', eventId: 'evt_ai_summit_2026', userId: 'usr_att_priya', status: 'FAILED_OUT_OF_STOCK' },
    { id: 'attp_04', eventId: 'evt_soundwave_goa_2026', userId: 'usr_att_yuvan', status: 'CONFIRMED' },
    { id: 'attp_05', eventId: 'evt_soundwave_goa_2026', userId: 'usr_att_priya', status: 'EXPIRED' },
  ];

  for (const a of attempts) {
    await db.query(
      `INSERT INTO "BookingAttempt" ("id", "eventId", "userId", "status")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("id") DO NOTHING`,
      [a.id, a.eventId, a.userId, a.status]
    );
  }

  // 6. Audit Log
  await db.query(
    `INSERT INTO "AuditLog" ("id", "userId", "action", "resourceType", "resourceId", "details")
     VALUES ('aud_01', 'usr_admin_01', 'SYSTEM_INITIALIZATION', 'SYSTEM', 'ROOT', 'Seeded initial platform users and events')
     ON CONFLICT ("id") DO NOTHING`
  );

  console.log('[Seed] Database seeding completed successfully.');
}

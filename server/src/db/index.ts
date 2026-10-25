import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { seedDatabase } from './seed';

const { Pool } = pg;

export interface DBClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  transaction<T>(callback: (client: DBTransaction) => Promise<T>): Promise<T>;
  isPGlite: boolean;
}

export interface DBTransaction {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
}

let dbInstance: DBClient | null = null;

export async function getDB(): Promise<DBClient> {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;
  // If a remote/standalone Postgres is configured and reachable
  if (databaseUrl && !databaseUrl.includes('placeholder')) {
    try {
      console.log('[DB] Connecting to PostgreSQL via DATABASE_URL...');
      const pool = new Pool({
        connectionString: databaseUrl,
        connectionTimeoutMillis: 3000,
      });

      // Test connection
      await pool.query('SELECT 1');
      console.log('[DB] Connected successfully to external PostgreSQL.');

      dbInstance = {
        isPGlite: false,
        async query<T = any>(sql: string, params?: any[]) {
          const res = await pool.query(sql, params);
          return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
        },
        async transaction<T>(callback: (client: DBTransaction) => Promise<T>): Promise<T> {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const txWrapper: DBTransaction = {
              query: async (sql, params) => {
                const res = await client.query(sql, params);
                return { rows: res.rows, rowCount: res.rowCount ?? 0 };
              },
            };
            const result = await callback(txWrapper);
            await client.query('COMMIT');
            return result;
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
        },
      };

      await initializeSchema(dbInstance);
      return dbInstance;
    } catch (err: any) {
      console.warn('[DB] External PostgreSQL connection failed:', err.message);
      console.log('[DB] Activating embedded PostgreSQL engine (@electric-sql/pglite)...');
    }
  }

  // Embedded PostgreSQL instance via PGlite
  console.log('[DB] Initializing high-performance embedded PostgreSQL engine (@electric-sql/pglite)...');
  const dataDir = path.resolve(process.cwd(), '.pgdata');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pglite = new PGlite(dataDir);
  await pglite.waitReady;
  console.log('[DB] Embedded PostgreSQL engine ready.');

  dbInstance = {
    isPGlite: true,
    async query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
      const res = await pglite.query(sql, params);
      return { rows: (res.rows as any) as T[], rowCount: res.rows.length };
    },
    async transaction<T>(callback: (client: DBTransaction) => Promise<T>): Promise<T> {
      return (await pglite.transaction(async (tx) => {
        const txWrapper: DBTransaction = {
          query: async <T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> => {
            const res = await tx.query(sql, params);
            return { rows: (res.rows as any) as T[], rowCount: res.rows.length };
          },
        };
        return await callback(txWrapper);
      })) as T;
    },
  };

  await initializeSchema(dbInstance);
  return dbInstance;
}

async function initializeSchema(db: DBClient) {
  try {
    // Check if User table exists
    const checkRes = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'User'
      ) as exists`
    );

    const exists = checkRes.rows[0]?.exists === true || checkRes.rows[0]?.exists === 't';
    if (!exists) {
      console.log('[DB] Tables not found. Executing initial schema DDL...');
      const ddl = `
        CREATE TABLE IF NOT EXISTS "User" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "email" TEXT NOT NULL UNIQUE,
            "name" TEXT NOT NULL,
            "passwordHash" TEXT NOT NULL,
            "role" TEXT NOT NULL DEFAULT 'ATTENDEE',
            "status" TEXT NOT NULL DEFAULT 'ACTIVE',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "Event" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "title" TEXT NOT NULL,
            "slug" TEXT NOT NULL UNIQUE,
            "description" TEXT NOT NULL,
            "category" TEXT NOT NULL,
            "venue" TEXT NOT NULL,
            "city" TEXT NOT NULL,
            "fullAddress" TEXT NOT NULL,
            "startDate" TIMESTAMP(3) NOT NULL,
            "endDate" TIMESTAMP(3) NOT NULL,
            "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
            "imageUrl" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'DRAFT',
            "salesStartTime" TIMESTAMP(3) NOT NULL,
            "salesCutoffTime" TIMESTAMP(3) NOT NULL,
            "organizerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "TicketType" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE RESTRICT,
            "name" TEXT NOT NULL,
            "description" TEXT NOT NULL,
            "price" NUMERIC(10,2) NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'INR',
            "totalQuantity" INTEGER NOT NULL,
            "soldQuantity" INTEGER NOT NULL DEFAULT 0,
            "heldQuantity" INTEGER NOT NULL DEFAULT 0,
            "salesStartTime" TIMESTAMP(3) NOT NULL,
            "salesCutoffTime" TIMESTAMP(3) NOT NULL,
            "purchaseLimit" INTEGER NOT NULL DEFAULT 5,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "chk_ticket_price_positive" CHECK ("price" >= 0),
            CONSTRAINT "chk_ticket_sold_positive" CHECK ("soldQuantity" >= 0),
            CONSTRAINT "chk_ticket_held_positive" CHECK ("heldQuantity" >= 0),
            CONSTRAINT "chk_ticket_inventory_capacity" CHECK ("soldQuantity" + "heldQuantity" <= "totalQuantity")
        );

        CREATE TABLE IF NOT EXISTS "Reservation" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE RESTRICT,
            "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
            "status" TEXT NOT NULL DEFAULT 'ACTIVE',
            "expiresAt" TIMESTAMP(3) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "ReservationItem" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "reservationId" TEXT NOT NULL REFERENCES "Reservation"("id") ON DELETE CASCADE,
            "ticketTypeId" TEXT NOT NULL REFERENCES "TicketType"("id") ON DELETE RESTRICT,
            "quantity" INTEGER NOT NULL,
            "unitPrice" NUMERIC(10,2) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "chk_reservation_quantity_positive" CHECK ("quantity" > 0)
        );

        CREATE TABLE IF NOT EXISTS "Order" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "orderNumber" TEXT NOT NULL UNIQUE,
            "attendeeId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
            "reservationId" TEXT NOT NULL UNIQUE REFERENCES "Reservation"("id") ON DELETE RESTRICT,
            "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE RESTRICT,
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "totalAmount" NUMERIC(10,2) NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'INR',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "OrderItem" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
            "ticketTypeId" TEXT NOT NULL REFERENCES "TicketType"("id") ON DELETE RESTRICT,
            "ticketNameSnapshot" TEXT NOT NULL,
            "unitPriceSnapshot" NUMERIC(10,2) NOT NULL,
            "quantity" INTEGER NOT NULL,
            "subtotal" NUMERIC(10,2) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "chk_order_item_quantity_positive" CHECK ("quantity" > 0)
        );

        CREATE TABLE IF NOT EXISTS "Payment" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT,
            "paymentReference" TEXT NOT NULL UNIQUE,
            "amount" NUMERIC(10,2) NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'INR',
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "gatewayResponseCode" TEXT,
            "idempotencyKey" TEXT UNIQUE,
            "failureReason" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "key" TEXT NOT NULL UNIQUE,
            "userId" TEXT NOT NULL,
            "requestPath" TEXT NOT NULL,
            "responseStatus" INTEGER NOT NULL,
            "responseBody" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "expiresAt" TIMESTAMP(3) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "AuditLog" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
            "action" TEXT NOT NULL,
            "resourceType" TEXT NOT NULL,
            "resourceId" TEXT,
            "details" TEXT,
            "ipAddress" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "BookingAttempt" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
            "userId" TEXT NOT NULL,
            "status" TEXT NOT NULL,
            "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS "idx_user_email" ON "User"("email");
        CREATE INDEX IF NOT EXISTS "idx_user_role" ON "User"("role");
        CREATE INDEX IF NOT EXISTS "idx_event_organizer" ON "Event"("organizerId");
        CREATE INDEX IF NOT EXISTS "idx_event_status" ON "Event"("status");
        CREATE INDEX IF NOT EXISTS "idx_event_category" ON "Event"("category");
        CREATE INDEX IF NOT EXISTS "idx_event_startDate" ON "Event"("startDate");
        CREATE INDEX IF NOT EXISTS "idx_ticket_event" ON "TicketType"("eventId");
        CREATE INDEX IF NOT EXISTS "idx_reservation_event" ON "Reservation"("eventId");
        CREATE INDEX IF NOT EXISTS "idx_reservation_user" ON "Reservation"("userId");
        CREATE INDEX IF NOT EXISTS "idx_reservation_status_expiry" ON "Reservation"("status", "expiresAt");
        CREATE INDEX IF NOT EXISTS "idx_order_attendee" ON "Order"("attendeeId");
        CREATE INDEX IF NOT EXISTS "idx_order_event" ON "Order"("eventId");
        CREATE INDEX IF NOT EXISTS "idx_payment_order" ON "Payment"("orderId");
        CREATE INDEX IF NOT EXISTS "idx_audit_user" ON "AuditLog"("userId");
        CREATE INDEX IF NOT EXISTS "idx_booking_attempt_event" ON "BookingAttempt"("eventId");
      `;

      // Execute statement chunks
      const statements = ddl
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await db.query(statement);
      }
      console.log('[DB] Schema DDL created successfully.');
      
      // Seed data
      await seedDatabase(db);
    } else {
      console.log('[DB] Schema already initialized.');
    }
  } catch (err) {
    console.error('[DB] Schema initialization error:', err);
    throw err;
  }
}

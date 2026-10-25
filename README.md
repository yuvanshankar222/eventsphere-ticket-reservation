# EventSphere — Multi-Tenant Event & Ticket Reservation System

EventSphere is a production-oriented web application designed for high-concurrency ticket booking, multi-tenant organizer isolation, 10-minute automated hold windows, and real-time revenue analytics.

---

## 1. Quick Start

### Prerequisites
- Node.js >= 20.x
- npm >= 9.x
- (Optional for standalone mode): PostgreSQL >= 15, Redis >= 7

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (or copy from .env.example)
cp .env.example .env

# 3. Start development server (serves backend on port 3000 with Vite middlewares)
npm run dev
```

The application is accessible at:
- **Web App**: `http://localhost:3000`
- **Swagger API Docs**: `http://localhost:3000/api/docs`
- **System Health**: `http://localhost:3000/api/health`

---

## 2. Seed Credentials & Demo Personas

The database is pre-seeded with realistic demonstration data:

| Persona | Role | Email | Password |
|---|---|---|---|
| Platform Admin | `ADMIN` | `admin@eventsphere.com` | `AdminPass123!` |
| Apex Management | `ORGANIZER` (Tenant 1) | `apex.events@eventsphere.com` | `OrganizerPass123!` |
| SoundWave Live | `ORGANIZER` (Tenant 2) | `soundwave.live@eventsphere.com` | `OrganizerPass123!` |
| Yuvan Shankar | `ATTENDEE` (Buyer) | `attendee@eventsphere.com` | `AttendeePass123!` |

*Tip*: Use the **"Role Switcher"** button in the top navigation bar to switch between personas instantly without manual re-typing.

---

## 3. Concurrency Protection & Invariants

EventSphere's reservation engine enforces PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) in consistent alphabetical order:

```sql
SELECT "id", "totalQuantity", "soldQuantity", "heldQuantity", "purchaseLimit"
FROM "TicketType"
WHERE "id" = ANY($1) AND "eventId" = $2
ORDER BY "id" ASC
FOR UPDATE;
```

### Invariants:
1. `availableQuantity + heldQuantity + soldQuantity = totalQuantity`
2. `soldQuantity + heldQuantity <= totalQuantity`
3. Held tickets automatically expire after **10 minutes** via the background reconciliation worker.
4. Confirmed tickets cannot expire or be released.

---

## 4. Automated Testing

Run the automated unit and concurrency tests:

```bash
# Run tests
npm test
```

Included test suites:
- `tests/inventory.test.ts`: Capacity invariants, purchase limit checks, allocation math.
- `tests/concurrency.test.ts`: 10 concurrent reservation attempts on 5 limited tickets; verifies exactly 5 succeed and 5 are rejected without overselling.

---

## 5. Docker Deployment

To run standalone PostgreSQL 16 and Redis 7 in local Docker containers:

```bash
# Spin up PostgreSQL and Redis
docker compose up -d postgres redis

# Run database migration
npx prisma migrate deploy

# Run seed script
npx tsx prisma/seed.ts

# Start the full-stack application
npm start
```

---

## 6. Architecture & Documentation Directory

- **ER Diagram**: `docs/er-diagram.mmd`
- **Postman Collection**: `docs/postman-collection.json`
- **API Documentation**: `docs/api-documentation.md`
- **Architecture Overview**: `docs/architecture.md`
- **Prisma Schema**: `prisma/schema.prisma`
- **Prisma Migrations**: `prisma/migrations/`

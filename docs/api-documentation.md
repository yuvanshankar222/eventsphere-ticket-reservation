# EventSphere REST API Documentation

Production REST API specification for **EventSphere — Multi-Tenant Event & Ticket Reservation System**.

- **Interactive Swagger UI**: `http://localhost:3000/api/docs`
- **Raw OpenAPI 3.0 Spec**: `http://localhost:3000/api/docs/json`
- **Postman Collection**: `docs/postman-collection.json`

---

## Base URL
`/api`

## Authentication
Authentication is supported via:
1. `Authorization: Bearer <JWT_TOKEN>` header
2. `HttpOnly`, `SameSite=Lax` cookie `token`

---

## Endpoints Summary

### Authentication
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register new attendee or organizer (Admin self-registration is blocked) |
| POST | `/auth/login` | Public | Authenticate user, receive JWT & HttpOnly cookie |
| POST | `/auth/logout` | Public | Invalidate session cookie |
| GET | `/auth/me` | Authenticated | Retrieve profile and current role |

### Events Catalog (Public & Organizer)
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/events` | Public | List published events with search, city, category, and price filters (Cached via Redis) |
| GET | `/events/:id` | Public | Get event details with ticket tiers and availability (Cached) |
| POST | `/events` | Organizer / Admin | Create a new event in `DRAFT` status |
| PUT | `/events/:id` | Organizer / Admin | Update event details (Strict tenant ownership verified) |
| DELETE | `/events/:id` | Organizer / Admin | Soft-cancel or delete event |
| POST | `/events/:id/publish` | Organizer / Admin | Publish event to public discovery |

### Ticket Categories
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/events/:id/tickets` | Public | List ticket categories and real-time available quantities |
| POST | `/events/:id/tickets` | Organizer / Admin | Create new ticket tier with capacity and price |
| PUT | `/tickets/:id` | Organizer / Admin | Update ticket tier (Capacity cannot be reduced below sold + held) |
| DELETE | `/tickets/:id` | Organizer / Admin | Deactivate ticket tier |

### Concurrency-Safe Reservations
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/reservations` | Authenticated | Atomic row-level locked ticket reservation (10-minute hold window) |
| GET | `/reservations/:id` | Owner / Admin | Retrieve reservation status and remaining seconds |
| POST | `/reservations/:id/cancel` | Owner / Admin | Explicitly release held inventory |

### Orders & Checkout
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/orders` | Authenticated | Create order from active reservation with price snapshotting |
| GET | `/orders/:id` | Owner / Organizer / Admin | Retrieve order details and settlement status |
| GET | `/orders` | Organizer / Admin | List orders (organizers only see their events' orders) |
| GET | `/attendee/bookings` | Attendee | List attendee's personal booking history |

### Simulated Payments
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/payments/process` | Authenticated | Simulated asynchronous payment; atomically transitions held tickets to sold |
| GET | `/payments/:id/status` | Owner / Admin | Check payment transaction status |
| POST | `/payments/mock-callback` | Webhook | Simulated gateway webhook with HMAC verification and duplicate protection |

### Organizer & Admin
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/organizer/dashboard` | Organizer | Tenant aggregate metrics (Sold, Held, Revenue, Conversion) |
| GET | `/organizer/analytics` | Organizer | Conversion analytics, revenue velocity, category distributions |
| GET | `/admin/dashboard` | Admin | Platform-wide volume, user counts, moderation KPIs |
| GET | `/admin/users` | Admin | Search and inspect user accounts |
| PATCH | `/admin/users/:id/status` | Admin | Suspend or reactivate user account |
| GET | `/admin/audit-logs` | Admin | View tamper-evident platform audit logs |
| GET | `/health` | Public | System health check (DB latency, Redis, Worker) |
| GET | `/ready` | Public | Kubernetes/Container readiness probe |

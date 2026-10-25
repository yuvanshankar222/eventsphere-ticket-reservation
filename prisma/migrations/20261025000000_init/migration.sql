-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ORGANIZER', 'ATTENDEE');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CHECKOUT_PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'PAYMENT_FAILED');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "BookingAttemptStatus" AS ENUM ('INITIATED', 'RESERVED', 'FAILED_OUT_OF_STOCK', 'FAILED_LIMIT_EXCEEDED', 'CONFIRMED', 'EXPIRED');

-- CreateTable User
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ATTENDEE',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable Event
CREATE TABLE "Event" (
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
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "salesStartTime" TIMESTAMP(3) NOT NULL,
    "salesCutoffTime" TIMESTAMP(3) NOT NULL,
    "organizerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable TicketType
CREATE TABLE "TicketType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE RESTRICT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
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

-- CreateTable Reservation
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE RESTRICT,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable ReservationItem
CREATE TABLE "ReservationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL REFERENCES "Reservation"("id") ON DELETE CASCADE,
    "ticketTypeId" TEXT NOT NULL REFERENCES "TicketType"("id") ON DELETE RESTRICT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chk_reservation_quantity_positive" CHECK ("quantity" > 0)
);

-- CreateTable Order
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL UNIQUE,
    "attendeeId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "reservationId" TEXT NOT NULL UNIQUE REFERENCES "Reservation"("id") ON DELETE RESTRICT,
    "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE RESTRICT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable OrderItem
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
    "ticketTypeId" TEXT NOT NULL REFERENCES "TicketType"("id") ON DELETE RESTRICT,
    "ticketNameSnapshot" TEXT NOT NULL,
    "unitPriceSnapshot" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chk_order_item_quantity_positive" CHECK ("quantity" > 0)
);

-- CreateTable Payment
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT,
    "paymentReference" TEXT NOT NULL UNIQUE,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayResponseCode" TEXT,
    "idempotencyKey" TEXT UNIQUE,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable IdempotencyKey
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "requestPath" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable BookingAttempt
CREATE TABLE "BookingAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
    "userId" TEXT NOT NULL,
    "status" "BookingAttemptStatus" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX "idx_user_email" ON "User"("email");
CREATE INDEX "idx_user_role" ON "User"("role");
CREATE INDEX "idx_event_organizer" ON "Event"("organizerId");
CREATE INDEX "idx_event_status" ON "Event"("status");
CREATE INDEX "idx_event_category" ON "Event"("category");
CREATE INDEX "idx_event_startDate" ON "Event"("startDate");
CREATE INDEX "idx_ticket_event" ON "TicketType"("eventId");
CREATE INDEX "idx_reservation_event" ON "Reservation"("eventId");
CREATE INDEX "idx_reservation_user" ON "Reservation"("userId");
CREATE INDEX "idx_reservation_status_expiry" ON "Reservation"("status", "expiresAt");
CREATE INDEX "idx_order_attendee" ON "Order"("attendeeId");
CREATE INDEX "idx_order_event" ON "Order"("eventId");
CREATE INDEX "idx_order_status" ON "Order"("status");
CREATE INDEX "idx_payment_order" ON "Payment"("orderId");
CREATE INDEX "idx_audit_user" ON "AuditLog"("userId");
CREATE INDEX "idx_audit_action" ON "AuditLog"("action");
CREATE INDEX "idx_booking_attempt_event" ON "BookingAttempt"("eventId");

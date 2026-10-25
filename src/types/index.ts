export type UserRole = 'ADMIN' | 'ORGANIZER' | 'ATTENDEE';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  venue: string;
  city: string;
  fullAddress: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  imageUrl: string;
  status: EventStatus;
  salesStartTime: string;
  salesCutoffTime: string;
  organizerId: string;
  organizerName?: string;
  organizerEmail?: string;
  startingPrice?: number;
  availableTickets?: number;
  totalSold?: number;
  totalCapacity?: number;
  totalRevenue?: number;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  description: string;
  price: number | string;
  currency: string;
  totalQuantity: number;
  soldQuantity: number;
  heldQuantity: number;
  availableQuantity?: number;
  salesStartTime: string;
  salesCutoffTime: string;
  purchaseLimit: number;
  isActive: boolean;
}

export type ReservationStatus =
  | 'ACTIVE'
  | 'CHECKOUT_PENDING'
  | 'CONFIRMED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'PAYMENT_FAILED';

export interface ReservationItem {
  id: string;
  reservationId: string;
  ticketTypeId: string;
  ticketName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Reservation {
  id: string;
  eventId: string;
  eventTitle?: string;
  venue?: string;
  city?: string;
  startDate?: string;
  imageUrl?: string;
  userId: string;
  status: ReservationStatus;
  expiresAt: string;
  remainingSeconds?: number;
  items: ReservationItem[];
  totalAmount: number;
  currency: string;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  orderId: string;
  ticketTypeId: string;
  ticketNameSnapshot: string;
  unitPriceSnapshot: number | string;
  quantity: number;
  subtotal: number | string;
}

export interface Order {
  id: string;
  orderNumber: string;
  attendeeId: string;
  attendeeName?: string;
  attendeeEmail?: string;
  reservationId: string;
  eventId: string;
  eventTitle?: string;
  venue?: string;
  city?: string;
  startDate?: string;
  imageUrl?: string;
  status: OrderStatus;
  totalAmount: number | string;
  currency: string;
  createdAt: string;
  items?: OrderItem[];
  payment?: {
    id: string;
    paymentReference: string;
    amount: number | string;
    status: string;
  };
}

export interface AuditLog {
  id: string;
  userId: string | null;
  userName?: string;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: string | null;
  createdAt: string;
}

export interface OrganizerMetrics {
  totalEvents: number;
  publishedEvents: number;
  draftEvents: number;
  totalSoldTickets: number;
  totalHeldTickets: number;
  availableTickets: number;
  completedOrders: number;
  pendingOrders: number;
  failedOrders: number;
  grossRevenue: number;
  currency: string;
  conversionRate: number;
}

export interface AdminMetrics {
  totalUsers: number;
  totalOrganizers: number;
  totalAttendees: number;
  suspendedUsers: number;
  totalEvents: number;
  publishedEvents: number;
  draftEvents: number;
  cancelledEvents: number;
  successfulTransactions: number;
  failedTransactions: number;
  platformRevenue: number;
  currency: string;
}

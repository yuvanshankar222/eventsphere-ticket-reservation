import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const router = Router();

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'EventSphere — Multi-Tenant Event & Ticket Reservation API',
    version: '1.0.0',
    description:
      'Production-oriented REST API for EventSphere. Features concurrency-safe ticket reservations with PostgreSQL transactions, row-level locking, 10-minute hold expiration, simulated asynchronous payments, Redis caching, and strict tenant isolation.',
    contact: {
      name: 'EventSphere Engineering',
      email: 'engineering@eventsphere.com',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Default API Endpoint',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      CookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'token',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'array', items: { type: 'string' } },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['ADMIN', 'ORGANIZER', 'ATTENDEE'] },
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
        },
      },
      Reservation: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          eventId: { type: 'string' },
          userId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'CHECKOUT_PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'PAYMENT_FAILED'],
          },
          expiresAt: { type: 'string', format: 'date-time' },
          totalAmount: { type: 'number' },
          currency: { type: 'string', example: 'INR' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'System Health Check',
        responses: {
          200: { description: 'System UP with DB & Redis diagnostics' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register new attendee or organizer',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                  role: { type: 'string', enum: ['ATTENDEE', 'ORGANIZER'] },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Registration successful' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate and receive session cookie/JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Login successful' } },
      },
    },
    '/events': {
      get: {
        summary: 'Discover published events with filtering and Redis caching',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'city', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'minPrice', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
        ],
        responses: { 200: { description: 'List of published events' } },
      },
      post: {
        summary: 'Create a new event (Organizer only)',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Event created in DRAFT status' } },
      },
    },
    '/reservations': {
      post: {
        summary: 'Concurrency-safe ticket reservation engine (10-minute hold window)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['eventId', 'items'],
                properties: {
                  eventId: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ticketTypeId: { type: 'string' },
                        quantity: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Tickets successfully locked for 10 minutes' },
          409: { description: 'Insufficient inventory conflict' },
        },
      },
    },
    '/payments/process': {
      post: {
        summary: 'Simulated asynchronous payment settlement',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderId'],
                properties: {
                  orderId: { type: 'string' },
                  paymentMethod: { type: 'string', enum: ['UPI', 'CARD', 'NET_BANKING'] },
                  forceOutcome: { type: 'string', enum: ['SUCCEEDED', 'FAILED'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Payment settled and converted held tickets to sold' },
          410: { description: 'Reservation expired before payment' },
        },
      },
    },
  },
};

router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(openApiSpec));
router.get('/docs/json', (req, res) => {
  res.json(openApiSpec);
});

export default router;

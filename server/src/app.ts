import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';

import { authenticateToken } from './middleware/auth';
import authRoutes from './routes/auth';
import eventsRoutes from './routes/events';
import ticketsRoutes from './routes/tickets';
import reservationsRoutes from './routes/reservations';
import ordersRoutes from './routes/orders';
import paymentsRoutes from './routes/payments';
import organizerRoutes from './routes/organizer';
import adminRoutes from './routes/admin';
import healthRoutes from './routes/health';
import swaggerRoutes from './routes/swagger';

export function createApp() {
  const app = express();

  // Basic security and parsing
  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Request correlation ID and logger
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
  });

  // JWT / Cookie Authentication middleware
  app.use(authenticateToken);

  // Mount API Routers
  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api', ticketsRoutes);
  app.use('/api/reservations', reservationsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/organizer', organizerRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', healthRoutes);
  app.use('/api', swaggerRoutes);

  // Centralized Error Handler (prevents leaking stack traces in client responses)
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const correlationId = req.correlationId;

    console.error(`[Error] [${correlationId}] ${req.method} ${req.url}:`, err);

    res.status(status).json({
      error: err.name || 'InternalServerError',
      message: err.message || 'An unexpected error occurred while processing your request.',
      correlationId,
    });
  });

  return app;
}

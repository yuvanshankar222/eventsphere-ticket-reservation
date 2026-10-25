import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import { createApp } from './server/src/app';
import { getDB } from './server/src/db';
import { getRedisClient } from './server/src/cache/redis';
import { startReservationWorker, stopReservationWorker } from './server/src/workers/reservationWorker';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  console.log('----------------------------------------------------');
  console.log('  EventSphere — Multi-Tenant Event & Reservation App');
  console.log('----------------------------------------------------');

  // 1. Initialize Database & Run Seed
  console.log('[Bootstrap] Initializing database...');
  await getDB();

  // 2. Initialize Redis (or Fallback Cache)
  console.log('[Bootstrap] Checking Redis connection...');
  getRedisClient();

  // 3. Start Background Reservation Expiration Worker
  console.log('[Bootstrap] Starting reservation expiration worker...');
  startReservationWorker(5000);

  // 4. Create Express app
  const app = createApp();

  // 5. Mount Vite middleware in dev or static files in production
  if (!isProduction) {
    console.log('[Bootstrap] Mounting Vite development server middlewares...');
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Bootstrap] Serving production build from dist...');
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EventSphere] Server listening on http://0.0.0.0:${PORT}`);
    console.log(`[EventSphere] API Documentation available at http://localhost:${PORT}/api/docs`);
    console.log(`[EventSphere] Health endpoint available at http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('[Shutdown] Received termination signal. Closing server gracefully...');
    stopReservationWorker();
    server.close(() => {
      console.log('[Shutdown] Server closed successfully.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup failure:', err);
  process.exit(1);
});

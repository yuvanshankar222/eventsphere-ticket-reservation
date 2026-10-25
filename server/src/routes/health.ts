import { Router, Request, Response } from 'express';
import { getDB } from '../db';
import { getCacheStatus } from '../cache/redis';

const router = Router();

// GET /api/health
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const dbStart = Date.now();
    await db.query('SELECT 1');
    const dbLatencyMs = Date.now() - dbStart;

    const cacheStatus = getCacheStatus();

    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'EventSphere API & Reservation Engine',
      environment: process.env.NODE_ENV || 'development',
      components: {
        database: {
          status: 'UP',
          engine: db.isPGlite ? 'PostgreSQL (WASM Embedded)' : 'PostgreSQL (External Server)',
          latencyMs: dbLatencyMs,
        },
        caching: cacheStatus,
        reservationWorker: {
          status: 'UP',
          intervalMs: 5000,
          holdDurationMinutes: 10,
        },
      },
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'DOWN',
      error: err.message,
    });
  }
});

// GET /api/ready
router.get('/ready', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    await db.query('SELECT 1');
    res.status(200).json({ ready: true });
  } catch (err: any) {
    res.status(503).json({ ready: false, error: err.message });
  }
});

export default router;

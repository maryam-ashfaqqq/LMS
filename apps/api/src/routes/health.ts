import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { query } from '../db/pool';
import { asyncHandler } from '../middleware/validate';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const started = Date.now();
    try {
      await query<RowDataPacket>('SELECT 1 AS ok');
      res.json({
        status: 'ok',
        service: 'oakline-api',
        database: 'up',
        latencyMs: Date.now() - started,
        time: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: 'degraded',
        service: 'oakline-api',
        database: 'down',
        latencyMs: Date.now() - started,
        time: new Date().toISOString(),
      });
    }
  }),
);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { catalogRouter } from './routes/catalog';
import { learningRouter } from './routes/learning';
import { instructorRouter } from './routes/instructor';
import { adminRouter } from './routes/admin';
import { paymentRouter, paymentWebhookHandler } from './routes/payments';
import { uploadRouter } from './routes/uploads';
import { certificateRouter } from './routes/certificates';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.webOrigin, credentials: true }));
  if (config.nodeEnv === 'development') app.use(morgan('dev'));

  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
    paymentWebhookHandler(req, res).catch(next);
  });

  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(config.uploadDir, { index: false }));

  app.get('/', (_req, res) => {
    res.json({ name: 'Oakline API', health: '/api/health' });
  });

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api/uploads', uploadRouter);
  app.use('/api/instructor', instructorRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/certificates', certificateRouter);
  app.use('/api', catalogRouter);
  app.use('/api', learningRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

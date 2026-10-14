import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimit.js';
import routes from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../dist');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'img-src': ["'self'", 'data:', 'blob:'],
          'style-src': ["'self'", "'unsafe-inline'"],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'", 'https://*.supabase.co'],
          'upgrade-insecure-requests': null,
        },
      },
    }),
  );

  app.use(
    cors({
      origin(origin, cb) {
        if (
          !origin ||
          config.clientOrigins.includes(origin) ||
          origin.endsWith('.vercel.app')
        ) {
          return cb(null, true);
        }
        return cb(null, false);
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  );

  app.use('/api', generalLimiter);
  app.use('/api', express.json({ limit: config.limits.jsonBodyLimit }));
  app.use('/api', routes);
  app.use('/api', notFound);

  // Serve the built frontend when available (production / `npm start`).
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

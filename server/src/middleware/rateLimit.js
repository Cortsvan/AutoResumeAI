import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

function limiter(max, code, message) {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code, message } });
    },
  });
}

export const generalLimiter = limiter(
  config.rateLimit.general,
  'RATE_LIMITED',
  'Too many requests. Please wait a moment and try again.',
);
export const aiLimiter = limiter(
  config.rateLimit.ai,
  'RATE_LIMITED',
  'You are sending messages too quickly. Please wait a moment and try again.',
);
export const documentLimiter = limiter(
  config.rateLimit.documents,
  'RATE_LIMITED',
  'Too many document operations. Please wait a moment and try again.',
);

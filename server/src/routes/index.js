import { Router } from 'express';
import { aiLimiter, documentLimiter } from '../middleware/rateLimit.js';
import { requireFile, uploadDocx } from '../middleware/upload.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import adminRouter from './admin.js';
import {
  applyDocumentEdits,
  chat,
  generateDocument,
  getConfig,
  inspectDocument,
  structureDocument,
} from '../controllers/index.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true }));
router.get('/config', optionalAuth, getConfig);

// Protected AI feature: requires authentication & budget/quota check
router.post('/chat', aiLimiter, requireAuth, chat);

// Document processing routes
router.post('/documents/inspect', documentLimiter, uploadDocx, requireFile, inspectDocument);
router.post('/documents/apply', documentLimiter, uploadDocx, requireFile, applyDocumentEdits);
router.post('/documents/generate', documentLimiter, generateDocument);
router.post('/resumes/structure', aiLimiter, optionalAuth, structureDocument);

// Admin dashboard routes (Protected by requireAdmin)
router.use('/admin', adminRouter);

export default router;

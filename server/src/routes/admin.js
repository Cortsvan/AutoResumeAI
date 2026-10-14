import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  getOverview,
  listUsers,
  updateUser,
  revokeUserSessions,
  getAuditLogs,
  updateBudget,
} from '../controllers/admin.js';

const router = Router();

// All admin routes require administrator privileges
router.use(requireAdmin);

router.get('/overview', getOverview);
router.get('/users', listUsers);
router.patch('/users/:userId', updateUser);
router.post('/users/:userId/revoke-sessions', revokeUserSessions);
router.get('/audit-logs', getAuditLogs);
router.patch('/budget', updateBudget);

export default router;

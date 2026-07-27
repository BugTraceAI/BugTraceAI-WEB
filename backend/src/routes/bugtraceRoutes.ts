import { Router } from 'express';
import { executeBugTraceCommand } from '../controllers/bugtraceController.js';
import { executeLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// /api/bugtrace/execute
router.post('/execute', executeLimiter, executeBugTraceCommand);

export default router;

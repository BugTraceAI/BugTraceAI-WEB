import { Router } from 'express';
import { executeBugTraceCommand } from '../controllers/bugtraceController.js';

const router = Router();

// /api/bugtrace/execute
router.post('/execute', executeBugTraceCommand);

export default router;

import { Router } from 'express';
import { executeKaliCommand } from '../controllers/kaliController.js';
import { executeLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// /api/kali/execute
router.post('/execute', executeLimiter, executeKaliCommand);

export default router;

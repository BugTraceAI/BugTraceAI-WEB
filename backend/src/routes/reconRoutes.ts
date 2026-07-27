import { Router } from 'express';
import { executeReconCommand } from '../controllers/reconController.js';
import { executeLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// /api/recon/execute
router.post('/execute', executeLimiter, executeReconCommand);

export default router;

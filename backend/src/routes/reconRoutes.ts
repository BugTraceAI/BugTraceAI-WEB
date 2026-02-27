import { Router } from 'express';
import { executeReconCommand } from '../controllers/reconController.js';

const router = Router();

// /api/recon/execute
router.post('/execute', executeReconCommand);

export default router;

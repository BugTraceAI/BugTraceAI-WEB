import { Router } from 'express';
import { executeKaliCommand } from '../controllers/kaliController.js';

const router = Router();

// /api/kali/execute
router.post('/execute', executeKaliCommand);

export default router;

import { Router } from 'express';
import * as ctrl from '../controllers/apiDiscoveryController.js';

const router = Router();

/** POST   /api/api-discovery/scans       — save a completed scan */
router.post('/scans', ctrl.createScan);

/** GET    /api/api-discovery/scans       — list all saved scans */
router.get('/scans', ctrl.listScans);

/** GET    /api/api-discovery/scans/:id   — get one scan */
router.get('/scans/:id', ctrl.getScan);

/** DELETE /api/api-discovery/scans/:id   — delete one scan */
router.delete('/scans/:id', ctrl.deleteScan);

/** DELETE /api/api-discovery/scans       — clear all scans */
router.delete('/scans', ctrl.clearAllScans);

export default router;

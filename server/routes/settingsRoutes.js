import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public reading
router.get('/', getSettings);

// Admin-only updates
router.post('/', requireAdmin, updateSettings);
router.put('/', requireAdmin, updateSettings);

export default router;

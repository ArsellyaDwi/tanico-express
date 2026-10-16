import { Router } from 'express';
import { getActivityLogs, createActivityLog } from '../controllers/activityLogsController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

router.get('/', getActivityLogs);
router.post('/', createActivityLog);

export default router;

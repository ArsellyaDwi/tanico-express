import { Router } from 'express';
import { getHome, getAbout, getFarmerStories } from '../controllers/homeController.js';

const router = Router();

router.get('/', getHome);
router.get('/about', getAbout);
router.get('/farmer-stories', getFarmerStories);

export default router;

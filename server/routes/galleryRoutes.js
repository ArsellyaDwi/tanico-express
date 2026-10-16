import { Router } from 'express';
import {
  getGallery,
  createGallery,
  updateGallery,
  deleteGallery
} from '../controllers/galleryController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public reading
router.get('/', getGallery);

// Admin-only mutations
router.post('/', requireAdmin, createGallery);
router.put('/', requireAdmin, updateGallery);
router.put('/:id', requireAdmin, updateGallery);
router.delete('/', requireAdmin, deleteGallery);
router.delete('/:id', requireAdmin, deleteGallery);

export default router;

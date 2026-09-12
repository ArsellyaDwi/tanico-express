import { Router } from 'express';
import {
  getGallery,
  createGallery,
  updateGallery,
  deleteGallery
} from '../controllers/galleryController.js';

const router = Router();

router.get('/', getGallery);
router.post('/', createGallery);
router.put('/', updateGallery);
router.put('/:id', updateGallery);
router.delete('/', deleteGallery);
router.delete('/:id', deleteGallery);

export default router;

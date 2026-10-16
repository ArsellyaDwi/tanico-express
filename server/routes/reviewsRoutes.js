import { Router } from 'express';
import {
  getReviews,
  createReview,
  updateReview,
  deleteReview
} from '../controllers/reviewsController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public reading
router.get('/', getReviews);

// Authenticated customer submission
router.post('/', requireAuth, createReview);

// Admin-only review management & moderation
router.put('/', requireAdmin, updateReview);
router.put('/:id', requireAdmin, updateReview);
router.delete('/', requireAdmin, deleteReview);
router.delete('/:id', requireAdmin, deleteReview);

export default router;

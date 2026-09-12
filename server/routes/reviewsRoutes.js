import { Router } from 'express';
import {
  getReviews,
  createReview,
  updateReview,
  deleteReview
} from '../controllers/reviewsController.js';

const router = Router();

router.get('/', getReviews);
router.post('/', createReview);
router.put('/', updateReview);
router.put('/:id', updateReview);
router.delete('/', deleteReview);
router.delete('/:id', deleteReview);

export default router;

import { Router } from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist
} from '../controllers/wishlistController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getWishlist);
router.post('/', addToWishlist);
router.delete('/', removeFromWishlist);
router.delete('/:productId', removeFromWishlist);

export default router;

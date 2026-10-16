import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  mergeCart
} from '../controllers/cartController.js';
import { authenticate, requireAuth } from '../middleware/auth.js';

const router = Router();

// Reading cart (returns [] for unauthenticated visitors)
router.get('/', authenticate, getCart);

// All cart mutations strictly require authentication
router.post('/', requireAuth, addToCart);
router.post('/merge', requireAuth, mergeCart);
router.put('/', requireAuth, updateCartItem);
router.put('/:productId', requireAuth, updateCartItem);
router.delete('/', requireAuth, clearCart);
router.delete('/:productId', requireAuth, removeFromCart);

export default router;

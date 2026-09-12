import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  mergeCart
} from '../controllers/cartController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getCart);
router.post('/', addToCart);
router.post('/merge', mergeCart);
router.put('/', updateCartItem);
router.put('/:productId', updateCartItem);
router.delete('/', clearCart);
router.delete('/:productId', removeFromCart);

export default router;

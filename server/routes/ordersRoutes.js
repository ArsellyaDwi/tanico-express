import { Router } from 'express';
import {
  getUserOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder
} from '../controllers/ordersController.js';
import { authenticate, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Order creation: authenticated user or guest checkout
router.post('/', authenticate, createOrder);

// Reading orders: strictly requires authentication to prevent data leaks
router.get('/', requireAuth, getUserOrders);
router.get('/:id', requireAuth, getOrderById);

// Updating order: requires authentication, customer can only cancel pending order
router.put('/', requireAuth, updateOrder);
router.put('/:id', requireAuth, updateOrder);

// Deleting order: strictly administrator only
router.delete('/', requireAdmin, deleteOrder);
router.delete('/:id', requireAdmin, deleteOrder);

export default router;

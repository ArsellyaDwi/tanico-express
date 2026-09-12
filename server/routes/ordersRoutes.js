import { Router } from 'express';
import {
  getUserOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder
} from '../controllers/ordersController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getUserOrders);
router.post('/', createOrder);
router.put('/', updateOrder);
router.put('/:id', updateOrder);
router.delete('/', deleteOrder);
router.delete('/:id', deleteOrder);
router.get('/:id', getOrderById);

export default router;

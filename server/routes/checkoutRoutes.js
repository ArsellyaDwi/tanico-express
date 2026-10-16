import { Router } from 'express';
import { processCheckout, getCheckoutCart } from '../controllers/checkoutController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getCheckoutCart);
router.post('/', processCheckout);

export default router;

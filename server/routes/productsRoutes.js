import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/productsController.js';

const router = Router();

router.get('/', getProducts);
router.post('/', createProduct);
router.put('/', updateProduct);
router.put('/:id', updateProduct);
router.delete('/', deleteProduct);
router.delete('/:id', deleteProduct);
router.get('/:id', getProductById);

export default router;

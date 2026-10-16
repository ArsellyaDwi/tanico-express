import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  importProducts
} from '../controllers/productsController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public reading
router.get('/', getProducts);
router.get('/:id', getProductById);

// Admin-only mutations
router.post('/import', requireAdmin, importProducts);
router.post('/', requireAdmin, createProduct);
router.put('/', requireAdmin, updateProduct);
router.put('/:id', requireAdmin, updateProduct);
router.delete('/', requireAdmin, deleteProduct);
router.delete('/:id', requireAdmin, deleteProduct);

export default router;

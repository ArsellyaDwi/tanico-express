import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoriesController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public reading
router.get('/', getCategories);
router.get('/:id', getCategoryById);

// Admin-only mutations
router.post('/', requireAdmin, createCategory);
router.put('/', requireAdmin, updateCategory);
router.put('/:id', requireAdmin, updateCategory);
router.patch('/:id', requireAdmin, updateCategory);
router.delete('/', requireAdmin, deleteCategory);
router.delete('/:id', requireAdmin, deleteCategory);

export default router;

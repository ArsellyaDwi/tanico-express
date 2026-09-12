import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoriesController.js';

const router = Router();

router.get('/', getCategories);
router.post('/', createCategory);
router.put('/', updateCategory);
router.put('/:id', updateCategory);
router.patch('/:id', updateCategory);
router.delete('/', deleteCategory);
router.delete('/:id', deleteCategory);
router.get('/:id', getCategoryById);

export default router;

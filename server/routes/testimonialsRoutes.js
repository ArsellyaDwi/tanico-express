import { Router } from 'express';
import {
  getTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial
} from '../controllers/testimonialsController.js';

const router = Router();

router.get('/', getTestimonials);
router.post('/', createTestimonial);
router.put('/', updateTestimonial);
router.put('/:id', updateTestimonial);
router.delete('/', deleteTestimonial);
router.delete('/:id', deleteTestimonial);

export default router;

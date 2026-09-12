import { Router } from 'express';
import {
  getPartners,
  createPartner,
  updatePartner,
  deletePartner
} from '../controllers/partnersController.js';

const router = Router();

router.get('/', getPartners);
router.post('/', createPartner);
router.put('/', updatePartner);
router.put('/:id', updatePartner);
router.delete('/', deletePartner);
router.delete('/:id', deletePartner);

export default router;

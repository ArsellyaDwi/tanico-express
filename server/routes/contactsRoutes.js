import { Router } from 'express';
import {
  getContacts,
  submitContact,
  updateContact,
  deleteContact
} from '../controllers/contactsController.js';

const router = Router();

router.get('/', getContacts);
router.post('/', submitContact);
router.put('/', updateContact);
router.put('/:id', updateContact);
router.delete('/', deleteContact);
router.delete('/:id', deleteContact);

export default router;

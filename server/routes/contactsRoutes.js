import { Router } from 'express';
import {
  getContacts,
  submitContact,
  updateContact,
  deleteContact
} from '../controllers/contactsController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public submission
router.post('/', submitContact);

// Admin-only management & reading (protecting customer PII)
router.get('/', requireAdmin, getContacts);
router.put('/', requireAdmin, updateContact);
router.put('/:id', requireAdmin, updateContact);
router.delete('/', requireAdmin, deleteContact);
router.delete('/:id', requireAdmin, deleteContact);

export default router;

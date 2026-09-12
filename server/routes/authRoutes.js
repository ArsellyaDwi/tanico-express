import { Router } from 'express';
import {
  login,
  register,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  logout,
  me,
  googleCallback,
  googleAuth
} from '../controllers/authController.js';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/logout', logout);
router.get('/me', me);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Google OAuth routes
router.get('/google/callback', googleCallback);
router.post('/google/callback', googleAuth);
router.post('/google', googleAuth);

export default router;

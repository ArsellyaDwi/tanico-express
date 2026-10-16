import { Router } from 'express';
import {
  getHeroBanners,
  createHeroBanner,
  updateHeroBanner,
  deleteHeroBanner,
  getHeroBenefits,
  createHeroBenefit,
  updateHeroBenefit,
  deleteHeroBenefit
} from '../controllers/bannersController.js';
import { requireAdmin } from '../middleware/auth.js';

export const heroBannersRouter = Router();
heroBannersRouter.get('/', getHeroBanners);
heroBannersRouter.post('/', requireAdmin, createHeroBanner);
heroBannersRouter.put('/', requireAdmin, updateHeroBanner);
heroBannersRouter.put('/:id', requireAdmin, updateHeroBanner);
heroBannersRouter.delete('/', requireAdmin, deleteHeroBanner);
heroBannersRouter.delete('/:id', requireAdmin, deleteHeroBanner);

export const heroBenefitsRouter = Router();
heroBenefitsRouter.get('/', getHeroBenefits);
heroBenefitsRouter.post('/', requireAdmin, createHeroBenefit);
heroBenefitsRouter.put('/', requireAdmin, updateHeroBenefit);
heroBenefitsRouter.put('/:id', requireAdmin, updateHeroBenefit);
heroBenefitsRouter.delete('/', requireAdmin, deleteHeroBenefit);
heroBenefitsRouter.delete('/:id', requireAdmin, deleteHeroBenefit);

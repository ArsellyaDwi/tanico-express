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

export const heroBannersRouter = Router();
heroBannersRouter.get('/', getHeroBanners);
heroBannersRouter.post('/', createHeroBanner);
heroBannersRouter.put('/', updateHeroBanner);
heroBannersRouter.put('/:id', updateHeroBanner);
heroBannersRouter.delete('/', deleteHeroBanner);
heroBannersRouter.delete('/:id', deleteHeroBanner);

export const heroBenefitsRouter = Router();
heroBenefitsRouter.get('/', getHeroBenefits);
heroBenefitsRouter.post('/', createHeroBenefit);
heroBenefitsRouter.put('/', updateHeroBenefit);
heroBenefitsRouter.put('/:id', updateHeroBenefit);
heroBenefitsRouter.delete('/', deleteHeroBenefit);
heroBenefitsRouter.delete('/:id', deleteHeroBenefit);

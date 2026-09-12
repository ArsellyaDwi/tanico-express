import { Router } from 'express';
import {
  getArticles,
  getArticleBySlug,
  createArticle,
  updateArticle,
  deleteArticle
} from '../controllers/articlesController.js';

const router = Router();

router.get('/', getArticles);
router.post('/', createArticle);
router.put('/', updateArticle);
router.put('/:id', updateArticle);
router.delete('/', deleteArticle);
router.delete('/:id', deleteArticle);
router.get('/:slug', getArticleBySlug);

export default router;

import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';
import { getCacheItem, setCacheItem } from '@/lib/cache.js';

export async function getPublishedArticles(limit = 24) {
  const cacheKey = `published_articles_limit_${limit}`;
  const cached = getCacheItem(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/articles?limit=${limit}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      return [];
    }

    const articles = await res.json();
    const result = Array.isArray(articles) ? articles : [];
    setCacheItem(cacheKey, result, 60 * 1000);
    return result;
  } catch (error) {
    logger.error('[ArticlesLib] getPublishedArticles error via Express API:', error);
    return [];
  }
}

export async function getArticleBySlug(slug) {
  if (!slug) return null;
  const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();
  const cacheKey = `article_slug_${decodedSlug}`;
  const cached = getCacheItem(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/articles/${encodeURIComponent(decodedSlug)}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      return null;
    }

    const article = await res.json();
    if (article && !article.error) {
      setCacheItem(cacheKey, article, 60 * 1000);
      return article;
    }
    return null;
  } catch (error) {
    logger.error('[ArticlesLib] getArticleBySlug error via Express API:', error);
    return null;
  }
}

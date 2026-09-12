import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';
import { getCacheItem, setCacheItem } from '@/lib/cache.js';

export async function getProductByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  const cacheKey = `product_detail_${idOrSlug}`;
  const cached = getCacheItem(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/products/${encodeURIComponent(idOrSlug)}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      return null;
    }

    const product = await res.json();
    if (product && !product.error) {
      setCacheItem(cacheKey, product, 60 * 1000);
      return product;
    }
    return null;
  } catch (error) {
    logger.error('[ProductsLib] getProductByIdOrSlug error via Express API:', error);
    return null;
  }
}

export async function getActiveProducts(limit = 24) {
  const cacheKey = `active_products_limit_${limit}`;
  const cached = getCacheItem(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/products?limit=${limit}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      return [];
    }

    const products = await res.json();
    const result = Array.isArray(products) ? products : (products.products || []);
    setCacheItem(cacheKey, result, 60 * 1000);
    return result;
  } catch (error) {
    logger.error('[ProductsLib] getActiveProducts error via Express API:', error);
    return [];
  }
}

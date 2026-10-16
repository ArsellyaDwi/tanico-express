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
      next: { revalidate: 60, tags: ['products'] },
      headers: { 'Accept': 'application/json' },
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
    });

    if (!res.ok) {
      return null;
    }

    const text = await res.text();
    let product = null;
    try {
      product = JSON.parse(text);
    } catch (_) {
      return null;
    }

    if (product && !product.error) {
      setCacheItem(cacheKey, product, 60 * 1000);
      return product;
    }
    return null;
  } catch (error) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE' || error?.message?.includes('Dynamic server usage')) {
      throw error;
    }
    logger.error('[ProductsLib] getProductByIdOrSlug error via Express API:', error);
    return null;
  }
}

export async function getActiveProducts(limit = 50, options = {}) {
  const { bypassCache = false } = typeof options === 'boolean' ? { bypassCache: options } : options;
  const cacheKey = `active_products_limit_${limit}`;
  if (!bypassCache) {
    const cached = getCacheItem(cacheKey);
    if (cached) return cached;
  }

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/products?limit=${limit}`, {
      next: { revalidate: 60, tags: ['products'] },
      headers: { 'Accept': 'application/json' },
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
    });

    if (!res.ok) {
      return [];
    }

    const text = await res.text();
    let products = [];
    try {
      products = JSON.parse(text);
    } catch (_) {
      return [];
    }
    const result = Array.isArray(products) ? products : (products?.products || []);
    setCacheItem(cacheKey, result, 30 * 1000); // 30 seconds short-lived cache
    return result;
  } catch (error) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE' || error?.message?.includes('Dynamic server usage')) {
      throw error;
    }
    logger.error('[ProductsLib] getActiveProducts error via Express API:', error);
    return [];
  }
}

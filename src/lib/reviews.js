import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';

export async function getReviews(productId) {
  try {
    const baseUrl = getApiBaseUrl();
    const url = productId ? `${baseUrl}/api/reviews?productId=${encodeURIComponent(productId)}` : `${baseUrl}/api/reviews`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error('[ReviewsLib] Error getting reviews via Express API:', error);
    return [];
  }
}

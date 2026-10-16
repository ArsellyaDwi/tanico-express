import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';

export async function getReviews(productId, token = null) {
  try {
    const baseUrl = getApiBaseUrl();
    const url = productId ? `${baseUrl}/api/reviews?productId=${encodeURIComponent(productId)}` : `${baseUrl}/api/reviews`;
    const headers = { 'Accept': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, {
      cache: 'no-store',
      headers,
      credentials: 'include'
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error('[ReviewsLib] Error getting reviews via Express API:', error);
    return [];
  }
}

export async function createReview(reviewData, token = null) {
  try {
    const baseUrl = getApiBaseUrl();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/api/reviews`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(reviewData)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal mengirimkan ulasan');
    }
    return data;
  } catch (error) {
    logger.error('[ReviewsLib] Error creating review via Express API:', error);
    throw error;
  }
}

import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';

export async function getTestimonials() {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/testimonials`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error('[TestimonialsLib] Error getting testimonials via Express API:', error);
    return [];
  }
}

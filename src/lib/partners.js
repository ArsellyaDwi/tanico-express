import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';

export async function getPartners() {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/partners`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error('[PartnersLib] Error getting partners via Express API:', error);
    return [];
  }
}

export async function savePartners(partnersArray) {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/admin/partners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partnersArray)
    });
    return await res.json();
  } catch (error) {
    logger.error('[PartnersLib] Error saving partners via Express API:', error);
    return { success: false, error: error.message };
  }
}

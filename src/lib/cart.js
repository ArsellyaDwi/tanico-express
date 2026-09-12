import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';

export async function getUserCart(userId) {
  if (!userId) return [];
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/cart`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'x-user-id': String(userId)
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error('[CartLib] Error getting user cart via Express API:', error);
    return [];
  }
}

export async function saveUserCart(userId, productId, quantity, setQuantity = false) {
  if (!userId || !productId) return { success: false, error: 'User ID dan Product ID wajib diisi' };
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/cart`, {
      method: setQuantity ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': String(userId)
      },
      body: JSON.stringify({ productId, quantity })
    });
    const data = await res.json();
    return { success: res.ok, ...data };
  } catch (error) {
    logger.error('[CartLib] Error saving user cart via Express API:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteUserCartItem(userId, productId) {
  if (!userId || !productId) return { success: false };
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/cart/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': String(userId)
      }
    });
    return { success: res.ok };
  } catch (error) {
    logger.error('[CartLib] Error deleting cart item via Express API:', error);
    return { success: false, error: error.message };
  }
}

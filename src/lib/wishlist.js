import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';

export async function getUserWishlist(userId) {
  if (!userId) return [];
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/wishlist`, {
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
    logger.error('[WishlistLib] Error getting user wishlist via Express API:', error);
    return [];
  }
}

export async function addUserWishlistItem(userId, productId) {
  if (!userId || !productId) return { success: false, error: 'User ID dan Product ID wajib diisi' };
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/wishlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': String(userId)
      },
      body: JSON.stringify({ productId })
    });
    const data = await res.json();
    return { success: res.ok, ...data };
  } catch (error) {
    logger.error('[WishlistLib] Error adding wishlist item via Express API:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteUserWishlistItem(userId, productId) {
  if (!userId || !productId) return { success: false };
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/wishlist/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': String(userId)
      }
    });
    return { success: res.ok };
  } catch (error) {
    logger.error('[WishlistLib] Error deleting wishlist item via Express API:', error);
    return { success: false, error: error.message };
  }
}

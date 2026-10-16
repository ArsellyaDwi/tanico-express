import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';

export async function getUserCart(token = null) {
  try {
    const baseUrl = getApiBaseUrl();
    const headers = { 'Accept': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/api/cart`, {
      cache: 'no-store',
      headers,
      credentials: 'include'
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error('[CartLib] Error getting user cart via Express API:', error);
    return [];
  }
}

export async function saveUserCart(productId, quantity, setQuantity = false, token = null) {
  if (!productId) return { success: false, error: 'Product ID wajib diisi' };
  try {
    const baseUrl = getApiBaseUrl();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/api/cart`, {
      method: setQuantity ? 'PUT' : 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ productId, quantity })
    });
    const data = await res.json();
    return { success: res.ok, ...data };
  } catch (error) {
    logger.error('[CartLib] Error saving user cart via Express API:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteUserCartItem(productId, token = null) {
  if (!productId) return { success: false };
  try {
    const baseUrl = getApiBaseUrl();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/api/cart/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      headers,
      credentials: 'include'
    });
    return { success: res.ok };
  } catch (error) {
    logger.error('[CartLib] Error deleting cart item via Express API:', error);
    return { success: false, error: error.message };
  }
}

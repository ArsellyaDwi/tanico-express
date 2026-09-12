import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';

export async function createCheckoutOrder(orderData) {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(orderData.userId ? { 'x-user-id': String(orderData.userId) } : {})
      },
      body: JSON.stringify(orderData)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal memproses pesanan');
    }
    return data;
  } catch (error) {
    logger.error('[OrdersLib] Error creating checkout order via Express API:', error);
    throw error;
  }
}

export async function getUserOrders(userIdOrPhone) {
  if (!userIdOrPhone) return [];
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/orders?phone=${encodeURIComponent(userIdOrPhone)}`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'x-user-id': String(userIdOrPhone)
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.orders || []);
  } catch (error) {
    logger.error('[OrdersLib] Error getting user orders via Express API:', error);
    return [];
  }
}

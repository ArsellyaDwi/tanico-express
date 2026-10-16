import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';

export async function createCheckoutOrder(orderData, token = null) {
  try {
    const baseUrl = getApiBaseUrl();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/api/checkout`, {
      method: 'POST',
      headers,
      credentials: 'include',
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

export async function getUserOrders(token = null) {
  if (!token) return [];
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/orders`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.orders || []);
  } catch (error) {
    logger.error('[OrdersLib] Error getting user orders via Express API:', error);
    return [];
  }
}

export async function getOrderById(orderId, token = null) {
  if (!orderId) return null;
  try {
    const baseUrl = getApiBaseUrl();
    const headers = { 'Accept': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderId)}`, {
      cache: 'no-store',
      headers,
      credentials: 'include'
    });

    const contentType = res.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    }

    if (!res.ok) {
      return {
        _error: true,
        status: res.status,
        message: data?.error || (res.status === 403 ? 'Akses ditolak: Anda tidak memiliki akses ke pesanan ini.' : 'Pesanan tidak ditemukan.')
      };
    }

    if (data && data.order) return data.order;
    return data;
  } catch (error) {
    logger.error('[OrdersLib] Error getting order detail via Express API:', error);
    return {
      _error: true,
      status: 500,
      message: 'Gagal menghubungi server untuk memuat detail transaksi.'
    };
  }
}

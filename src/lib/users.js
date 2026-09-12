import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';

export async function findUserByEmail(email) {
  if (!email) return null;
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/profile?email=${encodeURIComponent(email)}`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    logger.error('[UsersLib] Error in findUserByEmail via Express API:', error);
    return null;
  }
}

export async function createUser(data) {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Gagal mendaftar pengguna');
    return result.user || result;
  } catch (error) {
    logger.error('[UsersLib] Error in createUser via Express API:', error);
    throw error;
  }
}

export async function updateUserProfile(userId, data) {
  if (!userId) return null;
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': String(userId)
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) return null;
    const result = await res.json();
    return result.user || result;
  } catch (error) {
    logger.error('[UsersLib] Error in updateUserProfile via Express API:', error);
    return null;
  }
}

export async function verifyUserCredentials(email, password) {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch (error) {
    logger.error('[UsersLib] Error verifying credentials via Express API:', error);
    return null;
  }
}

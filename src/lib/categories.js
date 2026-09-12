import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';
import { getCacheItem, setCacheItem } from '@/lib/cache.js';

export async function getActiveCategories() {
  const cacheKey = 'active_categories_list';
  const cached = getCacheItem(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/categories`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      return [];
    }

    const categories = await res.json();
    const result = Array.isArray(categories) ? categories : [];
    setCacheItem(cacheKey, result, 60 * 1000);
    return result;
  } catch (error) {
    logger.error('[CategoriesLib] getActiveCategories error via Express API:', error);
    return [];
  }
}

export async function getCategories(all = false) {
  try {
    const baseUrl = getApiBaseUrl();
    const url = all ? `${baseUrl}/api/categories?all=true` : `${baseUrl}/api/categories`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Gagal memuat kategori');
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error('[CategoriesLib] getCategories error:', error);
    throw error;
  }
}

export async function getCategoryById(id) {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/categories/${id}`, {
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Kategori tidak ditemukan');
    }

    return data;
  } catch (error) {
    logger.error('[CategoriesLib] getCategoryById error:', error);
    throw error;
  }
}

export async function createCategory(categoryData, headers = {}) {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      },
      body: JSON.stringify(categoryData)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Gagal membuat kategori');
    }

    return data;
  } catch (error) {
    logger.error('[CategoriesLib] createCategory error:', error);
    throw error;
  }
}

export async function updateCategory(id, categoryData, headers = {}) {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      },
      body: JSON.stringify(categoryData)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Gagal memperbarui kategori');
    }

    return data;
  } catch (error) {
    logger.error('[CategoriesLib] updateCategory error:', error);
    throw error;
  }
}

export async function deleteCategory(id, headers = {}) {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/categories/${id}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Gagal menghapus kategori');
    }

    return data;
  } catch (error) {
    logger.error('[CategoriesLib] deleteCategory error:', error);
    throw error;
  }
}

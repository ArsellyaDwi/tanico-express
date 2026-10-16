const memoryCache = new Map();

export function getCacheItem(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
}

export function setCacheItem(key, data, ttlMs = 60000) {
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlMs,
  });
}

export function clearCacheItem(key) {
  memoryCache.delete(key);
}

export function clearCacheByPrefix(prefix) {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}

export function clearAllCache() {
  memoryCache.clear();
  try {
    fetch('http://127.0.0.1:3000/api/revalidate', { method: 'POST' }).catch(() => {});
  } catch (_) {}
}

export function clearHomeCache() {
  clearCacheItem('home_data_cache');
  clearCacheItem('categories_public_list');
  clearCacheByPrefix('categories_list_');
  clearCacheByPrefix('product_');
  clearCacheByPrefix('products_query_');
  clearCacheByPrefix('admin_');
  try {
    fetch('http://127.0.0.1:3000/api/revalidate', { method: 'POST' }).catch(() => {});
  } catch (_) {}
}

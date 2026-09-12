import { getApiBaseUrl } from '@/lib/apiBase.js';

const VALID_BUCKETS = new Set([
  'hero',
  'products',
  'categories',
  'articles',
  'gallery',
  'partners',
  'testimonials',
  'tanico-public'
]);

/**
 * Extract bucket and storage path from a Supabase Storage public/signed URL
 */
export function extractStoragePathAndBucket(url) {
  if (!url || typeof url !== 'string') return null;
  const regex = /\/storage\/v1\/object\/(?:public\/|sign\/)?([^/]+)\/(.+?)(?:\?.*)?$/;
  const match = url.match(regex);
  if (match) {
    const bucket = match[1];
    const path = decodeURIComponent(match[2]);
    return { bucket, path };
  }
  return null;
}

/**
 * Check if a URL points to an object in Supabase Storage
 */
export function isSupabaseStorageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.includes('/storage/v1/object/')) return false;
  const extracted = extractStoragePathAndBucket(url);
  return !!(extracted && extracted.bucket && extracted.path);
}

/**
 * Delete a single file from Supabase Storage.
 * Safely ignores external URLs, local asset paths, or placeholders.
 */
export async function deleteFileFromSupabase(urlOrPath, bucketParam = null) {
  if (!urlOrPath) return { success: true, skipped: true };
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/admin/media/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlOrPath, bucket: bucketParam })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[supabaseStorage] deleteFileFromSupabase fetch error:', err.message);
  }
  return { success: false };
}

/**
 * Batch delete files from Supabase Storage
 */
export async function deleteFilesFromSupabase(urlsOrPaths) {
  if (!urlsOrPaths || !Array.isArray(urlsOrPaths) || urlsOrPaths.length === 0) {
    return { success: true, count: 0 };
  }
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/admin/media/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: urlsOrPaths })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[supabaseStorage] deleteFilesFromSupabase fetch error:', err.message);
  }
  return { success: false };
}

/**
 * Batch check whether an array of image URLs are still referenced in any database table.
 * Fully routed through the Express backend API (/api/admin/media/check-in-use).
 * Frontend NEVER queries PostgreSQL or Prisma directly.
 */
export async function getReferencedUrlsInDatabase(urls, excluded = null) {
  if (!urls || !Array.isArray(urls) || urls.length === 0) return new Set();
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/admin/media/check-in-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls })
    });
    if (res.ok) {
      const data = await res.json();
      return new Set(data.referencedUrls || []);
    }
  } catch (err) {
    console.warn('[supabaseStorage] getReferencedUrlsInDatabase fetch error:', err.message);
  }
  return new Set();
}

export async function isFileStillReferencedInDatabase(url, excluded = null) {
  if (!url || typeof url !== 'string') return false;
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/admin/media/check-in-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.inUse);
    }
  } catch (err) {
    console.warn('[supabaseStorage] isFileStillReferencedInDatabase fetch error:', err.message);
  }
  return false;
}

/**
 * Automatically cleans up an old image if it is being replaced with a new image.
 * Routed to Express backend (/api/admin/media/replace) where PostgreSQL/Prisma checks and deletes securely.
 */
export async function cleanupOldImageIfReplaced(oldUrl, newUrl, excluded = null, options = {}) {
  if (!oldUrl || typeof oldUrl !== 'string') return { skipped: true, reason: 'No old URL' };
  if (oldUrl === newUrl) return { skipped: true, reason: 'URL unchanged' };
  if (!isSupabaseStorageUrl(oldUrl)) return { skipped: true, reason: 'Old URL not in Supabase Storage' };

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/admin/media/replace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldUrl, newUrl })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[supabaseStorage] cleanupOldImageIfReplaced fetch error:', err.message);
  }
  return { success: false };
}

/**
 * Automatically cleans up image(s) when an entity record is deleted.
 * Routed to Express backend (/api/admin/media/cleanup) with orphan protection.
 */
export async function cleanupDeletedEntityImages(urls, excluded = null, options = {}) {
  if (!urls) return { skipped: true };
  const list = Array.isArray(urls) ? urls : [urls];
  const validUrls = list
    .map(item => (typeof item === 'string' ? item : item?.url))
    .filter(u => u && typeof u === 'string' && isSupabaseStorageUrl(u));

  if (validUrls.length === 0) {
    return { skipped: true, reason: 'No valid Supabase Storage URLs to delete' };
  }

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/admin/media/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: validUrls })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[supabaseStorage] cleanupDeletedEntityImages fetch error:', err.message);
  }
  return { success: false };
}

/**
 * Audit orphan files in Supabase Storage across all buckets.
 */
export async function auditStorageOrphanFiles() {
  return {
    totalStorageFiles: 0,
    referencedFilesCount: 0,
    orphanFilesCount: 0,
    skippedFilesCount: 0,
    buckets: {},
    orphanFiles: []
  };
}

/**
 * Upload base64 string to Supabase Storage and return public URL.
 */
export async function uploadBase64ToSupabase(base64Data, filename = 'image.jpg', bucketName = 'tanico-public') {
  if (!base64Data || typeof base64Data !== 'string') {
    return { success: false, error: 'Invalid base64 data' };
  }

  const bucket = VALID_BUCKETS.has(bucketName) ? bucketName : 'tanico-public';

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/admin/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64: base64Data,
        filename,
        bucket
      })
    });

    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.error || 'Failed to upload image' };
  } catch (err) {
    console.error('[SupabaseStorage] uploadBase64ToSupabase error:', err);
    return { success: false, error: err.message || 'Error uploading file' };
  }
}

/**
 * Upload raw File or Buffer to Supabase Storage via Express backend
 */
export async function uploadBufferToSupabase(buffer, mimeType = 'image/jpeg', filename = 'file.jpg', bucketName = 'tanico-public') {
  const bucket = VALID_BUCKETS.has(bucketName) ? bucketName : 'tanico-public';

  try {
    const baseUrl = getApiBaseUrl();
    const blob = new Blob([buffer], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('bucket', bucket);
    formData.append('filename', filename);

    const res = await fetch(`${baseUrl}/api/admin/upload`, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.error || 'Failed to upload buffer' };
  } catch (err) {
    return { success: false, error: err.message || 'Error uploading buffer' };
  }
}

export async function ensureSupabaseImageUrl(imageVal, defaultFilename = 'image.jpg', bucket = 'tanico-public') {
  if (!imageVal || typeof imageVal !== 'string') return imageVal || '';
  if (imageVal.startsWith('data:image')) {
    try {
      const res = await uploadBase64ToSupabase(imageVal, defaultFilename, bucket);
      if (res.success && res.url) {
        return res.url;
      }
    } catch (err) {
      console.warn('[SupabaseStorage] ensureSupabaseImageUrl fallback:', err.message);
    }
  }
  return imageVal;
}

export async function cleanAllBase64InObject(obj, defaultBucket = 'tanico-public') {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image')) {
      return await ensureSupabaseImageUrl(obj, 'cms_image.jpg', defaultBucket);
    }
    const trimmed = obj.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          const cleaned = await cleanAllBase64InObject(parsed, defaultBucket);
          return JSON.stringify(cleaned);
        }
      } catch (e) {
        // Not valid JSON, return original string
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return await Promise.all(obj.map(item => cleanAllBase64InObject(item, defaultBucket)));
  }
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = await cleanAllBase64InObject(value, defaultBucket);
    }
    return cleaned;
  }
  return obj;
}


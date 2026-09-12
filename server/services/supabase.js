import { createClient } from '@supabase/supabase-js';
import { prisma } from './prisma.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  : null;

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

export function isSupabaseStorageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.includes('/storage/v1/object/')) return false;
  const extracted = extractStoragePathAndBucket(url);
  return !!(extracted && extracted.bucket && extracted.path);
}

/**
 * Checks whether an image path/filename is still referenced anywhere in the PostgreSQL database.
 * Prevents accidental deletion of shared or active media files (Orphan Protection).
 */
export async function isMediaUsedInDatabase(urlOrPath, bucketParam = null) {
  if (!urlOrPath || typeof urlOrPath !== 'string' || !urlOrPath.trim()) {
    return false;
  }

  let storagePath = null;
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    const extracted = extractStoragePathAndBucket(urlOrPath);
    if (!extracted) {
      return false; // External URL not in Supabase
    }
    storagePath = extracted.path;
  } else {
    storagePath = urlOrPath.replace(/^\/+/, '');
  }

  if (!storagePath) return false;

  const filenameOnly = storagePath.includes('/') ? storagePath.split('/').pop() : null;
  const pathMatchers = filenameOnly
    ? [{ contains: storagePath }, { contains: filenameOnly }]
    : [{ contains: storagePath }];

  try {
    const [
      inProduct,
      inProductImage,
      inCategory,
      inArticle,
      inGallery,
      inTestimonial,
      inHeroBanner,
      inHeroBenefit,
      inPartner,
      inAdminProfile,
      inUser,
      inReview,
      inOrderItem,
      inWebsiteSetting
    ] = await Promise.all([
      prisma.product.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ image: m }))
        },
        select: { id: true }
      }),
      prisma.productImage.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ url: m }))
        },
        select: { id: true }
      }),
      prisma.category.findFirst({
        where: {
          OR: [
            ...pathMatchers.map(m => ({ image: m })),
            ...pathMatchers.map(m => ({ heroImage: m })),
            ...pathMatchers.map(m => ({ banner: m })),
            ...pathMatchers.map(m => ({ ogImage: m }))
          ]
        },
        select: { id: true }
      }),
      prisma.article.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ image: m }))
        },
        select: { id: true }
      }),
      prisma.gallery.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ image: m }))
        },
        select: { id: true }
      }),
      prisma.testimonial.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ avatar: m }))
        },
        select: { id: true }
      }),
      prisma.heroBanner.findFirst({
        where: {
          OR: [
            ...pathMatchers.map(m => ({ image: m })),
            ...pathMatchers.map(m => ({ desktopImage: m })),
            ...pathMatchers.map(m => ({ mobileImage: m })),
            ...pathMatchers.map(m => ({ background: m }))
          ]
        },
        select: { id: true }
      }),
      prisma.heroBenefit.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ image: m }))
        },
        select: { id: true }
      }),
      prisma.partner.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ logo: m }))
        },
        select: { id: true }
      }),
      prisma.adminProfile.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ avatar: m }))
        },
        select: { id: true }
      }),
      prisma.user.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ avatar: m }))
        },
        select: { id: true }
      }),
      prisma.review.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ userAvatar: m }))
        },
        select: { id: true }
      }),
      prisma.orderItem.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ image: m }))
        },
        select: { id: true }
      }),
      prisma.websiteSetting.findFirst({
        where: {
          OR: pathMatchers.map(m => ({ homepageCMS: m }))
        },
        select: { id: true }
      })
    ]);

    return Boolean(
      inProduct ||
      inProductImage ||
      inCategory ||
      inArticle ||
      inGallery ||
      inTestimonial ||
      inHeroBanner ||
      inHeroBenefit ||
      inPartner ||
      inAdminProfile ||
      inUser ||
      inReview ||
      inOrderItem ||
      inWebsiteSetting
    );
  } catch (err) {
    console.error('[Supabase Storage] Error querying media reference in DB:', err);
    return true; // Conservative safety fallback: if check fails, avoid accidental deletion
  }
}

/**
 * Batch check whether an array of image URLs are still referenced in any database table.
 * Fully executed on backend via Prisma queries.
 */
export async function getReferencedUrlsInDatabase(urls, excluded = null) {
  if (!urls || !Array.isArray(urls) || urls.length === 0) return new Set();
  const referencedSet = new Set();
  await Promise.all(
    urls.map(async (u) => {
      if (u && typeof u === 'string') {
        const inUse = await isMediaUsedInDatabase(u);
        if (inUse) referencedSet.add(u);
      }
    })
  );
  return referencedSet;
}

/**
 * Direct file deletion from Supabase Storage using Bucket + Path identity.
 */
export async function deleteFileFromSupabase(urlOrPath, bucketParam = null) {
  if (!urlOrPath) {
    return { success: true, message: 'No file to delete' };
  }

  if (!supabase) {
    return { success: false, error: 'Supabase client is not initialized.' };
  }

  let bucket = bucketParam;
  let filePath = urlOrPath;

  if (typeof urlOrPath === 'string' && (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://'))) {
    if (!isSupabaseStorageUrl(urlOrPath)) {
      return { success: true, message: 'External URL ignored' };
    }
    const extracted = extractStoragePathAndBucket(urlOrPath);
    if (!extracted) {
      return { success: true, message: 'Not a valid Supabase URL' };
    }
    bucket = extracted.bucket;
    filePath = extracted.path;
  } else if (typeof urlOrPath === 'string') {
    filePath = urlOrPath.replace(/^\/+/, '');
  }

  if (!bucket || !VALID_BUCKETS.has(bucket)) {
    bucket = 'tanico-public';
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) {
      console.error(`[Supabase Storage] Failed to delete ${bucket}/${filePath}:`, error.message);
      return { success: false, error: error.message };
    }
    return { success: true, bucket, path: filePath, data };
  } catch (err) {
    console.error(`[Supabase Storage] Exception deleting ${bucket}/${filePath}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Safe file deletion with Orphan Protection:
 * Only deletes the file from Supabase if no other record in PostgreSQL still references it.
 */
export async function safeDeleteFileFromSupabase(urlOrPath, defaultBucket = null) {
  if (!urlOrPath || typeof urlOrPath !== 'string' || !urlOrPath.trim()) {
    return { success: true, message: 'No file to delete' };
  }

  const inUse = await isMediaUsedInDatabase(urlOrPath, defaultBucket);
  if (inUse) {
    console.log(`[Supabase Storage] Orphan Protection: File '${urlOrPath}' is still in use by another record. Deletion skipped.`);
    return {
      success: true,
      deleted: false,
      skipped: true,
      reason: 'STILL_IN_USE'
    };
  }

  const res = await deleteFileFromSupabase(urlOrPath, defaultBucket);
  return {
    ...res,
    deleted: Boolean(res.success),
    skipped: false
  };
}

/**
 * Handles media replacement: when a new image is provided, safely cleans up the old image
 * if it differs and is not referenced by any other record.
 */
export async function handleMediaReplacement(oldUrl, newUrl, defaultBucket = null) {
  if (!oldUrl || typeof oldUrl !== 'string' || !oldUrl.trim()) {
    return { success: true, message: 'No old media to clean up' };
  }
  if (oldUrl === newUrl) {
    return { success: true, message: 'Media unchanged' };
  }
  return await safeDeleteFileFromSupabase(oldUrl, defaultBucket);
}

export async function uploadBufferToSupabase(buffer, mimeType, filename, bucket = 'tanico-public') {
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase Storage belum terkonfigurasi (SUPABASE_URL atau Service Key belum diatur)'
    };
  }

  const cleanBucket = VALID_BUCKETS.has(bucket) ? bucket : 'tanico-public';
  const timestamp = Date.now();
  const cleanFilename = (filename || 'image.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${timestamp}_${cleanFilename}`;

  try {
    const { data, error } = await supabase.storage
      .from(cleanBucket)
      .upload(storagePath, buffer, {
        contentType: mimeType || 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error(`[Supabase Storage] Upload error to bucket '${cleanBucket}':`, error);
      return {
        success: false,
        error: error.message || 'Gagal mengunggah gambar ke Supabase Storage'
      };
    }

    const { data: publicData } = supabase.storage
      .from(cleanBucket)
      .getPublicUrl(storagePath);

    if (!publicData || !publicData.publicUrl) {
      return {
        success: false,
        error: 'Gagal mendapatkan Public URL dari Supabase Storage'
      };
    }

    return {
      success: true,
      url: publicData.publicUrl,
      publicUrl: publicData.publicUrl,
      path: storagePath,
      bucket: cleanBucket
    };
  } catch (err) {
    console.error(`[Supabase Storage] Exception uploading to bucket '${cleanBucket}':`, err);
    return {
      success: false,
      error: err.message || 'Gagal mengunggah gambar ke Supabase Storage'
    };
  }
}

export async function uploadBase64ToSupabase(base64Data, filename, bucket = 'tanico-public') {
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase Storage belum terkonfigurasi'
    };
  }

  try {
    let cleanBase64 = base64Data;
    let mimeType = 'image/jpeg';

    if (base64Data.includes(';base64,')) {
      const parts = base64Data.split(';base64,');
      const mimeMatch = parts[0].match(/data:(.*?)$/);
      if (mimeMatch) mimeType = mimeMatch[1];
      cleanBase64 = parts[1];
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    return await uploadBufferToSupabase(buffer, mimeType, filename, bucket);
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Gagal mengunggah gambar ke Supabase Storage'
    };
  }
}



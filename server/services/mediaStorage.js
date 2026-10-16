import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from './prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '../..');
const uploadsDir = path.resolve(appRoot, 'public/uploads');

// Ensure uploads directory exists if writable
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (_) {
  // Ephemeral or read-only filesystem fallback handled gracefully
}

/**
 * Checks whether an image path/filename is still referenced anywhere in the PostgreSQL database.
 * Prevents accidental deletion of shared or active media files (Orphan Protection).
 */
export async function isMediaUsedInDatabase(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string' || !urlOrPath.trim()) {
    return false;
  }

  let storagePath = urlOrPath.replace(/^\/+/, '');
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    try {
      const parsed = new URL(urlOrPath);
      storagePath = parsed.pathname.replace(/^\/+/, '');
    } catch (_) {
      storagePath = urlOrPath;
    }
  }

  const filenameOnly = storagePath.includes('/') ? storagePath.split('/').pop() : storagePath;
  const pathMatchers = filenameOnly && filenameOnly !== storagePath
    ? [{ contains: storagePath }, { contains: filenameOnly }]
    : [{ contains: storagePath }];

  try {
    const [
      inProduct,
      inProductImage,
      inCategory,
      inArticle,
      inGallery,
      inHeroBanner,
      inHeroBenefit,
      inAdminProfile,
      inUser,
      inReview,
      inOrderItem,
      inWebsiteSetting
    ] = await Promise.all([
      prisma.product.findFirst({
        where: { OR: pathMatchers.map(m => ({ image: m })) },
        select: { id: true }
      }),
      prisma.productImage.findFirst({
        where: { OR: pathMatchers.map(m => ({ url: m })) },
        select: { id: true }
      }),
      prisma.category.findFirst({
        where: {
          OR: [
            ...pathMatchers.map(m => ({ image: m })),
            ...pathMatchers.map(m => ({ banner: m })),
            ...pathMatchers.map(m => ({ heroImage: m }))
          ]
        },
        select: { id: true }
      }),
      prisma.article.findFirst({
        where: { OR: pathMatchers.map(m => ({ image: m })) },
        select: { id: true }
      }),
      prisma.gallery.findFirst({
        where: { OR: pathMatchers.map(m => ({ image: m })) },
        select: { id: true }
      }),
      prisma.heroBanner.findFirst({
        where: {
          OR: [
            ...pathMatchers.map(m => ({ image: m })),
            ...pathMatchers.map(m => ({ desktopImage: m })),
            ...pathMatchers.map(m => ({ mobileImage: m }))
          ]
        },
        select: { id: true }
      }),
      prisma.heroBenefit.findFirst({
        where: { OR: pathMatchers.map(m => ({ image: m })) },
        select: { id: true }
      }),
      prisma.adminProfile.findFirst({
        where: { OR: pathMatchers.map(m => ({ avatar: m })) },
        select: { id: true }
      }),
      prisma.user.findFirst({
        where: { OR: pathMatchers.map(m => ({ avatar: m })) },
        select: { id: true }
      }),
      prisma.review.findFirst({
        where: { OR: pathMatchers.map(m => ({ userAvatar: m })) },
        select: { id: true }
      }),
      prisma.orderItem.findFirst({
        where: { OR: pathMatchers.map(m => ({ image: m })) },
        select: { id: true }
      }),
      prisma.websiteSetting.findFirst({
        where: {
          OR: [
            ...pathMatchers.map(m => ({ homepageCMS: m })),
            ...pathMatchers.map(m => ({ contactsCMS: m }))
          ]
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
      inHeroBanner ||
      inHeroBenefit ||
      inAdminProfile ||
      inUser ||
      inReview ||
      inOrderItem ||
      inWebsiteSetting
    );
  } catch (err) {
    console.warn('[MediaStorage] Error checking media usage in database:', err.message);
    return false;
  }
}

/**
 * Batch check referenced URLs in PostgreSQL
 */
export async function getReferencedUrlsInDatabase(urls) {
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
 * Direct file deletion from local storage
 */
export async function deleteMediaFile(urlOrPath) {
  if (!urlOrPath) {
    return { success: true, message: 'No file to delete' };
  }

  try {
    let cleanFilename = '';
    if (typeof urlOrPath === 'string') {
      if (urlOrPath.startsWith('/uploads/')) {
        cleanFilename = urlOrPath.replace('/uploads/', '');
      } else if (urlOrPath.includes('/uploads/')) {
        cleanFilename = urlOrPath.split('/uploads/').pop();
      }
    }

    if (cleanFilename) {
      const targetPath = path.resolve(uploadsDir, cleanFilename);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
        return { success: true, message: `Deleted ${cleanFilename}` };
      }
    }

    return { success: true, message: 'File not found locally or external URL skipped' };
  } catch (err) {
    console.warn('[MediaStorage] Failed to delete file:', err.message);
    return { success: false, error: err.message };
  }
}

// Backwards compatibility alias
export const deleteFileFromSupabase = deleteMediaFile;

/**
 * Safe file deletion with Orphan Protection
 */
export async function safeDeleteMediaFile(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string' || !urlOrPath.trim()) {
    return { success: true, message: 'No file to delete' };
  }

  const inUse = await isMediaUsedInDatabase(urlOrPath);
  if (inUse) {
    return {
      success: true,
      deleted: false,
      skipped: true,
      reason: 'STILL_IN_USE'
    };
  }

  const res = await deleteMediaFile(urlOrPath);
  return {
    ...res,
    deleted: Boolean(res.success),
    skipped: false
  };
}

// Backwards compatibility alias
export const safeDeleteFileFromSupabase = safeDeleteMediaFile;

/**
 * Handles media replacement: when a new image is provided, safely cleans up the old image
 */
export async function handleMediaReplacement(oldUrl, newUrl) {
  if (!oldUrl || typeof oldUrl !== 'string' || !oldUrl.trim()) {
    return { success: true, message: 'No old media to clean up' };
  }
  if (oldUrl === newUrl) {
    return { success: true, message: 'Media unchanged' };
  }
  return await safeDeleteMediaFile(oldUrl);
}

/**
 * Upload buffer to local disk or fallback to base64 data URI
 */
export async function uploadBufferToMedia(buffer, mimeType, filename) {
  const timestamp = Date.now();
  const cleanFilename = `${timestamp}_${(filename || 'image.jpg').replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const targetFilePath = path.resolve(uploadsDir, cleanFilename);
    fs.writeFileSync(targetFilePath, buffer);

    const publicUrl = `/uploads/${cleanFilename}`;
    return {
      success: true,
      url: publicUrl,
      publicUrl,
      path: cleanFilename,
      filename: cleanFilename
    };
  } catch (fsErr) {
    // In read-only or serverless environments, store as self-contained base64 data URL
    const type = mimeType || 'image/jpeg';
    const dataUrl = `data:${type};base64,${buffer.toString('base64')}`;
    return {
      success: true,
      url: dataUrl,
      publicUrl: dataUrl,
      path: cleanFilename,
      filename: cleanFilename
    };
  }
}

// Backwards compatibility alias
export const uploadBufferToSupabase = uploadBufferToMedia;

/**
 * Upload base64 data
 */
export async function uploadBase64ToMedia(base64Data, filename) {
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
    return await uploadBufferToMedia(buffer, mimeType, filename);
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Gagal memproses gambar base64'
    };
  }
}

// Backwards compatibility alias
export const uploadBase64ToSupabase = uploadBase64ToMedia;

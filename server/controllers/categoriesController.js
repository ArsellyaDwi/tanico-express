import prisma from '../services/prisma.js';
import { getCacheItem, setCacheItem, clearHomeCache } from '../services/cache.js';
import { safeDeleteFileFromSupabase, handleMediaReplacement } from '../services/supabase.js';

export function parseBoolean(val, defaultVal = false) {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === 'true' || trimmed === '1' || trimmed === 'yes') return true;
    if (trimmed === 'false' || trimmed === '0' || trimmed === 'no') return false;
  }
  if (typeof val === 'number') return val === 1;
  return Boolean(val);
}

export function generateSlug(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export async function getCategories(req, res) {
  try {
    const { all } = req.query;
    const cacheKey = `categories_list_${all === 'true' ? 'all' : 'active'}`;
    const cached = getCacheItem(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const where = all === 'true' ? {} : { status: { notIn: ['Nonaktif', 'nonaktif'] } };

    const categories = await prisma.category.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    const result = categories || [];
    setCacheItem(cacheKey, result, 60 * 1000);
    return res.json(result);
  } catch (error) {
    console.error('getCategories error:', error);
    return res.status(500).json({
      success: false,
      error: 'Gagal memuat kategori',
      message: error.message
    });
  }
}

export async function getCategoryById(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID atau slug kategori diperlukan',
        message: 'ID atau slug kategori diperlukan'
      });
    }

    const category = await prisma.category.findFirst({
      where: {
        OR: [
          { id },
          { slug: id }
        ]
      },
      include: {
        _count: { select: { products: true } },
        products: {
          where: { status: { notIn: ['Nonaktif', 'nonaktif'] } },
          take: 24
        }
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Kategori tidak ditemukan',
        message: 'Kategori tidak ditemukan'
      });
    }

    return res.json(category);
  } catch (error) {
    console.error('getCategoryById error:', error);
    return res.status(500).json({
      success: false,
      error: 'Gagal memuat kategori',
      message: error.message
    });
  }
}

export async function createCategory(req, res) {
  try {
    const {
      name,
      slug,
      image,
      description,
      itemCount,
      status,
      sortOrder,
      badgeText,
      metaTitle,
      badgeColor,
      ctaLink,
      ctaText,
      showOnHomepage,
      banner,
      cropPosition,
      cropZoom,
      heroImage,
      ogImage
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Nama kategori wajib diisi',
        message: 'Nama kategori wajib diisi'
      });
    }

    const trimmedName = String(name).trim();
    const genSlug = slug ? String(slug).trim().toLowerCase() : generateSlug(trimmedName);

    // Check slug uniqueness
    const existingSlug = await prisma.category.findFirst({
      where: { slug: genSlug }
    });
    if (existingSlug) {
      return res.status(400).json({
        success: false,
        error: 'Slug kategori sudah digunakan! Slug harus unik.',
        message: 'Slug kategori sudah digunakan! Slug harus unik.'
      });
    }

    // Check name uniqueness
    const existingName = await prisma.category.findUnique({
      where: { name: trimmedName }
    });
    if (existingName) {
      return res.status(400).json({
        success: false,
        error: 'Nama kategori sudah digunakan! Nama harus unik.',
        message: 'Nama kategori sudah digunakan! Nama harus unik.'
      });
    }

    const newCategory = await prisma.category.create({
      data: {
        name: trimmedName,
        slug: genSlug,
        image: image ? String(image) : '',
        description: description ? String(description) : '',
        itemCount: itemCount !== undefined ? parseInt(itemCount, 10) || 0 : 0,
        status: status || 'Aktif',
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) || 0 : 0,
        badgeText: badgeText || metaTitle || '',
        badgeColor: badgeColor || 'Green',
        ctaLink: ctaLink || '',
        ctaText: ctaText || '',
        showOnHomepage: parseBoolean(showOnHomepage, true),
        banner: banner || '',
        cropPosition: cropPosition || 'center center',
        cropZoom: cropZoom ? String(cropZoom) : '100',
        heroImage: heroImage || '',
        ogImage: ogImage || ''
      }
    });

    clearHomeCache();
    return res.status(201).json(newCategory);
  } catch (error) {
    console.error('createCategory error:', error);
    if (error.code === 'P2002') {
      const target = error.meta?.target ? ` (${Array.isArray(error.meta.target) ? error.meta.target.join(', ') : error.meta.target})` : '';
      return res.status(400).json({
        success: false,
        error: `Nama atau slug kategori sudah digunakan${target}.`,
        message: error.message
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Gagal membuat kategori',
      message: error.message
    });
  }
}

export async function updateCategory(req, res) {
  try {
    // Support batch update if array is provided
    if (Array.isArray(req.body)) {
      const updates = req.body;
      const updatedCategories = [];
      for (const item of updates) {
        if (!item?.id) continue;
        const dataToUpdate = {};
        if (item.sortOrder !== undefined) dataToUpdate.sortOrder = parseInt(item.sortOrder, 10) || 0;
        if (item.status !== undefined) dataToUpdate.status = String(item.status);
        if (item.showOnHomepage !== undefined) dataToUpdate.showOnHomepage = parseBoolean(item.showOnHomepage, true);
        if (Object.keys(dataToUpdate).length > 0) {
          const u = await prisma.category.update({
            where: { id: item.id },
            data: dataToUpdate
          }).catch(err => {
            console.warn(`Failed to update category ${item.id} in batch:`, err.message);
            return null;
          });
          if (u) updatedCategories.push(u);
        }
      }
      clearHomeCache();
      return res.json({ success: true, count: updatedCategories.length, data: updatedCategories });
    }

    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID kategori diperlukan',
        message: 'ID kategori diperlukan'
      });
    }

    let existing = await prisma.category.findUnique({ where: { id } }).catch(() => null);
    if (!existing) {
      existing = await prisma.category.findFirst({
        where: {
          OR: [
            { slug: id },
            { name: id }
          ]
        }
      }).catch(() => null);
    }
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Kategori tidak ditemukan di database',
        message: `Kategori dengan ID "${id}" tidak ditemukan`
      });
    }
    const targetId = existing.id;

    const {
      name,
      slug,
      image,
      description,
      itemCount,
      status,
      sortOrder,
      badgeText,
      metaTitle,
      badgeColor,
      ctaLink,
      ctaText,
      showOnHomepage,
      banner,
      cropPosition,
      cropZoom,
      heroImage,
      ogImage
    } = req.body || {};

    const dataToUpdate = {};

    // Validate and update name
    if (name !== undefined && name !== null) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return res.status(400).json({
          success: false,
          error: 'Nama kategori tidak boleh kosong',
          message: 'Nama kategori tidak boleh kosong'
        });
      }
      if (trimmedName !== existing.name) {
        const dupName = await prisma.category.findUnique({ where: { name: trimmedName } });
        if (dupName && dupName.id !== targetId) {
          return res.status(400).json({
            success: false,
            error: 'Nama kategori sudah digunakan! Nama harus unik.',
            message: 'Nama kategori sudah digunakan! Nama harus unik.'
          });
        }
      }
      dataToUpdate.name = trimmedName;
    }

    // Validate and update slug
    if (slug !== undefined && slug !== null) {
      const trimmedSlug = String(slug).trim().toLowerCase();
      if (!trimmedSlug) {
        return res.status(400).json({
          success: false,
          error: 'Slug kategori tidak boleh kosong',
          message: 'Slug kategori tidak boleh kosong'
        });
      }
      if (trimmedSlug !== existing.slug) {
        const dupSlug = await prisma.category.findFirst({
          where: {
            slug: trimmedSlug,
            id: { not: targetId }
          }
        });
        if (dupSlug) {
          return res.status(400).json({
            success: false,
            error: 'Slug kategori sudah digunakan! Slug harus unik.',
            message: 'Slug kategori sudah digunakan! Slug harus unik.'
          });
        }
      }
      dataToUpdate.slug = trimmedSlug;
    } else if (name !== undefined && name !== null && !existing.slug) {
      dataToUpdate.slug = generateSlug(name);
    }

    if (image !== undefined && image !== null) dataToUpdate.image = String(image);
    if (description !== undefined && description !== null) dataToUpdate.description = String(description);
    if (itemCount !== undefined && itemCount !== null) dataToUpdate.itemCount = parseInt(itemCount, 10) || 0;
    if (status !== undefined && status !== null) dataToUpdate.status = String(status);
    if (sortOrder !== undefined && sortOrder !== null) dataToUpdate.sortOrder = parseInt(sortOrder, 10) || 0;

    // Badge text (support badgeText or metaTitle)
    if (badgeText !== undefined && badgeText !== null) {
      dataToUpdate.badgeText = String(badgeText);
    } else if (metaTitle !== undefined && metaTitle !== null) {
      dataToUpdate.badgeText = String(metaTitle);
    }

    if (badgeColor !== undefined && badgeColor !== null) dataToUpdate.badgeColor = String(badgeColor);
    if (ctaLink !== undefined && ctaLink !== null) dataToUpdate.ctaLink = String(ctaLink);
    if (ctaText !== undefined && ctaText !== null) dataToUpdate.ctaText = String(ctaText);

    if (showOnHomepage !== undefined && showOnHomepage !== null) {
      dataToUpdate.showOnHomepage = parseBoolean(showOnHomepage, true);
    }

    if (banner !== undefined && banner !== null) dataToUpdate.banner = String(banner);
    if (cropPosition !== undefined && cropPosition !== null) dataToUpdate.cropPosition = String(cropPosition);
    if (cropZoom !== undefined && cropZoom !== null) dataToUpdate.cropZoom = String(cropZoom);
    if (heroImage !== undefined && heroImage !== null) dataToUpdate.heroImage = String(heroImage);
    if (ogImage !== undefined && ogImage !== null) dataToUpdate.ogImage = String(ogImage);

    const updated = await prisma.category.update({
      where: { id: targetId },
      data: dataToUpdate
    });

    if (image !== undefined && existing?.image && existing.image !== image) {
      await handleMediaReplacement(existing.image, image, 'categories').catch(() => {});
    }
    if (heroImage !== undefined && existing?.heroImage && existing.heroImage !== heroImage) {
      await handleMediaReplacement(existing.heroImage, heroImage, 'categories').catch(() => {});
    }
    if (banner !== undefined && existing?.banner && existing.banner !== banner) {
      await handleMediaReplacement(existing.banner, banner, 'categories').catch(() => {});
    }
    if (ogImage !== undefined && existing?.ogImage && existing.ogImage !== ogImage) {
      await handleMediaReplacement(existing.ogImage, ogImage, 'categories').catch(() => {});
    }

    clearHomeCache();
    return res.json(updated);
  } catch (error) {
    console.error('updateCategory error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Kategori tidak ditemukan di database',
        message: error.message
      });
    }
    if (error.code === 'P2002') {
      const target = error.meta?.target ? ` (${Array.isArray(error.meta.target) ? error.meta.target.join(', ') : error.meta.target})` : '';
      return res.status(400).json({
        success: false,
        error: `Nama atau slug kategori sudah digunakan${target}.`,
        message: error.message
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Gagal memperbarui kategori',
      message: error.message || 'Terjadi kesalahan pada server saat memperbarui kategori'
    });
  }
}

export async function deleteCategory(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID kategori diperlukan',
        message: 'ID kategori diperlukan'
      });
    }

    let existing = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } }
      }
    }).catch(() => null);

    if (!existing) {
      existing = await prisma.category.findFirst({
        where: {
          OR: [
            { slug: id },
            { name: id }
          ]
        },
        include: {
          _count: { select: { products: true } }
        }
      }).catch(() => null);
    }

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Kategori tidak ditemukan',
        message: 'Kategori dengan ID tersebut tidak ditemukan'
      });
    }

    if (existing._count?.products > 0) {
      return res.status(400).json({
        success: false,
        error: `Kategori masih digunakan oleh ${existing._count.products} produk. Hapus atau pindahkan produk terlebih dahulu.`,
        message: `Kategori masih memiliki ${existing._count.products} produk terkait.`
      });
    }

    await prisma.category.delete({ where: { id: existing.id } });

    if (existing.image) await safeDeleteFileFromSupabase(existing.image, 'categories').catch(() => {});
    if (existing.heroImage) await safeDeleteFileFromSupabase(existing.heroImage, 'categories').catch(() => {});
    if (existing.banner) await safeDeleteFileFromSupabase(existing.banner, 'categories').catch(() => {});
    if (existing.ogImage) await safeDeleteFileFromSupabase(existing.ogImage, 'categories').catch(() => {});

    clearHomeCache();
    return res.json({ success: true, message: 'Kategori berhasil dihapus' });
  } catch (error) {
    console.error('deleteCategory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Gagal menghapus kategori',
      message: error.message
    });
  }
}

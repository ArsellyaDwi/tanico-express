import prisma from '../services/prisma.js';
import { getCacheItem, setCacheItem, clearHomeCache, clearAllCache } from '../services/cache.js';
import { safeDeleteFileFromSupabase, handleMediaReplacement } from '../services/mediaStorage.js';

export async function getProducts(req, res) {
  try {
    const cacheKey = `products_query_${JSON.stringify(req.query || {})}`;
    const cached = getCacheItem(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Total-Count', String(cached.total));
      if (req.query.paginated === 'true') {
        return res.json(cached.paginated);
      }
      return res.json(cached.formattedProducts);
    }

    const {
      search,
      q,
      category,
      categoryId,
      kategori,
      minPrice,
      maxPrice,
      isFeatured,
      isPopular,
      inStock,
      sortBy = 'terbaru',
      page = 1,
      limit = 50,
      all
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (all !== 'true') {
      where.status = { notIn: ['Nonaktif', 'nonaktif'] };
    }

    const andConditions = [];

    const rawSearch = String(search || q || '').trim();
    if (rawSearch) {
      andConditions.push({
        OR: [
          { name: { contains: rawSearch, mode: 'insensitive' } },
          { description: { contains: rawSearch, mode: 'insensitive' } },
          { categoryName: { contains: rawSearch, mode: 'insensitive' } }
        ]
      });
    }

    const rawCat = String(categoryId || category || kategori || '').trim();
    if (rawCat && rawCat.toLowerCase() !== 'all' && rawCat.toLowerCase() !== 'semua') {
      andConditions.push({
        OR: [
          { categoryId: rawCat },
          { category: { slug: { equals: rawCat, mode: 'insensitive' } } },
          { category: { name: { equals: rawCat, mode: 'insensitive' } } },
          { categoryName: { equals: rawCat, mode: 'insensitive' } }
        ]
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice) || 0;
      if (maxPrice) where.price.lte = parseFloat(maxPrice) || 999999999;
    }

    if (isFeatured === 'true' || isFeatured === true) {
      where.isFeatured = true;
    }

    if (isPopular === 'true' || isPopular === true) {
      where.isPopular = true;
    }

    if (inStock === 'true' || inStock === true) {
      where.stock = { gt: 0 };
    }

    let orderBy = { createdAt: 'desc' };
    switch (sortBy) {
      case 'termurah':
      case 'price_asc':
        orderBy = { price: 'asc' };
        break;
      case 'termahal':
      case 'price_desc':
        orderBy = { price: 'desc' };
        break;
      case 'terlaris':
      case 'popular':
        orderBy = { soldCount: 'desc' };
        break;
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'terbaru':
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, slug: true, image: true, status: true }
          }
        },
        orderBy,
        skip,
        take: limitNum
      }),
      prisma.product.count({ where })
    ]);

    const formattedProducts = (Array.isArray(products) ? products : []).filter(Boolean).map(p => {
      const catObj = p && typeof p.category === 'object' && p.category !== null ? p.category : null;
      const catName = p?.categoryName || catObj?.name || (typeof p?.category === 'string' ? p.category : 'Hasil Panen');
      return {
        ...p,
        categoryName: catName,
        category: catName,
        categoryObj: catObj
      };
    });

    res.setHeader('X-Total-Count', String(total));

    const responsePayload = {
      total,
      formattedProducts,
      paginated: {
        success: true,
        products: formattedProducts,
        data: formattedProducts,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    };
    setCacheItem(cacheKey, responsePayload, 45000);

    if (req.query.paginated === 'true') {
      return res.json(responsePayload.paginated);
    }

    return res.json(formattedProducts);
  } catch (error) {
    console.error('getProducts error:', error);
    return res.status(500).json({ error: 'Gagal memuat produk' });
  }
}

export async function getProductById(req, res) {
  try {
    const rawId = req.params.id || req.query.id;
    if (!rawId) {
      return res.status(400).json({ error: 'ID atau Slug produk wajib diberikan' });
    }

    const id = String(rawId).trim();
    const cacheKey = `product_detail_${id}`;
    const cached = getCacheItem(cacheKey);
    if (cached && !cached.error) {
      return res.json(cached);
    }

    const safeCategorySelect = {
      category: {
        select: { id: true, name: true, slug: true, image: true, status: true }
      }
    };

    const includeRelations = {
      ...safeCategorySelect,
      farmerLocation: true
    };

    // Helper to query with relations, falling back to category-only if farmerLocation fails
    async function safeFind(queryFn) {
      try {
        return await queryFn(includeRelations);
      } catch (err) {
        try {
          return await queryFn(safeCategorySelect);
        } catch (_) {
          return null;
        }
      }
    }

    let product = null;

    // 1. Primary Check: Direct lookup by ID if input format is UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) {
      product = await safeFind((include) =>
        prisma.product.findUnique({
          where: { id },
          include
        })
      );
    }

    // 2. Secondary Check: Lookup by slug or product name (or fallback if UUID not found in primary table)
    if (!product) {
      const formattedName = id.replace(/-/g, ' ').trim();
      const targetSlug = id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

      product = await safeFind((include) =>
        prisma.product.findFirst({
          where: {
            OR: [
              { name: { equals: formattedName, mode: 'insensitive' } },
              { name: { equals: id, mode: 'insensitive' } },
              { name: { contains: formattedName, mode: 'insensitive' } }
            ],
            status: { notIn: ['Nonaktif', 'nonaktif'] }
          },
          include
        })
      );

      // 3. Tertiary Check: Match against active products list by normalized slug
      if (!product) {
        const allActive = await safeFind((include) =>
          prisma.product.findMany({
            where: { status: { notIn: ['Nonaktif', 'nonaktif'] } },
            include
          })
        ) || [];

        product = (allActive || []).find((p) => {
          const pSlug = (p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
          const pNameLower = (p.name || '').toLowerCase();
          return (
            p.id === id ||
            pSlug === targetSlug ||
            pNameLower === formattedName.toLowerCase() ||
            pNameLower === id.toLowerCase()
          );
        }) || null;
      }
    }

    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }

    const catObj = typeof product.category === 'object' && product.category !== null ? product.category : null;
    const catName = product.categoryName || catObj?.name || (typeof product.category === 'string' ? product.category : 'Hasil Panen');

    const formattedProduct = {
      ...product,
      categoryName: catName,
      category: catName,
      categoryObj: catObj
    };

    setCacheItem(cacheKey, formattedProduct, 60 * 1000);
    return res.json(formattedProduct);
  } catch (error) {
    console.error('getProductById error:', error);
    return res.status(500).json({ error: 'Gagal memuat detail produk' });
  }
}

export async function createProduct(req, res) {
  try {
    const body = req.body || {};
    const {
      name,
      price,
      unit = 'kg',
      category: inputCategory,
      categoryId,
      categoryName,
      image,
      images,
      description,
      stock = 0,
      minOrder = 1,
      isFeatured = false,
      isPopular = false,
      status = 'Aktif'
    } = body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nama dan harga produk wajib diisi' });
    }

    let finalCategoryId = categoryId;
    let finalCategoryName = categoryName || (typeof inputCategory === 'string' ? inputCategory : 'Hasil Panen');

    if (!finalCategoryId && finalCategoryName) {
      const existingCat = await prisma.category.findFirst({
        where: { name: { equals: finalCategoryName, mode: 'insensitive' } }
      });
      if (existingCat) {
        finalCategoryId = existingCat.id;
      }
    }

    const newProduct = await prisma.product.create({
      data: {
        name: name.trim(),
        price: parseFloat(price) || 0,
        unit,
        categoryId: finalCategoryId || null,
        categoryName: finalCategoryName,
        image: image || '',
        images: Array.isArray(images) ? JSON.stringify(images) : (images || '[]'),
        description: description || '',
        stock: parseInt(stock, 10) || 0,
        minOrder: parseInt(minOrder, 10) || 1,
        isFeatured: Boolean(isFeatured),
        isPopular: Boolean(isPopular),
        status
      }
    });

    clearHomeCache();
    return res.status(201).json(newProduct);
  } catch (error) {
    console.error('createProduct error:', error);
    return res.status(500).json({ error: 'Gagal membuat produk' });
  }
}

export async function updateProduct(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID produk diperlukan' });

    const existing = await prisma.product.findUnique({
      where: { id },
      include: { images: true }
    });

    const body = req.body || {};
    const dataToUpdate = {};

    if (body.name !== undefined) dataToUpdate.name = body.name.trim();
    if (body.price !== undefined) dataToUpdate.price = parseFloat(body.price);
    if (body.unit !== undefined) dataToUpdate.unit = body.unit;
    if (body.image !== undefined) dataToUpdate.image = body.image;
    if (body.images !== undefined) {
      dataToUpdate.images = Array.isArray(body.images) ? JSON.stringify(body.images) : body.images;
    }
    if (body.description !== undefined) dataToUpdate.description = body.description;
    if (body.stock !== undefined) dataToUpdate.stock = parseInt(body.stock, 10);
    if (body.minOrder !== undefined) dataToUpdate.minOrder = parseInt(body.minOrder, 10);
    if (body.isFeatured !== undefined) dataToUpdate.isFeatured = Boolean(body.isFeatured);
    if (body.isPopular !== undefined) dataToUpdate.isPopular = Boolean(body.isPopular);
    if (body.status !== undefined) dataToUpdate.status = body.status;
    if (body.categoryName !== undefined) dataToUpdate.categoryName = body.categoryName;
    if (body.categoryId !== undefined) dataToUpdate.categoryId = body.categoryId;

    const updated = await prisma.product.update({
      where: { id },
      data: dataToUpdate
    });

    if (body.image !== undefined && existing?.image && existing.image !== body.image) {
      await handleMediaReplacement(existing.image, body.image, 'products').catch(() => {});
    }

    clearHomeCache();
    return res.json(updated);
  } catch (error) {
    console.error('updateProduct error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui produk' });
  }
}

export async function deleteProduct(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID produk diperlukan' });

    const prod = await prisma.product.findUnique({
      where: { id },
      include: { images: true }
    });

    await prisma.product.delete({ where: { id } });

    if (prod?.image) {
      await safeDeleteFileFromSupabase(prod.image, 'products').catch(() => {});
    }
    if (prod?.images && prod.images.length > 0) {
      for (const img of prod.images) {
        if (img.url) await safeDeleteFileFromSupabase(img.url, 'products').catch(() => {});
      }
    }

    clearHomeCache();
    clearAllCache();
    return res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    return res.status(500).json({ error: 'Gagal menghapus produk' });
  }
}

export async function importProducts(req, res) {
  try {
    const rawList = Array.isArray(req.body)
      ? req.body
      : (Array.isArray(req.body?.products) ? req.body.products : []);

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data produk yang diberikan untuk diimpor' });
    }

    // Fetch existing categories to map categoryId
    const allCategories = await prisma.category.findMany({
      select: { id: true, name: true, slug: true }
    }).catch(() => []);

    const categoryMap = new Map();
    for (const c of allCategories) {
      if (c.id) categoryMap.set(c.id.toLowerCase(), c);
      if (c.name) categoryMap.set(c.name.toLowerCase().trim(), c);
      if (c.slug) categoryMap.set(c.slug.toLowerCase().trim(), c);
    }

    let createdCount = 0;
    let updatedCount = 0;
    const processed = [];

    // Process all items in batch
    for (const item of rawList) {
      const name = String(item.name || item.Nama || item['Nama Produk'] || '').trim();
      if (!name || name.length < 2) continue;

      const rawId = item.id || item.ID || item['Id'] || '';
      const price = parseFloat(item.price ?? item.Harga ?? 0) || 0;
      const rawDisc = item.discountPrice ?? item['Harga Coret'] ?? item.diskon;
      const discountPrice = (rawDisc !== undefined && rawDisc !== null && rawDisc !== '')
        ? (parseFloat(rawDisc) || null)
        : null;
      const stock = parseInt(item.stock ?? item.Stok ?? 0, 10) || 0;
      const unit = String(item.unit || item.Satuan || 'kg').trim();
      const origin = String(item.origin || item.Asal || 'Pemali, Bangka').trim();
      const description = String(item.description || item.Deskripsi || '').trim();
      const status = String(item.status || item.Status || 'Aktif').trim();

      // Category matching
      const rawCat = String(item.category || item.categoryName || item.Kategori || '').trim();
      let matchedCatId = null;
      let matchedCatName = rawCat || 'Hasil Panen';
      if (rawCat) {
        const found = categoryMap.get(rawCat.toLowerCase());
        if (found) {
          matchedCatId = found.id;
          matchedCatName = found.name;
        }
      }

      // Featured flag handling
      const rawFeatured = item.isFeatured ?? item['Produk Unggulan'] ?? item.Unggulan ?? item.featured;
      let explicitFeatured = null;
      if (rawFeatured !== undefined && rawFeatured !== null && rawFeatured !== '') {
        const strF = String(rawFeatured).toLowerCase().trim();
        explicitFeatured = (strF === 'ya' || strF === 'true' || strF === '1' || rawFeatured === true);
      }

      // Look up existing product by ID or Name
      let existing = null;
      if (rawId) {
        existing = await prisma.product.findUnique({
          where: { id: String(rawId) }
        }).catch(() => null);
      }
      if (!existing) {
        existing = await prisma.product.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } }
        }).catch(() => null);
      }

      if (existing) {
        // UPDATE existing product
        const finalIsFeatured = explicitFeatured !== null ? explicitFeatured : existing.isFeatured;
        const updated = await prisma.product.update({
          where: { id: existing.id },
          data: {
            name,
            price,
            discountPrice,
            stock,
            unit: unit || existing.unit,
            origin: origin || existing.origin,
            description: (description !== undefined && description !== '') ? description : existing.description,
            status: status || existing.status,
            categoryId: matchedCatId || existing.categoryId,
            categoryName: matchedCatName || existing.categoryName,
            isFeatured: finalIsFeatured
          },
          include: { category: true }
        });
        updatedCount++;
        processed.push(updated);
      } else {
        // CREATE new product
        const newId = rawId ? String(rawId) : undefined;
        const finalIsFeatured = explicitFeatured !== null ? explicitFeatured : false;
        const created = await prisma.product.create({
          data: {
            ...(newId ? { id: newId } : {}),
            name,
            price,
            discountPrice,
            stock,
            unit: unit || 'kg',
            origin: origin || 'Pemali, Bangka',
            description: description || '',
            status: status || 'Aktif',
            categoryId: matchedCatId,
            categoryName: matchedCatName,
            isFeatured: finalIsFeatured,
            rating: 5.0,
            image: item.image || ''
          },
          include: { category: true }
        });
        createdCount++;
        processed.push(created);
      }
    }

    // Invalidate both backend & frontend caches
    clearAllCache();
    clearHomeCache();

    return res.json({
      success: true,
      message: `Berhasil memproses ${processed.length} produk (${updatedCount} diperbarui, ${createdCount} baru)`,
      totalProcessed: processed.length,
      updatedCount,
      createdCount,
      products: processed
    });
  } catch (error) {
    console.error('importProducts error:', error);
    return res.status(500).json({ error: 'Gagal mengimpor produk: ' + (error?.message || error) });
  }
}

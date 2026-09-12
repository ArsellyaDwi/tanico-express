import prisma from '../services/prisma.js';
import { getCacheItem, setCacheItem, clearHomeCache } from '../services/cache.js';
import { safeDeleteFileFromSupabase, handleMediaReplacement } from '../services/supabase.js';

export async function getProducts(req, res) {
  try {
    const {
      search,
      category,
      categoryId,
      minPrice,
      maxPrice,
      isFeatured,
      isPopular,
      inStock,
      sortBy = 'terbaru',
      page = 1,
      limit = 24,
      all
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (all !== 'true') {
      where.status = { notIn: ['Nonaktif', 'nonaktif'] };
    }

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
        { categoryName: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    const catParam = categoryId || category;
    if (catParam && catParam !== 'all' && catParam !== 'semua') {
      where.OR = [
        ...(where.OR || []),
        { categoryId: catParam },
        { category: { slug: catParam } },
        { category: { name: { equals: catParam, mode: 'insensitive' } } },
        { categoryName: { equals: catParam, mode: 'insensitive' } }
      ];
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

    const formattedProducts = (products || []).map(p => {
      const catObj = typeof p.category === 'object' && p.category !== null ? p.category : null;
      const catName = p.categoryName || catObj?.name || (typeof p.category === 'string' ? p.category : 'Hasil Panen');
      return {
        ...p,
        categoryName: catName,
        category: catName,
        categoryObj: catObj
      };
    });

    res.setHeader('X-Total-Count', String(total));

    if (req.query.paginated === 'true') {
      return res.json({
        success: true,
        products: formattedProducts,
        data: formattedProducts,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      });
    }

    return res.json(formattedProducts);
  } catch (error) {
    console.error('getProducts error:', error);
    return res.status(500).json({ error: 'Gagal memuat produk' });
  }
}

export async function getProductById(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'ID atau Slug produk wajib diberikan' });
    }

    const cacheKey = `product_detail_${id}`;
    const cached = getCacheItem(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const includeRelations = {
      category: {
        select: { id: true, name: true, slug: true, image: true, status: true }
      },
      farmerLocation: true
    };

    let product = await prisma.product.findUnique({
      where: { id },
      include: includeRelations
    }).catch(() => null);

    if (!product) {
      const formattedName = String(id).replace(/-/g, ' ');
      product = await prisma.product.findFirst({
        where: {
          OR: [
            { name: { equals: formattedName, mode: 'insensitive' } },
            { name: { contains: formattedName, mode: 'insensitive' } }
          ],
          status: { notIn: ['Nonaktif', 'nonaktif'] }
        },
        include: includeRelations
      }).catch(() => null);
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
    return res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    return res.status(500).json({ error: 'Gagal menghapus produk' });
  }
}

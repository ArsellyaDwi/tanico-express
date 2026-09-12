import bcrypt from 'bcryptjs';
import prisma from '../services/prisma.js';
import { createSessionToken, verifySessionToken } from '../services/tokenService.js';
import { extractToken } from '../middleware/auth.js';
import { uploadBufferToSupabase, uploadBase64ToSupabase, deleteFileFromSupabase, safeDeleteFileFromSupabase, handleMediaReplacement, isMediaUsedInDatabase, getReferencedUrlsInDatabase } from '../services/supabase.js';
import { clearAllCache } from '../services/cache.js';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from './categoriesController.js';

// ==================== AUTHENTICATION ====================

export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan kata sandi administrator wajib diisi.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { role: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Email atau kata sandi administrator salah.' });
    }

    const statusUpper = (user.status || 'AKTIF').toUpperCase();
    if (statusUpper === 'NONAKTIF' || statusUpper === 'NON-AKTIF' || statusUpper === 'DISABLED') {
      return res.status(403).json({ error: 'Akun administrator telah dinonaktifkan.' });
    }

    let isValid = false;
    if (user.password) {
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        isValid = await bcrypt.compare(password, user.password);
      } else {
        if (user.password === password) {
          isValid = true;
          const newHash = await bcrypt.hash(password, 10);
          await prisma.user.update({
            where: { id: user.id },
            data: { password: newHash }
          }).catch(() => {});
        }
      }
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Email atau kata sandi administrator salah.' });
    }

    const roleName = (user.role?.name || '').toUpperCase();
    if (roleName !== 'ADMIN' && roleName !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Akun tidak memiliki hak akses administrator.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    }).catch(() => {});

    const sessionData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: roleName
    };

    const token = await createSessionToken(sessionData);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('tanico_session', token, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      sessionToken: token,
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar || '',
      phone: user.phone || '',
      address: user.address || '',
      provider: user.provider || 'Email',
      status: user.status || 'Aktif',
      role: user.role
    });
  } catch (error) {
    console.error('adminLogin error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server saat login admin.' });
  }
}

export async function adminLogout(req, res) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('tanico_session', '', {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      expires: new Date(0)
    });
    return res.json({ success: true, message: 'Berhasil logout' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal logout' });
  }
}

export async function adminMe(req, res) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Tidak terautentikasi' });
    }

    const payload = await verifySessionToken(token);
    if (!payload?.id) {
      return res.status(401).json({ error: 'Sesi kedaluwarsa' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Admin tidak ditemukan' });
    }

    const roleName = (user.role?.name || '').toUpperCase();
    if (roleName !== 'ADMIN' && roleName !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Bukan administrator' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar || '',
      role: user.role,
      status: user.status
    });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memverifikasi sesi admin' });
  }
}

export async function getAdminProfile(req, res) {
  return adminMe(req, res);
}

export async function updateAdminProfile(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Tidak terautentikasi' });

    const { name, email, avatar, phone, password } = req.body || {};
    const dataToUpdate = {};
    if (name) dataToUpdate.name = name.trim();
    if (email) dataToUpdate.email = email.trim().toLowerCase();
    if (avatar !== undefined) dataToUpdate.avatar = avatar;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (password && password.length >= 6) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      include: { role: true }
    });

    if (avatar !== undefined && existing?.avatar && existing.avatar !== avatar) {
      await handleMediaReplacement(existing.avatar, avatar, 'tanico-public').catch(() => {});
    }

    // Keep AdminProfile in sync if exists
    await prisma.adminProfile.updateMany({
      data: {
        ...(name && { name: name.trim() }),
        ...(email && { email: email.trim().toLowerCase() }),
        ...(avatar !== undefined && { avatar })
      }
    }).catch(() => {});

    return res.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        avatar: updated.avatar || '',
        phone: updated.phone || '',
        role: updated.role
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memperbarui profil admin' });
  }
}

// ==================== DASHBOARD & ANALYTICS ====================

export async function getAdminDashboard(req, res) {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalProducts,
      totalCategories,
      totalOrdersCount,
      totalCustomers,
      orderRevenueAgg,
      completedRevenueAgg,
      recent7DaysOrders,
      orderStatusGroup,
      lowStockProducts,
      recentReviews,
      recentOrders,
      activityLogs
    ] = await Promise.all([
      prisma.product.count().catch(() => 0),
      prisma.category.count().catch(() => 0),
      prisma.order.count().catch(() => 0),
      prisma.user.count().catch(() => 0),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: { not: 'Dibatalkan' } }
      }).catch(() => ({ _sum: { totalAmount: 0 } })),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: 'Selesai' }
      }).catch(() => ({ _sum: { totalAmount: 0 } })),
      prisma.order.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          status: { not: 'Dibatalkan' }
        },
        select: { createdAt: true, totalAmount: true }
      }).catch(() => []),
      prisma.order.groupBy({
        by: ['status'],
        _count: { status: true }
      }).catch(() => []),
      prisma.product.findMany({
        where: { stock: { lte: 10 } },
        orderBy: { stock: 'asc' },
        take: 8
      }).catch(() => []),
      prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      }).catch(() => []),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: { items: true }
      }).catch(() => []),
      prisma.activityLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 10
      }).catch(() => [])
    ]);

    const totalRevenue = Number(orderRevenueAgg?._sum?.totalAmount || 0);
    const completedRevenue = Number(completedRevenueAgg?._sum?.totalAmount || 0);
    const averageOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

    // Build 7 days trend
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const trendMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().split('T')[0];
      const label = `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
      trendMap[key] = { label, total: 0, count: 0 };
    }

    recent7DaysOrders.forEach(ord => {
      const dateKey = new Date(ord.createdAt).toISOString().split('T')[0];
      if (trendMap[dateKey]) {
        trendMap[dateKey].total += Number(ord.totalAmount || 0);
        trendMap[dateKey].count += 1;
      }
    });

    const salesTrendData = Object.values(trendMap).map(t => ({
      name: t.label,
      total: t.total,
      pesanan: t.count
    }));

    const orderStatusData = (orderStatusGroup || []).map(g => ({
      name: g.status,
      count: g._count?.status || 0
    }));

    return res.json({
      totalRevenue,
      completedRevenue,
      totalOrdersCount,
      averageOrderValue,
      totalProductsSold: 0,
      totalCategories,
      totalProducts,
      totalCustomers,
      salesTrendData,
      categoryChartData: [],
      orderStatusData,
      bestSellers: [],
      lowStockProducts,
      recentReviews,
      recentOrders,
      logs: activityLogs
    });
  } catch (error) {
    console.error('getAdminDashboard error:', error);
    return res.status(500).json({ error: 'Gagal memuat data dashboard' });
  }
}

export async function getAdminAnalytics(req, res) {
  return getAdminDashboard(req, res);
}

// ==================== PRODUCTS CRUD ====================

export async function listAdminProducts(req, res) {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: {
          select: { id: true, name: true, slug: true, image: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = products.map(p => {
      const catObj = typeof p.category === 'object' && p.category !== null ? p.category : null;
      const catName = p.categoryName || catObj?.name || (typeof p.category === 'string' ? p.category : 'Hasil Panen');
      return {
        ...p,
        categoryName: catName,
        category: catName,
        categoryObj: catObj
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error('listAdminProducts error:', error);
    return res.status(500).json({ error: 'Gagal memuat produk' });
  }
}

export async function createAdminProduct(req, res) {
  try {
    const body = req.body || {};
    const {
      name,
      price,
      unit = 'kg',
      stock = 0,
      image = '',
      description = '',
      categoryId,
      categoryName,
      status = 'Aktif',
      isFeatured = false,
      isPopular = false,
      discountPrice
    } = body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nama dan harga produk wajib diisi' });
    }

    const cleanSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = `PROD-${Date.now()}`;

    const newProduct = await prisma.product.create({
      data: {
        id,
        name: name.trim(),
        price: parseFloat(price) || 0,
        unit,
        stock: parseInt(stock, 10) || 0,
        image,
        description,
        categoryId: categoryId || null,
        categoryName: categoryName || 'Hasil Panen',
        status,
        isFeatured: Boolean(isFeatured),
        isPopular: Boolean(isPopular),
        discountPrice: discountPrice ? parseFloat(discountPrice) : null
      },
      include: { category: true }
    });

    clearAllCache();
    return res.status(201).json(newProduct);
  } catch (error) {
    console.error('createAdminProduct error:', error);
    return res.status(500).json({ error: 'Gagal membuat produk' });
  }
}

export async function updateAdminProduct(req, res) {
  try {
    const id = req.params.id || req.body?.id;
    if (!id) {
      return res.status(400).json({ error: 'ID produk diperlukan' });
    }

    const {
      name,
      price,
      unit,
      stock,
      image,
      description,
      categoryId,
      categoryName,
      status,
      isFeatured,
      isPopular,
      discountPrice
    } = req.body || {};

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (price !== undefined) dataToUpdate.price = parseFloat(price);
    if (unit !== undefined) dataToUpdate.unit = unit;
    if (stock !== undefined) dataToUpdate.stock = parseInt(stock, 10);
    if (image !== undefined) dataToUpdate.image = image;
    if (description !== undefined) dataToUpdate.description = description;
    if (categoryId !== undefined) dataToUpdate.categoryId = categoryId;
    if (categoryName !== undefined) dataToUpdate.categoryName = categoryName;
    if (status !== undefined) dataToUpdate.status = status;
    if (isFeatured !== undefined) dataToUpdate.isFeatured = Boolean(isFeatured);
    if (isPopular !== undefined) dataToUpdate.isPopular = Boolean(isPopular);
    if (discountPrice !== undefined) dataToUpdate.discountPrice = discountPrice ? parseFloat(discountPrice) : null;

    const existing = await prisma.product.findUnique({ where: { id } });

    const updated = await prisma.product.update({
      where: { id },
      data: dataToUpdate,
      include: { category: true }
    });

    if (image !== undefined && existing?.image && existing.image !== image) {
      await handleMediaReplacement(existing.image, image, 'products').catch(() => {});
    }

    clearAllCache();
    return res.json(updated);
  } catch (error) {
    console.error('updateAdminProduct error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui produk' });
  }
}

export async function deleteAdminProduct(req, res) {
  try {
    const { id } = req.params;
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

    clearAllCache();
    return res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error('deleteAdminProduct error:', error);
    return res.status(500).json({ error: 'Gagal menghapus produk' });
  }
}

// ==================== CATEGORIES CRUD ====================

export async function listAdminCategories(req, res) {
  // Pass all=true by default for admin list
  if (req.query.all === undefined) {
    req.query.all = 'true';
  }
  return getCategories(req, res);
}

export async function createAdminCategory(req, res) {
  return createCategory(req, res);
}

export async function updateAdminCategory(req, res) {
  return updateCategory(req, res);
}

export async function deleteAdminCategory(req, res) {
  return deleteCategory(req, res);
}

// ==================== STOCK MANAGEMENT ====================

export async function listAdminStock(req, res) {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        unit: true,
        image: true,
        status: true,
        categoryName: true
      },
      orderBy: { stock: 'asc' }
    });
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat stok' });
  }
}

export async function updateAdminStock(req, res) {
  try {
    const id = req.params.id || req.body?.id;
    const { stock, price } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID produk diperlukan' });

    const dataToUpdate = {};
    if (stock !== undefined) dataToUpdate.stock = parseInt(stock, 10);
    if (price !== undefined) dataToUpdate.price = parseFloat(price);

    const updated = await prisma.product.update({
      where: { id },
      data: dataToUpdate
    });

    clearAllCache();
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memperbarui stok produk' });
  }
}

// ==================== ORDERS MANAGEMENT ====================

export async function listAdminOrders(req, res) {
  try {
    const orders = await prisma.order.findMany({
      include: { items: true, user: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat pesanan' });
  }
}

export async function updateAdminOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!id || !status) return res.status(400).json({ error: 'ID dan status diperlukan' });

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true }
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memperbarui status pesanan' });
  }
}

export async function deleteAdminOrder(req, res) {
  try {
    const { id } = req.params;
    await prisma.orderItem.deleteMany({ where: { orderId: id } }).catch(() => {});
    await prisma.order.delete({ where: { id } });
    return res.json({ success: true, message: 'Pesanan berhasil dihapus' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menghapus pesanan' });
  }
}

// ==================== CUSTOMERS MANAGEMENT ====================

export async function listAdminCustomers(req, res) {
  try {
    const customers = await prisma.user.findMany({
      include: {
        role: true,
        _count: { select: { orders: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(customers);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat pelanggan' });
  }
}

export async function updateAdminCustomer(req, res) {
  try {
    const { id } = req.params;
    const { status, roleId } = req.body || {};
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(roleId && { roleId })
      },
      include: { role: true }
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memperbarui pelanggan' });
  }
}

export async function deleteAdminCustomer(req, res) {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    await prisma.user.delete({ where: { id } });

    if (user?.avatar) {
      await safeDeleteFileFromSupabase(user.avatar, 'tanico-public').catch(() => {});
    }

    return res.json({ success: true, message: 'Pelanggan berhasil dihapus' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menghapus pelanggan' });
  }
}

// ==================== REVIEWS MANAGEMENT ====================

export async function listAdminReviews(req, res) {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(reviews);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat ulasan' });
  }
}

export async function updateAdminReview(req, res) {
  try {
    if (Array.isArray(req.body)) {
      const results = [];
      for (const item of req.body) {
        if (item && item.id) {
          const dataToUpdate = {};
          if (item.status !== undefined) dataToUpdate.status = item.status;
          if (item.reply !== undefined) dataToUpdate.reply = item.reply;
          if (item.adminReply !== undefined) dataToUpdate.adminReply = item.adminReply;
          const up = await prisma.review.update({
            where: { id: item.id },
            data: dataToUpdate
          }).catch(() => null);
          if (up) results.push(up);
        }
      }
      return res.json({ success: true, updated: results });
    }

    const id = req.params.id || req.body?.id;
    const { status, reply, adminReply } = req.body || {};
    const dataToUpdate = {};
    if (status !== undefined) dataToUpdate.status = status;
    if (reply !== undefined) dataToUpdate.reply = reply;
    if (adminReply !== undefined) dataToUpdate.adminReply = adminReply;

    const updated = await prisma.review.update({
      where: { id },
      data: dataToUpdate
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memperbarui status ulasan' });
  }
}

export async function deleteAdminReview(req, res) {
  try {
    const { id } = req.params;
    await prisma.review.delete({ where: { id } });
    return res.json({ success: true, message: 'Ulasan berhasil dihapus' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menghapus ulasan' });
  }
}

// ==================== ARTICLES CRUD ====================

export async function listAdminArticles(req, res) {
  try {
    const articles = await prisma.article.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(articles);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat artikel' });
  }
}

export async function createAdminArticle(req, res) {
  try {
    const { title, excerpt, content, image = '', category = 'Tips', status = 'Published', author = 'Tim TaniCo' } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Judul artikel diperlukan' });

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const newArticle = await prisma.article.create({
      data: {
        title: title.trim(),
        slug,
        excerpt: excerpt || '',
        content: content || '',
        image,
        category,
        status,
        author
      }
    });

    clearAllCache();
    return res.status(201).json(newArticle);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal membuat artikel' });
  }
}

export async function updateAdminArticle(req, res) {
  try {
    const id = req.params.id || req.body?.id;
    const existing = await prisma.article.findUnique({ where: { id } });

    const { title, excerpt, content, image, category, status, author } = req.body || {};
    const dataToUpdate = {};
    if (title !== undefined) {
      dataToUpdate.title = title;
      dataToUpdate.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (excerpt !== undefined) dataToUpdate.excerpt = excerpt;
    if (content !== undefined) dataToUpdate.content = content;
    if (image !== undefined) dataToUpdate.image = image;
    if (category !== undefined) dataToUpdate.category = category;
    if (status !== undefined) dataToUpdate.status = status;
    if (author !== undefined) dataToUpdate.author = author;

    const updated = await prisma.article.update({
      where: { id },
      data: dataToUpdate
    });

    if (image !== undefined && existing?.image && existing.image !== image) {
      await handleMediaReplacement(existing.image, image, 'articles').catch(() => {});
    }

    clearAllCache();
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memperbarui artikel' });
  }
}

export async function deleteAdminArticle(req, res) {
  try {
    const { id } = req.params;
    const article = await prisma.article.findUnique({ where: { id } });
    await prisma.article.delete({ where: { id } });

    if (article?.image) {
      await safeDeleteFileFromSupabase(article.image, 'articles').catch(() => {});
    }

    clearAllCache();
    return res.json({ success: true, message: 'Artikel berhasil dihapus' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menghapus artikel' });
  }
}

// ==================== GALLERY CRUD ====================

export async function listAdminGallery(req, res) {
  try {
    const gallery = await prisma.gallery.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    return res.json(gallery);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat galeri' });
  }
}

export async function createAdminGallery(req, res) {
  try {
    const { title, image, span = 'col-span-1', active = true, sortOrder = 0 } = req.body || {};
    if (!image) return res.status(400).json({ error: 'Gambar galeri diperlukan' });

    const newGallery = await prisma.gallery.create({
      data: {
        title: title || 'Kebun TaniCo',
        image,
        span,
        active: Boolean(active),
        sortOrder: parseInt(sortOrder, 10) || 0
      }
    });

    clearAllCache();
    return res.status(201).json(newGallery);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menambahkan galeri' });
  }
}

export async function updateAdminGallery(req, res) {
  try {
    const id = req.params.id || req.body?.id;
    const existing = await prisma.gallery.findUnique({ where: { id } });

    const { title, image, span, active, sortOrder } = req.body || {};
    const dataToUpdate = {};
    if (title !== undefined) dataToUpdate.title = title;
    if (image !== undefined) dataToUpdate.image = image;
    if (span !== undefined) dataToUpdate.span = span;
    if (active !== undefined) dataToUpdate.active = Boolean(active);
    if (sortOrder !== undefined) dataToUpdate.sortOrder = parseInt(sortOrder, 10);

    const updated = await prisma.gallery.update({
      where: { id },
      data: dataToUpdate
    });

    if (image !== undefined && existing?.image && existing.image !== image) {
      await handleMediaReplacement(existing.image, image, 'gallery').catch(() => {});
    }

    clearAllCache();
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memperbarui galeri' });
  }
}

export async function deleteAdminGallery(req, res) {
  try {
    const { id } = req.params;
    const gal = await prisma.gallery.findUnique({ where: { id } });
    await prisma.gallery.delete({ where: { id } });

    if (gal?.image) {
      await safeDeleteFileFromSupabase(gal.image, 'gallery').catch(() => {});
    }

    clearAllCache();
    return res.json({ success: true, message: 'Galeri berhasil dihapus' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menghapus galeri' });
  }
}

// ==================== TESTIMONIALS CRUD ====================

export async function listAdminTestimonials(req, res) {
  try {
    const testimonials = await prisma.testimonial.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    return res.json(testimonials);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat testimoni' });
  }
}

export async function createAdminTestimonial(req, res) {
  try {
    const list = Array.isArray(req.body?.list) ? req.body.list : (Array.isArray(req.body) ? req.body : null);
    if (list) {
      const results = [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const name = (item.name || `Pelanggan ${i + 1}`).trim();
        const comment = (item.comment || item.text || item.review || item.content || '').trim();
        const role = (item.role || 'Pelanggan Setia').trim();
        const avatar = (item.avatar || item.image || '').trim();
        const location = (item.location || '').trim();
        const rating = Number(item.rating) || 5;
        const active = item.active !== false;
        const sortOrder = item.sortOrder !== undefined ? parseInt(item.sortOrder, 10) : i;

        if (item.id) {
          const updated = await prisma.testimonial.upsert({
            where: { id: item.id },
            update: { name, role, comment, avatar, location, rating, active, sortOrder },
            create: { id: item.id, name, role, comment, avatar, location, rating, active, sortOrder }
          }).catch(() => null);
          if (updated) results.push(updated);
        } else if (name && comment) {
          const created = await prisma.testimonial.create({
            data: { name, role, comment, avatar, location, rating, active, sortOrder }
          }).catch(() => null);
          if (created) results.push(created);
        }
      }
      clearAllCache();
      const updatedList = await prisma.testimonial.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
      });
      return res.json(updatedList);
    }

    const { name, role = 'Pelanggan Setia', text, comment, image = '', avatar = '', location = '', rating = 5, active = true, sortOrder = 0 } = req.body || {};
    const finalComment = (comment || text || '').trim();
    const finalAvatar = (avatar || image || '').trim();
    if (!name?.trim() || !finalComment) return res.status(400).json({ error: 'Nama dan ulasan testimoni diperlukan' });

    const newTestimonial = await prisma.testimonial.create({
      data: {
        name: name.trim(),
        role: role.trim(),
        comment: finalComment,
        avatar: finalAvatar,
        location: (location || '').trim(),
        rating: Number(rating) || 5,
        active: Boolean(active),
        sortOrder: parseInt(sortOrder, 10) || 0
      }
    });

    clearAllCache();
    return res.status(201).json(newTestimonial);
  } catch (error) {
    console.error('createAdminTestimonial error:', error);
    return res.status(500).json({ error: 'Gagal membuat testimoni' });
  }
}

export async function updateAdminTestimonial(req, res) {
  try {
    const id = req.params.id || req.body?.id;
    const existing = await prisma.testimonial.findUnique({ where: { id } });

    const { name, role, text, comment, image, avatar, location, rating, active, sortOrder } = req.body || {};
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (role !== undefined) dataToUpdate.role = role.trim();
    if (comment !== undefined || text !== undefined) dataToUpdate.comment = (comment !== undefined ? comment : text).trim();
    if (avatar !== undefined || image !== undefined) dataToUpdate.avatar = (avatar !== undefined ? avatar : image).trim();
    if (location !== undefined) dataToUpdate.location = (location || '').trim();
    if (rating !== undefined) dataToUpdate.rating = Number(rating) || 5;
    if (active !== undefined) dataToUpdate.active = Boolean(active);
    if (sortOrder !== undefined) dataToUpdate.sortOrder = parseInt(sortOrder, 10);

    const updated = await prisma.testimonial.update({
      where: { id },
      data: dataToUpdate
    });

    const newAvatar = avatar !== undefined ? avatar : image;
    if (newAvatar !== undefined && existing?.avatar && existing.avatar !== newAvatar) {
      await handleMediaReplacement(existing.avatar, newAvatar, 'testimonials').catch(() => {});
    }

    clearAllCache();
    return res.json(updated);
  } catch (error) {
    console.error('updateAdminTestimonial error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui testimoni' });
  }
}

export async function deleteAdminTestimonial(req, res) {
  try {
    const { id } = req.params;
    const testi = await prisma.testimonial.findUnique({ where: { id } });
    await prisma.testimonial.delete({ where: { id } });

    if (testi?.avatar) {
      await safeDeleteFileFromSupabase(testi.avatar, 'testimonials').catch(() => {});
    }

    clearAllCache();
    return res.json({ success: true, message: 'Testimoni berhasil dihapus' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menghapus testimoni' });
  }
}

// ==================== CONTACTS MANAGEMENT ====================

export async function listAdminContacts(req, res) {
  try {
    const contacts = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(contacts);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat pesan kontak' });
  }
}

export async function updateAdminContact(req, res) {
  try {
    if (Array.isArray(req.body)) {
      const results = [];
      for (const item of req.body) {
        if (item && item.id) {
          const dataToUpdate = {};
          if (item.isRead !== undefined) dataToUpdate.isRead = item.isRead;
          if (item.reply !== undefined) dataToUpdate.reply = item.reply;
          const up = await prisma.contactMessage.update({
            where: { id: item.id },
            data: dataToUpdate
          }).catch(() => null);
          if (up) results.push(up);
        }
      }
      return res.json({ success: true, updated: results });
    }

    const id = req.params.id || req.body?.id;
    const { isRead, reply } = req.body || {};
    const updated = await prisma.contactMessage.update({
      where: { id },
      data: {
        ...(isRead !== undefined && { isRead }),
        ...(reply !== undefined && { reply })
      }
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memperbarui status kontak' });
  }
}

export async function deleteAdminContact(req, res) {
  try {
    const { id } = req.params;
    await prisma.contactMessage.delete({ where: { id } });
    return res.json({ success: true, message: 'Pesan kontak berhasil dihapus' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menghapus pesan kontak' });
  }
}

// ==================== CART & WISHLIST ADMIN ====================

export async function listAdminCarts(req, res) {
  try {
    const carts = await prisma.cart.findMany({
      include: {
        user: true,
        items: { include: { product: true } }
      }
    });
    return res.json(carts);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat daftar keranjang' });
  }
}

export async function deleteAdminCart(req, res) {
  try {
    const { id } = req.params;
    await prisma.cartItem.deleteMany({ where: { cartId: id } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal mengosongkan keranjang' });
  }
}

export async function listAdminWishlists(req, res) {
  try {
    const wishlists = await prisma.wishlist.findMany({
      include: {
        user: true,
        items: { include: { product: true } }
      }
    });
    return res.json(wishlists);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat daftar wishlist' });
  }
}

export async function deleteAdminWishlist(req, res) {
  try {
    const { id } = req.params;
    await prisma.wishlistItem.deleteMany({ where: { wishlistId: id } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal mengosongkan wishlist' });
  }
}

// ==================== SETTINGS CRUD ====================

export async function getAdminSettings(req, res) {
  try {
    let setting = await prisma.websiteSetting.findFirst();
    if (!setting) {
      setting = await prisma.websiteSetting.create({
        data: {
          id: 'default',
          logoText: 'TaniCo',
          tagline: 'Murni Organik',
          websiteName: 'TaniCo — Sayur Segar Organik',
          address: 'Jl. Raya Pemali No. 45, Bangka',
          googleMapsUrl: 'https://maps.google.com',
          whatsappNumber: '+628127300400',
          instagramUrl: 'https://instagram.com/tanico.bangka',
          facebookUrl: 'https://facebook.com/TaniCoBangka',
          emailAddress: 'halo@tanico.id',
          operationalHours: 'Setiap Hari: 07.00 - 17.00 WIB',
          footerText: '© 2026 TaniCo. Hak Cipta Dilindungi.',
          seoKeywords: 'sayur organik, sayur segar bangka, tanico, sayur sehat',
          homepageCMS: '{}',
          contactsCMS: '{}'
        }
      });
    }
    return res.json(setting);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat pengaturan' });
  }
}

export async function updateAdminSettings(req, res) {
  try {
    const body = req.body || {};
    let setting = await prisma.websiteSetting.findFirst();

    if (!setting) {
      setting = await prisma.websiteSetting.create({
        data: {
          id: 'default',
          ...body
        }
      });
    } else {
      setting = await prisma.websiteSetting.update({
        where: { id: setting.id },
        data: {
          ...body,
          ...(body.homepageCMS && typeof body.homepageCMS === 'object' && {
            homepageCMS: JSON.stringify(body.homepageCMS)
          })
        }
      });
    }

    clearAllCache();
    return res.json(setting);
  } catch (error) {
    console.error('updateAdminSettings error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui pengaturan' });
  }
}

// ==================== FILE UPLOAD ====================

export async function uploadFile(req, res) {
  try {
    if (req.file) {
      const bucket = req.body.bucket || req.body.folder || 'tanico-public';
      const customFilename = req.body.filename || req.file.originalname || 'upload.jpg';

      const result = await uploadBufferToSupabase(
        req.file.buffer,
        req.file.mimetype,
        customFilename,
        bucket
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Gagal mengunggah gambar ke Supabase Storage'
        });
      }

      return res.json({
        success: true,
        url: result.url || result.publicUrl,
        publicUrl: result.url || result.publicUrl,
        path: result.path,
        bucket: result.bucket
      });
    }

    // Base64 upload fallback
    const { base64, filename, bucket } = req.body || {};
    if (!base64) {
      return res.status(400).json({
        success: false,
        error: 'File gambar tidak ditemukan'
      });
    }

    const result = await uploadBase64ToSupabase(base64, filename || 'image.jpg', bucket || 'tanico-public');
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Gagal mengunggah gambar ke Supabase Storage'
      });
    }

    return res.json({
      success: true,
      url: result.url || result.publicUrl,
      publicUrl: result.url || result.publicUrl,
      path: result.path,
      bucket: result.bucket
    });
  } catch (error) {
    console.error('uploadFile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Gagal mengunggah gambar ke Supabase Storage'
    });
  }
}

// ==================== MEDIA VERIFICATION & CLEANUP ====================

export async function checkMediaInUse(req, res) {
  try {
    const { urls, url, bucket } = req.body || {};
    if (urls && Array.isArray(urls)) {
      const referencedSet = await getReferencedUrlsInDatabase(urls);
      return res.json({
        success: true,
        referencedUrls: Array.from(referencedSet)
      });
    }
    if (url) {
      const inUse = await isMediaUsedInDatabase(url, bucket);
      return res.json({
        success: true,
        inUse
      });
    }
    return res.status(400).json({ error: 'URL atau array URLs diperlukan' });
  } catch (error) {
    console.error('checkMediaInUse error:', error);
    return res.status(500).json({ error: 'Gagal memeriksa penggunaan media' });
  }
}

export async function cleanupMedia(req, res) {
  try {
    const { url, urls, bucket } = req.body || {};
    if (urls && Array.isArray(urls)) {
      const results = [];
      for (const u of urls) {
        const r = await safeDeleteFileFromSupabase(u, bucket);
        results.push({ url: u, ...r });
      }
      return res.json({ success: true, results });
    }
    if (url) {
      const result = await safeDeleteFileFromSupabase(url, bucket);
      return res.json({ success: true, ...result });
    }
    return res.status(400).json({ error: 'URL diperlukan' });
  } catch (error) {
    console.error('cleanupMedia error:', error);
    return res.status(500).json({ error: 'Gagal membersihkan media' });
  }
}

export async function replaceMedia(req, res) {
  try {
    const { oldUrl, newUrl, bucket } = req.body || {};
    if (!oldUrl) return res.status(400).json({ error: 'oldUrl diperlukan' });
    const result = await handleMediaReplacement(oldUrl, newUrl, bucket);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('replaceMedia error:', error);
    return res.status(500).json({ error: 'Gagal mengganti media' });
  }
}

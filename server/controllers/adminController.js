import bcrypt from 'bcryptjs';
import prisma from '../services/prisma.js';
import { createSessionToken, verifySessionToken } from '../services/tokenService.js';
import { extractToken } from '../middleware/auth.js';
import { uploadBufferToSupabase, uploadBase64ToSupabase, deleteFileFromSupabase, safeDeleteFileFromSupabase, handleMediaReplacement, isMediaUsedInDatabase, getReferencedUrlsInDatabase } from '../services/mediaStorage.js';
import { getCacheItem, setCacheItem, clearCacheItem, clearCacheByPrefix, clearAllCache } from '../services/cache.js';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from './categoriesController.js';
import { importProducts } from './productsController.js';
import { recordStockMutation, STOCK_MUTATION_SOURCES, parseStockHistoryRecord } from '../services/stockService.js';
import { updateOrderStatusAtomic, deleteOrderAtomic, runWithTransactionRetry } from '../services/orderService.js';

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
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    };
    res.cookie('tanico_admin_session', token, cookieOptions);
    // Also set tanico_session for unified backwards compatibility
    res.cookie('tanico_session', token, cookieOptions);

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
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      expires: new Date(0),
      maxAge: 0
    };
    res.cookie('tanico_session', '', cookieOptions);
    res.cookie('tanico_admin_session', '', cookieOptions);
    return res.json({ success: true, message: 'Berhasil keluar dari sesi admin.' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal logout admin.' });
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

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar || '',
      role: user.role,
      status: user.status
    };

    return res.json({
      success: true,
      user: userData,
      ...userData
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
    const cacheKey = 'admin_dashboard_summary';
    const cached = getCacheItem(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const now = new Date();
    // Today's boundaries (00:00:00 to 23:59:59.999)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 7 days ago boundary
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      pendingOrdersCount,
      processingOrdersCount,
      readyToShipCount,
      todayOrders,
      outOfStockCount,
      lowStockCount,
      lowStockProducts,
      recentOrders,
      recent7DaysOrders,
      recentReviews,
      activityLogs,
      nonCancelledOrderItems
    ] = await Promise.all([
      // 1. Menunggu konfirmasi
      prisma.order.count({ where: { status: 'Menunggu' } }).catch(() => 0),
      // 2. Sedang diproses
      prisma.order.count({ where: { status: 'Diproses' } }).catch(() => 0),
      // 3. Perlu dikirim / Siap pickup (status Dikirim atau fulfillment ready)
      prisma.order.count({ where: { status: 'Dikirim' } }).catch(() => 0),
      // 4. Pesanan hari ini
      prisma.order.findMany({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
        select: { id: true, totalAmount: true, status: true, fulfillmentMethod: true }
      }).catch(() => []),
      // 5. Stok habis (stock <= 0)
      prisma.product.count({ where: { stock: { lte: 0 } } }).catch(() => 0),
      // 6. Stok menipis (0 < stock <= 10)
      prisma.product.count({ where: { stock: { gt: 0, lte: 10 } } }).catch(() => 0),
      // 7. Daftar produk stok menipis / habis (maks 8 produk)
      prisma.product.findMany({
        where: { stock: { lte: 10 } },
        orderBy: { stock: 'asc' },
        take: 8,
        select: {
          id: true,
          name: true,
          image: true,
          unit: true,
          stock: true,
          categoryName: true,
          category: { select: { name: true } }
        }
      }).catch(() => []),
      // 8. Pesanan terbaru (maksimal 5 data)
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          customerName: true,
          customerEmail: true,
          phone: true,
          totalAmount: true,
          status: true,
          fulfillmentMethod: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
              unit: true,
              price: true
            }
          }
        }
      }).catch(() => []),
      // 9. Pesanan 7 hari terakhir untuk grafik ringkas
      prisma.order.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          status: { not: 'Dibatalkan' }
        },
        select: { createdAt: true, totalAmount: true }
      }).catch(() => []),
      // 10. Ulasan terbaru (2-3 data)
      prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          customerName: true,
          rating: true,
          comment: true,
          createdAt: true,
          productName: true
        }
      }).catch(() => []),
      // 11. Log aktivitas tim terbaru
      prisma.activityLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 8
      }).catch(() => []),
      // 12. Order items untuk hitung top 3-4 produk terlaris
      prisma.orderItem.findMany({
        where: {
          order: { status: { not: 'Dibatalkan' } }
        },
        select: {
          productId: true,
          name: true,
          quantity: true,
          price: true,
          image: true,
          unit: true,
          product: {
            select: {
              id: true,
              name: true,
              image: true,
              unit: true,
              categoryName: true,
              category: { select: { name: true } }
            }
          }
        }
      }).catch(() => [])
    ]);

    // Perhitungan metrik penjualan hari ini
    const todayNonCancelled = todayOrders.filter(o => o.status !== 'Dibatalkan');
    const todayOrdersRevenue = todayNonCancelled.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const todayCompletedOrders = todayOrders.filter(o => o.status === 'Selesai');
    const todayCompletedRevenue = todayCompletedOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const todayCompletedOrdersCount = todayCompletedOrders.length;
    const todayOrdersCount = todayOrders.length;

    // Susun grafik tren 7 hari terakhir
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const trendMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().split('T')[0];
      const label = `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
      trendMap[dateKey] = { name: label, Pendapatan: 0, Pesanan: 0 };
    }

    recent7DaysOrders.forEach(ord => {
      const dateKey = new Date(ord.createdAt).toISOString().split('T')[0];
      if (trendMap[dateKey]) {
        trendMap[dateKey].Pendapatan += Number(ord.totalAmount || 0);
        trendMap[dateKey].Pesanan += 1;
      }
    });

    const salesTrendData = Object.values(trendMap);

    // Hitung top 3-4 produk terlaris
    const productAgg = {};
    nonCancelledOrderItems.forEach(item => {
      const pId = item.productId || item.name;
      if (!productAgg[pId]) {
        productAgg[pId] = {
          id: pId,
          name: item.name || item.product?.name || 'Produk',
          image: item.image || item.product?.image || '',
          unit: item.unit || item.product?.unit || 'Kg',
          categoryName: item.product?.category?.name || item.product?.categoryName || 'Hasil Panen',
          quantity: 0,
          revenue: 0
        };
      }
      const qty = Number(item.quantity || 1);
      productAgg[pId].quantity += qty;
      productAgg[pId].revenue += qty * Number(item.price || 0);
    });

    const bestSellers = Object.values(productAgg)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 4)
      .map(item => ({
        p: {
          id: item.id,
          name: item.name,
          image: item.image,
          unit: item.unit,
          categoryName: item.categoryName
        },
        quantity: item.quantity,
        revenue: item.revenue
      }));

    const responsePayload = {
      success: true,
      // Operational summaries
      pendingOrdersCount,
      processingOrdersCount,
      readyToShipCount,
      todayOrdersRevenue,
      todayCompletedOrdersCount,
      todayCompletedRevenue,
      todayOrdersCount,
      // Inventory alerts
      outOfStockCount,
      lowStockCount,
      lowStockProducts: lowStockProducts.map(p => ({
        id: p.id,
        name: p.name,
        image: p.image,
        unit: p.unit,
        stock: p.stock,
        categoryName: p.category?.name || p.categoryName || 'Hasil Panen'
      })),
      // Lists (max 5 orders, 7-day trend, 4 best sellers, 3 reviews, 8 logs)
      recentOrders,
      salesTrendData,
      bestSellers,
      recentReviews,
      logs: activityLogs
    };

    setCacheItem(cacheKey, responsePayload, 30000);
    return res.json(responsePayload);
  } catch (error) {
    console.error('getAdminDashboard error:', error);
    return res.status(500).json({ error: 'Gagal memuat data dashboard operasional' });
  }
}

export async function getAdminAnalytics(req, res) {
  try {
    const cacheKey = `admin_analytics_${JSON.stringify(req.query || {})}`;
    const cached = getCacheItem(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const timeframe = req.query.timeframe || req.query.period || '30d';
    const status = req.query.status || 'ALL';
    const category = req.query.category || 'ALL';
    const product = req.query.product || 'ALL';
    const fulfillment = req.query.fulfillment || 'ALL';
    const customStartDate = req.query.startDate;
    const customEndDate = req.query.endDate;

    // 1. Tentukan rentang tanggal saat ini dan rentang tanggal periode sebelumnya
    const now = new Date();
    let startDate = null;
    let endDate = null;
    let prevStartDate = null;
    let prevEndDate = null;
    let hasComparison = false;

    if (customStartDate && customEndDate) {
      // Custom date range
      startDate = new Date(`${customStartDate}T00:00:00.000`);
      endDate = new Date(`${customEndDate}T23:59:59.999`);
      const diffMs = endDate.getTime() - startDate.getTime();
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(prevEndDate.getTime() - diffMs);
      hasComparison = true;
    } else if (timeframe === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 1);
      prevEndDate = new Date(endDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      hasComparison = true;
    } else if (timeframe === '7d') {
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - 6);
      prevStartDate.setHours(0, 0, 0, 0);
      hasComparison = true;
    } else if (timeframe === '30d') {
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      prevEndDate = new Date(startDate.getTime() - 1);
      prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - 29);
      prevStartDate.setHours(0, 0, 0, 0);
      hasComparison = true;
    } else if (timeframe === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      prevStartDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      hasComparison = true;
    } // 'all' -> no date filter & no comparison

    // 2. Query filter pesanan
    const orderWhere = {};
    if (startDate && endDate) {
      orderWhere.createdAt = { gte: startDate, lte: endDate };
    } else if (startDate) {
      orderWhere.createdAt = { gte: startDate };
    }
    if (status && status !== 'ALL') {
      orderWhere.status = status;
    }
    if (fulfillment && fulfillment !== 'ALL') {
      orderWhere.fulfillmentMethod = fulfillment.toUpperCase();
    }

    const prevOrderWhere = {};
    if (hasComparison && prevStartDate && prevEndDate) {
      prevOrderWhere.createdAt = { gte: prevStartDate, lte: prevEndDate };
      if (status && status !== 'ALL') prevOrderWhere.status = status;
      if (fulfillment && fulfillment !== 'ALL') prevOrderWhere.fulfillmentMethod = fulfillment.toUpperCase();
    }

    // 3. Query database
    const [orders, prevOrders, allProducts, allCategories] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        orderBy: { createdAt: 'asc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  stock: true,
                  unit: true,
                  image: true,
                  categoryId: true,
                  categoryName: true,
                  category: { select: { id: true, name: true } }
                }
              }
            }
          }
        }
      }).catch(() => []),
      hasComparison ? prisma.order.findMany({
        where: prevOrderWhere,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  stock: true,
                  unit: true,
                  image: true,
                  categoryId: true,
                  categoryName: true,
                  category: { select: { id: true, name: true } }
                }
              }
            }
          }
        }
      }).catch(() => []) : Promise.resolve([]),
      prisma.product.findMany({
        include: {
          category: { select: { id: true, name: true } }
        }
      }).catch(() => []),
      prisma.category.findMany().catch(() => [])
    ]);

    // 4. Helper untuk filter kategori & produk pada item pesanan
    const hasCategoryFilter = category && category !== 'ALL';
    const hasProductFilter = product && product !== 'ALL';

    function filterOrderList(rawOrders) {
      if (!hasCategoryFilter && !hasProductFilter) return rawOrders;

      return rawOrders.map(ord => ({
        ...ord,
        items: ord.items.filter(it => {
          let matchCat = true;
          let matchProd = true;
          if (hasCategoryFilter) {
            matchCat = it.product?.categoryId === category ||
              it.product?.category?.id === category ||
              (it.product?.category?.name && it.product.category.name.toLowerCase() === category.toLowerCase()) ||
              (it.product?.categoryName && it.product.categoryName.toLowerCase() === category.toLowerCase());
          }
          if (hasProductFilter) {
            matchProd = it.productId === product ||
              it.product?.id === product ||
              (it.name && it.name.toLowerCase().includes(product.toLowerCase()));
          }
          return matchCat && matchProd;
        })
      })).filter(ord => ord.items.length > 0);
    }

    const filteredOrders = filterOrderList(orders);
    const filteredPrevOrders = hasComparison ? filterOrderList(prevOrders) : [];

    // 5. Agregasi data periode berjalan (Current Period)
    const nonCancelledOrders = filteredOrders.filter(o => o.status !== 'Dibatalkan');
    const totalOrdersCount = filteredOrders.length;
    const cancelledOrdersCount = filteredOrders.filter(o => o.status === 'Dibatalkan').length;
    const cancellationRate = totalOrdersCount > 0
      ? Number(((cancelledOrdersCount / totalOrdersCount) * 100).toFixed(1))
      : 0;

    // Total nilai pesanan yang tidak dibatalkan
    const totalRevenue = nonCancelledOrders.reduce((sum, o) => {
      if (hasCategoryFilter || hasProductFilter) {
        return sum + o.items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
      }
      return sum + Number(o.totalAmount || 0);
    }, 0);

    // Nilai penjualan dari pesanan selesai
    const completedOrders = filteredOrders.filter(o => o.status === 'Selesai');
    const completedRevenue = completedOrders.reduce((sum, o) => {
      if (hasCategoryFilter || hasProductFilter) {
        return sum + o.items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
      }
      return sum + Number(o.totalAmount || 0);
    }, 0);

    const averageOrderValue = nonCancelledOrders.length > 0
      ? Math.round(totalRevenue / nonCancelledOrders.length)
      : 0;

    // Jumlah pelanggan unik dari pesanan yang masuk
    const uniqueCustomerSet = new Set();
    filteredOrders.forEach(o => {
      const custId = o.userId || o.customerEmail || o.phone || o.customerName;
      if (custId) uniqueCustomerSet.add(custId);
    });
    const uniqueCustomersCount = uniqueCustomerSet.size;

    // Hitung unit terjual, performa produk & performa kategori
    let totalProductsSold = 0;
    const productSalesMap = {};
    const categorySalesMap = {};
    const categoryTxSet = {};
    const productTxSet = {};

    filteredOrders.forEach(o => {
      if (o.status !== 'Dibatalkan') {
        (o.items || []).forEach(it => {
          const qty = Number(it.quantity || 1);
          const price = Number(it.price || 0);
          const revenue = price * qty;
          totalProductsSold += qty;

          const pId = it.productId || it.product?.id || it.name;
          if (!productSalesMap[pId]) {
            productSalesMap[pId] = {
              id: pId,
              name: it.name || it.product?.name || 'Produk',
              image: it.image || it.product?.image || '',
              unit: it.unit || it.product?.unit || 'Kg',
              price: price,
              categoryName: it.product?.category?.name || it.product?.categoryName || 'Hasil Panen',
              stock: it.product?.stock ?? 0,
              soldCount: 0,
              revenue: 0,
              transactionCount: 0
            };
            productTxSet[pId] = new Set();
          }
          productSalesMap[pId].soldCount += qty;
          productSalesMap[pId].revenue += revenue;
          productTxSet[pId].add(o.id);

          const catName = it.product?.category?.name || it.product?.categoryName || 'Lainnya';
          if (!categorySalesMap[catName]) {
            categorySalesMap[catName] = {
              name: catName,
              revenue: 0,
              soldCount: 0,
              transactionCount: 0
            };
            categoryTxSet[catName] = new Set();
          }
          categorySalesMap[catName].revenue += revenue;
          categorySalesMap[catName].soldCount += qty;
          categoryTxSet[catName].add(o.id);
        });
      }
    });

    // Pasang transactionCount pada produk & kategori
    Object.keys(productTxSet).forEach(pId => {
      if (productSalesMap[pId]) {
        productSalesMap[pId].transactionCount = productTxSet[pId].size;
      }
    });
    Object.keys(categoryTxSet).forEach(catName => {
      if (categorySalesMap[catName]) {
        categorySalesMap[catName].transactionCount = categoryTxSet[catName].size;
      }
    });

    // 6. Agregasi data periode sebelumnya (Previous Period Comparison)
    let prevMetrics = null;
    if (hasComparison) {
      const prevNonCancelled = filteredPrevOrders.filter(o => o.status !== 'Dibatalkan');
      const prevTotalRevenue = prevNonCancelled.reduce((sum, o) => {
        if (hasCategoryFilter || hasProductFilter) {
          return sum + o.items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
        }
        return sum + Number(o.totalAmount || 0);
      }, 0);
      const prevCompleted = filteredPrevOrders.filter(o => o.status === 'Selesai');
      const prevCompletedRevenue = prevCompleted.reduce((sum, o) => {
        if (hasCategoryFilter || hasProductFilter) {
          return sum + o.items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
        }
        return sum + Number(o.totalAmount || 0);
      }, 0);
      const prevOrdersCount = filteredPrevOrders.length;
      const prevCancelledCount = filteredPrevOrders.filter(o => o.status === 'Dibatalkan').length;
      const prevCancellationRate = prevOrdersCount > 0
        ? Number(((prevCancelledCount / prevOrdersCount) * 100).toFixed(1))
        : 0;
      const prevAov = prevNonCancelled.length > 0 ? Math.round(prevTotalRevenue / prevNonCancelled.length) : 0;
      let prevProductsSold = 0;
      prevNonCancelled.forEach(o => {
        (o.items || []).forEach(it => {
          prevProductsSold += Number(it.quantity || 1);
        });
      });

      function calcChange(curr, prev) {
        if (prev === 0 || prev === null || prev === undefined) return null;
        return Number((((curr - prev) / prev) * 100).toFixed(1));
      }

      prevMetrics = {
        totalRevenue: prevTotalRevenue,
        completedRevenue: prevCompletedRevenue,
        totalOrdersCount: prevOrdersCount,
        totalProductsSold: prevProductsSold,
        averageOrderValue: prevAov,
        cancellationRate: prevCancellationRate,
        growth: {
          totalRevenue: calcChange(totalRevenue, prevTotalRevenue),
          completedRevenue: calcChange(completedRevenue, prevCompletedRevenue),
          totalOrdersCount: calcChange(totalOrdersCount, prevOrdersCount),
          totalProductsSold: calcChange(totalProductsSold, prevProductsSold),
          averageOrderValue: calcChange(averageOrderValue, prevAov),
          cancellationRate: calcChange(cancellationRate, prevCancellationRate)
        }
      };
    }

    // 7. Grafik Analitik Waktu ke Waktu (Sales & Orders Trend)
    let salesTrendData = [];
    const diffDays = startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 30;

    if (timeframe === 'today' || diffDays <= 1) {
      // Interval per jam (setiap 2 jam)
      const hoursMap = {};
      for (let h = 0; h < 24; h += 2) {
        const label = `${String(h).padStart(2, '0')}:00`;
        hoursMap[h] = { name: label, Pendapatan: 0, Pesanan: 0 };
      }
      nonCancelledOrders.forEach(o => {
        const ordDate = new Date(o.createdAt);
        const bucketHour = Math.floor(ordDate.getHours() / 2) * 2;
        if (hoursMap[bucketHour]) {
          const ordAmt = (hasCategoryFilter || hasProductFilter)
            ? o.items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0)
            : Number(o.totalAmount || 0);
          hoursMap[bucketHour].Pendapatan += ordAmt;
          hoursMap[bucketHour].Pesanan += 1;
        }
      });
      salesTrendData = Object.values(hoursMap);
    } else if (timeframe === '7d' || timeframe === '30d' || diffDays <= 60) {
      // Interval per hari
      const dayMap = {};
      const numDays = Math.max(1, diffDays);
      for (let i = 0; i < numDays; i++) {
        const d = new Date(startDate || now);
        d.setDate(d.getDate() + i);
        const dateKey = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
        dayMap[dateKey] = { name: label, Pendapatan: 0, Pesanan: 0 };
      }
      nonCancelledOrders.forEach(o => {
        const dateKey = new Date(o.createdAt).toISOString().split('T')[0];
        if (dayMap[dateKey]) {
          const ordAmt = (hasCategoryFilter || hasProductFilter)
            ? o.items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0)
            : Number(o.totalAmount || 0);
          dayMap[dateKey].Pendapatan += ordAmt;
          dayMap[dateKey].Pesanan += 1;
        }
      });
      salesTrendData = Object.values(dayMap);
    } else {
      // Interval per bulan
      const monthMap = {};
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      for (let m = 0; m < 12; m++) {
        monthMap[m] = { name: monthNames[m], Pendapatan: 0, Pesanan: 0 };
      }
      nonCancelledOrders.forEach(o => {
        const m = new Date(o.createdAt).getMonth();
        if (monthMap[m]) {
          const ordAmt = (hasCategoryFilter || hasProductFilter)
            ? o.items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0)
            : Number(o.totalAmount || 0);
          monthMap[m].Pendapatan += ordAmt;
          monthMap[m].Pesanan += 1;
        }
      });
      salesTrendData = Object.values(monthMap);
    }

    // 8. Kontribusi Penjualan per Kategori (Pie Chart)
    const categoryChartData = Object.values(categorySalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map(c => ({
        name: c.name,
        value: c.revenue,
        percentage: totalRevenue > 0 ? Number(((c.revenue / totalRevenue) * 100).toFixed(1)) : 0
      }));

    // 9. Distribusi Status Pesanan (Bar Chart)
    const statusCounts = {
      'Menunggu': 0,
      'Diproses': 0,
      'Dikirim': 0,
      'Selesai': 0,
      'Dibatalkan': 0
    };
    const statusRevenues = {
      'Menunggu': 0,
      'Diproses': 0,
      'Dikirim': 0,
      'Selesai': 0,
      'Dibatalkan': 0
    };
    filteredOrders.forEach(o => {
      const st = o.status || 'Menunggu';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      statusRevenues[st] = (statusRevenues[st] || 0) + Number(o.totalAmount || 0);
    });
    const orderStatusData = Object.keys(statusCounts).map(s => ({
      status: s,
      Jumlah: statusCounts[s],
      revenue: statusRevenues[s]
    }));

    // 10. Tabel Performa Kategori
    const categoryAnalytics = allCategories.map(cat => {
      const catProds = allProducts.filter(p => p.categoryId === cat.id);
      const catSales = categorySalesMap[cat.name] || { soldCount: 0, revenue: 0, transactionCount: 0 };
      const contributionPercentage = totalRevenue > 0
        ? Number(((catSales.revenue / totalRevenue) * 100).toFixed(1))
        : 0;
      return {
        id: cat.id,
        name: cat.name,
        productCount: catProds.length,
        soldCount: catSales.soldCount,
        revenue: catSales.revenue,
        transactionCount: catSales.transactionCount || 0,
        contributionPercentage
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // 11. Tabel Performa Produk (Ranking Terlaris & Omzet)
    const bestSellers = Object.values(productSalesMap)
      .sort((a, b) => b.soldCount - a.soldCount)
      .map(item => ({
        id: item.id,
        name: item.name,
        image: item.image,
        unit: item.unit,
        price: item.price,
        categoryName: item.categoryName,
        stock: item.stock,
        soldCount: item.soldCount,
        quantity: item.soldCount,
        revenue: item.revenue,
        transactionCount: item.transactionCount || 0,
        p: {
          id: item.id,
          name: item.name,
          image: item.image,
          unit: item.unit,
          price: item.price,
          categoryName: item.categoryName,
          stock: item.stock
        }
      }));

    // 12. Analisis Transaksi (Status Breakdown + Fulfillment Delivery vs Pickup)
    const fulfillmentCounts = {
      DELIVERY: { count: 0, revenue: 0 },
      PICKUP: { count: 0, revenue: 0 }
    };
    filteredOrders.forEach(o => {
      const method = (o.fulfillmentMethod || 'DELIVERY').toUpperCase();
      if (!fulfillmentCounts[method]) {
        fulfillmentCounts[method] = { count: 0, revenue: 0 };
      }
      fulfillmentCounts[method].count += 1;
      if (o.status !== 'Dibatalkan') {
        fulfillmentCounts[method].revenue += Number(o.totalAmount || 0);
      }
    });

    const transactionAnalysis = {
      statusSummary: Object.keys(statusCounts).map(s => ({
        status: s,
        count: statusCounts[s],
        revenue: statusRevenues[s],
        percentage: totalOrdersCount > 0 ? Number(((statusCounts[s] / totalOrdersCount) * 100).toFixed(1)) : 0
      })),
      fulfillmentSummary: Object.keys(fulfillmentCounts).map(m => ({
        method: m,
        label: m === 'PICKUP' ? 'Ambil di Kebun (Pickup)' : 'Kirim ke Alamat (Delivery)',
        count: fulfillmentCounts[m].count,
        revenue: fulfillmentCounts[m].revenue,
        percentage: totalOrdersCount > 0 ? Number(((fulfillmentCounts[m].count / totalOrdersCount) * 100).toFixed(1)) : 0
      })),
      // Rincian transaksi untuk sheet ekspor dan eksplorasi tabel
      transactions: filteredOrders.slice(0, 150).map(o => ({
        id: o.id,
        createdAt: o.createdAt,
        customerName: o.customerName,
        customerEmail: o.customerEmail || '-',
        phone: o.phone || '-',
        fulfillmentMethod: o.fulfillmentMethod || 'DELIVERY',
        status: o.status,
        totalAmount: Number(o.totalAmount || 0),
        itemsCount: (o.items || []).reduce((s, it) => s + Number(it.quantity || 1), 0)
      }))
    };

    const responsePayload = {
      success: true,
      timeframe,
      status,
      category,
      product,
      fulfillment,
      startDate: startDate ? startDate.toISOString().split('T')[0] : null,
      endDate: endDate ? endDate.toISOString().split('T')[0] : null,
      // KPI Utama
      totalRevenue,
      completedRevenue,
      totalOrdersCount,
      totalProductsSold,
      averageOrderValue,
      cancellationRate,
      uniqueCustomersCount,
      // Periode Sebelumnya & Pertumbuhan
      prevMetrics,
      // Grafik
      salesTrendData,
      categoryChartData,
      orderStatusData,
      // Tabel Analitik
      categoryAnalytics,
      bestSellers,
      // Analisis Transaksi
      transactionAnalysis
    };

    setCacheItem(cacheKey, responsePayload, 45000);
    return res.json(responsePayload);
  } catch (error) {
    console.error('getAdminAnalytics error:', error);
    return res.status(500).json({ error: 'Gagal memuat data analitik bisnis' });
  }
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

    const formatted = (Array.isArray(products) ? products : []).filter(Boolean).map(p => {
      const catObj = p && typeof p.category === 'object' && p.category !== null ? p.category : null;
      const catName = p?.categoryName || catObj?.name || (typeof p?.category === 'string' ? p.category : 'Hasil Panen');
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

    let finalCategoryId = categoryId || null;
    let finalCategoryName = categoryName || 'Hasil Panen';

    if (finalCategoryId && (!categoryName || categoryName === 'Hasil Panen')) {
      const cat = await prisma.category.findUnique({ where: { id: finalCategoryId } }).catch(() => null);
      if (cat) finalCategoryName = cat.name;
    } else if (!finalCategoryId && finalCategoryName && finalCategoryName !== 'Semua' && finalCategoryName !== 'Hasil Panen') {
      const cat = await prisma.category.findFirst({
        where: {
          OR: [
            { name: { equals: finalCategoryName, mode: 'insensitive' } },
            { slug: { equals: finalCategoryName, mode: 'insensitive' } }
          ]
        }
      }).catch(() => null);
      if (cat) {
        finalCategoryId = cat.id;
        finalCategoryName = cat.name;
      }
    }

    const newProduct = await prisma.product.create({
      data: {
        id,
        name: name.trim(),
        price: parseFloat(price) || 0,
        unit,
        stock: parseInt(stock, 10) || 0,
        image,
        description,
        categoryId: finalCategoryId,
        categoryName: finalCategoryName,
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

export async function importAdminProducts(req, res) {
  return importProducts(req, res);
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
    if (categoryId !== undefined) {
      dataToUpdate.categoryId = categoryId || null;
      if (categoryId && categoryName === undefined) {
        const cat = await prisma.category.findUnique({ where: { id: categoryId } }).catch(() => null);
        if (cat) dataToUpdate.categoryName = cat.name;
      }
    }
    if (categoryName !== undefined) {
      dataToUpdate.categoryName = categoryName;
      if (categoryName && categoryId === undefined) {
        const cat = await prisma.category.findFirst({
          where: {
            OR: [
              { name: { equals: categoryName, mode: 'insensitive' } },
              { slug: { equals: categoryName, mode: 'insensitive' } }
            ]
          }
        }).catch(() => null);
        if (cat) dataToUpdate.categoryId = cat.id;
      }
    }
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
    const cacheKey = 'admin_stock_list';
    const cached = getCacheItem(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

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
    setCacheItem(cacheKey, products, 30000);
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat stok' });
  }
}

export async function listAdminStockHistory(req, res) {
  try {
    const { productId, type, search, limit = 200 } = req.query || {};
    const where = {};
    if (productId && productId !== 'ALL') {
      where.productId = productId;
    }
    if (type && type !== 'ALL') {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { productName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ];
    }
    const history = await prisma.stockHistory.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            stock: true,
            unit: true,
            categoryName: true,
            image: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(500, parseInt(limit, 10) || 200)
    });

    const parsed = history.map(item => parseStockHistoryRecord(item));
    let finalResult = parsed;
    const { source, orderId } = req.query || {};
    if (source && source !== 'ALL') {
      finalResult = finalResult.filter(r => r.source === source);
    }
    if (orderId) {
      finalResult = finalResult.filter(r => r.orderId === orderId);
    }
    return res.json(finalResult);
  } catch (error) {
    console.error('listAdminStockHistory error:', error);
    return res.status(500).json({ error: 'Gagal memuat riwayat mutasi stok' });
  }
}

export async function createStockMutation(req, res) {
  try {
    const { productId, productName, type, quantity, notes } = req.body || {};
    if (!productId || quantity === undefined) {
      return res.status(400).json({ error: 'ID produk dan jumlah stok wajib diisi' });
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      return res.status(400).json({ error: 'Jumlah kuantitas stok harus berupa angka positif' });
    }

    const actorName = req.user?.name || req.user?.email || 'Admin TaniCo';

    const result = await runWithTransactionRetry(async () => {
      return await prisma.$transaction(async (tx) => {
        const currentProd = await tx.product.findUnique({
          where: { id: productId }
        });

        if (!currentProd) {
          throw new Error('Produk tidak ditemukan di database');
        }

        let newStock = currentProd.stock;
        if (type === 'Masuk') {
          newStock += qtyNum;
        } else {
          if (qtyNum > currentProd.stock) {
            throw new Error(
              `Stok tidak mencukupi! Sisa stok saat ini hanya ${currentProd.stock} ${currentProd.unit || 'porsi'}.`
            );
          }
          newStock = Math.max(0, currentProd.stock - qtyNum);
        }

        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { stock: newStock }
        });

        const savedHistory = await recordStockMutation({
          client: tx,
          productId,
          productName: productName || currentProd.name,
          type: type === 'Masuk' ? 'Masuk' : 'Keluar',
          quantity: qtyNum,
          source: type === 'Masuk' ? STOCK_MUTATION_SOURCES.RESTOCK : STOCK_MUTATION_SOURCES.MANUAL_OUT,
          actorName,
          stockBefore: currentProd.stock,
          stockAfter: newStock,
          unit: currentProd.unit || 'kg',
          notes: notes || (type === 'Masuk' ? 'Panen Baru' : 'Sortir Gudang')
        });

        return { savedHistory, updatedProduct };
      }, {
        maxWait: 10000,
        timeout: 20000
      });
    });

    clearAllCache();
    return res.status(201).json(result.savedHistory);
  } catch (error) {
    console.error('createStockMutation error:', error);
    return res.status(400).json({ error: error.message || 'Gagal mencatat mutasi stok di database' });
  }
}

export async function updateAdminStock(req, res) {
  try {
    const id = req.params.id || req.body?.id;
    const { stock, price } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID produk diperlukan' });

    const dataToUpdate = {};
    if (stock !== undefined) {
      const parsedStock = parseInt(stock, 10);
      if (parsedStock < 0) {
        return res.status(400).json({ error: 'Stok tidak boleh bernilai negatif' });
      }
      dataToUpdate.stock = parsedStock;
    }
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

export async function listAdminStockOpnames(req, res) {
  try {
    const { search, filter } = req.query || {};

    const where = {};
    if (search && String(search).trim() !== '') {
      const q = String(search).trim();
      where.OR = [
        { product: { name: { contains: q, mode: 'insensitive' } } },
        { product: { id: { contains: q, mode: 'insensitive' } } },
        { notes: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (filter === 'deficit') {
      where.difference = { lt: 0 };
    } else if (filter === 'surplus') {
      where.difference = { gt: 0 };
    } else if (filter === 'match') {
      where.difference = { equals: 0 };
    }

    const opnames = await prisma.stockOpname.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            image: true,
            unit: true,
            categoryName: true,
            price: true,
            stock: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    return res.json(opnames);
  } catch (error) {
    console.error('listAdminStockOpnames error:', error);
    return res.status(500).json({ error: 'Gagal memuat riwayat stock opname' });
  }
}

export async function createAdminStockOpname(req, res) {
  try {
    const { productId, physicalStock, notes } = req.body || {};
    if (!productId || typeof productId !== 'string' || productId.trim() === '') {
      return res.status(400).json({ error: 'ID produk wajib diisi' });
    }

    if (physicalStock === undefined || physicalStock === null || physicalStock === '') {
      return res.status(400).json({ error: 'Kuantitas stok fisik wajib diisi' });
    }

    const parsedPhysical = parseFloat(physicalStock);
    if (isNaN(parsedPhysical)) {
      return res.status(400).json({ error: 'Stok fisik harus berupa angka valid (bukan NaN)' });
    }

    if (parsedPhysical < 0) {
      return res.status(400).json({ error: 'Stok fisik tidak boleh bernilai negatif' });
    }

    const actorName = req.user?.name || req.user?.email || 'Admin TaniCo';

    // Atomic Database Transaction for Stock Opname + Product Stock + Stock Mutation
    const result = await runWithTransactionRetry(async () => {
      return await prisma.$transaction(async (tx) => {
        // 1. Authoritative check from DB
        const currentProd = await tx.product.findUnique({
          where: { id: productId }
        });

        if (!currentProd) {
          throw new Error('Produk tidak ditemukan di database');
        }

        // 2. Authoritative system stock before adjustment
        const bookStock = Number(currentProd.stock ?? 0);

        // 3. Difference = physicalStock - bookStock
        const difference = parseFloat((parsedPhysical - bookStock).toFixed(2));
        const newProductStock = Math.max(0, Math.round(parsedPhysical));

        // 4. Record StockOpname log
        const newOpname = await tx.stockOpname.create({
          data: {
            productId,
            bookStock,
            physicalStock: parsedPhysical,
            difference,
            notes: notes ? String(notes).trim() : null
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                unit: true,
                categoryName: true,
                price: true,
                stock: true
              }
            }
          }
        });

        // 5. Update Product Stock to match physical count
        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { stock: newProductStock }
        });

        // 6. Record Stock Mutation History if difference exists
        if (difference !== 0) {
          await recordStockMutation({
            client: tx,
            productId,
            productName: currentProd.name,
            type: difference > 0 ? 'Masuk' : 'Keluar',
            quantity: Math.abs(Math.round(difference)),
            source: STOCK_MUTATION_SOURCES.STOCK_OPNAME,
            actorName,
            stockBefore: bookStock,
            stockAfter: newProductStock,
            unit: currentProd.unit || 'kg',
            notes: `Buku: ${bookStock}, Fisik: ${parsedPhysical}, Selisih: ${difference > 0 ? '+' : ''}${difference}.${notes ? ` Catatan: ${notes}` : ''}`
          });
        }

        return {
          data: newOpname,
          updatedProduct,
          bookStock,
          difference
        };
      }, {
        maxWait: 10000,
        timeout: 20000
      });
    });

    // Invalidate system cache
    clearAllCache();

    return res.status(201).json({
      success: true,
      data: result.data,
      updatedProduct: result.updatedProduct,
      bookStock: result.bookStock,
      difference: result.difference
    });
  } catch (error) {
    console.error('createAdminStockOpname error:', error);
    return res.status(400).json({ error: error.message || 'Gagal memproses Stock Opname di database.' });
  }
}

export async function bulkAdminStockOpname(req, res) {
  try {
    const { items, syncStock = true, generalNotes } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Daftar item stock opname tidak boleh kosong' });
    }

    const actorName = req.user?.name || req.user?.email || 'Admin TaniCo';

    const result = await runWithTransactionRetry(async () => {
      return await prisma.$transaction(async (tx) => {
        const validProductIds = items.map(i => i.productId).filter(Boolean);
        const existingProducts = await tx.product.findMany({
          where: { id: { in: validProductIds } }
        });
        const prodMap = new Map(existingProducts.map(p => [p.id, p]));

        const createdRecords = [];
        for (const item of items) {
          const { productId, physicalStock, notes } = item;
          if (!productId || physicalStock === undefined || physicalStock === null) continue;

          const pStock = parseFloat(physicalStock);
          if (isNaN(pStock) || pStock < 0) continue;

          const currentProd = prodMap.get(productId);
          if (!currentProd) continue;

          const bookStock = Number(currentProd.stock ?? 0);
          const diff = parseFloat((pStock - bookStock).toFixed(2));
          const newProductStock = Math.max(0, Math.round(pStock));

          const opname = await tx.stockOpname.create({
            data: {
              productId,
              bookStock,
              physicalStock: pStock,
              difference: diff,
              notes: notes || generalNotes || 'Batch Stock Opname'
            }
          });
          createdRecords.push(opname);

          if (syncStock) {
            await tx.product.update({
              where: { id: productId },
              data: { stock: newProductStock }
            });

            if (diff !== 0) {
              await recordStockMutation({
                client: tx,
                productId,
                productName: currentProd.name,
                type: diff > 0 ? 'Masuk' : 'Keluar',
                quantity: Math.abs(Math.round(diff)),
                source: STOCK_MUTATION_SOURCES.STOCK_OPNAME,
                actorName,
                stockBefore: bookStock,
                stockAfter: newProductStock,
                unit: currentProd.unit || 'kg',
                notes: `Batch Stock Opname: Buku: ${bookStock}, Fisik: ${pStock}, Selisih: ${diff > 0 ? '+' : ''}${diff}.${notes ? ` Catatan: ${notes}` : ''}`
              });
            }
          }
        }
        return createdRecords;
      }, {
        maxWait: 10000,
        timeout: 30000
      });
    });

    clearAllCache();
    return res.status(201).json({ count: result.length, records: result });
  } catch (error) {
    console.error('bulkAdminStockOpname error:', error);
    return res.status(500).json({ error: 'Gagal menyimpan batch stock opname' });
  }
}

// ==================== ORDERS MANAGEMENT ====================

export async function listAdminOrders(req, res) {
  try {
    const cacheKey = 'admin_orders_list';
    const cached = getCacheItem(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const orders = await prisma.order.findMany({
      include: { items: true, user: true },
      orderBy: { createdAt: 'desc' }
    });
    setCacheItem(cacheKey, orders, 30000);
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

    const actorName = req.user?.name || req.user?.email || 'Admin TaniCo';
    const updated = await updateOrderStatusAtomic(id, status, actorName);

    return res.json(updated);
  } catch (error) {
    console.error('updateAdminOrderStatus error:', error);
    return res.status(400).json({ error: error.message || 'Gagal memperbarui status pesanan' });
  }
}

export async function deleteAdminOrder(req, res) {
  try {
    const { id } = req.params;
    const actorName = req.user?.name || req.user?.email || 'Admin TaniCo';
    await deleteOrderAtomic(id, actorName);
    return res.json({ success: true, message: 'Pesanan berhasil dihapus' });
  } catch (error) {
    console.error('deleteAdminOrder error:', error);
    return res.status(400).json({ error: error.message || 'Gagal menghapus pesanan' });
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

// ==================== CART ADMIN ====================

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

import prisma from '../services/prisma.js';
import { getAuthenticatedUserId } from '../middleware/auth.js';
import {
  createCheckoutOrderAtomic,
  updateOrderStatusAtomic,
  deleteOrderAtomic
} from '../services/orderService.js';

async function getUserId(req) {
  if (req.userId) return req.userId;
  return await getAuthenticatedUserId(req);
}

export async function getUserOrders(req, res) {
  try {
    if (req.query.id || req.query.orderId) {
      req.params = { ...req.params, id: req.query.id || req.query.orderId };
      return getOrderById(req, res);
    }

    const userId = await getUserId(req);
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

    if (!userId && !isAdmin) {
      return res.status(401).json({ error: 'Autentikasi diperlukan untuk melihat riwayat pesanan.' });
    }

    const { status } = req.query;
    const where = {};

    if (!isAdmin) {
      // Pelanggan hanya boleh melihat pesanannya sendiri
      where.userId = userId;
    } else {
      // Administrator dapat memfilter berdasarkan userId atau nomor telepon
      if (req.query.userId) where.userId = String(req.query.userId).trim();
      if (req.query.phone) where.phone = String(req.query.phone).trim();
    }

    if (status) {
      where.status = String(status).trim();
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    return res.json(orders || []);
  } catch (error) {
    console.error('getUserOrders error:', error);
    return res.status(500).json({ error: 'Gagal memuat pesanan' });
  }
}

export async function getOrderById(req, res) {
  try {
    const rawId = req.params.id || req.params.orderId || req.query.id || req.query.orderId;
    if (!rawId || !String(rawId).trim()) {
      return res.status(400).json({ success: false, error: 'ID transaksi tidak valid.' });
    }

    let cleanId = String(rawId).trim();
    try {
      cleanId = decodeURIComponent(cleanId);
    } catch (_) {}

    const authUserId = await getUserId(req);

    // Primary lookup by exact ID
    let order = await prisma.order.findUnique({
      where: { id: cleanId },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true
          }
        }
      }
    });

    // Fallback lookup case-insensitive if exact match not found
    if (!order) {
      order = await prisma.order.findFirst({
        where: { id: { equals: cleanId, mode: 'insensitive' } },
        include: {
          items: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              avatar: true
            }
          }
        }
      });
    }

    if (!order) {
      return res.status(404).json({ success: false, error: `Transaksi dengan ID "${cleanId}" tidak ditemukan.` });
    }

    const roleName = (typeof req.user?.role === 'object' ? req.user?.role?.name : req.user?.role || '').toUpperCase();
    const isAdmin = roleName === 'ADMIN' || roleName === 'SUPER_ADMIN';

    if (!isAdmin) {
      const userEmail = (req.user?.email || '').toLowerCase().trim();
      const orderEmail = (order.customerEmail || '').toLowerCase().trim();
      const userPhone = (req.user?.phone || '').trim();
      const orderPhone = (order.phone || '').trim();

      const isOwner = (order.userId && order.userId === authUserId) ||
        (userEmail && orderEmail && userEmail === orderEmail) ||
        (userPhone && orderPhone && userPhone === orderPhone);

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki wewenang untuk melihat detail transaksi ini.'
        });
      }

      // Link order to user if not linked yet or if user logged in with matching email
      if ((!order.userId || order.userId !== authUserId) && authUserId && userEmail && orderEmail && userEmail === orderEmail) {
        prisma.order.update({
          where: { id: order.id },
          data: { userId: authUserId }
        }).catch(() => {});
      }
    }

    return res.json({
      success: true,
      ...order
    });
  } catch (error) {
    console.error('[OrdersController] getOrderById error:', error);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat memproses transaksi.' });
  }
}

export async function createOrder(req, res) {
  try {
    const body = req.body || {};
    const orderData = Array.isArray(body) ? body[0] : body;

    const {
      customerName,
      phone,
      address,
      subdistrict,
      notes,
      paymentMethod,
      customerEmail,
      userId: bodyUserId,
      voucherCode,
      fulfillmentMethod,
      items
    } = orderData || {};

    const authUserId = await getUserId(req);
    // Identity must come from authenticated session, not untrusted request body
    const finalUserId = authUserId || null;

    const newOrder = await createCheckoutOrderAtomic({
      customerName,
      phone,
      address,
      subdistrict,
      notes,
      paymentMethod,
      fulfillmentMethod,
      customerEmail,
      userId: finalUserId,
      voucherCode,
      items: items || []
    });

    return res.status(201).json(newOrder);
  } catch (error) {
    console.error('createOrder error:', error);
    return res.status(400).json({ error: error.message || 'Gagal menyimpan pesanan' });
  }
}

export async function updateOrder(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) {
      return res.status(400).json({ error: 'ID pesanan diperlukan' });
    }

    const authUserId = await getUserId(req);
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    if (!isAdmin && existing.userId && existing.userId !== authUserId) {
      return res.status(403).json({ error: 'Akses ditolak: Anda tidak memiliki akses untuk mengubah pesanan ini.' });
    }

    const { status, notes, address, phone, customerName, fulfillmentMethod } = req.body || {};

    let updated;
    if (status !== undefined) {
      // Pelanggan biasa hanya boleh membatalkan pesanan miliknya yang masih berstatus 'Menunggu'
      if (!isAdmin) {
        if (status !== 'Dibatalkan') {
          return res.status(403).json({ error: 'Pelanggan hanya dapat membatalkan pesanan.' });
        }
        if (existing.status !== 'Menunggu') {
          return res.status(400).json({ error: 'Pesanan yang telah diproses tidak dapat dibatalkan langsung. Silakan hubungi admin.' });
        }
      }
      updated = await updateOrderStatusAtomic(id, status, isAdmin ? 'Admin' : 'Pelanggan');
    }

    // Jika field lain diperbarui
    if (notes !== undefined || address !== undefined || phone !== undefined || customerName !== undefined || fulfillmentMethod !== undefined) {
      if (!isAdmin && existing.status !== 'Menunggu') {
        return res.status(400).json({ error: 'Pesanan yang sedang diproses tidak dapat diubah oleh pelanggan.' });
      }
      updated = await prisma.order.update({
        where: { id },
        data: {
          ...(notes !== undefined && { notes }),
          ...(address !== undefined && { address }),
          ...(phone !== undefined && { phone }),
          ...(customerName !== undefined && { customerName }),
          ...(fulfillmentMethod !== undefined && { fulfillmentMethod })
        },
        include: { items: true }
      });
    }

    return res.json(updated || existing);
  } catch (error) {
    console.error('updateOrder error:', error);
    return res.status(400).json({ error: error.message || 'Gagal memperbarui pesanan' });
  }
}

export async function deleteOrder(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) {
      return res.status(400).json({ error: 'ID pesanan diperlukan' });
    }

    const authUserId = await getUserId(req);
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Akses ditolak: Hanya administrator yang dapat menghapus pesanan.' });
    }

    await deleteOrderAtomic(id, 'Admin');
    return res.json({ success: true, message: 'Pesanan berhasil dihapus' });
  } catch (error) {
    console.error('deleteOrder error:', error);
    return res.status(400).json({ error: error.message || 'Gagal menghapus pesanan' });
  }
}

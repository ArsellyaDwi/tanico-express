import prisma from '../services/prisma.js';
import { getAuthenticatedUserId } from '../middleware/auth.js';

async function getUserId(req) {
  if (req.userId) return req.userId;
  return await getAuthenticatedUserId(req);
}

export async function getUserOrders(req, res) {
  try {
    const userId = await getUserId(req);
    const { phone, status } = req.query;

    const where = {};
    if (userId) {
      where.userId = userId;
    } else if (phone) {
      where.phone = String(phone).trim();
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
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        user: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    return res.json(order);
  } catch (error) {
    console.error('getOrderById error:', error);
    return res.status(500).json({ error: 'Gagal memuat pesanan' });
  }
}

export async function createOrder(req, res) {
  try {
    const body = req.body || {};
    const orderData = Array.isArray(body) ? body[0] : body;

    const {
      id,
      customerName,
      phone,
      address,
      subdistrict,
      notes,
      totalAmount,
      status,
      paymentMethod,
      customerEmail,
      userId: bodyUserId,
      voucherCode,
      items
    } = orderData || {};

    if (!customerName || !phone || !address) {
      return res.status(400).json({ error: 'Nama, nomor telepon, dan alamat wajib diisi' });
    }

    const authUserId = await getUserId(req);
    const finalUserId = bodyUserId || authUserId || null;
    const orderId = id || `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder = await prisma.order.create({
      data: {
        id: orderId,
        customerName: String(customerName).trim(),
        phone: String(phone).trim(),
        address: String(address).trim(),
        subdistrict: subdistrict || '',
        notes: notes || '',
        totalAmount: Number(totalAmount) || 0,
        status: status || 'Menunggu',
        paymentMethod: paymentMethod || 'tf',
        customerEmail: customerEmail || '',
        userId: finalUserId,
        voucherCode: voucherCode || '',
        items: {
          create: (items || []).map(item => ({
            productId: item.productId || item.id || null,
            name: item.name || 'Produk TaniCo',
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            unit: item.unit || 'kg',
            image: item.image || ''
          }))
        }
      },
      include: { items: true }
    });

    return res.status(201).json(newOrder);
  } catch (error) {
    console.error('createOrder error:', error);
    return res.status(500).json({ error: 'Gagal menyimpan pesanan' });
  }
}

export async function updateOrder(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) {
      return res.status(400).json({ error: 'ID pesanan diperlukan' });
    }

    const { status, notes, address, phone, customerName } = req.body || {};

    const updated = await prisma.order.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(customerName !== undefined && { customerName })
      },
      include: { items: true }
    });

    return res.json(updated);
  } catch (error) {
    console.error('updateOrder error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui pesanan' });
  }
}

export async function deleteOrder(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) {
      return res.status(400).json({ error: 'ID pesanan diperlukan' });
    }

    await prisma.order.delete({ where: { id } });
    return res.json({ success: true, message: 'Pesanan berhasil dihapus' });
  } catch (error) {
    console.error('deleteOrder error:', error);
    return res.status(500).json({ error: 'Gagal menghapus pesanan' });
  }
}

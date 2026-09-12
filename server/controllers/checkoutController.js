import prisma from '../services/prisma.js';
import { getAuthenticatedUserId } from '../middleware/auth.js';

async function getUserId(req) {
  if (req.userId) return req.userId;
  return await getAuthenticatedUserId(req);
}

export async function getCheckoutCart(req, res) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.json({ items: [], total: 0 });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.json({ items: [], total: 0 });
    }

    const items = cart.items.map(item => ({
      id: item.productId,
      productId: item.productId,
      name: item.product?.name || '',
      price: item.product?.discountPrice || item.product?.price || 0,
      quantity: item.quantity,
      unit: item.product?.unit || '',
      image: item.product?.image || '',
      product: item.product || {}
    }));

    const total = items.reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0);

    return res.json({ items, total });
  } catch (error) {
    console.error('getCheckoutCart error:', error);
    return res.status(500).json({ error: 'Gagal memuat data keranjang checkout' });
  }
}

export async function processCheckout(req, res) {
  try {
    const body = req.body || {};
    const {
      customerName,
      customerPhone,
      phone,
      shippingAddress,
      address,
      subdistrict = '',
      paymentMethod = 'tf',
      voucherCode = '',
      notes = '',
      customerEmail = ''
    } = body;

    let items = Array.isArray(body.items) ? [...body.items] : [];

    const finalName = customerName || body.name || body.recipientName || body.fullName || '';
    const finalPhone = customerPhone || phone || body.recipientPhone || body.telepon || '';
    const finalAddress = shippingAddress || address || body.fullAddress || body.alamat || '';

    if (!finalName || !finalPhone || !finalAddress) {
      return res.status(400).json({ error: 'Nama penerima, nomor telepon, dan alamat wajib diisi.' });
    }

    const userId = await getUserId(req);

    // If items is empty or not provided, retrieve directly from user's active database Cart
    if (items.length === 0 && userId) {
      const userCart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: { product: true }
          }
        }
      });

      if (userCart && userCart.items && userCart.items.length > 0) {
        items = userCart.items.map(item => ({
          productId: item.productId,
          id: item.productId,
          name: item.product?.name || '',
          price: item.product?.discountPrice || item.product?.price || 0,
          quantity: item.quantity,
          unit: item.product?.unit || '',
          image: item.product?.image || ''
        }));
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang belanja Anda kosong.' });
    }

    const productIds = items.map(item => item.productId || item.id).filter(Boolean);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    const productMap = new Map(dbProducts.map(p => [p.id, p]));

    let calculatedTotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const pid = item.productId || item.id;
      const dbProd = productMap.get(pid);
      const qty = Math.max(1, parseInt(item.quantity || 1, 10));

      const itemPrice = dbProd ? (dbProd.discountPrice || dbProd.price) : Number(item.price || 0);
      const itemName = dbProd ? dbProd.name : (item.name || '');
      const itemUnit = dbProd ? dbProd.unit : (item.unit || '');
      const itemImage = dbProd ? (dbProd.image || '') : (item.image || '');

      calculatedTotal += itemPrice * qty;

      orderItemsData.push({
        productId: dbProd ? dbProd.id : (pid || null),
        name: itemName,
        price: itemPrice,
        quantity: qty,
        unit: itemUnit,
        image: itemImage
      });

      // Decrement stock and increment soldCount
      if (dbProd) {
        await prisma.product.update({
          where: { id: dbProd.id },
          data: {
            stock: { decrement: qty },
            soldCount: { increment: qty }
          }
        }).catch(() => {});
      }
    }

    const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const order = await prisma.order.create({
      data: {
        id: orderId,
        customerName: finalName.trim(),
        phone: finalPhone.trim(),
        address: finalAddress.trim(),
        subdistrict: (subdistrict || '').trim(),
        notes: (notes || '').trim(),
        totalAmount: calculatedTotal,
        status: 'Menunggu',
        paymentMethod: paymentMethod || 'tf',
        customerEmail: (customerEmail || '').trim(),
        userId: userId || null,
        voucherCode: (voucherCode || '').trim(),
        items: {
          create: orderItemsData
        }
      },
      include: {
        items: true,
        user: true
      }
    });

    // Clear user cart if userId
    if (userId) {
      const cart = await prisma.cart.findUnique({ where: { userId } });
      if (cart) {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } }).catch(() => {});
      }
    }

    return res.status(201).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan saat memproses checkout.' });
  }
}

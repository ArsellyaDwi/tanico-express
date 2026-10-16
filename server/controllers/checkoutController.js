import prisma from '../services/prisma.js';
import { getAuthenticatedUserId } from '../middleware/auth.js';
import { createCheckoutOrderAtomic } from '../services/orderService.js';

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
      customerEmail = '',
      fulfillmentMethod: reqFulfillment,
      isDirectBuy = false
    } = body;

    let items = Array.isArray(body.items) ? [...body.items] : [];
    const userId = await getUserId(req);

    // If items is empty or not provided and NOT a direct buy, retrieve directly from user's active database Cart
    if (items.length === 0 && userId && !isDirectBuy) {
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

    const finalName = customerName || body.name || body.recipientName || body.fullName || '';
    const finalPhone = customerPhone || phone || body.recipientPhone || body.telepon || '';
    const finalAddress = shippingAddress || address || body.fullAddress || body.alamat || '';
    const fulfillmentMethod = reqFulfillment || body.deliveryMethod || body.orderType || 'DELIVERY';

    const order = await createCheckoutOrderAtomic({
      customerName: finalName,
      phone: finalPhone,
      address: finalAddress,
      subdistrict,
      notes,
      paymentMethod,
      fulfillmentMethod,
      customerEmail,
      userId,
      voucherCode,
      items,
      isDirectBuy: Boolean(isDirectBuy)
    });

    return res.status(201).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(400).json({
      error: error.message || 'Terjadi kesalahan saat memproses checkout.'
    });
  }
}

import prisma from '../services/prisma.js';
import { getAuthenticatedUserId } from '../middleware/auth.js';

async function getUserId(req) {
  if (req.userId) return req.userId;
  return await getAuthenticatedUserId(req);
}

export async function getCart(req, res) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.json([]);
    }

    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: { product: true }
          }
        }
      }).catch(() => null);
    }

    if (!cart || !cart.items) {
      return res.json([]);
    }

    const items = cart.items.map(item => ({
      id: item.productId,
      cartItemId: item.id,
      productId: item.productId,
      quantity: item.quantity,
      product: item.product || {},
      ...(item.product || {})
    }));

    return res.json(items);
  } catch (error) {
    console.error('getCart error:', error);
    return res.status(500).json({ error: 'Gagal memuat keranjang' });
  }
}

export async function addToCart(req, res) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Pengguna tidak terautentikasi' });
    }

    const { productId, quantity, setQuantity } = req.body || {};
    if (!productId) {
      return res.status(400).json({ error: 'ID produk wajib diisi' });
    }

    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } }
    });

    let newQty;
    if (typeof setQuantity === 'number') {
      newQty = setQuantity;
    } else if (setQuantity === true) {
      newQty = parseInt(quantity, 10);
    } else {
      const addQty = parseInt(quantity, 10) || 1;
      newQty = existingItem ? existingItem.quantity + addQty : addQty;
    }

    if (newQty <= 0) {
      if (existingItem) {
        await prisma.cartItem.delete({ where: { id: existingItem.id } });
      }
    } else {
      await prisma.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        create: { cartId: cart.id, productId, quantity: newQty },
        update: { quantity: newQty }
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('addToCart error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui keranjang' });
  }
}

export async function updateCartItem(req, res) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Pengguna tidak terautentikasi' });
    }

    const productId = req.params.productId || req.body?.productId;
    const { quantity, setQuantity } = req.body || {};

    if (!productId) {
      return res.status(400).json({ error: 'ID produk wajib diisi' });
    }

    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    const newQty = typeof setQuantity === 'number' ? setQuantity : parseInt(quantity, 10);

    if (isNaN(newQty) || newQty <= 0) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId }
      });
    } else {
      await prisma.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        create: { cartId: cart.id, productId, quantity: newQty },
        update: { quantity: newQty }
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('updateCartItem error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui item keranjang' });
  }
}

export async function removeFromCart(req, res) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Pengguna tidak terautentikasi' });
    }

    const productId = req.params.productId || req.query.productId || req.body?.productId;
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart && productId) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId }
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('removeFromCart error:', error);
    return res.status(500).json({ error: 'Gagal menghapus item dari keranjang' });
  }
}

export async function clearCart(req, res) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Pengguna tidak terautentikasi' });
    }

    const productId = req.query.productId || req.body?.productId;
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      if (productId) {
        await prisma.cartItem.deleteMany({
          where: { cartId: cart.id, productId }
        });
      } else {
        await prisma.cartItem.deleteMany({
          where: { cartId: cart.id }
        });
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('clearCart error:', error);
    return res.status(500).json({ error: 'Gagal mengosongkan keranjang' });
  }
}

export async function mergeCart(req, res) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Pengguna tidak terautentikasi' });
    }

    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, message: 'Tidak ada item untuk digabung' });
    }

    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    for (const item of items) {
      const productId = item.productId || item.id;
      const quantity = parseInt(item.quantity, 10) || 1;
      if (!productId || quantity <= 0) continue;

      const existingItem = await prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } }
      });

      if (existingItem) {
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + quantity }
        });
      } else {
        await prisma.cartItem.create({
          data: { cartId: cart.id, productId, quantity }
        });
      }
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    const formattedItems = (updatedCart?.items || []).map(item => ({
      id: item.productId,
      cartItemId: item.id,
      productId: item.productId,
      quantity: item.quantity,
      product: item.product || {},
      ...(item.product || {})
    }));

    return res.json({ success: true, items: formattedItems });
  } catch (error) {
    console.error('mergeCart error:', error);
    return res.status(500).json({ error: 'Gagal menggabungkan keranjang' });
  }
}


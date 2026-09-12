import prisma from '../services/prisma.js';
import { getAuthenticatedUserId } from '../middleware/auth.js';

async function getUserId(req) {
  if (req.userId) return req.userId;
  return await getAuthenticatedUserId(req);
}

export async function getWishlist(req, res) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.json([]);
    }

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: { category: true }
            }
          }
        }
      }
    });

    if (!wishlist || !wishlist.items) {
      return res.json([]);
    }

    const items = wishlist.items.map(item => ({
      id: item.id,
      productId: item.productId,
      createdAt: item.createdAt,
      product: item.product || {},
      ...(item.product || {})
    }));

    return res.json(items);
  } catch (error) {
    console.error('getWishlist error:', error);
    return res.status(500).json({ error: 'Gagal memuat wishlist' });
  }
}

export async function addToWishlist(req, res) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Pengguna tidak terautentikasi' });
    }

    const { productId } = req.body || {};
    if (!productId) {
      return res.status(400).json({ error: 'ID produk wajib diisi' });
    }

    let wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({ data: { userId } });
    }

    const existing = await prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } }
    });

    if (!existing) {
      await prisma.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId
        }
      });
    }

    return res.json({ success: true, message: 'Berhasil ditambahkan ke wishlist' });
  } catch (error) {
    console.error('addToWishlist error:', error);
    return res.status(500).json({ error: 'Gagal menambahkan ke wishlist' });
  }
}

export async function removeFromWishlist(req, res) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Pengguna tidak terautentikasi' });
    }

    const productId = req.params.productId || req.query.productId || req.body?.productId;
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (wishlist && productId) {
      await prisma.wishlistItem.deleteMany({
        where: { wishlistId: wishlist.id, productId }
      });
    }

    return res.json({ success: true, message: 'Berhasil dihapus dari wishlist' });
  } catch (error) {
    console.error('removeFromWishlist error:', error);
    return res.status(500).json({ error: 'Gagal menghapus dari wishlist' });
  }
}

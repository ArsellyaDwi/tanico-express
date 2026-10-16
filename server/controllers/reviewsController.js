import prisma from '../services/prisma.js';
import { extractToken, resolveUser } from '../middleware/auth.js';
import { verifySessionToken } from '../services/tokenService.js';

export async function getReviews(req, res) {
  try {
    const { productId, status, all } = req.query;

    const user = await resolveUser(req).catch(() => null);
    const currentUserId = user?.id || null;
    const roleUpper = (typeof user?.role === 'object' ? user?.role?.name : user?.role || '').toUpperCase();
    const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN';

    const where = {};
    if (productId) where.productId = productId;
    if (status) {
      where.status = status;
    } else if (all === 'true' && isAdmin) {
      // Admin inspection can view all
    } else if (currentUserId) {
      // Author sees approved reviews AND their own submitted reviews (even if Pending)
      where.OR = [
        { status: { in: ['Disetujui', 'Approved', 'disetujui'] } },
        { userId: currentUserId }
      ];
    } else {
      where.status = { in: ['Disetujui', 'Approved', 'disetujui'] };
    }

    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return res.json(reviews || []);
  } catch (error) {
    console.error('getReviews error:', error);
    return res.status(500).json({ error: 'Gagal memuat ulasan' });
  }
}

export async function createReview(req, res) {
  try {
    const {
      productId,
      productName,
      rating,
      comment,
      customerName
    } = req.body || {};

    const user = await resolveUser(req);
    let resolvedUserId = user?.id || null;
    let resolvedName = customerName || user?.name || user?.email || 'Pelanggan TaniCo';
    let resolvedAvatar = user?.avatar || user?.image || '';
    let isAdmin = false;

    if (user) {
      const roleUpper = (typeof user.role === 'object' ? user.role?.name : user.role || '').toUpperCase();
      if (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') {
        isAdmin = true;
      }
    }

    if (!resolvedUserId) {
      return res.status(401).json({ error: 'Silakan masuk terlebih dahulu untuk menulis ulasan produk.' });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Komentar ulasan wajib diisi' });
    }

    const numRating = parseInt(rating, 10);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Nilai rating harus antara 1 sampai 5 bintang.' });
    }

    let finalProductName = productName || '';
    if (!finalProductName && productId) {
      const prod = await prisma.product.findUnique({ where: { id: productId } }).catch(() => null);
      if (prod) finalProductName = prod.name;
    }

    const newReview = await prisma.review.create({
      data: {
        productId: productId || null,
        productName: finalProductName || 'Produk TaniCo',
        customerName: resolvedName.trim(),
        userId: resolvedUserId,
        userAvatar: resolvedAvatar,
        rating: Math.min(5, Math.max(1, numRating)),
        comment: comment.trim(),
        status: isAdmin ? (req.body?.status || 'Approved') : 'Pending'
      }
    });

    return res.status(201).json(newReview);
  } catch (error) {
    console.error('createReview error:', error);
    return res.status(500).json({ error: 'Gagal mengirimkan ulasan' });
  }
}

export async function updateReview(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID ulasan diperlukan' });

    const { rating, comment, status, reply, adminReply } = req.body || {};
    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...(rating !== undefined && { rating: Number(rating) }),
        ...(comment !== undefined && { comment }),
        ...(status !== undefined && { status }),
        ...(reply !== undefined && { reply }),
        ...(adminReply !== undefined && { adminReply, adminReplyAt: new Date() })
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('updateReview error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui ulasan' });
  }
}

export async function deleteReview(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID ulasan diperlukan' });

    await prisma.review.delete({ where: { id } });
    return res.json({ success: true, message: 'Ulasan berhasil dihapus' });
  } catch (error) {
    console.error('deleteReview error:', error);
    return res.status(500).json({ error: 'Gagal menghapus ulasan' });
  }
}

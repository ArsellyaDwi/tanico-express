import prisma from '../services/prisma.js';
import { extractToken } from '../middleware/auth.js';
import { verifySessionToken } from '../services/tokenService.js';

export async function getReviews(req, res) {
  try {
    const { productId, status, all } = req.query;

    const where = {};
    if (productId) where.productId = productId;
    if (status) {
      where.status = status;
    } else if (all !== 'true') {
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
      customerName,
      name,
      userId,
      userAvatar,
      rating,
      comment,
      status
    } = req.body || {};

    let resolvedUserId = userId || null;
    let resolvedName = (customerName || name || '').trim();
    let resolvedAvatar = userAvatar || '';

    // If no name or userId provided, check authorization token
    const token = extractToken(req);
    if (token) {
      const payload = await verifySessionToken(token);
      if (payload?.id) {
        resolvedUserId = resolvedUserId || payload.id;
        resolvedName = resolvedName || payload.name || payload.email || '';
      }
    }

    if (!resolvedName && resolvedUserId) {
      const user = await prisma.user.findUnique({ where: { id: resolvedUserId } }).catch(() => null);
      if (user) {
        resolvedName = user.name || user.email;
        resolvedAvatar = resolvedAvatar || user.avatar || '';
      }
    }

    if (!resolvedName) {
      resolvedName = 'Pelanggan TaniCo';
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Komentar ulasan wajib diisi' });
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
        customerName: resolvedName,
        userId: resolvedUserId,
        userAvatar: resolvedAvatar,
        rating: Math.min(5, Math.max(1, parseInt(rating, 10) || 5)),
        comment: comment.trim(),
        status: status || 'Pending'
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

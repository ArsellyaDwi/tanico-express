import prisma from '../services/prisma.js';
import { clearHomeCache } from '../services/cache.js';
import { safeDeleteFileFromSupabase, handleMediaReplacement } from '../services/supabase.js';

export async function getTestimonials(req, res) {
  try {
    const { all } = req.query;
    const where = all === 'true' ? {} : { active: true };
    const testimonials = await prisma.testimonial.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
    });
    return res.json(testimonials || []);
  } catch (error) {
    console.error('getTestimonials error:', error);
    return res.status(500).json({ error: 'Gagal memuat testimoni' });
  }
}

export async function createTestimonial(req, res) {
  try {
    const body = req.body || {};

    // Bulk Sync Mode
    if (Array.isArray(body.testimonials) || Array.isArray(body.list)) {
      const list = body.testimonials || body.list;
      const existing = await prisma.testimonial.findMany();
      const existingMap = new Map(existing.map(t => [t.id, t]));

      const incomingValidIds = new Set();
      list.forEach(t => {
        if (t.id && existingMap.has(t.id)) {
          incomingValidIds.add(t.id);
        }
      });

      const itemsToDelete = existing.filter(t => !incomingValidIds.has(t.id));
      if (itemsToDelete.length > 0) {
        const idsToDelete = itemsToDelete.map(t => t.id);
        await prisma.testimonial.deleteMany({
          where: { id: { in: idsToDelete } }
        });
        for (const item of itemsToDelete) {
          if (item.avatar) await safeDeleteFileFromSupabase(item.avatar, 'testimonials').catch(() => {});
        }
      }

      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        const oldT = t.id ? existingMap.get(t.id) : null;
        const tName = t.name || `Pelanggan ${i + 1}`;
        const tComment = t.comment || t.review || t.content || '';
        const tData = {
          name: tName,
          role: t.role || 'Pelanggan Setia',
          location: t.location || t.city || '',
          comment: tComment,
          rating: Number(t.rating) || 5,
          avatar: t.avatar || '',
          active: t.active !== false,
          sortOrder: Number(t.sortOrder) || i
        };

        if (t.id && oldT) {
          await prisma.testimonial.update({
            where: { id: t.id },
            data: tData
          });
          if (t.avatar !== undefined && oldT.avatar && oldT.avatar !== t.avatar) {
            await handleMediaReplacement(oldT.avatar, t.avatar, 'testimonials').catch(() => {});
          }
        } else {
          await prisma.testimonial.create({
            data: tData
          });
        }
      }

      clearHomeCache();
      const updatedList = await prisma.testimonial.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
      });
      return res.json(updatedList);
    }

    // Single Create Mode
    const { name, role, comment, review, content, rating, avatar, location, active, sortOrder } = body;
    const finalComment = typeof comment === 'string' ? comment : (typeof review === 'string' ? review : (typeof content === 'string' ? content : ''));

    if (!name?.trim() || !finalComment?.trim()) {
      return res.status(400).json({ error: 'Nama dan ulasan testimoni wajib diisi' });
    }

    const newTestimonial = await prisma.testimonial.create({
      data: {
        name: name.trim(),
        role: (role || 'Pelanggan Setia').trim(),
        comment: finalComment.trim(),
        rating: Number(rating) || 5,
        avatar: avatar || '',
        location: (location || '').trim(),
        active: active !== false,
        sortOrder: Number(sortOrder) || 0
      }
    });

    clearHomeCache();
    return res.status(201).json(newTestimonial);
  } catch (error) {
    console.error('createTestimonial error:', error);
    return res.status(500).json({ error: 'Gagal membuat testimoni' });
  }
}

export async function updateTestimonial(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID testimoni diperlukan' });

    const existing = await prisma.testimonial.findUnique({ where: { id } });

    const body = req.body || {};
    const finalComment = body.comment !== undefined ? body.comment : (body.review !== undefined ? body.review : body.content);

    const updated = await prisma.testimonial.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.role !== undefined && { role: body.role.trim() }),
        ...(finalComment !== undefined && { comment: finalComment.trim() }),
        ...(body.rating !== undefined && { rating: Number(body.rating) }),
        ...(body.avatar !== undefined && { avatar: body.avatar }),
        ...(body.location !== undefined && { location: body.location.trim() }),
        ...(body.active !== undefined && { active: Boolean(body.active) }),
        ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) })
      }
    });

    if (body.avatar !== undefined && existing?.avatar && existing.avatar !== body.avatar) {
      await handleMediaReplacement(existing.avatar, body.avatar, 'testimonials').catch(() => {});
    }

    clearHomeCache();
    return res.json(updated);
  } catch (error) {
    console.error('updateTestimonial error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui testimoni' });
  }
}

export async function deleteTestimonial(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID testimoni diperlukan' });

    const item = await prisma.testimonial.findUnique({ where: { id } });
    await prisma.testimonial.delete({ where: { id } });

    if (item?.avatar) {
      await safeDeleteFileFromSupabase(item.avatar, 'testimonials').catch(() => {});
    }

    clearHomeCache();
    return res.json({ success: true, message: 'Testimoni berhasil dihapus' });
  } catch (error) {
    console.error('deleteTestimonial error:', error);
    return res.status(500).json({ error: 'Gagal menghapus testimoni' });
  }
}

import prisma from '../services/prisma.js';
import { clearHomeCache } from '../services/cache.js';
import { safeDeleteFileFromSupabase, handleMediaReplacement } from '../services/supabase.js';

export async function getGallery(req, res) {
  try {
    const { all } = req.query;
    const where = all === 'true' ? {} : { active: true };
    const gallery = await prisma.gallery.findMany({
      where,
      orderBy: { sortOrder: 'asc' }
    });
    return res.json(gallery || []);
  } catch (error) {
    console.error('getGallery error:', error);
    return res.status(500).json({ error: 'Gagal memuat galeri' });
  }
}

export async function createGallery(req, res) {
  try {
    const { image, title, span, active, sortOrder } = req.body || {};
    if (!image || !title) {
      return res.status(400).json({ error: 'Gambar dan judul galeri wajib diisi' });
    }

    const newItem = await prisma.gallery.create({
      data: {
        image,
        title,
        span: span || 'col-span-1',
        active: active !== false,
        sortOrder: Number(sortOrder) || 0
      }
    });

    clearHomeCache();
    return res.status(201).json(newItem);
  } catch (error) {
    console.error('createGallery error:', error);
    return res.status(500).json({ error: 'Gagal menyimpan galeri' });
  }
}

export async function updateGallery(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID galeri diperlukan' });

    const existing = await prisma.gallery.findUnique({ where: { id } });

    const { image, title, span, active, sortOrder } = req.body || {};
    const updated = await prisma.gallery.update({
      where: { id },
      data: {
        ...(image !== undefined && { image }),
        ...(title !== undefined && { title }),
        ...(span !== undefined && { span }),
        ...(active !== undefined && { active }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) })
      }
    });

    if (image !== undefined && existing?.image && existing.image !== image) {
      await handleMediaReplacement(existing.image, image, 'gallery').catch(() => {});
    }

    clearHomeCache();
    return res.json(updated);
  } catch (error) {
    console.error('updateGallery error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui galeri' });
  }
}

export async function deleteGallery(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID galeri diperlukan' });

    const item = await prisma.gallery.findUnique({ where: { id } });
    await prisma.gallery.delete({ where: { id } });

    if (item?.image) {
      await safeDeleteFileFromSupabase(item.image, 'gallery').catch(() => {});
    }

    clearHomeCache();
    return res.json({ success: true, message: 'Item galeri berhasil dihapus' });
  } catch (error) {
    console.error('deleteGallery error:', error);
    return res.status(500).json({ error: 'Gagal menghapus galeri' });
  }
}

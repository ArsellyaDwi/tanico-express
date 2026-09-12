import prisma from '../services/prisma.js';
import { clearHomeCache } from '../services/cache.js';
import { safeDeleteFileFromSupabase, handleMediaReplacement } from '../services/supabase.js';

export async function getPartners(req, res) {
  try {
    const { all } = req.query;
    const where = all === 'true' ? {} : { active: true };
    const partners = await prisma.partner.findMany({
      where,
      orderBy: { sortOrder: 'asc' }
    });
    return res.json(partners || []);
  } catch (error) {
    console.error('getPartners error:', error);
    return res.status(500).json({ error: 'Gagal memuat mitra' });
  }
}

export async function createPartner(req, res) {
  try {
    const body = req.body || {};

    // Bulk Sync Mode
    const list = Array.isArray(body) ? body : (Array.isArray(body.list) ? body.list : null);
    if (list) {
      const existing = await prisma.partner.findMany();
      const existingMap = new Map(existing.map(p => [p.id, p]));

      const incomingValidIds = new Set();
      list.forEach(p => {
        if (p.id && existingMap.has(p.id)) incomingValidIds.add(p.id);
      });

      const itemsToDelete = existing.filter(p => !incomingValidIds.has(p.id));
      if (itemsToDelete.length > 0) {
        const idsToDelete = itemsToDelete.map(p => p.id);
        await prisma.partner.deleteMany({ where: { id: { in: idsToDelete } } });
        for (const p of itemsToDelete) {
          if (p.logo) await safeDeleteFileFromSupabase(p.logo, 'partners').catch(() => {});
        }
      }

      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const oldP = p.id ? existingMap.get(p.id) : null;
        const logoVal = p.logo || p.image || p.imageUrl || '';
        const pData = {
          name: p.name || `Mitra ${i + 1}`,
          logo: logoVal,
          location: p.location || '',
          description: p.description ?? p.desc ?? '',
          website: p.website ?? p.url ?? '',
          active: p.active !== false,
          sortOrder: Number(p.sortOrder ?? p.order) || i
        };

        if (p.id && oldP) {
          await prisma.partner.update({ where: { id: p.id }, data: pData });
          if (logoVal && oldP.logo && oldP.logo !== logoVal) {
            await handleMediaReplacement(oldP.logo, logoVal, 'partners').catch(() => {});
          }
        } else {
          await prisma.partner.create({ data: pData });
        }
      }

      clearHomeCache();
      const updated = await prisma.partner.findMany({ orderBy: { sortOrder: 'asc' } });
      return res.json(updated);
    }

    const { name, logo, image, imageUrl, location, description, website, active, sortOrder } = body;
    if (!name) {
      return res.status(400).json({ error: 'Nama mitra wajib diisi' });
    }

    const logoVal = logo || image || imageUrl || '';

    const newPartner = await prisma.partner.create({
      data: {
        name: name.trim(),
        logo: logoVal,
        location: location || '',
        description: description || '',
        website: website || '',
        active: active !== false,
        sortOrder: Number(sortOrder) || 0
      }
    });

    clearHomeCache();
    return res.status(201).json(newPartner);
  } catch (error) {
    console.error('createPartner error:', error);
    return res.status(500).json({ error: 'Gagal menyimpan mitra' });
  }
}

export async function updatePartner(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID mitra diperlukan' });

    const existing = await prisma.partner.findUnique({ where: { id } });

    const { name, logo, image, imageUrl, location, description, website, active, sortOrder } = req.body || {};
    const logoVal = logo !== undefined ? logo : (image !== undefined ? image : (imageUrl !== undefined ? imageUrl : undefined));
    const updated = await prisma.partner.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(logoVal !== undefined && { logo: logoVal }),
        ...(location !== undefined && { location }),
        ...(description !== undefined && { description }),
        ...(website !== undefined && { website }),
        ...(active !== undefined && { active: Boolean(active) }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) })
      }
    });

    if (logoVal !== undefined && existing?.logo && existing.logo !== logoVal) {
      await handleMediaReplacement(existing.logo, logoVal, 'partners').catch(() => {});
    }

    clearHomeCache();
    return res.json(updated);
  } catch (error) {
    console.error('updatePartner error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui mitra' });
  }
}

export async function deletePartner(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID mitra diperlukan' });

    const partner = await prisma.partner.findUnique({ where: { id } });
    await prisma.partner.delete({ where: { id } });

    if (partner?.logo) {
      await safeDeleteFileFromSupabase(partner.logo, 'partners').catch(() => {});
    }

    clearHomeCache();
    return res.json({ success: true, message: 'Mitra berhasil dihapus' });
  } catch (error) {
    console.error('deletePartner error:', error);
    return res.status(500).json({ error: 'Gagal menghapus mitra' });
  }
}

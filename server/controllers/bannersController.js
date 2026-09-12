import prisma from '../services/prisma.js';
import { clearHomeCache } from '../services/cache.js';
import { safeDeleteFileFromSupabase, handleMediaReplacement } from '../services/supabase.js';

// ==================== HERO BANNERS ====================

export async function getHeroBanners(req, res) {
  try {
    const { all } = req.query;
    const where = all === 'true' ? {} : { active: true };
    const banners = await prisma.heroBanner.findMany({
      where,
      orderBy: { sortOrder: 'asc' }
    });
    const formatted = (banners || []).map(b => {
      const desk = b.desktopImage || b.image || b.mobileImage || '';
      const mob = b.mobileImage || b.desktopImage || b.image || '';
      return {
        ...b,
        image: desk || mob,
        desktopImage: desk || mob,
        mobileImage: mob || desk,
        active: b.active !== false
      };
    });
    return res.json(formatted);
  } catch (error) {
    console.error('getHeroBanners error:', error);
    return res.status(500).json({ error: 'Gagal memuat hero banners' });
  }
}

export async function createHeroBanner(req, res) {
  try {
    const body = req.body || {};

    // Bulk Sync Mode
    if (Array.isArray(body.slides)) {
      const slides = body.slides;
      const existingBanners = await prisma.heroBanner.findMany();
      const existingMap = new Map(existingBanners.map(b => [b.id, b]));

      // Protection: if slides is empty, do NOT wipe existing banners (prevent empty CMS overwrites)
      if (slides.length === 0) {
        const currentBanners = await prisma.heroBanner.findMany({
          orderBy: { sortOrder: 'asc' }
        });
        return res.json(currentBanners);
      }

      const incomingValidIds = new Set();
      slides.forEach(s => {
        if (s.id && existingMap.has(s.id)) {
          incomingValidIds.add(s.id);
        }
      });

      const itemsToDelete = existingBanners.filter(b => !incomingValidIds.has(b.id));
      if (itemsToDelete.length > 0 && incomingValidIds.size > 0) {
        const idsToDelete = itemsToDelete.map(b => b.id);
        await prisma.heroBanner.deleteMany({
          where: { id: { in: idsToDelete } }
        });
        // Note: Retain Supabase Storage files per retention policy
      }

      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        const oldSlide = (s.id && existingMap.has(s.id)) ? existingMap.get(s.id) : null;
        const sTitle = s.title || `Slide ${i + 1}`;

        let sDesk = s.desktopImage || s.image || '';
        let sMob = s.mobileImage || '';

        // Preserve existing image if incoming image is empty and not explicitly removed
        if (oldSlide) {
          if (s.removeImage === true || s.removeDesktopImage === true) {
            sDesk = '';
          } else if (!sDesk && (oldSlide.desktopImage || oldSlide.image)) {
            sDesk = oldSlide.desktopImage || oldSlide.image;
          }

          if (s.removeMobileImage === true) {
            sMob = '';
          } else if (!sMob && oldSlide.mobileImage) {
            sMob = oldSlide.mobileImage;
          } else if (!sMob) {
            sMob = sDesk;
          }
        } else {
          if (!sMob) sMob = sDesk;
        }

        const sData = {
          title: sTitle,
          subtitle: s.subtitle || '',
          badge: s.badge || '',
          description: s.description || '',
          buttonText: s.buttonText || '',
          buttonLink: s.buttonLink || '',
          image: sDesk,
          desktopImage: sDesk,
          mobileImage: sMob,
          active: s.active !== false,
          background: s.background || '#ECF6ED',
          overlay: Number(s.overlay) || 0,
          cropPosition: s.cropPosition || 'center center',
          cropZoom: String(s.cropZoom || '100'),
          desktopCrop: s.desktopCrop || s.cropPosition || 'center center',
          desktopZoom: String(s.desktopZoom || s.cropZoom || '100'),
          mobileCrop: s.mobileCrop || s.cropPosition || 'center center',
          mobileZoom: String(s.mobileZoom || s.cropZoom || '100'),
          sortOrder: Number(s.sortOrder) || i
        };

        if (oldSlide) {
          await prisma.heroBanner.update({
            where: { id: s.id },
            data: sData
          });
        } else {
          await prisma.heroBanner.create({
            data: sData
          });
        }
      }

      clearHomeCache();
      const updatedBanners = await prisma.heroBanner.findMany({
        orderBy: { sortOrder: 'asc' }
      });
      return res.json(updatedBanners);
    }

    // Single Create Mode
    const rawImage = body.image || body.desktopImage || '';
    const rawMob = body.mobileImage || rawImage;

    const newBanner = await prisma.heroBanner.create({
      data: {
        title: body.title || 'Hero Banner',
        subtitle: body.subtitle || '',
        badge: body.badge || '',
        description: body.description || '',
        buttonText: body.buttonText || '',
        buttonLink: body.buttonLink || '',
        image: rawImage,
        desktopImage: rawImage,
        mobileImage: rawMob,
        active: body.active !== false,
        background: body.background || '#ECF6ED',
        overlay: Number(body.overlay) || 0,
        cropPosition: body.cropPosition || 'center center',
        cropZoom: String(body.cropZoom || '100'),
        desktopCrop: body.desktopCrop || 'center center',
        desktopZoom: String(body.desktopZoom || '100'),
        mobileCrop: body.mobileCrop || 'center center',
        mobileZoom: String(body.mobileZoom || '100'),
        sortOrder: Number(body.sortOrder) || 0
      }
    });

    clearHomeCache();
    return res.status(201).json(newBanner);
  } catch (error) {
    console.error('createHeroBanner error:', error);
    return res.status(500).json({ error: 'Gagal membuat hero banner' });
  }
}

export async function updateHeroBanner(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID Hero Banner diperlukan' });

    const existing = await prisma.heroBanner.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Hero Banner tidak ditemukan' });

    const data = req.body || {};

    let nextDesk = existing.desktopImage;
    if (data.removeDesktopImage === true || data.removeImage === true) {
      nextDesk = '';
    } else if (data.desktopImage !== undefined && data.desktopImage !== '') {
      nextDesk = data.desktopImage;
    } else if (data.image !== undefined && data.image !== '') {
      nextDesk = data.image;
    }

    let nextMob = existing.mobileImage;
    if (data.removeMobileImage === true) {
      nextMob = '';
    } else if (data.mobileImage !== undefined && data.mobileImage !== '') {
      nextMob = data.mobileImage;
    } else if (data.mobileImage === undefined && nextDesk) {
      nextMob = nextDesk;
    }

    const updated = await prisma.heroBanner.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.subtitle !== undefined && { subtitle: data.subtitle }),
        ...(data.badge !== undefined && { badge: data.badge }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.buttonText !== undefined && { buttonText: data.buttonText }),
        ...(data.buttonLink !== undefined && { buttonLink: data.buttonLink }),
        image: nextDesk,
        desktopImage: nextDesk,
        mobileImage: nextMob,
        ...(data.active !== undefined && { active: Boolean(data.active) }),
        ...(data.background !== undefined && { background: data.background }),
        ...(data.overlay !== undefined && { overlay: Number(data.overlay) }),
        ...(data.cropPosition !== undefined && { cropPosition: data.cropPosition }),
        ...(data.cropZoom !== undefined && { cropZoom: String(data.cropZoom) }),
        ...(data.desktopCrop !== undefined && { desktopCrop: data.desktopCrop }),
        ...(data.desktopZoom !== undefined && { desktopZoom: String(data.desktopZoom) }),
        ...(data.mobileCrop !== undefined && { mobileCrop: data.mobileCrop }),
        ...(data.mobileZoom !== undefined && { mobileZoom: String(data.mobileZoom) }),
        ...(data.sortOrder !== undefined && { sortOrder: Number(data.sortOrder) })
      }
    });

    clearHomeCache();
    return res.json(updated);
  } catch (error) {
    console.error('updateHeroBanner error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui hero banner' });
  }
}

export async function deleteHeroBanner(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID Hero Banner diperlukan' });

    const banner = await prisma.heroBanner.findUnique({ where: { id } });
    await prisma.heroBanner.delete({ where: { id } });

    if (banner?.image) await safeDeleteFileFromSupabase(banner.image, 'hero').catch(() => {});
    if (banner?.desktopImage) await safeDeleteFileFromSupabase(banner.desktopImage, 'hero').catch(() => {});
    if (banner?.mobileImage) await safeDeleteFileFromSupabase(banner.mobileImage, 'hero').catch(() => {});
    if (banner?.background) await safeDeleteFileFromSupabase(banner.background, 'hero').catch(() => {});

    clearHomeCache();
    return res.json({ success: true, message: 'Hero banner berhasil dihapus' });
  } catch (error) {
    console.error('deleteHeroBanner error:', error);
    return res.status(500).json({ error: 'Gagal menghapus hero banner' });
  }
}

// ==================== HERO BENEFITS ====================

export async function getHeroBenefits(req, res) {
  try {
    const { all } = req.query;
    const where = all === 'true' ? {} : { active: true };
    const benefits = await prisma.heroBenefit.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    const formatted = (benefits || []).map(b => {
      const title = b.title || b.value || '';
      const description = b.description || b.label || '';
      return {
        id: b.id,
        title,
        description,
        value: title,
        label: description,
        image: b.image || '',
        sortOrder: typeof b.sortOrder === 'number' ? b.sortOrder : 0,
        active: b.active !== false,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error('getHeroBenefits error:', error);
    return res.status(500).json({ error: 'Gagal memuat hero benefits' });
  }
}

export async function createHeroBenefit(req, res) {
  try {
    const body = req.body || {};
    const items = Array.isArray(body) ? body : (Array.isArray(body.benefits) ? body.benefits : null);

    if (items) {
      const existingBenefits = await prisma.heroBenefit.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
      });
      const existingById = new Map(existingBenefits.map(b => [b.id, b]));
      const existingBySortOrder = new Map();
      for (const b of existingBenefits) {
        if (!existingBySortOrder.has(b.sortOrder)) {
          existingBySortOrder.set(b.sortOrder, b);
        }
      }

      // Protection: if items is empty, do NOT wipe existing benefits
      if (items.length === 0) {
        const currentBenefits = await prisma.heroBenefit.findMany({
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
        });
        return res.json(currentBenefits);
      }

      // Stable matching:
      // 1. Match by id if provided and exists
      // 2. Match by sortOrder (0, 1, 2, 3) if id is missing or not matched
      // DO NOT delete records simply because frontend did not provide IDs
      const matchedIds = new Set();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const targetSortOrder = typeof item.sortOrder === 'number' ? item.sortOrder : i;

        let matchedBenefit = null;
        if (item.id && existingById.has(item.id)) {
          matchedBenefit = existingById.get(item.id);
        } else if (existingBySortOrder.has(targetSortOrder)) {
          matchedBenefit = existingBySortOrder.get(targetSortOrder);
        }

        const title = (item.title || item.value || (matchedBenefit ? (matchedBenefit.title || matchedBenefit.value) : '') || '').trim();
        const description = (item.description || item.label || (matchedBenefit ? (matchedBenefit.description || matchedBenefit.label) : '') || '').trim();

        let itemImage = item.image || '';
        if (matchedBenefit) {
          if (item.removeImage === true) {
            itemImage = '';
          } else if (!itemImage && matchedBenefit.image) {
            itemImage = matchedBenefit.image;
          }
        }

        const bData = {
          title: title || (matchedBenefit?.title ?? ''),
          description: description || (matchedBenefit?.description ?? ''),
          value: title || (matchedBenefit?.value ?? ''),
          label: description || (matchedBenefit?.label ?? ''),
          image: itemImage,
          sortOrder: targetSortOrder,
          active: item.active !== false
        };

        if (matchedBenefit) {
          matchedIds.add(matchedBenefit.id);
          await prisma.heroBenefit.update({
            where: { id: matchedBenefit.id },
            data: bData
          });
        } else {
          const created = await prisma.heroBenefit.create({
            data: bData
          });
          matchedIds.add(created.id);
        }
      }

      // Clean up any duplicate records that share sortOrders with updated cards but were not matched
      const incomingSortOrders = new Set(items.map((it, idx) => typeof it.sortOrder === 'number' ? it.sortOrder : idx));
      const duplicateIdsToDelete = existingBenefits
        .filter(b => !matchedIds.has(b.id) && incomingSortOrders.has(b.sortOrder))
        .map(b => b.id);

      if (duplicateIdsToDelete.length > 0) {
        await prisma.heroBenefit.deleteMany({
          where: { id: { in: duplicateIdsToDelete } }
        });
      }

      clearHomeCache();
      const allBenefits = await prisma.heroBenefit.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
      });

      const formatted = allBenefits.map(b => {
        const title = b.title || b.value || '';
        const description = b.description || b.label || '';
        return {
          id: b.id,
          title,
          description,
          value: title,
          label: description,
          image: b.image || '',
          sortOrder: typeof b.sortOrder === 'number' ? b.sortOrder : 0,
          active: b.active !== false,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt
        };
      });

      return res.json(formatted);
    }

    const title = (body.title || body.value || '').trim();
    const description = (body.description || body.label || '').trim();
    if (!title || !description) {
      return res.status(400).json({ error: 'Title dan description wajib diisi' });
    }

    const newBenefit = await prisma.heroBenefit.create({
      data: {
        title,
        description,
        value: title,
        label: description,
        image: body.image || '',
        sortOrder: Number(body.sortOrder) || 0,
        active: body.active !== false
      }
    });

    clearHomeCache();
    return res.status(201).json(newBenefit);
  } catch (error) {
    console.error('createHeroBenefit error:', error);
    return res.status(500).json({ error: 'Gagal membuat kartu manfaat' });
  }
}

export async function updateHeroBenefit(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID Kartu Manfaat diperlukan' });

    const existing = await prisma.heroBenefit.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Kartu Manfaat tidak ditemukan' });

    const body = req.body || {};
    const updateData = {};
    if (body.title !== undefined || body.value !== undefined) {
      const val = String(body.title !== undefined ? body.title : body.value).trim();
      updateData.title = val;
      updateData.value = val;
    }
    if (body.description !== undefined || body.label !== undefined) {
      const lbl = String(body.description !== undefined ? body.description : body.label).trim();
      updateData.description = lbl;
      updateData.label = lbl;
    }
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder);
    if (body.active !== undefined) updateData.active = Boolean(body.active);

    if (body.removeImage === true) {
      updateData.image = '';
    } else if (body.image !== undefined && body.image !== '') {
      updateData.image = body.image;
    }

    const updated = await prisma.heroBenefit.update({
      where: { id },
      data: updateData
    });

    clearHomeCache();
    return res.json(updated);
  } catch (error) {
    console.error('updateHeroBenefit error:', error);
    return res.status(500).json({ error: 'Gagal memperbarui kartu manfaat' });
  }
}

export async function deleteHeroBenefit(req, res) {
  try {
    const id = req.params.id || req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'ID Kartu Manfaat diperlukan' });

    const benefit = await prisma.heroBenefit.findUnique({ where: { id } });
    await prisma.heroBenefit.delete({ where: { id } });

    if (benefit?.image) {
      await safeDeleteFileFromSupabase(benefit.image, 'hero').catch(() => {});
    }

    clearHomeCache();
    return res.json({ success: true, message: 'Kartu manfaat berhasil dihapus' });
  } catch (error) {
    console.error('deleteHeroBenefit error:', error);
    return res.status(500).json({ error: 'Gagal menghapus kartu manfaat' });
  }
}

import prisma from '../services/prisma.js';
import { getCacheItem, setCacheItem } from '../services/cache.js';

function getHomepageCms(customCms = {}) {
  return {
    hero: {
      badge: '100% Organik & Segar',
      title: 'Sayur Segar Berkualitas dari Petani Lokal Bangka',
      subtitle: 'Dipanen pagi hari, dikemas higienis, dan dikirim langsung ke rumah Anda di hari yang sama.',
      ctaText: 'Belanja Sekarang',
      ctaLink: '/products',
      show: true,
      ...(customCms.hero || {})
    },
    featured: {
      badge: 'Pilihan Terbaik',
      title: 'Produk Segar Terpopuler',
      subtitle: 'Sayuran dan buah organik segar favorit keluarga Indonesia.',
      show: true,
      limit: 8,
      ...(customCms.featured || {})
    },
    umkm: {
      badge: 'Kisah Kami',
      title: 'Mendukung Petani Lokal & Pertanian Berkelanjutan',
      subtitle: 'Setiap pembelian Anda berkontribusi langsung pada kesejahteraan keluarga petani di Bangka.',
      show: true,
      ...(customCms.umkm || {})
    },
    gallery: {
      badge: 'Galeri Kebun',
      title: 'Aktivitas & Kebun TaniCo',
      subtitle: 'Intip proses penanaman, panen, dan pengemasan kami.',
      show: true,
      ...(customCms.gallery || {})
    },
    articles: {
      badge: 'Edukasi & Tips',
      title: 'Artikel & Panduan Hidup Sehat',
      subtitle: 'Pelajari resep, tips menjaga kesegaran sayur, dan wawasan nutrisi terbaik.',
      show: true,
      ...(customCms.articles || {})
    }
  };
}

export async function getHomeDataInternal() {
  const cached = getCacheItem('home_data_cache');
  if (cached) return cached;

  try {
    const [
      categories,
      products,
      articles,
      gallery,
      heroBanners,
      heroBenefits,
      setting
    ] = await Promise.all([
      (prisma?.category?.findMany ? prisma.category.findMany({
        where: { status: { notIn: ['Nonaktif', 'nonaktif'] } },
        orderBy: { sortOrder: 'asc' },
        take: 50,
        include: { _count: { select: { products: true } } }
      }) : Promise.resolve([])).catch(() => []),

      (prisma?.product?.findMany ? prisma.product.findMany({
        where: { status: { notIn: ['Nonaktif', 'nonaktif'] } },
        take: 100,
        orderBy: [{ isFeatured: 'desc' }, { soldCount: 'desc' }, { createdAt: 'desc' }],
        include: {
          category: {
            select: { id: true, name: true, slug: true, image: true, status: true }
          }
        }
      }) : Promise.resolve([])).catch(() => []),

      (prisma?.article?.findMany ? prisma.article.findMany({
        where: { status: { notIn: ['Draft', 'Nonaktif', 'draft', 'nonaktif'] } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }) : Promise.resolve([])).catch(() => []),

      (prisma?.gallery?.findMany ? prisma.gallery.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        take: 20
      }) : Promise.resolve([])).catch(() => []),

      (prisma?.heroBanner?.findMany ? prisma.heroBanner.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' }
      }) : Promise.resolve([])).catch(() => []),

      (prisma?.heroBenefit?.findMany ? prisma.heroBenefit.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' }
      }) : Promise.resolve([])).catch(() => []),

      (prisma?.websiteSetting?.findFirst ? prisma.websiteSetting.findFirst() : Promise.resolve(null)).catch(() => null)
    ]);

    let parsedCms = {};
    if (setting?.homepageCMS) {
      try {
        parsedCms = typeof setting.homepageCMS === 'string'
          ? JSON.parse(setting.homepageCMS)
          : setting.homepageCMS;
      } catch (e) {
        parsedCms = {};
      }
    }
    parsedCms = getHomepageCms(parsedCms);

    const formattedProducts = (Array.isArray(products) ? products : []).filter(Boolean).map(p => {
      const catObj = p && typeof p.category === 'object' && p.category !== null ? p.category : null;
      const catName = p?.categoryName || catObj?.name || (typeof p?.category === 'string' ? p.category : 'Hasil Panen');
      return {
        ...p,
        categoryName: catName,
        category: catName,
        categoryObj: catObj
      };
    });

    const formattedBanners = (Array.isArray(heroBanners) ? heroBanners : []).filter(Boolean).map(b => {
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

    const effectiveHeroBenefits = (heroBenefits || []).map(hb => ({
      id: hb.id,
      title: hb.title || hb.value || '',
      description: hb.description || hb.label || '',
      value: hb.title || hb.value || '',
      label: hb.description || hb.label || '',
      image: hb.image || '',
      sortOrder: typeof hb.sortOrder === 'number' ? hb.sortOrder : 0,
      active: hb.active ?? true,
      createdAt: hb.createdAt ? (typeof hb.createdAt === 'string' ? hb.createdAt : hb.createdAt.toISOString()) : null,
      updatedAt: hb.updatedAt ? (typeof hb.updatedAt === 'string' ? hb.updatedAt : hb.updatedAt.toISOString()) : null
    }));

    // Ensure hero CMS slides are populated from active hero banners
    const activeHeroBanners = formattedBanners.length > 0
      ? formattedBanners
      : (Array.isArray(parsedCms.hero?.slides) ? parsedCms.hero.slides.filter(s => s && s.active !== false) : []);

    effectiveHeroBenefits.forEach((hb, idx) => {
      const num = idx + 1;
      if (hb.image) {
        parsedCms.hero[`stat${num}Image`] = hb.image;
      }
      if (hb.title) {
        parsedCms.hero[`stat${num}Value`] = hb.title;
      }
      if (hb.description) {
        parsedCms.hero[`stat${num}Label`] = hb.description;
      }
    });

    parsedCms.hero = {
      ...parsedCms.hero,
      slides: activeHeroBanners,
      benefits: effectiveHeroBenefits
    };

    // Synchronize both cms.featured and cms.featuredProducts so all components receive identical config
    const effectiveFeaturedCms = parsedCms.featuredProducts || parsedCms.featured || {};
    parsedCms.featured = effectiveFeaturedCms;
    parsedCms.featuredProducts = effectiveFeaturedCms;

    const result = {
      settings: {
        ...(setting || {}),
        homepageCMS: parsedCms
      },
      categories: categories || [],
      featuredProducts: formattedProducts,
      products: formattedProducts,
      latestArticles: articles || [],
      articles: articles || [],
      gallery: gallery || [],
      heroBanners: activeHeroBanners,
      heroBenefits: effectiveHeroBenefits,
      homepageCMS: parsedCms
    };

    setCacheItem('home_data_cache', result, 60 * 1000);
    return result;
  } catch (error) {
    console.error('getHomeDataInternal error:', error);
    return {
      settings: { homepageCMS: getHomepageCms({}) },
      categories: [],
      featuredProducts: [],
      products: [],
      latestArticles: [],
      articles: [],
      gallery: [],
      heroBanners: [],
      heroBenefits: [],
      homepageCMS: getHomepageCms({})
    };
  }
}

export async function getHome(req, res) {
  try {
    const data = await getHomeDataInternal();
    return res.json(data);
  } catch (error) {
    console.error('getHome error:', error);
    return res.status(500).json({ error: 'Gagal memuat data beranda' });
  }
}

export async function getAbout(req, res) {
  try {
    const homeData = await getHomeDataInternal();
    return res.json({
      benefits: homeData.heroBenefits || [],
      settings: homeData.settings || null
    });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat data about' });
  }
}

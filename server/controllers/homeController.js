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
    testimonials: {
      badge: 'Ulasan Pelanggan',
      title: 'Apa Kata Mereka Tentang TaniCo',
      subtitle: 'Kepuasan dan kesegaran yang dirasakan langsung oleh pelanggan setia kami.',
      show: true,
      ...(customCms.testimonials || {})
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
      partners,
      testimonials,
      heroBanners,
      heroBenefits,
      setting
    ] = await Promise.all([
      prisma.category.findMany({
        where: { status: { notIn: ['Nonaktif', 'nonaktif'] } },
        orderBy: { sortOrder: 'asc' },
        take: 50,
        include: { _count: { select: { products: true } } }
      }).catch(() => []),

      prisma.product.findMany({
        where: { status: { notIn: ['Nonaktif', 'nonaktif'] } },
        take: 50,
        orderBy: [{ soldCount: 'desc' }, { createdAt: 'desc' }],
        include: {
          category: {
            select: { id: true, name: true, slug: true, image: true, status: true }
          }
        }
      }).catch(() => []),

      prisma.article.findMany({
        where: { status: { notIn: ['Draft', 'Nonaktif', 'draft', 'nonaktif'] } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }).catch(() => []),

      prisma.gallery.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        take: 20
      }).catch(() => []),

      prisma.partner.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        take: 30
      }).catch(() => []),

      prisma.testimonial.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
        take: 20
      }).catch(() => []),

      prisma.heroBanner.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' }
      }).catch(() => []),

      prisma.heroBenefit.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' }
      }).catch(() => []),

      prisma.websiteSetting.findFirst().catch(() => null)
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

    const formattedProducts = (products || []).map(p => {
      const catObj = typeof p.category === 'object' && p.category !== null ? p.category : null;
      const catName = p.categoryName || catObj?.name || (typeof p.category === 'string' ? p.category : 'Hasil Panen');
      return {
        ...p,
        categoryName: catName,
        category: catName,
        categoryObj: catObj
      };
    });

    const formattedBanners = (heroBanners || []).map(b => {
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
      partners: partners || [],
      testimonials: testimonials || [],
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
      partners: [],
      testimonials: [],
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
      partners: homeData.partners || [],
      settings: homeData.settings || null
    });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat data about' });
  }
}

export async function getFarmerStories(req, res) {
  try {
    const homeData = await getHomeDataInternal();
    const articles = homeData.articles || [];
    const mitraArticles = articles.filter(a =>
      a.showOnKisahMitra === true ||
      (a.category && (a.category.toLowerCase().includes('mitra') || a.category.toLowerCase().includes('petani')))
    );
    return res.json({
      farmers: mitraArticles.length > 0 ? mitraArticles : articles.slice(0, 4),
      gallery: homeData.gallery || []
    });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat kisah petani' });
  }
}

import { getApiBaseUrl } from '@/lib/apiBase.js';
import { getHomepageCms } from '@/utils/cmsDefaults.js';
import { logger } from '@/utils/logger.js';
import { getHomeCache, setHomeCache } from '@/lib/cache.js';

export async function getHomeData(options = {}) {
  const { bypassCache = false } = options;
  if (!bypassCache) {
    const cached = getHomeCache();
    if (cached && Array.isArray(cached.heroBanners) && cached.heroBanners.length > 0) {
      return cached;
    }
  }

  try {
    const baseUrl = getApiBaseUrl();
    const fetchOptions = bypassCache
      ? { cache: 'no-store', headers: { 'Accept': 'application/json' } }
      : { next: { revalidate: 30, tags: ['home'] }, headers: { 'Accept': 'application/json' } };

    const res = await fetch(`${baseUrl}/api/home`, fetchOptions);

    if (!res.ok) {
      throw new Error(`Failed to fetch home data from Express: ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Expected JSON but received ${contentType}`);
    }

    const data = await res.json();

    // Fallback: If heroBanners is missing or empty, fetch directly from /api/hero-banners
    if (!Array.isArray(data.heroBanners) || data.heroBanners.length === 0) {
      try {
        const bannersRes = await fetch(`${baseUrl}/api/hero-banners`, fetchOptions);
        if (bannersRes.ok) {
          const banners = await bannersRes.json();
          if (Array.isArray(banners) && banners.length > 0) {
            data.heroBanners = banners;
          }
        }
      } catch (e) {
        logger.error('[HomeLib] Error fetching fallback hero-banners:', e);
      }
    }

    // Fallback: If heroBenefits is missing or empty, fetch directly from /api/hero-benefits
    if (!Array.isArray(data.heroBenefits) || data.heroBenefits.length === 0) {
      try {
        const benefitsRes = await fetch(`${baseUrl}/api/hero-benefits`, fetchOptions);
        if (benefitsRes.ok) {
          const benefits = await benefitsRes.json();
          if (Array.isArray(benefits) && benefits.length > 0) {
            data.heroBenefits = benefits;
          }
        }
      } catch (e) {
        logger.error('[HomeLib] Error fetching fallback hero-benefits:', e);
      }
    }

    // Synchronize hero CMS slides and benefits
    if (!data.homepageCMS) data.homepageCMS = {};
    if (!data.homepageCMS.hero) data.homepageCMS.hero = {};
    if (Array.isArray(data.heroBanners) && data.heroBanners.length > 0) {
      data.homepageCMS.hero.slides = data.heroBanners;
    }
    if (Array.isArray(data.heroBenefits) && data.heroBenefits.length > 0) {
      data.homepageCMS.hero.benefits = data.heroBenefits;
    }

    const effectiveFeatured = data.homepageCMS.featuredProducts || data.homepageCMS.featured || {};
    data.homepageCMS.featured = effectiveFeatured;
    data.homepageCMS.featuredProducts = effectiveFeatured;

    const homeResult = {
      ...data,
      success: true,
      _fetchFailed: false
    };

    setHomeCache(homeResult, 60 * 1000);
    return homeResult;
  } catch (error) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE' || error?.message?.includes('Dynamic server usage')) {
      throw error;
    }
    logger.error('[HomeLib] Error fetching home data from Express API:', error);
    return {
      success: false,
      _fetchFailed: true,
      error: error?.message || 'Gagal terhubung ke backend Express API',
      settings: {},
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

export async function getAboutData() {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/home/about`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    if (err?.digest === 'DYNAMIC_SERVER_USAGE' || err?.message?.includes('Dynamic server usage')) {
      throw err;
    }
    logger.error('[HomeLib] Error fetching about data from Express API:', err);
  }

  const homeData = await getHomeData();
  return {
    benefits: homeData.heroBenefits || [],
    settings: homeData.settings || null
  };
}

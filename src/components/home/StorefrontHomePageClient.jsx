"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

// Core layout & design components
import Hero from '@/components/home/Hero';
import Categories from '@/components/category/Categories';
import FeaturedCarousel from '@/components/home/FeaturedCarousel';
import Gallery from '@/components/home/Gallery';
import { useCart } from '@/context/CartContext';
import PageLayoutWrapper from '@/components/layout/PageLayoutWrapper';

function StorefrontHomePageContent({ initialData = null }) {
  const router = useRouter();
  const { addToCart } = useCart();

  // Determine if initialData from SSR is valid or failed
  const isInitialValid = Boolean(
    initialData &&
    initialData._fetchFailed !== true &&
    initialData.success !== false &&
    Object.keys(initialData).length > 0 &&
    (
      (Array.isArray(initialData.products) && initialData.products.length > 0) ||
      (Array.isArray(initialData.categories) && initialData.categories.length > 0) ||
      (Array.isArray(initialData.heroBanners) && initialData.heroBanners.length > 0) ||
      (initialData.settings && Object.keys(initialData.settings).length > 1)
    )
  );

  const [data, setData] = React.useState(isInitialValid ? initialData : {});
  const [loading, setLoading] = React.useState(!isInitialValid);
  const [fetchError, setFetchError] = React.useState(
    initialData?._fetchFailed ? (initialData.error || 'Gagal memuat data awal dari backend Express') : null
  );

  React.useEffect(() => {
    if (isInitialValid) {
      setData(initialData);
      setLoading(false);
      setFetchError(null);
      return;
    }

    let isMounted = true;
    async function loadHome() {
      try {
        setLoading(true);
        const res = await fetch('/api/home');
        if (res.ok) {
          const fresh = await res.json();
          if (isMounted) {
            setData(fresh || {});
            setFetchError(null);
          }
        } else {
          if (isMounted) {
            setFetchError(`Backend Express merespons status HTTP ${res.status}`);
          }
        }
      } catch (err) {
        console.error('Error fetching /api/home from client:', err);
        if (isMounted) {
          setFetchError(err.message || 'Koneksi ke backend Express terputus');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHome();
    return () => { isMounted = false; };
  }, [initialData, isInitialValid]);

  // Synchronize products when missing or on explicit update event
  React.useEffect(() => {
    let isMounted = true;
    async function syncActiveProducts() {
      try {
        const res = await fetch('/api/products?limit=100', {
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok && isMounted) {
          const fresh = await res.json();
          const list = Array.isArray(fresh) ? fresh : (fresh?.products || fresh?.data || []);
          if (Array.isArray(list) && list.length > 0) {
            setData(prev => ({
              ...prev,
              products: list,
              featuredProducts: list
            }));
          }
        }
      } catch (err) {
        // Keep initialData if network fails
      }
    }

    // Only run on mount if SSR initial products were not provided
    if (!initialData?.products || initialData.products.length === 0) {
      syncActiveProducts();
    }

    const handleUpdate = () => {
      syncActiveProducts();
    };

    window.addEventListener('products_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('products_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const homeData = data || {};

  const handleOpenProductDetail = React.useCallback((p) => {
    if (!p) return;
    const slug = p.slug || (p.name ? p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : '');
    if (slug) router.push(`/produk/${slug}`);
  }, [router]);

  const handleCategorySelect = React.useCallback((cat) => {
    if (!cat) return;
    const catSlug = typeof cat === 'object' ? (cat.slug || cat.name) : cat;
    router.push(`/produk?category=${encodeURIComponent(catSlug)}`);
  }, [router]);

  const handleExploreClick = React.useCallback(() => {
    router.push('/produk');
  }, [router]);

  const products = homeData?.featuredProducts || homeData?.products || [];
  const categories = homeData?.categories || [];
  const gallery = homeData?.gallery || [];
  const rawCms = homeData?.homepageCMS || homeData?.settings?.homepageCMS || {};
  let cms = rawCms;
  if (typeof rawCms === 'string') {
    try {
      cms = JSON.parse(rawCms);
    } catch {
      cms = {};
    }
  }
  const heroBanners = (Array.isArray(homeData?.heroBanners) && homeData.heroBanners.length > 0)
    ? homeData.heroBanners
    : (Array.isArray(cms?.hero?.slides) ? cms.hero.slides : []);
  const heroBenefits = (Array.isArray(homeData?.heroBenefits) && homeData.heroBenefits.length > 0)
    ? homeData.heroBenefits
    : (Array.isArray(cms?.hero?.benefits) ? cms.hero.benefits : []);

  const hasAnyData = products.length > 0 || categories.length > 0 || heroBanners.length > 0;

  const handleRetry = React.useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/home');
      if (res.ok) {
        const fresh = await res.json();
        setData(fresh || {});
        setFetchError(null);
      } else {
        setFetchError(`Backend Express merespons HTTP ${res.status}`);
      }
    } catch (err) {
      setFetchError(err.message || 'Gagal menyambung ke server');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="overflow-hidden bg-[#FCFCFC]">
      {/* Visual Indicator if API Error Occurred */}
      {fetchError && !hasAnyData && (
        <div className="max-w-4xl mx-auto my-12 p-8 bg-amber-50 border border-amber-200 rounded-2xl text-center shadow-xs">
          <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 font-bold text-xl">
            !
          </div>
          <h3 className="text-xl font-bold text-amber-900 mb-2">
            Gagal Terhubung ke Backend API
          </h3>
          <p className="text-sm text-amber-700 max-w-lg mx-auto mb-6">
            Aplikasi tidak dapat memuat data dari Express backend ({fetchError}). Periksa konfigurasi INTERNAL_API_URL dan status koneksi database PostgreSQL di server.
          </p>
          <button
            onClick={handleRetry}
            disabled={loading}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Menghubungkan...' : 'Coba Lagi'}
          </button>
        </div>
      )}

      {/* 1. Hero Section */}
      {cms?.hero?.show !== false && (
        <Hero 
          cms={{
            ...cms?.hero,
            slides: heroBanners,
            benefits: heroBenefits
          }}
          heroBanners={heroBanners}
          heroBenefits={heroBenefits}
          onExploreClick={handleExploreClick}
          isLoading={false}
        />
      )}

      {/* 2. Categories Showcase */}
      {cms?.categories?.show !== false && (
        <Categories
          cms={cms?.categories}
          categories={categories}
          onCategorySelect={handleCategorySelect}
          isLoading={false}
        />
      )}

      {/* 3. Featured Carousel Block */}
      {(cms?.featuredProducts?.show !== false && cms?.featured?.show !== false) && (
        <FeaturedCarousel 
          cms={cms?.featuredProducts || cms?.featured}
          products={products}
          onOpenProductDetail={handleOpenProductDetail}
          onAddToCart={addToCart}
          isLoading={false}
        />
      )}

      {/* 4. Instagram Style Gallery */}
      {cms?.gallery?.show !== false && (
        <Gallery cms={cms?.gallery} gallery={gallery} />
      )}
    </div>
  );
}

export default function StorefrontHomePageClient({ initialData = null }) {
  return (
    <PageLayoutWrapper settings={initialData?.settings}>
      <StorefrontHomePageContent initialData={initialData} />
    </PageLayoutWrapper>
  );
}


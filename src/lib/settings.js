import { getApiBaseUrl } from '@/lib/apiBase.js';
import { logger } from '@/utils/logger.js';

export async function getWebsiteSettings() {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/settings`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) return data;
    }
  } catch (e) {
    logger.error('[SettingsLib] getWebsiteSettings error via Express API:', e);
  }

  return {
    id: "default",
    logoText: "TaniCo",
    tagline: "Murni Organik",
    websiteName: "TaniCo — Sayur Segar Organik",
    address: "Jl. Raya Pemali No. 45, Kecamatan Pemali, Kabupaten Bangka, Provinsi Kepulauan Bangka Belitung 33251",
    googleMapsUrl: "https://maps.google.com",
    whatsappNumber: "+628127300400",
    instagramUrl: "https://instagram.com/tanico.bangka",
    facebookUrl: "https://facebook.com/TaniCoBangka",
    emailAddress: "halo@tanico.id",
    operationalHours: "Setiap Hari: 07.00 - 17.00 WIB",
    footerText: "© 2026 TaniCo. Hak Cipta Dilindungi.",
    seoKeywords: "sayur organik, sayur segar bangka, tanico, sayur sehat",
    homepageCMS: "{}",
    contactsCMS: "{}"
  };
}

export async function getWebsiteData() {
  try {
    const baseUrl = getApiBaseUrl();
    const [productsRes, articlesRes] = await Promise.all([
      fetch(`${baseUrl}/api/products?all=true&limit=100`, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      }).catch(() => null),
      fetch(`${baseUrl}/api/articles?all=true&limit=100`, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      }).catch(() => null)
    ]);

    const products = productsRes && productsRes.ok ? await productsRes.json() : [];
    const articles = articlesRes && articlesRes.ok ? await articlesRes.json() : [];

    return {
      settings: { id: "default", homepageCMS: "{}" },
      adminProfile: { id: "default", name: "Admin TaniCo", email: "admin@tanico.id", role: "Super Admin", avatar: "" },
      categories: [],
      products: Array.isArray(products) ? products : [],
      orders: [],
      reviews: [],
      activityLogs: [],
      stockHistory: [],
      gallery: [],
      partners: [],
      testimonials: [],
      contactMessages: [],
      articles: Array.isArray(articles) ? articles : [],
      totalUsers: 0
    };
  } catch (error) {
    logger.error('[SettingsLib] getWebsiteData error via Express API:', error);
    return {
      settings: { id: "default", homepageCMS: "{}" },
      adminProfile: { id: "default", name: "Admin TaniCo", email: "admin@tanico.id", role: "Super Admin", avatar: "" },
      categories: [],
      products: [],
      orders: [],
      reviews: [],
      activityLogs: [],
      stockHistory: [],
      gallery: [],
      partners: [],
      testimonials: [],
      contactMessages: [],
      articles: [],
      totalUsers: 0
    };
  }
}

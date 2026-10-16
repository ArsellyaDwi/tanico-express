"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { formatRupiah } from '@/utils/formatters';
import { buildStorageUrl } from '@/utils/buildStorageUrl';
import { useAdmin } from '@/components/admin/AdminShell';

const SalesTrendChart = dynamic(
  () => import('@/app/admin/dashboard/DashboardCharts').then(mod => mod.SalesTrendChart),
  { 
    ssr: false, 
    loading: () => (
      <div className="w-full h-full bg-gray-50/60 rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">
        Memuat grafik tren...
      </div>
    ) 
  }
);

let cachedDashboardData = null;
let cachedDashboardTimestamp = 0;
const DASHBOARD_CACHE_TTL = 45000;

export default function AdminDashboardPage() {
  const router = useRouter();
  const adminCtx = useAdmin() || {};
  const { handleQuickAction } = adminCtx;

  const [dashData, setDashData] = useState(cachedDashboardData);
  const [loading, setLoading] = useState(!cachedDashboardData);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isClientMounted, setIsClientMounted] = useState(false);

  const getAuthHeaders = useCallback(() => {
    if (typeof window === 'undefined') return {};
    try {
      const u = JSON.parse(localStorage.getItem('tanico_user') || 'null');
      return u?.sessionToken ? { Authorization: `Bearer ${u.sessionToken}` } : {};
    } catch {
      return {};
    }
  }, []);

  const loadDashboardData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedDashboardData && (now - cachedDashboardTimestamp < DASHBOARD_CACHE_TTL)) {
      setDashData(cachedDashboardData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDashData(data);
        cachedDashboardData = data;
        cachedDashboardTimestamp = Date.now();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setErrorMsg(errJson.error || 'Gagal memuat ringkasan operasional.');
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setErrorMsg('Gagal terhubung ke server backend.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    setIsClientMounted(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // Operational metrics
  const pendingCount = dashData?.pendingOrdersCount ?? 0;
  const processingCount = dashData?.processingOrdersCount ?? 0;
  const readyToShipCount = dashData?.readyToShipCount ?? 0;
  const todayRevenue = dashData?.todayOrdersRevenue ?? 0;
  const todayCompletedCount = dashData?.todayCompletedOrdersCount ?? 0;
  const todayCompletedRevenue = dashData?.todayCompletedRevenue ?? 0;
  const todayOrdersCount = dashData?.todayOrdersCount ?? 0;

  // Inventory
  const outOfStockCount = dashData?.outOfStockCount ?? 0;
  const lowStockCount = dashData?.lowStockCount ?? 0;
  const lowStockProducts = dashData?.lowStockProducts || [];

  // Lists
  const recentOrders = dashData?.recentOrders || [];
  const salesTrendData = dashData?.salesTrendData || [];
  const bestSellers = dashData?.bestSellers || [];
  const recentReviews = dashData?.recentReviews || [];
  const activityLogs = dashData?.logs || [];

  const handleRestock = (productId) => {
    if (typeof handleQuickAction === 'function') {
      handleQuickAction(`restock-${productId}`);
    } else {
      router.push('/admin/stock');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Menunggu':
        return { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Menunggu' };
      case 'Diproses':
        return { dot: 'bg-blue-500', text: 'text-blue-700', label: 'Diproses' };
      case 'Dikirim':
        return { dot: 'bg-indigo-500', text: 'text-indigo-700', label: 'Dikirim / Siap' };
      case 'Selesai':
        return { dot: 'bg-emerald-600', text: 'text-emerald-700', label: 'Selesai' };
      case 'Dibatalkan':
        return { dot: 'bg-rose-500', text: 'text-rose-700', label: 'Dibatalkan' };
      default:
        return { dot: 'bg-gray-400', text: 'text-gray-600', label: status || 'Pending' };
    }
  };

  return (
    <div className="space-y-6 sm:space-y-7 pb-12 text-left font-sans text-gray-900">
      
      {/* 1. Header & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block">
            Konsol Operasional
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mt-0.5">
            Dashboard Operasional
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Pantau status pesanan langsung, inventaris panen, dan penanganan harian.
          </p>
        </div>

        {/* Action Triggers - Clean and Minimal */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (typeof handleQuickAction === 'function') {
                handleQuickAction('add-product');
              } else {
                router.push('/admin/products');
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-[#174C3C] text-white hover:bg-[#123d30] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Produk</span>
          </button>

          <button
            onClick={() => router.push('/admin/orders')}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#DDE9DF] text-gray-700 hover:bg-gray-50 text-xs font-semibold transition-colors cursor-pointer"
          >
            Kelola Pesanan
          </button>

          <button
            onClick={() => router.push('/admin/stock')}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#DDE9DF] text-gray-700 hover:bg-gray-50 text-xs font-semibold transition-colors cursor-pointer"
          >
            Manajemen Stok
          </button>

          <button
            onClick={loadDashboardData}
            title="Segarkan data operasional"
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-[#DDE9DF] text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state alert if any */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={loadDashboardData}
            className="underline font-semibold hover:text-red-900 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 2. Kartu Metrik Operasional Utama (Clean, Minimal, No Loud Icons) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        
        {/* Pesanan Menunggu Konfirmasi */}
        <div
          onClick={() => router.push('/admin/orders')}
          className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs hover:border-gray-400 transition-colors cursor-pointer flex flex-col justify-between text-left"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                Menunggu Konfirmasi
              </span>
              {pendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500" title="Ada antrean baru" />
              )}
            </div>
            <div className="mt-2.5">
              {loading ? (
                <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse my-1" />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 block">
                  {pendingCount} <span className="text-xs font-semibold text-gray-500">Pesanan</span>
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#DDE9DF] text-[10px] text-gray-500">
            {pendingCount > 0 ? 'Perlu tindakan konfirmasi' : 'Tidak ada antrean pesanan'}
          </div>
        </div>

        {/* Pesanan Sedang Diproses */}
        <div
          onClick={() => router.push('/admin/orders')}
          className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs hover:border-gray-400 transition-colors cursor-pointer flex flex-col justify-between text-left"
        >
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">
              Sedang Diproses
            </span>
            <div className="mt-2.5">
              {loading ? (
                <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse my-1" />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 block">
                  {processingCount} <span className="text-xs font-semibold text-gray-500">Pesanan</span>
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#DDE9DF] text-[10px] text-gray-500">
            Sedang disiapkan di kebun
          </div>
        </div>

        {/* Perlu Dikirim / Pickup */}
        <div
          onClick={() => router.push('/admin/orders')}
          className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs hover:border-gray-400 transition-colors cursor-pointer flex flex-col justify-between text-left"
        >
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">
              Perlu Dikirim / Pickup
            </span>
            <div className="mt-2.5">
              {loading ? (
                <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse my-1" />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 block">
                  {readyToShipCount} <span className="text-xs font-semibold text-gray-500">Pesanan</span>
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#DDE9DF] text-[10px] text-gray-500">
            Siap kurir / diambil pelanggan
          </div>
        </div>

        {/* Penjualan Hari Ini */}
        <div
          onClick={() => router.push('/admin/analytics?timeframe=today')}
          className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs hover:border-gray-400 transition-colors cursor-pointer flex flex-col justify-between text-left"
        >
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">
              Penjualan Hari Ini
            </span>
            <div className="mt-2.5">
              {loading ? (
                <div className="h-7 w-24 bg-gray-100 rounded-lg animate-pulse my-1" />
              ) : (
                <span className="text-xl sm:text-2xl font-bold text-gray-900 block truncate">
                  {formatRupiah(todayRevenue)}
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#DDE9DF] text-[10px] text-gray-500 truncate">
            {todayOrdersCount} pesanan masuk hari ini
          </div>
        </div>

        {/* Pesanan Selesai Hari Ini */}
        <div
          onClick={() => router.push('/admin/orders')}
          className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs hover:border-gray-400 transition-colors cursor-pointer flex flex-col justify-between text-left"
        >
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">
              Selesai Hari Ini
            </span>
            <div className="mt-2.5">
              {loading ? (
                <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse my-1" />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 block">
                  {todayCompletedCount} <span className="text-xs font-semibold text-gray-500">Pesanan</span>
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[#DDE9DF] text-[10px] text-gray-500 truncate">
            Omzet: {formatRupiah(todayCompletedRevenue)}
          </div>
        </div>

      </div>

      {/* 3. Peringatan Stok Habis & Menipis (Clean & Calm) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        
        {/* Ringkasan Peringatan Stok (4 Kolom) */}
        <div className="lg:col-span-4 bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs flex flex-col justify-between text-left">
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-900">Peringatan Inventaris</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Pemantauan otomatis produk habis dan stok kritis (&le; 10 unit).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-[#DDE9DF] bg-gray-50/50">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">
                  Stok Habis
                </span>
                <span className="text-2xl font-bold text-gray-900 block mt-1.5">
                  {outOfStockCount}
                </span>
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  Produk 0 Unit
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-[#DDE9DF] bg-gray-50/50">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">
                  Stok Menipis
                </span>
                <span className="text-2xl font-bold text-gray-900 block mt-1.5">
                  {lowStockCount}
                </span>
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  &le; 10 Unit
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push('/admin/stock')}
            className="mt-4 w-full py-2.5 px-3 rounded-xl border border-[#DDE9DF] text-gray-700 hover:bg-gray-50 text-xs font-semibold transition-colors cursor-pointer text-center"
          >
            Buka Manajemen Stok &rarr;
          </button>
        </div>

        {/* Daftar Produk Stok Menipis / Perlu Restok (8 Kolom) */}
        <div className="lg:col-span-8 bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs text-left">
          <div className="flex items-center justify-between pb-3 border-b border-[#DDE9DF]">
            <div>
              <h3 className="text-sm text-gray-900 font-bold">Produk Perlu Ditindaklanjuti</h3>
              <span className="text-[10px] text-gray-500 font-medium block">
                Daftar produk dengan stok terendah di kebun
              </span>
            </div>
            <button
              onClick={() => router.push('/admin/stock')}
              className="text-xs text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
            >
              Lihat Semua Stok &rarr;
            </button>
          </div>

          <div className="divide-y divide-[#DDE9DF] max-h-52 overflow-y-auto pr-1">
            {lowStockProducts.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 font-medium">
                Semua produk saat ini memiliki stok aman di atas 10 unit.
              </div>
            ) : (
              lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 first:pt-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                      {p.image ? (
                        <img src={buildStorageUrl(p.image)} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase">
                          {p.name.slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-semibold text-gray-900 truncate">{p.name}</h4>
                      <span className="text-[10px] text-gray-500 block">
                        {p.categoryName || 'Hasil Panen'} &bull; <span className="font-semibold text-gray-700">Sisa {p.stock} {p.unit || 'Kg'}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestock(p.id)}
                    className="shrink-0 ml-3 px-2.5 py-1 bg-white text-gray-700 border border-[#DDE9DF] hover:bg-gray-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    + Restok
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* 4. Tren Penjualan 7 Hari & Daftar Singkat Pesanan Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        
        {/* Tren Penjualan 7 Hari Terakhir (Grafik Ringkas) - 7 Kolom */}
        <div className="lg:col-span-7 bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs text-left flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#DDE9DF]">
            <div>
              <h3 className="text-sm text-gray-900 font-bold">Tren Penjualan 7 Hari Terakhir</h3>
              <span className="text-[10px] text-gray-500 font-medium block">
                Perkembangan omzet harian aktual pesanan yang tidak dibatalkan
              </span>
            </div>
            <button
              onClick={() => router.push('/admin/analytics')}
              className="text-xs text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
            >
              Laporan Lengkap &rarr;
            </button>
          </div>

          <div className="h-60 w-full my-4">
            {isClientMounted ? (
              <SalesTrendChart salesTrendData={salesTrendData} />
            ) : (
              <div className="w-full h-full bg-gray-50/60 rounded-xl flex items-center justify-center text-xs text-gray-400">
                Memuat grafik tren...
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#DDE9DF] flex items-center justify-between text-[11px] text-gray-500">
            <span>Agregasi nilai pesanan aktual per hari</span>
            <span className="font-semibold text-gray-700">7 Hari Terakhir</span>
          </div>
        </div>

        {/* Daftar Singkat Pesanan Terbaru (Maks. 5 Pesanan) - 5 Kolom */}
        <div className="lg:col-span-5 bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs text-left flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#DDE9DF]">
            <div>
              <h3 className="text-sm text-gray-900 font-bold">Pesanan Terbaru</h3>
              <span className="text-[10px] text-gray-500 font-medium block">
                5 transaksi terakhir yang masuk ke sistem
              </span>
            </div>
            <button
              onClick={() => router.push('/admin/orders')}
              className="text-xs text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
            >
              Semua &rarr;
            </button>
          </div>

          <div className="divide-y divide-[#DDE9DF] flex-1">
            {recentOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400 font-medium">
                Belum ada pesanan terbaru di sistem.
              </div>
            ) : (
              recentOrders.map((ord) => {
                const badge = getStatusBadge(ord.status);
                const orderDate = new Date(ord.createdAt);
                const timeStr = orderDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const dateStr = orderDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                const itemsCount = ord.items ? ord.items.reduce((s, it) => s + (it.quantity || 1), 0) : 0;

                return (
                  <div
                    key={ord.id}
                    onClick={() => router.push('/admin/orders')}
                    className="py-2.5 first:pt-2.5 last:pb-2.5 hover:bg-gray-50/70 -mx-2 px-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-gray-900 truncate">
                            {ord.customerName}
                          </span>
                          <span className={`text-[10px] font-semibold inline-flex items-center gap-1.5 ${badge.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                          <span>{dateStr}, {timeStr}</span>
                          <span>&bull;</span>
                          <span>{itemsCount} item</span>
                          <span>&bull;</span>
                          <span className="uppercase text-[9px] font-medium text-gray-500">
                            {ord.fulfillmentMethod === 'PICKUP' ? 'Ambil Sendiri' : 'Pengiriman'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-semibold text-xs text-gray-900 block">
                          {formatRupiah(ord.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => router.push('/admin/orders')}
            className="mt-3 w-full py-2 bg-gray-50/70 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold transition-colors text-center cursor-pointer border border-[#DDE9DF]"
          >
            Buka Pengelolaan Pesanan Lengkap &rarr;
          </button>
        </div>

      </div>

      {/* 5. Produk Terlaris (3-4 Produk) & Ulasan Terbaru & Log Aktivitas Admin */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        
        {/* Ringkasan Produk Terlaris (Maksimal 4) - 4 Kolom */}
        <div className="lg:col-span-4 bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs text-left flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#DDE9DF]">
            <div>
              <h3 className="text-sm text-gray-900 font-bold">Produk Terlaris</h3>
              <span className="text-[10px] text-gray-500 font-medium block">
                Top 4 hasil panen terfavorit
              </span>
            </div>
            <button
              onClick={() => router.push('/admin/analytics')}
              className="text-xs text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
            >
              Ranking &rarr;
            </button>
          </div>

          <div className="space-y-3 flex-1 my-3">
            {bestSellers.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 font-medium">
                Belum ada data produk terjual.
              </div>
            ) : (
              bestSellers.map((item, idx) => {
                const p = item.p || item;
                return (
                  <div key={p.id || idx} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                      {p.image ? (
                        <img src={buildStorageUrl(p.image)} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase">
                          {p.name.slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-xs text-gray-900 truncate">{p.name}</h4>
                      <span className="text-[10px] text-gray-500 block">
                        {p.categoryName || 'Hasil Panen'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-xs text-gray-900 block">{item.quantity} {p.unit || 'Kg'}</span>
                      <span className="text-[10px] text-gray-500 block">{formatRupiah(item.revenue)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => router.push('/admin/products')}
            className="w-full py-2 bg-gray-50/70 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold transition-colors text-center cursor-pointer border border-[#DDE9DF]"
          >
            Kelola Katalog Produk &rarr;
          </button>
        </div>

        {/* Ulasan Terbaru (2-3 Ulasan) - 4 Kolom */}
        <div className="lg:col-span-4 bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs text-left flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#DDE9DF]">
            <div>
              <h3 className="text-sm text-gray-900 font-bold">Ulasan Pembeli</h3>
              <span className="text-[10px] text-gray-500 font-medium block">
                Umpan balik langsung dari pelanggan
              </span>
            </div>
            <button
              onClick={() => router.push('/admin/reviews')}
              className="text-xs text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
            >
              Moderasi &rarr;
            </button>
          </div>

          <div className="space-y-2.5 flex-1 my-3">
            {recentReviews.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 font-medium">
                Belum ada ulasan yang masuk.
              </div>
            ) : (
              recentReviews.map((r) => (
                <div key={r.id} className="p-2.5 rounded-xl bg-gray-50/60 border border-[#DDE9DF] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-gray-900">{r.customerName}</span>
                    <span className="text-[11px] text-amber-600 font-semibold">
                      ★ {r.rating || 5}.0
                    </span>
                  </div>
                  {r.productName && (
                    <span className="text-[10px] text-gray-500 block">
                      {r.productName}
                    </span>
                  )}
                  <p className="text-[11px] text-gray-600 italic line-clamp-2">
                    &ldquo;{r.comment}&rdquo;
                  </p>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => router.push('/admin/reviews')}
            className="w-full py-2 bg-gray-50/70 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold transition-colors text-center cursor-pointer border border-[#DDE9DF]"
          >
            Halaman Moderasi Ulasan &rarr;
          </button>
        </div>

        {/* Log Aktivitas Tim - 4 Kolom */}
        <div className="lg:col-span-4 bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs text-left flex flex-col justify-between">
          <div className="pb-3 border-b border-[#DDE9DF]">
            <h3 className="text-sm text-gray-900 font-bold">Log Aktivitas Tim</h3>
            <span className="text-[10px] text-gray-500 font-medium block">
              Riwayat tindakan administrator
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto flex-1 pr-1 my-3">
            {activityLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 font-medium">
                Belum ada aktivitas admin tercatat.
              </div>
            ) : (
              activityLogs.slice(0, 6).map((log) => {
                const logTime = new Date(log.timestamp);
                const timeStr = logTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={log.id} className="text-xs py-1.5 border-b border-gray-100 last:border-0 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0"></span>
                      <p className="text-gray-600 text-[11px] leading-relaxed">
                        <strong className="text-gray-900">{log.adminName}</strong>: {log.action}
                      </p>
                    </div>
                    <span className="text-[9px] text-gray-400 font-semibold shrink-0 mt-0.5">
                      {timeStr}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-[#DDE9DF] text-[10px] text-gray-500 text-center font-medium">
            Pencatatan aktivitas sistem otomatis
          </div>
        </div>

      </div>

    </div>
  );
}

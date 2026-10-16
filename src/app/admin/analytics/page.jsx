"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  DollarSign, 
  ShoppingBag, 
  ClipboardList, 
  TrendingUp, 
  Users, 
  RefreshCw, 
  Download, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Search,
  Calendar,
  Truck,
  Package,
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  PieChart as PieChartIcon,
  BarChart3
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { formatRupiah } from '@/utils/formatters';
import { buildStorageUrl } from '@/utils/buildStorageUrl';
import { exportMultiSheetToExcel } from '@/utils/exportExcel';
import AdminButton from '@/components/admin/AdminButton';
import { useAdmin } from '@/components/admin/AdminShell';

// Charts dynamically loaded
const SalesTrendChart = dynamic(
  () => import('@/app/admin/dashboard/DashboardCharts').then(mod => mod.SalesTrendChart),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-50/50 rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">Memuat grafik pendapatan...</div> }
);

const OrdersTrendChart = dynamic(
  () => import('@/app/admin/dashboard/DashboardCharts').then(mod => mod.OrdersTrendChart),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-50/50 rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">Memuat grafik pesanan...</div> }
);

const CategoryPieChart = dynamic(
  () => import('@/app/admin/dashboard/DashboardCharts').then(mod => mod.CategoryPieChart),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-50/50 rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">Memuat grafik kategori...</div> }
);

const OrderStatusBarChart = dynamic(
  () => import('@/app/admin/dashboard/DashboardCharts').then(mod => mod.OrderStatusBarChart),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-50/50 rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">Memuat grafik status...</div> }
);

const COLORS = ['#174C3C', '#6E9C7C', '#AD8B3A', '#8D6E63', '#2E7D32', '#BCAAA4'];

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const { categories = [], addToast } = useAdmin();

  // Filters State
  const [timeframe, setTimeframe] = useState('30d'); // 'today' | '7d' | '30d' | 'year' | 'custom' | 'all'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedFulfillment, setSelectedFulfillment] = useState('ALL'); // 'ALL' | 'DELIVERY' | 'PICKUP'
  const [searchProduct, setSearchProduct] = useState('');

  // Sorting state for Products table
  const [productSortBy, setProductSortBy] = useState('soldCount'); // 'soldCount' | 'revenue'
  const [productSortOrder, setProductSortOrder] = useState('desc'); // 'desc' | 'asc'

  // Data & Request States
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isClientMounted, setIsClientMounted] = useState(false);

  // Auth Header
  const getAuthHeaders = useCallback(() => {
    if (typeof window === 'undefined') return {};
    try {
      const u = JSON.parse(localStorage.getItem('tanico_user') || 'null');
      return u?.sessionToken ? { Authorization: `Bearer ${u.sessionToken}` } : {};
    } catch {
      return {};
    }
  }, []);

  // Fetch real analytics data from Express backend
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const queryParams = new URLSearchParams({
        timeframe,
        status: selectedStatus,
        category: selectedCategory,
        fulfillment: selectedFulfillment,
        product: searchProduct.trim()
      });

      if (timeframe === 'custom' && startDate && endDate) {
        queryParams.set('startDate', startDate);
        queryParams.set('endDate', endDate);
      }

      const res = await fetch(`/api/admin/analytics?${queryParams.toString()}`, {
        headers: getAuthHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || 'Gagal memuat data analitik.');
      }
    } catch (err) {
      console.error('Error fetching analytics endpoint:', err);
      setErrorMsg('Gagal terhubung ke server analitik.');
    } finally {
      setLoading(false);
    }
  }, [timeframe, startDate, endDate, selectedStatus, selectedCategory, selectedFulfillment, searchProduct, getAuthHeaders]);

  useEffect(() => {
    setIsClientMounted(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle Quick Timeframe Selection
  const handleQuickTimeframe = (tf) => {
    setTimeframe(tf);
    if (tf !== 'custom') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Handle Custom Date Range Submit
  const handleApplyCustomDates = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      if (typeof addToast === 'function') {
        addToast('Pilih tanggal awal dan akhir terlebih dahulu.', 'error');
      }
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      if (typeof addToast === 'function') {
        addToast('Tanggal mulai tidak boleh lebih besar dari tanggal akhir.', 'error');
      }
      return;
    }
    setTimeframe('custom');
  };

  // Extracted Metrics
  const totalRevenue = analyticsData?.totalRevenue ?? 0;
  const completedRevenue = analyticsData?.completedRevenue ?? 0;
  const totalOrdersCount = analyticsData?.totalOrdersCount ?? 0;
  const totalProductsSold = analyticsData?.totalProductsSold ?? 0;
  const averageOrderValue = analyticsData?.averageOrderValue ?? 0;
  const cancellationRate = analyticsData?.cancellationRate ?? 0;
  const uniqueCustomersCount = analyticsData?.uniqueCustomersCount ?? 0;
  const prevMetrics = analyticsData?.prevMetrics || null;

  // Extracted Charts & Tables
  const salesTrendData = analyticsData?.salesTrendData || [];
  const categoryChartData = analyticsData?.categoryChartData || [];
  const orderStatusData = analyticsData?.orderStatusData || [];
  const categoryAnalytics = analyticsData?.categoryAnalytics || [];
  const rawBestSellers = analyticsData?.bestSellers || [];
  const transactionAnalysis = analyticsData?.transactionAnalysis || {
    statusSummary: [],
    fulfillmentSummary: [],
    transactions: []
  };

  // Sorted Products
  const sortedProducts = useMemo(() => {
    const list = [...rawBestSellers];
    list.sort((a, b) => {
      const valA = productSortBy === 'revenue' ? (a.revenue || 0) : (a.soldCount || 0);
      const valB = productSortBy === 'revenue' ? (b.revenue || 0) : (b.soldCount || 0);
      return productSortOrder === 'desc' ? valB - valA : valA - valB;
    });
    return list;
  }, [rawBestSellers, productSortBy, productSortOrder]);

  // Helper for actual growth display
  const renderGrowthBadge = (growthVal, isInverse = false) => {
    if (growthVal === null || growthVal === undefined) {
      return (
        <span className="text-[10px] text-gray-400 font-semibold inline-flex items-center">
          - <span className="ml-1 text-[9px] font-normal text-gray-400">(vs periode lalu)</span>
        </span>
      );
    }

    const isPositive = growthVal > 0;
    const isNeutral = growthVal === 0;

    let textColor = 'text-gray-500';
    if (!isNeutral) {
      if (isInverse) {
        // e.g. for cancellation rate: higher is bad (red), lower is good (green)
        textColor = isPositive ? 'text-rose-700' : 'text-emerald-700';
      } else {
        textColor = isPositive ? 'text-emerald-700' : 'text-rose-700';
      }
    }

    return (
      <span className={`inline-flex items-center text-[10px] font-bold ${textColor}`}>
        {isPositive && <ArrowUpRight className="w-3 h-3 mr-0.5" />}
        {!isPositive && !isNeutral && <ArrowDownRight className="w-3 h-3 mr-0.5" />}
        {growthVal > 0 ? `+${growthVal}%` : `${growthVal}%`}
        <span className="ml-1 text-[9px] font-normal text-gray-500">vs periode lalu</span>
      </span>
    );
  };

  // MULTI-SHEET EXCEL EXPORT
  const handleExportMultiSheetExcel = () => {
    try {
      const todayDateStr = new Date().toISOString().split('T')[0];

      // Sheet 1: Ringkasan & Parameter Filter
      const summaryRows = [
        { 'Kategori': 'Parameter Laporan', 'Informasi': 'Nilai Filter Terpasang' },
        { 'Kategori': 'Periode Laporan', 'Informasi': timeframe.toUpperCase() },
        { 'Kategori': 'Rentang Tanggal', 'Informasi': (startDate && endDate) ? `${startDate} s/d ${endDate}` : (analyticsData?.startDate ? `${analyticsData.startDate} s/d ${analyticsData.endDate}` : 'Semua Waktu') },
        { 'Kategori': 'Status Pesanan', 'Informasi': selectedStatus },
        { 'Kategori': 'Kategori Produk', 'Informasi': selectedCategory },
        { 'Kategori': 'Metode Fulfillment', 'Informasi': selectedFulfillment },
        { 'Kategori': 'Pencarian Produk', 'Informasi': searchProduct || 'Semua Produk' },
        { 'Kategori': 'Tanggal Ekspor', 'Informasi': `${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')} WIB` },
        { 'Kategori': '', 'Informasi': '' },
        { 'Kategori': 'Metrik KPI Performa Bisnis', 'Informasi': 'Capaian Aktual' },
        { 'Kategori': 'Total Nilai Pesanan (Non-Batal)', 'Informasi': formatRupiah(totalRevenue) },
        { 'Kategori': 'Nilai Penjualan Pesanan Selesai', 'Informasi': formatRupiah(completedRevenue) },
        { 'Kategori': 'Jumlah Total Transaksi', 'Informasi': `${totalOrdersCount} Transaksi` },
        { 'Kategori': 'Total Unit/Porsi Terjual', 'Informasi': `${totalProductsSold} Unit` },
        { 'Kategori': 'Rata-rata Nilai Pesanan (AOV)', 'Informasi': formatRupiah(averageOrderValue) },
        { 'Kategori': 'Tingkat Pembatalan Pesanan', 'Informasi': `${cancellationRate}%` },
        { 'Kategori': 'Jumlah Pelanggan Unik', 'Informasi': `${uniqueCustomersCount} Pelanggan` }
      ];

      // Sheet 2: Tren Penjualan Waktu ke Waktu
      const trendRows = (salesTrendData || []).map((t) => ({
        'Waktu / Tanggal': t.name,
        'Nilai Penjualan (Rp)': t.Pendapatan || 0,
        'Jumlah Pesanan': t.Pesanan || 0
      }));

      // Sheet 3: Performa Produk
      const productRows = (sortedProducts || []).map((prod, idx) => ({
        'Peringkat': idx + 1,
        'Nama Produk': prod.name,
        'Kategori': prod.categoryName || '-',
        'Satuan': prod.unit || 'Kg',
        'Harga Satuan (Rp)': prod.price || 0,
        'Kuantitas Terjual': prod.soldCount || 0,
        'Total Nilai Penjualan (Rp)': prod.revenue || 0,
        'Jumlah Transaksi': prod.transactionCount || 0,
        'Sisa Stok Terkini': prod.stock ?? 0
      }));

      // Sheet 4: Performa Kategori
      const categoryRows = (categoryAnalytics || []).map((cat) => ({
        'Nama Kategori': cat.name,
        'Jumlah Produk (SKU)': cat.productCount || 0,
        'Total Unit Terjual': cat.soldCount || 0,
        'Total Nilai Penjualan (Rp)': cat.revenue || 0,
        'Jumlah Transaksi': cat.transactionCount || 0,
        'Kontribusi Omzet (%)': `${cat.contributionPercentage || 0}%`
      }));

      // Sheet 5: Status Pesanan
      const statusRows = (transactionAnalysis.statusSummary || []).map((s) => ({
        'Status Pesanan': s.status,
        'Jumlah Pesanan': s.count,
        'Total Nilai (Rp)': s.revenue,
        'Persentase Transaksi (%)': `${s.percentage}%`
      }));

      // Sheet 6: Rincian Transaksi
      const transactionRows = (transactionAnalysis.transactions || []).map((tx) => ({
        'ID Pesanan': tx.id,
        'Tanggal Transaksi': new Date(tx.createdAt).toLocaleDateString('id-ID'),
        'Waktu Transaksi': new Date(tx.createdAt).toLocaleTimeString('id-ID'),
        'Nama Pelanggan': tx.customerName,
        'No. Telepon': tx.phone,
        'Metode Fulfillment': tx.fulfillmentMethod === 'PICKUP' ? 'Ambil di Kebun (Pickup)' : 'Kirim ke Alamat (Delivery)',
        'Status': tx.status,
        'Total Nilai (Rp)': tx.totalAmount,
        'Jumlah Item': tx.itemsCount
      }));

      const sheets = [
        { sheetName: 'Ringkasan', data: summaryRows },
        { sheetName: 'Tren Penjualan', data: trendRows },
        { sheetName: 'Performa Produk', data: productRows },
        { sheetName: 'Performa Kategori', data: categoryRows },
        { sheetName: 'Status Pesanan', data: statusRows },
        { sheetName: 'Rincian Transaksi', data: transactionRows }
      ];

      exportMultiSheetToExcel(sheets, `TaniCo_Laporan_Analitik_${todayDateStr}`);
      if (typeof addToast === 'function') {
        addToast('Laporan analitik (6 sheet Excel) berhasil diunduh.', 'success');
      }
    } catch (err) {
      console.error('Multi-sheet export error:', err);
      if (typeof addToast === 'function') {
        addToast('Gagal mengekspor laporan: ' + err.message, 'error');
      }
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 text-left font-sans">
      
      {/* 1. Header Halaman Analitik */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-0.5">
          <span className="font-sans text-[10px] uppercase tracking-wider text-[#6E9C7C] font-bold block">
            EVALUASI BISNIS / LAPORAN ANALITIK
          </span>
          <h2 className="font-sans text-2xl sm:text-3xl font-bold text-[#174C3C] tracking-tight">
            Laporan Analitik &amp; Kinerja
          </h2>
          <p className="font-sans text-xs text-[#6B7280]">
            Eksplorasi komprehensif performa penjualan, tren transaksi, dan kontribusi hasil panen.
          </p>
        </div>

        {/* Action Triggers */}
        <div className="flex flex-wrap items-center gap-2">
          <AdminButton
            onClick={fetchAnalytics}
            variant="outline"
            size="md"
            icon={RefreshCw}
            disabled={loading}
          >
            {loading ? 'Memuat...' : 'Segarkan Data'}
          </AdminButton>

          <AdminButton
            onClick={handleExportMultiSheetExcel}
            variant="primary"
            size="md"
            icon={Download}
          >
            Ekspor Excel (Multi-Sheet)
          </AdminButton>
        </div>
      </div>

      {/* Error state alert */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={fetchAnalytics}
            className="underline font-bold hover:text-red-900 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* =========================================================================
          SECTION A: FILTER LAPORAN
         ========================================================================= */}
      <div className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs space-y-3.5">
        
        {/* Top Filter Row: Quick Presets & Custom Date Range */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#DDE9DF]/80 pb-3">
          
          {/* Quick Presets Buttons */}
          <div className="flex items-center gap-1 bg-[#F8FAF9] p-1 rounded-xl border border-[#DDE9DF] overflow-x-auto">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: '7d', label: '7 Hari' },
              { id: '30d', label: '30 Hari' },
              { id: 'year', label: 'Tahun Ini' },
              { id: 'all', label: 'Semua Periode' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleQuickTimeframe(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  timeframe === item.id
                    ? 'bg-[#174C3C] text-white shadow-2xs'
                    : 'text-gray-600 hover:text-[#174C3C] hover:bg-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          <form onSubmit={handleApplyCustomDates} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 bg-[#FCFCFC] border border-[#DDE9DF] px-2.5 py-1.5 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="outline-none bg-transparent text-gray-700 font-semibold cursor-pointer"
                title="Tanggal Mulai"
              />
              <span className="text-gray-400 font-bold">&ndash;</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="outline-none bg-transparent text-gray-700 font-semibold cursor-pointer"
                title="Tanggal Selesai"
              />
            </div>

            <button
              type="submit"
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeframe === 'custom'
                  ? 'bg-[#174C3C] text-white'
                  : 'bg-[#F8FAF9] border border-[#DDE9DF] text-[#174C3C] hover:bg-[#DDE9DF]/50'
              }`}
            >
              Terapkan Rentang
            </button>
          </form>

        </div>

        {/* Bottom Filter Row: Status, Kategori, Fulfillment, Pencarian Produk */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Status Pesanan */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
              Status Pesanan
            </label>
            <div className="flex items-center gap-2 bg-[#FCFCFC] border border-[#DDE9DF] px-3 py-2 rounded-xl">
              <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs bg-transparent outline-none text-gray-800 font-semibold cursor-pointer"
              >
                <option value="ALL">Semua Status Pesanan</option>
                <option value="Menunggu">Menunggu Konfirmasi</option>
                <option value="Diproses">Sedang Diproses</option>
                <option value="Dikirim">Dikirim / Siap Pickup</option>
                <option value="Selesai">Selesai</option>
                <option value="Dibatalkan">Dibatalkan</option>
              </select>
            </div>
          </div>

          {/* Kategori Produk */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
              Kategori Produk
            </label>
            <div className="flex items-center gap-2 bg-[#FCFCFC] border border-[#DDE9DF] px-3 py-2 rounded-xl">
              <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-xs bg-transparent outline-none text-gray-800 font-semibold cursor-pointer truncate"
              >
                <option value="ALL">Semua Kategori Produk</option>
                {categories.map((c) => {
                  const cName = typeof c === 'string' ? c : c.name;
                  const cId = typeof c === 'string' ? c : (c.id || c.name);
                  return <option key={cId} value={cId}>{cName}</option>;
                })}
              </select>
            </div>
          </div>

          {/* Filter Pickup / Delivery */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
              Metode Pengiriman
            </label>
            <div className="flex items-center gap-2 bg-[#FCFCFC] border border-[#DDE9DF] px-3 py-2 rounded-xl">
              <Truck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <select
                value={selectedFulfillment}
                onChange={(e) => setSelectedFulfillment(e.target.value)}
                className="w-full text-xs bg-transparent outline-none text-gray-800 font-semibold cursor-pointer"
              >
                <option value="ALL">Semua Metode (Delivery &amp; Pickup)</option>
                <option value="DELIVERY">Kirim ke Alamat (Delivery)</option>
                <option value="PICKUP">Ambil Sendiri di Kebun (Pickup)</option>
              </select>
            </div>
          </div>

          {/* Filter Pencarian Produk */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
              Pencarian Produk
            </label>
            <div className="flex items-center gap-2 bg-[#FCFCFC] border border-[#DDE9DF] px-3 py-2 rounded-xl">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Nama produk..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full text-xs bg-transparent outline-none text-gray-800 font-medium"
              />
              {searchProduct && (
                <button
                  type="button"
                  onClick={() => setSearchProduct('')}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Filter Summary Indicator */}
        <div className="flex items-center justify-between text-[11px] text-[#6B7280] pt-1">
          <span>
            Filter aktif: <strong className="text-[#174C3C]">{timeframe.toUpperCase()}</strong> &bull; Status: <strong className="text-[#174C3C]">{selectedStatus}</strong> &bull; Kategori: <strong className="text-[#174C3C]">{selectedCategory}</strong> &bull; Metode: <strong className="text-[#174C3C]">{selectedFulfillment}</strong>
          </span>
          {loading && <span className="text-[#174C3C] font-bold animate-pulse">Memperbarui data...</span>}
        </div>

      </div>

      {/* =========================================================================
          SECTION B: KPI PERFORMA BISNIS
         ========================================================================= */}
      <div>
        <div className="mb-3">
          <h3 className="font-sans text-sm font-bold text-[#174C3C]">Indikator Kinerja Utama (KPI Bisnis)</h3>
          <span className="font-sans text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold block">
            Metrik performa dihitung berdasarkan filter terpilih dan dibandingkan dengan periode sebelumnya yang setara
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
          
          {/* 1. Total Nilai Pesanan */}
          <div className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs flex flex-col justify-between text-left">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
                Total Nilai Pesanan
              </span>
              <div className="mt-2.5">
                {loading ? (
                  <div className="h-7 w-24 bg-gray-100 rounded-lg animate-pulse my-1" />
                ) : (
                  <span className="text-xl sm:text-2xl font-bold text-[#202020] block truncate">
                    {formatRupiah(totalRevenue)}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#DDE9DF] flex flex-col gap-1">
              {renderGrowthBadge(prevMetrics?.growth?.totalRevenue)}
              <span className="text-[10px] text-[#6B7280]">Pesanan tidak dibatalkan</span>
            </div>
          </div>

          {/* 2. Nilai Penjualan Selesai */}
          <div className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs flex flex-col justify-between text-left">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
                Penjualan Selesai
              </span>
              <div className="mt-2.5">
                {loading ? (
                  <div className="h-7 w-24 bg-gray-100 rounded-lg animate-pulse my-1" />
                ) : (
                  <span className="text-xl sm:text-2xl font-bold text-emerald-900 block truncate">
                    {formatRupiah(completedRevenue)}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#DDE9DF] flex flex-col gap-1">
              {renderGrowthBadge(prevMetrics?.growth?.completedRevenue)}
              <span className="text-[10px] text-[#6B7280]">Status transaksi Selesai</span>
            </div>
          </div>

          {/* 3. Jumlah Pesanan */}
          <div className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs flex flex-col justify-between text-left">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
                Jumlah Pesanan
              </span>
              <div className="mt-2.5">
                {loading ? (
                  <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse my-1" />
                ) : (
                  <span className="text-xl sm:text-2xl font-bold text-[#202020] block">
                    {totalOrdersCount} <span className="text-xs font-semibold text-[#6B7280]">Pesanan</span>
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#DDE9DF] flex flex-col gap-1">
              {renderGrowthBadge(prevMetrics?.growth?.totalOrdersCount)}
              <span className="text-[10px] text-[#6B7280]">Total pesanan masuk</span>
            </div>
          </div>

          {/* 4. Total Unit Produk Terjual */}
          <div className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs flex flex-col justify-between text-left">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
                Unit Terjual
              </span>
              <div className="mt-2.5">
                {loading ? (
                  <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse my-1" />
                ) : (
                  <span className="text-xl sm:text-2xl font-bold text-[#202020] block">
                    {totalProductsSold} <span className="text-xs font-semibold text-[#6B7280]">Porsi/Kg</span>
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#DDE9DF] flex flex-col gap-1">
              {renderGrowthBadge(prevMetrics?.growth?.totalProductsSold)}
              <span className="text-[10px] text-[#6B7280]">Total volume pangan panen</span>
            </div>
          </div>

          {/* 5. Rata-rata Nilai Pesanan (AOV) */}
          <div className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs flex flex-col justify-between text-left">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
                Rata-rata Pesanan (AOV)
              </span>
              <div className="mt-2.5">
                {loading ? (
                  <div className="h-7 w-20 bg-gray-100 rounded-lg animate-pulse my-1" />
                ) : (
                  <span className="text-xl sm:text-2xl font-bold text-[#202020] block truncate">
                    {formatRupiah(averageOrderValue)}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#DDE9DF] flex flex-col gap-1">
              {renderGrowthBadge(prevMetrics?.growth?.averageOrderValue)}
              <span className="text-[10px] text-[#6B7280]">Basket size per checkout</span>
            </div>
          </div>

          {/* 6. Tingkat Pembatalan Pesanan */}
          <div className="bg-white border border-[#DDE9DF] p-4 sm:p-5 rounded-2xl shadow-2xs flex flex-col justify-between text-left">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider block">
                Tingkat Pembatalan
              </span>
              <div className="mt-2.5">
                {loading ? (
                  <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse my-1" />
                ) : (
                  <span className={`text-xl sm:text-2xl font-bold block ${cancellationRate > 10 ? 'text-rose-700' : 'text-[#202020]'}`}>
                    {cancellationRate}%
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#DDE9DF] flex flex-col gap-1">
              {renderGrowthBadge(prevMetrics?.growth?.cancellationRate, true)}
              <span className="text-[10px] text-[#6B7280]">Rasio transaksi dibatalkan</span>
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
          SECTION C: GRAFIK ANALITIK
         ========================================================================= */}
      <div className="space-y-4">
        <div>
          <h3 className="font-sans text-sm font-bold text-[#174C3C]">Grafik Analitik &amp; Visualisasi Tren</h3>
          <span className="font-sans text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold block">
            Interval waktu disesuaikan otomatis (per jam untuk harian, per hari untuk mingguan/bulanan, per bulan untuk tahunan)
          </span>
        </div>

        {/* Row 1: Tren Nilai Penjualan & Tren Jumlah Pesanan */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Grafik 1: Tren Nilai Penjualan */}
          <div className="bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-sans text-sm text-[#174C3C] font-bold">Tren Nilai Penjualan (Omzet)</h4>
                <span className="font-sans text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold block pt-0.5">
                  Perkembangan nominal penjualan dari waktu ke waktu
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-sans text-[10px] text-[#174C3C] font-bold">
                <span className="w-2.5 h-2.5 bg-[#174C3C] rounded-sm inline-block"></span>
                <span>Nilai Penjualan</span>
              </div>
            </div>

            <div className="h-64 w-full">
              {isClientMounted ? (
                <SalesTrendChart salesTrendData={salesTrendData} />
              ) : (
                <div className="w-full h-full bg-gray-50/50 rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">
                  Memuat grafik...
                </div>
              )}
            </div>
          </div>

          {/* Grafik 2: Tren Jumlah Pesanan */}
          <div className="bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-sans text-sm text-[#174C3C] font-bold">Tren Jumlah Pesanan</h4>
                <span className="font-sans text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold block pt-0.5">
                  Volume frekuensi pesanan masuk per interval
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-sans text-[10px] text-[#6E9C7C] font-bold">
                <span className="w-2.5 h-2.5 bg-[#6E9C7C] rounded-sm inline-block"></span>
                <span>Jumlah Transaksi</span>
              </div>
            </div>

            <div className="h-64 w-full">
              {isClientMounted ? (
                <OrdersTrendChart salesTrendData={salesTrendData} />
              ) : (
                <div className="w-full h-full bg-gray-50/50 rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">
                  Memuat grafik...
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Row 2: Kontribusi Kategori (Pie Chart) & Distribusi Status Pesanan (Bar Chart) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Grafik 3: Kontribusi Penjualan per Kategori */}
          <div className="bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs space-y-4 text-left flex flex-col justify-between">
            <div>
              <h4 className="font-sans text-sm text-[#174C3C] font-bold">Kontribusi Penjualan per Kategori</h4>
              <span className="font-sans text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold block pt-0.5">
                Proporsi omzet pangan segar menurut kategori
              </span>
            </div>

            <div className="h-56 w-full flex items-center justify-center relative">
              {isClientMounted ? (
                <CategoryPieChart categoryChartData={categoryChartData} COLORS={COLORS} />
              ) : (
                <div className="w-full h-full bg-gray-50/50 rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">
                  Memuat grafik...
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] font-sans text-[#6B7280] pt-2 border-t border-[#DDE9DF]">
              {categoryChartData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2 h-2 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate font-semibold">{entry.name}: {entry.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grafik 4: Distribusi Status Pesanan */}
          <div className="bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs space-y-4 text-left flex flex-col justify-between">
            <div>
              <h4 className="font-sans text-sm text-[#174C3C] font-bold">Distribusi Status Pesanan</h4>
              <span className="font-sans text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold block pt-0.5">
                Penyebaran status pesanan dalam periode terpilih
              </span>
            </div>

            <div className="h-56 w-full">
              {isClientMounted ? (
                <OrderStatusBarChart orderStatusData={orderStatusData} />
              ) : (
                <div className="w-full h-full bg-gray-50/50 rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">
                  Memuat grafik...
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#DDE9DF] flex items-center justify-between text-[11px] text-[#6B7280]">
              <span>Hijau: Selesai &bull; Abu/Biru: Proses/Kirim &bull; Merah: Dibatalkan</span>
              <span className="font-bold text-[#174C3C]">Total {totalOrdersCount} Pesanan</span>
            </div>
          </div>

        </div>

      </div>

      {/* =========================================================================
          SECTION D: TABEL PERFORMA KATEGORI
         ========================================================================= */}
      <div className="bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs space-y-4 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-sans text-sm font-bold text-[#174C3C]">Tabel Performa Kategori</h3>
            <span className="font-sans text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold block pt-0.5">
              Rincian pasokan, unit terjual, omzet, dan kontribusi terhadap total omzet
            </span>
          </div>
          <span className="font-sans text-xs text-[#6B7280] font-semibold">
            {categoryAnalytics.length} Kategori Terdaftar
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-[#F8FAF9] border-b border-[#DDE9DF] text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-3.5">Nama Kategori</th>
                <th className="py-3 px-3 text-center">Jumlah SKU</th>
                <th className="py-3 px-3 text-right">Unit Terjual</th>
                <th className="py-3 px-3 text-right">Nilai Penjualan (Rp)</th>
                <th className="py-3 px-3 text-center">Jumlah Transaksi</th>
                <th className="py-3 px-3 text-right">Kontribusi Omzet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE9DF]">
              {categoryAnalytics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                    Belum ada data transaksi kategori pada filter ini.
                  </td>
                </tr>
              ) : (
                categoryAnalytics.map((cat) => (
                  <tr key={cat.id || cat.name} className="hover:bg-[#FCFCFC] transition-colors">
                    <td className="py-3 px-3.5 font-bold text-[#202020]">
                      {cat.name}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-600 font-medium">
                      {cat.productCount} SKU
                    </td>
                    <td className="py-3 px-3 text-right text-gray-800 font-bold">
                      {cat.soldCount} Unit
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#174C3C]">
                      {formatRupiah(cat.revenue)}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-600 font-medium">
                      {cat.transactionCount || 0}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#202020]">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#174C3C] h-full rounded-full"
                            style={{ width: `${Math.min(100, cat.contributionPercentage || 0)}%` }}
                          />
                        </div>
                        <span className="text-xs">{cat.contributionPercentage || 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          SECTION E: TABEL PERFORMA PRODUK (DENGAN SORTING)
         ========================================================================= */}
      <div className="bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs space-y-4 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-sans text-sm font-bold text-[#174C3C]">Tabel Performa Produk (Ranking Pangan)</h3>
            <span className="font-sans text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold block pt-0.5">
              Urutan hasil panen berdasarkan volume penjualan dan nominal omzet
            </span>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-[#6B7280]">Urutkan:</span>
            <select
              value={productSortBy}
              onChange={(e) => setProductSortBy(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-[#FCFCFC] border border-[#DDE9DF] rounded-xl outline-none font-semibold text-gray-700 cursor-pointer"
            >
              <option value="soldCount">Kuantitas Terjual</option>
              <option value="revenue">Nilai Penjualan</option>
            </select>

            <button
              type="button"
              onClick={() => setProductSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="p-1.5 border border-[#DDE9DF] rounded-xl text-gray-700 hover:bg-[#F8FAF9] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              title="Ganti arah pengurutan"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
              <span>{productSortOrder === 'desc' ? 'Tertinggi' : 'Terendah'}</span>
            </button>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-[#F8FAF9] border-b border-[#DDE9DF] text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-3 text-center">#</th>
                <th className="py-3 px-3.5">Nama Produk</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3 text-right">Harga Satuan</th>
                <th className="py-3 px-3 text-right">Unit Terjual</th>
                <th className="py-3 px-3 text-right">Nilai Penjualan</th>
                <th className="py-3 px-3 text-center">Transaksi</th>
                <th className="py-3 px-3 text-right">Stok Terkini</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE9DF]">
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400 font-medium">
                    Belum ada produk yang terjual pada filter ini.
                  </td>
                </tr>
              ) : (
                sortedProducts.map((item, idx) => {
                  const p = item.p || item;
                  return (
                    <tr key={p.id || idx} className="hover:bg-[#FCFCFC] transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-gray-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5 font-bold text-[#202020]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#FCFCFC] border border-[#DDE9DF] overflow-hidden shrink-0">
                            {p.image ? (
                              <img src={buildStorageUrl(p.image)} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-[#ECF6ED] flex items-center justify-center text-[#174C3C]">
                                <ShoppingBag className="w-3.5 h-3.5 opacity-40" />
                              </div>
                            )}
                          </div>
                          <span className="truncate max-w-[200px]">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[10px] uppercase font-bold text-[#6E9C7C]">
                        {p.categoryName || '-'}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600 font-medium">
                        {formatRupiah(p.price || 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-[#174C3C]">
                        {item.soldCount || 0} {p.unit || 'Kg'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-[#202020]">
                        {formatRupiah(item.revenue || 0)}
                      </td>
                      <td className="py-3 px-3 text-center text-gray-600 font-medium">
                        {item.transactionCount || 0}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-500 font-medium text-[11px]">
                        <span className="text-gray-600">Sisa {p.stock ?? 0} {p.unit || 'Kg'}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          SECTION F: ANALISIS TRANSAKSI (STATUS & METODE PICKUP/DELIVERY)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Rekap Status Pesanan */}
        <div className="bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs space-y-4 text-left">
          <div>
            <h3 className="font-sans text-sm font-bold text-[#174C3C]">Rekap Status Transaksi</h3>
            <span className="font-sans text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold block pt-0.5">
              Rincian jumlah dan nominal nilai per status pesanan
            </span>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="bg-[#F8FAF9] border-b border-[#DDE9DF] text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Pesanan</th>
                  <th className="py-2.5 px-3 text-right">Nilai Nominal</th>
                  <th className="py-2.5 px-3 text-right">Persentase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE9DF]">
                {(transactionAnalysis.statusSummary || []).map((s) => (
                  <tr key={s.status} className="hover:bg-[#FCFCFC]">
                    <td className="py-2.5 px-3 font-bold text-[#202020]">
                      {s.status}
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-gray-700">
                      {s.count}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#174C3C]">
                      {formatRupiah(s.revenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-600">
                      {s.percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Perbandingan Metode Pickup & Delivery */}
        <div className="bg-white border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl shadow-2xs space-y-4 text-left flex flex-col justify-between">
          <div>
            <h3 className="font-sans text-sm font-bold text-[#174C3C]">Perbandingan Metode Pemenuhan (Fulfillment)</h3>
            <span className="font-sans text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold block pt-0.5">
              Distribusi pesanan antara Pengiriman ke Alamat (Delivery) dan Ambil Sendiri (Pickup)
            </span>
          </div>

          <div className="w-full overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="bg-[#F8FAF9] border-b border-[#DDE9DF] text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Metode</th>
                  <th className="py-2.5 px-3 text-center">Pesanan</th>
                  <th className="py-2.5 px-3 text-right">Total Nilai</th>
                  <th className="py-2.5 px-3 text-right">Porsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE9DF]">
                {(transactionAnalysis.fulfillmentSummary || []).map((f) => (
                  <tr key={f.method} className="hover:bg-[#FCFCFC]">
                    <td className="py-2.5 px-3 font-bold text-[#202020]">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span>{f.label}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-gray-700">
                      {f.count}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#174C3C]">
                      {formatRupiah(f.revenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-800">
                      {f.percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-[#DDE9DF] text-[11px] text-[#6B7280]">
            Sistem mencatat metode pemenuhan pesanan secara riil dari database.
          </div>
        </div>

      </div>

      {/* =========================================================================
          SECTION G: BANNER EKSPOR MULTI-SHEET LAPORAN LENGKAP
         ========================================================================= */}
      <div className="bg-[#ECF6ED] border border-[#DDE9DF] p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="font-sans text-sm font-bold text-[#174C3C]">
            Unduh Arsip Laporan Lengkap (.xlsx Multi-Sheet)
          </h4>
          <p className="font-sans text-xs text-[#202020]/80">
            Ekspor mencakup 6 sheet terstruktur: Ringkasan &amp; Parameter, Tren Penjualan, Performa Produk, Performa Kategori, Status Pesanan, dan Rincian Transaksi yang disaring sesuai filter aktif.
          </p>
        </div>

        <button
          onClick={handleExportMultiSheetExcel}
          className="shrink-0 py-2.5 px-5 bg-[#174C3C] hover:bg-[#123C30] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Ekspor 6 Sheet Excel</span>
        </button>
      </div>

    </div>
  );
}

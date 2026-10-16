"use client";

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { formatDateTime } from '@/utils/formatters';

export default function StockSummaryTab({
  products = [],
  stockHistory = [],
  isLoading = false,
  onRefresh,
  onNavigateTab
}) {
  // Real backend calculations
  const totalProducts = products.length;
  const outOfStockProducts = products.filter(p => Number(p?.stock ?? 0) <= 0);
  const lowStockProducts = products.filter(p => {
    const s = Number(p?.stock ?? 0);
    return s > 0 && s <= 10;
  });
  const inStockProducts = products.filter(p => Number(p?.stock ?? 0) > 10);

  // Total available stock volume across all inventory
  const totalStockVolume = products.reduce((acc, p) => acc + (Number(p?.stock) || 0), 0);

  // Recent stock activities
  const recentActivities = stockHistory.slice(0, 8);

  return (
    <div className="space-y-4">
      {/* 4 Metric Cards - Clean Neutral Enterprise Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Total Produk */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Total Produk
          </div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">
            {totalProducts}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Total volume: {totalStockVolume.toLocaleString('id-ID')} unit
          </div>
        </div>

        {/* 2. Stok Tersedia */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Stok Tersedia
          </div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">
            {inStockProducts.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Persediaan aman (&gt; 10 unit)
          </div>
        </div>

        {/* 3. Stok Menipis */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Stok Menipis
          </div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">
            {lowStockProducts.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Batas peringatan (1 - 10 unit)
          </div>
        </div>

        {/* 4. Stok Habis */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Stok Habis
          </div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">
            {outOfStockProducts.length}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Persediaan 0 unit
          </div>
        </div>
      </div>

      {/* Grid: Attention List + Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Produk Menipis & Habis */}
        <div className="lg:col-span-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Produk Perlu Perhatian
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Stok habis atau di bawah batas minimum
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('mutasi')}
              className="text-xs font-medium text-[#174C3C] hover:underline cursor-pointer"
            >
              Restok Manual
            </button>
          </div>

          <div className="overflow-x-auto">
            {[...outOfStockProducts, ...lowStockProducts].length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                Semua stok produk dalam kondisi aman (&gt; 10 unit).
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <th className="py-2.5 px-3.5">Produk</th>
                    <th className="py-2.5 px-3.5">Kategori</th>
                    <th className="py-2.5 px-3.5 text-right">Sisa Stok</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[...outOfStockProducts, ...lowStockProducts].slice(0, 10).map((prod) => {
                    const st = Number(prod.stock ?? 0);
                    const isZero = st <= 0;
                    return (
                      <tr key={prod.id} className="hover:bg-gray-50/60">
                        <td className="py-2.5 px-3.5 font-medium text-gray-900">
                          {prod.name}
                        </td>
                        <td className="py-2.5 px-3.5 text-gray-500">
                          {prod.categoryName || '-'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-medium text-gray-900">
                          {st} {prod.unit || 'kg'}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium border ${
                            isZero 
                              ? 'bg-red-50 text-red-700 border-red-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {isZero ? 'Habis' : 'Menipis'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Aktivitas Stok Terbaru */}
        <div className="lg:col-span-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Aktivitas Stok Terbaru
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Pencatatan mutasi terkini dari database
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('riwayat')}
              className="text-xs font-medium text-[#174C3C] hover:underline cursor-pointer"
            >
              Lihat Semua Log
            </button>
          </div>

          <div className="overflow-x-auto">
            {recentActivities.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                Belum ada aktivitas stok yang tercatat.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <th className="py-2.5 px-3.5">Waktu</th>
                    <th className="py-2.5 px-3.5">Produk</th>
                    <th className="py-2.5 px-3.5 text-right">Perubahan</th>
                    <th className="py-2.5 px-3.5">Sumber / Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentActivities.map((act) => {
                    const isMasuk = act.type === 'Masuk';
                    const qty = Number(act.quantity || 0);
                    return (
                      <tr key={act.id} className="hover:bg-gray-50/60">
                        <td className="py-2.5 px-3.5 text-gray-500 whitespace-nowrap">
                          {formatDateTime(act.timestamp || act.createdAt)}
                        </td>
                        <td className="py-2.5 px-3.5 font-medium text-gray-900">
                          {act.productName || act.product?.name || '-'}
                        </td>
                        <td className={`py-2.5 px-3.5 text-right font-medium whitespace-nowrap ${
                          isMasuk ? 'text-emerald-700' : 'text-gray-900'
                        }`}>
                          {isMasuk ? `+${qty}` : `-${qty}`} {act.unit || 'kg'}
                        </td>
                        <td className="py-2.5 px-3.5 text-gray-600 max-w-[200px] truncate" title={act.cleanNotes || act.notes}>
                          <span className="text-gray-900 font-medium mr-1">
                            [{act.source || (isMasuk ? 'RESTOCK' : 'MUTASI')}]
                          </span>
                          {act.cleanNotes || act.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

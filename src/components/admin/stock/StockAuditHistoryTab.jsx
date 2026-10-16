"use client";

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { formatDateTime } from '@/utils/formatters';

export default function StockAuditHistoryTab({
  products = [],
  stockHistory = [],
  isLoading = false,
  onRefresh
}) {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterProduct, setFilterProduct] = useState('ALL');
  const [filterDate, setFilterDate] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Filter history
  const filteredAudit = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();

    return (stockHistory || []).filter((item) => {
      // 1. Search (Product name, notes, orderId, actorName)
      if (q) {
        const prod = (item.productName || item.product?.name || '').toLowerCase();
        const note = (item.cleanNotes || item.notes || '').toLowerCase();
        const ord = (item.orderId || '').toLowerCase();
        const actor = (item.actorName || '').toLowerCase();
        if (!prod.includes(q) && !note.includes(q) && !ord.includes(q) && !actor.includes(q)) {
          return false;
        }
      }

      // 2. Filter Category / Source
      if (filterSource !== 'ALL') {
        const itemSource = item.source || (item.type === 'Masuk' ? 'RESTOCK' : 'MANUAL_OUT');
        if (itemSource !== filterSource) return false;
      }

      // 3. Filter Type (Masuk / Keluar)
      if (filterType !== 'ALL' && item.type !== filterType) {
        return false;
      }

      // 4. Filter Product
      if (filterProduct !== 'ALL' && item.productId !== filterProduct) {
        return false;
      }

      // 5. Date Range Filter
      if (filterDate !== 'ALL' && item.timestamp) {
        const itemDate = new Date(item.timestamp);
        const diffMs = now - itemDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (filterDate === 'TODAY' && diffDays > 1) return false;
        if (filterDate === '7DAYS' && diffDays > 7) return false;
        if (filterDate === '30DAYS' && diffDays > 30) return false;
      }

      return true;
    });
  }, [stockHistory, searchQuery, filterSource, filterType, filterProduct, filterDate]);

  // Aggregate statistics for the filtered audit records
  const auditMetrics = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    filteredAudit.forEach(a => {
      const q = Number(a.quantity) || 0;
      if (a.type === 'Masuk') totalIn += q;
      else totalOut += q;
    });
    return {
      totalRecords: filteredAudit.length,
      totalIn,
      totalOut,
      netChange: totalIn - totalOut
    };
  }, [filteredAudit]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredAudit.length / itemsPerPage));
  const paginatedAudit = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAudit.slice(start, start + itemsPerPage);
  }, [filteredAudit, currentPage, itemsPerPage]);

  return (
    <div className="space-y-3">
      {/* Table Header and Summary Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-gray-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Log Audit Riwayat Perubahan Stok
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {auditMetrics.totalRecords} catatan mutasi &middot; Total Masuk: +{auditMetrics.totalIn} &middot; Total Keluar: -{auditMetrics.totalOut} &middot; Selisih Bersih: {auditMetrics.netChange >= 0 ? `+${auditMetrics.netChange}` : auditMetrics.netChange} unit
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-md transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari produk, catatan, ref, aktor..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filter Source */}
          <select
            value={filterSource}
            onChange={(e) => {
              setFilterSource(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:border-gray-400"
          >
            <option value="ALL">Semua Kategori Sumber</option>
            <option value="PURCHASE">Pembelian (PURCHASE)</option>
            <option value="CANCELLATION">Pembatalan (CANCELLATION)</option>
            <option value="STOCK_OPNAME">Stock Opname (STOCK_OPNAME)</option>
            <option value="RESTOCK">Restok Manual (RESTOCK)</option>
            <option value="MANUAL_OUT">Pengurangan Manual (MANUAL_OUT)</option>
          </select>

          {/* Filter Type */}
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:border-gray-400"
          >
            <option value="ALL">Semua Jenis Perubahan</option>
            <option value="Masuk">Masuk (+)</option>
            <option value="Keluar">Keluar (-)</option>
          </select>

          {/* Filter Product */}
          <select
            value={filterProduct}
            onChange={(e) => {
              setFilterProduct(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:border-gray-400"
          >
            <option value="ALL">Semua Produk</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Filter Date */}
          <select
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:border-gray-400"
          >
            <option value="ALL">Semua Periode</option>
            <option value="TODAY">Hari Ini</option>
            <option value="7DAYS">7 Hari Terakhir</option>
            <option value="30DAYS">30 Hari Terakhir</option>
          </select>
        </div>
      </div>

      {/* Main Audit Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Tanggal & Waktu</th>
                <th className="py-2.5 px-3.5">Produk</th>
                <th className="py-2.5 px-3.5 text-center">Jenis</th>
                <th className="py-2.5 px-3.5 text-right">Perubahan</th>
                <th className="py-2.5 px-3.5">Sumber / Kategori</th>
                <th className="py-2.5 px-3.5">Ref. Pesanan</th>
                <th className="py-2.5 px-3.5 text-center">Stok (Sblm &rarr; Ssdh)</th>
                <th className="py-2.5 px-3.5">Keterangan</th>
                <th className="py-2.5 px-3.5">Aktor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedAudit.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-gray-400">
                    Tidak ada catatan audit riwayat perubahan stok yang sesuai filter.
                  </td>
                </tr>
              ) : (
                paginatedAudit.map((item) => {
                  const isMasuk = item.type === 'Masuk';
                  const qty = Number(item.quantity || 0);
                  const source = item.source || (isMasuk ? 'RESTOCK' : 'MANUAL_OUT');
                  
                  // Valid before and after stock if recorded in backend
                  const hasBefore = item.stockBefore !== undefined && item.stockBefore !== null;
                  const hasAfter = item.stockAfter !== undefined && item.stockAfter !== null;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/60">
                      {/* Date & Time */}
                      <td className="py-2.5 px-3.5 text-gray-500 whitespace-nowrap">
                        {formatDateTime(item.timestamp || item.createdAt)}
                      </td>

                      {/* Product */}
                      <td className="py-2.5 px-3.5 font-medium text-gray-900 whitespace-nowrap">
                        {item.productName || item.product?.name || '-'}
                      </td>

                      {/* Type (Masuk / Keluar) */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium border ${
                          isMasuk 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                          {item.type}
                        </span>
                      </td>

                      {/* Quantity change */}
                      <td className={`py-2.5 px-3.5 text-right font-medium whitespace-nowrap ${
                        isMasuk ? 'text-emerald-700' : 'text-gray-900'
                      }`}>
                        {isMasuk ? `+${qty}` : `-${qty}`} {item.unit || 'kg'}
                      </td>

                      {/* Source category */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className="text-[11px] text-gray-700 font-mono">
                          {source}
                        </span>
                      </td>

                      {/* Order Reference */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {item.orderId ? (
                          <span className="font-mono text-gray-800">
                            #{item.orderId}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Before and After Stock */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        {hasBefore && hasAfter ? (
                          <span className="font-mono text-gray-700">
                            {item.stockBefore} &rarr; <span className="font-semibold text-gray-900">{item.stockAfter}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-2.5 px-3.5 text-gray-600 max-w-[240px] truncate" title={item.cleanNotes || item.notes}>
                        {item.cleanNotes || item.notes || '-'}
                      </td>

                      {/* Actor */}
                      <td className="py-2.5 px-3.5 text-gray-500 whitespace-nowrap">
                        {item.actorName || (source === 'PURCHASE' ? 'Pelanggan' : 'Admin')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-3.5 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
            <div>
              Halaman {currentPage} dari {totalPages} ({filteredAudit.length} total data)
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

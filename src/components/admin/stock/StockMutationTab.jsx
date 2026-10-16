"use client";

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import AdminButton from '@/components/admin/AdminButton';
import { formatDateTime } from '@/utils/formatters';

export default function StockMutationTab({
  products = [],
  stockHistory = [],
  isLoading = false,
  onRefresh,
  refreshProducts,
  addToast,
  handleAddActivityLog
}) {
  // ==================== 1. MUTATION FORM STATE ====================
  const [mutProductId, setMutProductId] = useState('');
  const [mutType, setMutType] = useState('Masuk'); // 'Masuk' | 'Keluar'
  const [mutQuantity, setMutQuantity] = useState('');
  const [mutNotes, setMutNotes] = useState('');
  const [isSubmittingMut, setIsSubmittingMut] = useState(false);

  // Authentication headers helper
  const getAuthHeaders = () => {
    if (typeof window === 'undefined') return {};
    try {
      const u = JSON.parse(localStorage.getItem('tanico_user') || 'null');
      return u?.sessionToken ? { Authorization: `Bearer ${u.sessionToken}` } : {};
    } catch (e) {
      return {};
    }
  };

  // Selected product object
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === mutProductId) || null;
  }, [products, mutProductId]);

  // Handle save manual mutation
  const handleSaveMutation = async (e) => {
    e.preventDefault();
    if (!mutProductId) {
      if (addToast) addToast('Pilih produk sayuran terlebih dahulu.', 'warning');
      return;
    }
    const qty = parseInt(mutQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      if (addToast) addToast('Jumlah kuantitas stok harus lebih dari 0.', 'warning');
      return;
    }

    if (mutType === 'Keluar' && selectedProduct && qty > (selectedProduct.stock || 0)) {
      if (addToast) {
        addToast(
          `Stok tidak mencukupi! Sisa stok produk "${selectedProduct.name}" hanya ${selectedProduct.stock} ${selectedProduct.unit || 'kg'}.`,
          'error'
        );
      }
      return;
    }

    setIsSubmittingMut(true);
    try {
      const res = await fetch('/api/admin/stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          productId: mutProductId,
          productName: selectedProduct?.name,
          type: mutType,
          quantity: qty,
          notes: mutNotes.trim() || (mutType === 'Masuk' ? 'Restok manual' : 'Sortir/Pengurangan manual')
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal menyimpan mutasi stok');
      }

      if (addToast) {
        addToast(
          `Mutasi stok ${mutType.toLowerCase()} berhasil disimpan untuk "${selectedProduct?.name}".`,
          'success'
        );
      }

      if (handleAddActivityLog) {
        handleAddActivityLog({
          type: 'STOCK_MUTATION',
          description: `Mutasi ${mutType} ${qty} ${selectedProduct?.unit || 'kg'} produk ${selectedProduct?.name}`,
          target: selectedProduct?.name
        });
      }

      // Reset form
      setMutProductId('');
      setMutQuantity('');
      setMutNotes('');

      // Refresh data
      if (onRefresh) onRefresh();
      if (refreshProducts) refreshProducts();
    } catch (err) {
      console.error('Error saving stock mutation:', err);
      if (addToast) {
        addToast(err.message || 'Terjadi kesalahan saat menyimpan mutasi stok.', 'error');
      }
    } finally {
      setIsSubmittingMut(false);
    }
  };

  // ==================== 2. HISTORY STATE ====================
  const [historySearch, setHistorySearch] = useState('');
  const [historyProductFilter, setHistoryProductFilter] = useState('ALL');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL'); // 'ALL' | 'Masuk' | 'Keluar'
  const [historySourceFilter, setHistorySourceFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Filtered mutation history
  const filteredMutations = useMemo(() => {
    const q = historySearch.trim().toLowerCase();

    return (stockHistory || []).filter((item) => {
      if (q) {
        const prod = (item.productName || item.product?.name || '').toLowerCase();
        const note = (item.cleanNotes || item.notes || '').toLowerCase();
        const ord = (item.orderId || '').toLowerCase();
        const actor = (item.actorName || '').toLowerCase();
        if (!prod.includes(q) && !note.includes(q) && !ord.includes(q) && !actor.includes(q)) {
          return false;
        }
      }

      if (historyProductFilter !== 'ALL' && item.productId !== historyProductFilter) {
        return false;
      }

      if (historyTypeFilter !== 'ALL' && item.type !== historyTypeFilter) {
        return false;
      }

      if (historySourceFilter !== 'ALL') {
        const src = item.source || (item.type === 'Masuk' ? 'RESTOCK' : 'MANUAL_OUT');
        if (src !== historySourceFilter) return false;
      }

      return true;
    });
  }, [stockHistory, historySearch, historyProductFilter, historyTypeFilter, historySourceFilter]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredMutations.length / itemsPerPage));
  const paginatedMutations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMutations.slice(start, start + itemsPerPage);
  }, [filteredMutations, currentPage, itemsPerPage]);

  return (
    <div className="space-y-4">
      {/* Manual Mutation Form */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="mb-3">
          <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
            Form Mutasi Stok Manual
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Gunakan form ini khusus untuk pencatatan restok masuk dari panen/petani atau pengurangan sortir/rusak
          </p>
        </div>

        <form onSubmit={handleSaveMutation} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Product Select */}
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Pilih Produk Sayuran
              </label>
              <select
                value={mutProductId}
                onChange={(e) => setMutProductId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-gray-200 rounded-md text-gray-800 focus:outline-none focus:border-gray-400"
              >
                <option value="">-- Pilih Produk --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stok: {p.stock ?? 0} {p.unit || 'kg'})
                  </option>
                ))}
              </select>
            </div>

            {/* Mutation Type Toggle */}
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Jenis Mutasi
              </label>
              <div className="grid grid-cols-2 gap-1.5 h-9 p-0.5 bg-gray-100 rounded-md border border-gray-200">
                <button
                  type="button"
                  onClick={() => setMutType('Masuk')}
                  className={`text-xs font-medium rounded transition-colors cursor-pointer ${
                    mutType === 'Masuk'
                      ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Masuk (Restok)
                </button>
                <button
                  type="button"
                  onClick={() => setMutType('Keluar')}
                  className={`text-xs font-medium rounded transition-colors cursor-pointer ${
                    mutType === 'Keluar'
                      ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Keluar (Sortir)
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Kuantitas
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Jumlah..."
                  value={mutQuantity}
                  onChange={(e) => setMutQuantity(e.target.value)}
                  className="w-full h-9 px-3 pr-10 text-xs bg-white border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
                  {selectedProduct?.unit || 'unit'}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Keterangan
              </label>
              <input
                type="text"
                placeholder={mutType === 'Masuk' ? 'Contoh: Panen kebun Pemali' : 'Contoh: Sortir busuk/rusak'}
                value={mutNotes}
                onChange={(e) => setMutNotes(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <AdminButton
              type="submit"
              disabled={!mutProductId || !mutQuantity || isSubmittingMut}
              loading={isSubmittingMut}
            >
              Simpan Mutasi Stok
            </AdminButton>
          </div>
        </form>
      </div>

      {/* Mutation History Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Table Controls */}
        <div className="p-3.5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Riwayat Pergerakan Mutasi Stok
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Catatan mutasi otomatis sistem (pembelian & pembatalan) serta mutasi manual admin
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

        {/* Filter bar */}
        <div className="p-3.5 bg-gray-50/50 border-b border-gray-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari produk, catatan, ref..."
              value={historySearch}
              onChange={(e) => {
                setHistorySearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <select
            value={historyProductFilter}
            onChange={(e) => {
              setHistoryProductFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:border-gray-400"
          >
            <option value="ALL">Semua Produk</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={historyTypeFilter}
            onChange={(e) => {
              setHistoryTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:border-gray-400"
          >
            <option value="ALL">Semua Jenis Perubahan</option>
            <option value="Masuk">Masuk (Stok Bertambah)</option>
            <option value="Keluar">Keluar (Stok Berkurang)</option>
          </select>

          <select
            value={historySourceFilter}
            onChange={(e) => {
              setHistorySourceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:border-gray-400"
          >
            <option value="ALL">Semua Sumber Mutasi</option>
            <option value="PURCHASE">Pembelian Pelanggan (PURCHASE)</option>
            <option value="CANCELLATION">Pembatalan Pesanan (CANCELLATION)</option>
            <option value="STOCK_OPNAME">Stock Opname (STOCK_OPNAME)</option>
            <option value="RESTOCK">Restok Manual (RESTOCK)</option>
            <option value="MANUAL_OUT">Pengurangan Manual (MANUAL_OUT)</option>
          </select>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Waktu</th>
                <th className="py-2.5 px-3.5">Produk</th>
                <th className="py-2.5 px-3.5 text-center">Jenis</th>
                <th className="py-2.5 px-3.5 text-right">Jumlah</th>
                <th className="py-2.5 px-3.5">Sumber Mutasi</th>
                <th className="py-2.5 px-3.5">Keterangan</th>
                <th className="py-2.5 px-3.5">Aktor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedMutations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-gray-400">
                    Tidak ada riwayat mutasi stok yang sesuai filter.
                  </td>
                </tr>
              ) : (
                paginatedMutations.map((item) => {
                  const isMasuk = item.type === 'Masuk';
                  const qty = Number(item.quantity || 0);
                  const source = item.source || (isMasuk ? 'RESTOCK' : 'MANUAL_OUT');

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/60">
                      <td className="py-2.5 px-3.5 text-gray-500 whitespace-nowrap">
                        {formatDateTime(item.timestamp || item.createdAt)}
                      </td>
                      <td className="py-2.5 px-3.5 font-medium text-gray-900">
                        {item.productName || item.product?.name || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium border ${
                          isMasuk 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3.5 text-right font-medium whitespace-nowrap ${
                        isMasuk ? 'text-emerald-700' : 'text-gray-900'
                      }`}>
                        {isMasuk ? `+${qty}` : `-${qty}`} {item.unit || 'kg'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className="text-[11px] text-gray-700 font-mono">
                          {source}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-gray-600 max-w-[220px] truncate" title={item.cleanNotes || item.notes}>
                        {item.cleanNotes || item.notes || '-'}
                      </td>
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
              Halaman {currentPage} dari {totalPages} ({filteredMutations.length} total data)
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

"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import AdminButton from '@/components/admin/AdminButton';
import { formatDate } from '@/utils/formatters';

export default function StockOpnameTab({
  products = [],
  opnameHistory = [],
  isLoading = false,
  onRefresh,
  refreshProducts,
  addToast,
  handleAddActivityLog
}) {
  // ==================== 1. FORM STATE ====================
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [physicalStockInput, setPhysicalStockInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [isSubmittingOpname, setIsSubmittingOpname] = useState(false);
  const searchContainerRef = useRef(null);

  // Close search suggestion popup when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered products for search autocomplete
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.id && p.id.toLowerCase().includes(q)) ||
      (p.categoryName && p.categoryName.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [products, searchQuery]);

  // When a product is selected
  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setPhysicalStockInput(String(product.stock ?? 0));
    setIsSearchOpen(false);
  };

  // Difference calculation: Selisih = Stok Fisik - Stok Sistem
  const systemStock = selectedProduct ? Number(selectedProduct.stock ?? 0) : 0;
  const physicalStockNum = physicalStockInput !== '' ? parseFloat(physicalStockInput) : null;
  const difference = (selectedProduct && physicalStockNum !== null && !isNaN(physicalStockNum))
    ? parseFloat((physicalStockNum - systemStock).toFixed(2))
    : null;

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

  // Handle submit Stock Opname
  const handleSubmitOpname = async (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      if (addToast) addToast('Pilih produk yang ingin di-opname terlebih dahulu.', 'warning');
      return;
    }
    if (physicalStockInput === '' || isNaN(parseFloat(physicalStockInput))) {
      if (addToast) addToast('Masukkan jumlah stok fisik yang valid.', 'warning');
      return;
    }

    const physicalVal = parseFloat(physicalStockInput);
    if (physicalVal < 0) {
      if (addToast) addToast('Stok fisik tidak boleh bernilai negatif.', 'warning');
      return;
    }

    setIsSubmittingOpname(true);
    try {
      const res = await fetch('/api/admin/stock-opname', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          physicalStock: physicalVal,
          notes: notesInput.trim() || undefined
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal menyimpan hasil stock opname');
      }

      const diffVal = result.difference ?? (physicalVal - systemStock);
      const diffFormatted = diffVal > 0 ? `+${diffVal}` : `${diffVal}`;
      const toastMsg = `Stock opname "${selectedProduct.name}" berhasil disimpan. Stok disesuaikan menjadi ${physicalVal} (selisih: ${diffFormatted}).`;

      if (addToast) {
        addToast(toastMsg, 'success');
      }

      if (handleAddActivityLog) {
        handleAddActivityLog({
          type: 'STOCK_OPNAME',
          description: `Stock opname produk ${selectedProduct.name}: fisik ${physicalVal}, sistem ${systemStock}, selisih ${diffFormatted}`,
          target: selectedProduct.name
        });
      }

      // Reset form
      setSelectedProduct(null);
      setSearchQuery('');
      setPhysicalStockInput('');
      setNotesInput('');

      // Refresh data
      if (onRefresh) onRefresh();
      if (refreshProducts) refreshProducts();
    } catch (err) {
      console.error('Error submitting stock opname:', err);
      if (addToast) {
        addToast(err.message || 'Terjadi kesalahan saat memproses stock opname.', 'error');
      }
    } finally {
      setIsSubmittingOpname(false);
    }
  };

  // ==================== 2. HISTORY STATE ====================
  const [historySearch, setHistorySearch] = useState('');
  const [historyProductFilter, setHistoryProductFilter] = useState('ALL');
  const [historyDiffFilter, setHistoryDiffFilter] = useState('ALL');
  const [historyDateFilter, setHistoryDateFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Filtered opname history
  const filteredOpnames = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const now = new Date();

    return (opnameHistory || []).filter((item) => {
      if (q) {
        const prod = (item.product?.name || item.productName || '').toLowerCase();
        const note = (item.notes || '').toLowerCase();
        const adm = (item.adminName || '').toLowerCase();
        if (!prod.includes(q) && !note.includes(q) && !adm.includes(q)) {
          return false;
        }
      }

      if (historyProductFilter !== 'ALL' && item.productId !== historyProductFilter) {
        return false;
      }

      if (historyDiffFilter !== 'ALL') {
        const diff = Number(item.difference ?? 0);
        if (historyDiffFilter === 'DEFICIT' && diff >= 0) return false;
        if (historyDiffFilter === 'SURPLUS' && diff <= 0) return false;
        if (historyDiffFilter === 'MATCH' && diff !== 0) return false;
      }

      if (historyDateFilter !== 'ALL' && item.createdAt) {
        const itemDate = new Date(item.createdAt);
        const diffMs = now - itemDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (historyDateFilter === 'TODAY' && diffDays > 1) return false;
        if (historyDateFilter === '7DAYS' && diffDays > 7) return false;
        if (historyDateFilter === '30DAYS' && diffDays > 30) return false;
      }

      return true;
    });
  }, [opnameHistory, historySearch, historyProductFilter, historyDiffFilter, historyDateFilter]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredOpnames.length / itemsPerPage));
  const paginatedOpnames = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOpnames.slice(start, start + itemsPerPage);
  }, [filteredOpnames, currentPage, itemsPerPage]);

  return (
    <div className="space-y-4">
      {/* Opname Form Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="mb-3">
          <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
            Pencatatan Stock Opname
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pemeriksaan fisik persediaan untuk mencocokkan stok aktual di gudang dengan catatan sistem
          </p>
        </div>

        <form onSubmit={handleSubmitOpname} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Product Autocomplete */}
            <div className="md:col-span-5 relative" ref={searchContainerRef}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Pilih Produk Sayuran
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik nama produk untuk mencari..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  className="w-full h-9 pl-8 pr-3 text-xs bg-white border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Suggestions Dropdown */}
              {isSearchOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500 text-center">
                      Produk tidak ditemukan.
                    </div>
                  ) : (
                    searchResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-b-0 cursor-pointer"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-[11px] text-gray-500">{product.categoryName || 'Tanpa Kategori'}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-gray-900">{product.stock ?? 0}</span>
                          <span className="text-gray-500 ml-1">{product.unit || 'kg'}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* System Stock (Read-only) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Stok Sistem
              </label>
              <div className="h-9 px-3 bg-gray-50 border border-gray-200 rounded-md flex items-center text-xs text-gray-800 font-medium">
                {selectedProduct ? `${systemStock} ${selectedProduct.unit || 'kg'}` : '-'}
              </div>
            </div>

            {/* Physical Stock Input */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Stok Fisik Aktual
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Jumlah riil..."
                value={physicalStockInput}
                onChange={(e) => setPhysicalStockInput(e.target.value)}
                disabled={!selectedProduct}
                className="w-full h-9 px-3 text-xs bg-white border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            {/* Difference (Selisih) */}
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Selisih (Fisik - Sistem)
              </label>
              <div className={`h-9 px-3 rounded-md flex items-center text-xs font-medium border ${
                difference === null 
                  ? 'bg-gray-50 border-gray-200 text-gray-500'
                  : difference === 0
                  ? 'bg-gray-50 border-gray-200 text-gray-700'
                  : difference > 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {difference === null
                  ? '-'
                  : difference === 0
                  ? '0 (Cocok)'
                  : difference > 0
                  ? `+${difference} (Surplus)`
                  : `${difference} (Defisit)`
                }
              </div>
            </div>
          </div>

          {/* Notes and Submit */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Keterangan opname (opsional, contoh: Pemeriksaan berkala mingguan)..."
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                disabled={!selectedProduct}
                className="w-full h-9 px-3 text-xs bg-white border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400 disabled:bg-gray-50"
              />
            </div>

            <div className="flex items-center gap-2">
              {selectedProduct && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setSearchQuery('');
                    setPhysicalStockInput('');
                    setNotesInput('');
                  }}
                  className="h-9 px-3 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50"
                >
                  Batal
                </button>
              )}

              <AdminButton
                type="submit"
                disabled={!selectedProduct || physicalStockInput === '' || isSubmittingOpname}
                loading={isSubmittingOpname}
              >
                Simpan Hasil Opname
              </AdminButton>
            </div>
          </div>
        </form>
      </div>

      {/* Opname History Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden space-y-0">
        {/* Table Controls */}
        <div className="p-3.5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Riwayat Pemeriksaan Stock Opname
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Catatan penyesuaian stok fisik yang telah diverifikasi
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
              placeholder="Cari produk, catatan, admin..."
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
            value={historyDiffFilter}
            onChange={(e) => {
              setHistoryDiffFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:border-gray-400"
          >
            <option value="ALL">Semua Selisih</option>
            <option value="DEFICIT">Defisit (Stok Berkurang)</option>
            <option value="SURPLUS">Surplus (Stok Bertambah)</option>
            <option value="MATCH">Cocok (Selisih 0)</option>
          </select>

          <select
            value={historyDateFilter}
            onChange={(e) => {
              setHistoryDateFilter(e.target.value);
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

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Tanggal</th>
                <th className="py-2.5 px-3.5">Produk</th>
                <th className="py-2.5 px-3.5 text-right">Stok Sistem</th>
                <th className="py-2.5 px-3.5 text-right">Stok Fisik</th>
                <th className="py-2.5 px-3.5 text-right">Selisih</th>
                <th className="py-2.5 px-3.5">Keterangan</th>
                <th className="py-2.5 px-3.5">Pemeriksa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedOpnames.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-gray-400">
                    Tidak ada riwayat stock opname yang sesuai filter.
                  </td>
                </tr>
              ) : (
                paginatedOpnames.map((item) => {
                  const diff = Number(item.difference ?? 0);
                  const isZero = diff === 0;
                  const isPositive = diff > 0;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/60">
                      <td className="py-2.5 px-3.5 text-gray-500 whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="py-2.5 px-3.5 font-medium text-gray-900">
                        {item.product?.name || item.productName || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-gray-600">
                        {item.systemStock}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-medium text-gray-900">
                        {item.physicalStock}
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium border ${
                          isZero 
                            ? 'bg-gray-50 text-gray-700 border-gray-200' 
                            : isPositive 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                            : 'bg-red-50 text-red-800 border-red-200'
                        }`}>
                          {isPositive ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-gray-600 max-w-[200px] truncate" title={item.notes}>
                        {item.notes || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-gray-500 whitespace-nowrap">
                        {item.adminName || 'Admin'}
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
              Halaman {currentPage} dari {totalPages} ({filteredOpnames.length} total data)
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

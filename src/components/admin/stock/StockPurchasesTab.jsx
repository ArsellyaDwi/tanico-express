"use client";

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  X
} from 'lucide-react';
import { formatRupiah, formatDateTime } from '@/utils/formatters';

export default function StockPurchasesTab({
  orders = [],
  stockHistory = [],
  isLoading = false,
  onRefresh
}) {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected Order for Modal Detail
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Map each order to its linked stock mutations
  const ordersWithStock = useMemo(() => {
    return orders.map((order) => {
      const linkedMutations = stockHistory.filter(
        h => h.orderId === order.id || (h.notes && h.notes.includes(order.id))
      );

      const purchaseMutations = linkedMutations.filter(
        h => h.source === 'PURCHASE' || h.type === 'Keluar'
      );

      const cancelMutations = linkedMutations.filter(
        h => h.source === 'CANCELLATION' || (h.type === 'Masuk' && h.notes?.includes('dibatalkan'))
      );

      const itemsDeductedStock = (order.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
      const mutationDeductedStock = purchaseMutations.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);
      const totalStockOut = mutationDeductedStock > 0 ? mutationDeductedStock : itemsDeductedStock;

      return {
        ...order,
        linkedMutations,
        purchaseMutations,
        cancelMutations,
        totalStockOut
      };
    });
  }, [orders, stockHistory]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();

    return ordersWithStock.filter((order) => {
      if (q) {
        const matchesId = (order.id || '').toLowerCase().includes(q);
        const matchesName = (order.customerName || '').toLowerCase().includes(q);
        const matchesPhone = (order.phone || '').toLowerCase().includes(q);
        const matchesItem = (order.items || []).some(it => (it.name || '').toLowerCase().includes(q));
        if (!matchesId && !matchesName && !matchesPhone && !matchesItem) return false;
      }

      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }

      if (fulfillmentFilter !== 'ALL') {
        const f = (order.fulfillmentMethod || 'DELIVERY').toUpperCase();
        if (f !== fulfillmentFilter.toUpperCase()) return false;
      }

      if (dateFilter !== 'ALL' && order.createdAt) {
        const itemDate = new Date(order.createdAt);
        const diffMs = now - itemDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (dateFilter === 'TODAY' && diffDays > 1) return false;
        if (dateFilter === '7DAYS' && diffDays > 7) return false;
        if (dateFilter === '30DAYS' && diffDays > 30) return false;
      }

      return true;
    });
  }, [ordersWithStock, searchQuery, statusFilter, fulfillmentFilter, dateFilter]);

  // Aggregated totals
  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  }, [filteredOrders]);

  const totalStockOutAll = useMemo(() => {
    return filteredOrders.reduce((acc, o) => acc + (Number(o.totalStockOut) || 0), 0);
  }, [filteredOrders]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  return (
    <div className="space-y-3">
      {/* Search and Filters Header */}
      <div className="bg-white p-3.5 rounded-lg border border-gray-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Daftar Pembelian & Pengurangan Stok
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Menampilkan {filteredOrders.length} transaksi pesanan &middot; Total nilai: {formatRupiah(totalRevenue)} &middot; Stok keluar: {totalStockOutAll} unit
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

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari no. pesanan, pelanggan, produk..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:border-gray-400"
          >
            <option value="ALL">Semua Status Pesanan</option>
            <option value="Menunggu">Menunggu</option>
            <option value="Diproses">Diproses</option>
            <option value="Dikirim">Dikirim</option>
            <option value="Selesai">Selesai</option>
            <option value="Dibatalkan">Dibatalkan</option>
          </select>

          {/* Fulfillment Filter */}
          <select
            value={fulfillmentFilter}
            onChange={(e) => {
              setFulfillmentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:border-gray-400"
          >
            <option value="ALL">Semua Metode Pemenuhan</option>
            <option value="DELIVERY">Pengantaran (Delivery)</option>
            <option value="PICKUP">Ambil di Tempat (Pickup)</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
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

      {/* Main Orders Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                <th className="py-2.5 px-3.5">No. Pesanan</th>
                <th className="py-2.5 px-3.5">Waktu</th>
                <th className="py-2.5 px-3.5">Pelanggan</th>
                <th className="py-2.5 px-3.5">Produk & Kuantitas</th>
                <th className="py-2.5 px-3.5 text-right">Stok Keluar</th>
                <th className="py-2.5 px-3.5 text-right">Total</th>
                <th className="py-2.5 px-3.5 text-center">Metode</th>
                <th className="py-2.5 px-3.5 text-center">Status</th>
                <th className="py-2.5 px-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs text-gray-400">
                    Tidak ada riwayat pembelian yang sesuai filter.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const isCancelled = order.status === 'Dibatalkan' || order.cancellationStatus;
                  const isDone = order.status === 'Selesai';

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/60">
                      {/* No Pesanan */}
                      <td className="py-2.5 px-3.5 font-mono font-medium text-gray-900 whitespace-nowrap">
                        {order.id}
                      </td>

                      {/* Waktu */}
                      <td className="py-2.5 px-3.5 text-gray-500 whitespace-nowrap">
                        {formatDateTime(order.createdAt)}
                      </td>

                      {/* Pelanggan */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{order.customerName || 'Pelanggan Umum'}</div>
                        <div className="text-[11px] text-gray-500">{order.phone || '-'}</div>
                      </td>

                      {/* Produk yang dibeli */}
                      <td className="py-2.5 px-3.5 max-w-[280px]">
                        <div className="space-y-1">
                          {(order.items || []).slice(0, 3).map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-gray-900 font-medium truncate" title={it.name}>
                                {it.name}
                              </span>
                              <span className="text-gray-500 whitespace-nowrap">
                                {it.quantity} {it.unit || 'kg'} &times; {formatRupiah(it.price || 0)}
                              </span>
                            </div>
                          ))}
                          {(order.items || []).length > 3 && (
                            <div className="text-[10px] text-gray-400">
                              +{(order.items || []).length - 3} produk lainnya
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Stok Keluar */}
                      <td className="py-2.5 px-3.5 text-right font-medium text-gray-900 whitespace-nowrap">
                        <span className={isCancelled ? 'line-through text-gray-400' : ''}>
                          -{order.totalStockOut} unit
                        </span>
                        {isCancelled && (
                          <div className="text-[10px] text-gray-500 font-normal">
                            (dikembalikan)
                          </div>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-2.5 px-3.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {formatRupiah(order.total || 0)}
                      </td>

                      {/* Metode */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <span className="text-[11px] text-gray-600">
                          {(order.fulfillmentMethod || 'DELIVERY').toUpperCase() === 'PICKUP' ? 'Ambil di Tempat' : 'Pengantaran'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium border ${
                          isCancelled
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : isDone
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                          {order.status || 'Menunggu'}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="text-xs font-medium text-[#174C3C] hover:underline cursor-pointer"
                        >
                          Detail
                        </button>
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
              Halaman {currentPage} dari {totalPages} ({filteredOrders.length} total data)
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

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Rincian Pesanan #{selectedOrder.id}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Dibuat pada {formatDateTime(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Customer & Fulfillment Info */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <div>
                  <div className="font-semibold text-gray-700 uppercase text-[10px] tracking-wider">
                    Informasi Pelanggan
                  </div>
                  <div className="mt-1 font-medium text-gray-900">
                    {selectedOrder.customerName || 'Pelanggan Umum'}
                  </div>
                  <div className="text-gray-500">{selectedOrder.phone || '-'}</div>
                  {selectedOrder.address && (
                    <div className="text-gray-600 mt-0.5 text-[11px]">{selectedOrder.address}</div>
                  )}
                </div>

                <div>
                  <div className="font-semibold text-gray-700 uppercase text-[10px] tracking-wider">
                    Pengambilan & Status
                  </div>
                  <div className="mt-1 text-gray-900">
                    Metode: <span className="font-medium">{(selectedOrder.fulfillmentMethod || 'DELIVERY').toUpperCase() === 'PICKUP' ? 'Ambil Sendiri' : 'Pengantaran'}</span>
                  </div>
                  <div className="text-gray-900">
                    Status: <span className="font-medium">{selectedOrder.status || 'Menunggu'}</span>
                  </div>
                  {selectedOrder.cancellationReason && (
                    <div className="text-red-700 text-[11px] mt-0.5">
                      Alasan Batal: {selectedOrder.cancellationReason}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div>
                <div className="font-semibold text-gray-700 uppercase text-[10px] tracking-wider mb-2">
                  Daftar Produk yang Dibeli
                </div>
                <table className="w-full text-left border-collapse border border-gray-200 rounded">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                      <th className="py-2 px-3">Produk</th>
                      <th className="py-2 px-3 text-right">Kuantitas</th>
                      <th className="py-2 px-3 text-right">Harga Satuan</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(selectedOrder.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium text-gray-900">{it.name}</td>
                        <td className="py-2 px-3 text-right text-gray-700">{it.quantity} {it.unit || 'kg'}</td>
                        <td className="py-2 px-3 text-right text-gray-700">{formatRupiah(it.price || 0)}</td>
                        <td className="py-2 px-3 text-right font-medium text-gray-900">
                          {formatRupiah((it.price || 0) * (it.quantity || 1))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-900">
                      <td colSpan={3} className="py-2 px-3 text-right">Total Tagihan</td>
                      <td className="py-2 px-3 text-right">{formatRupiah(selectedOrder.total || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Linked Stock Mutations */}
              <div>
                <div className="font-semibold text-gray-700 uppercase text-[10px] tracking-wider mb-2">
                  Catatan Mutasi Stok Terkait (PURCHASE)
                </div>
                {(!selectedOrder.purchaseMutations || selectedOrder.purchaseMutations.length === 0) ? (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded text-gray-500">
                    Pengurangan stok dilakukan langsung berdasarkan kuantitas item pesanan (-{selectedOrder.totalStockOut} unit).
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedOrder.purchaseMutations.map((mut) => (
                      <div key={mut.id} className="p-2.5 bg-gray-50 border border-gray-200 rounded flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {mut.productName || mut.product?.name || '-'}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {formatDateTime(mut.timestamp || mut.createdAt)} &middot; {mut.cleanNotes || mut.notes}
                          </div>
                        </div>
                        <div className="text-right font-medium text-gray-900">
                          -{mut.quantity} {mut.unit || 'kg'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-100 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback, Component } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useLayout } from '@/context/LayoutContext';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MapPin, 
  Printer, 
  ClipboardCheck, 
  AlertCircle, 
  Calendar,
  Lock,
  SearchX,
  RefreshCw,
  Tag,
  Truck
} from 'lucide-react';
import { formatRupiah, formatDateTime } from '@/utils/formatters';

class DetailErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[DetailTransaksi] Component error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#FCFCFC] text-[#111111] font-jost pb-24 text-left">
          <div className="max-w-4xl mx-auto px-6 pt-8">
            <Link
              href="/akun/transaksi"
              className="inline-flex items-center gap-2 text-xs font-bold text-[#1B4D3E] hover:underline mb-8 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>KEMBALI KE RIWAYAT TRANSAKSI</span>
            </Link>
            <div className="bg-white border border-[#DDE9DF] rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-xs">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-red-50 border border-red-100">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-xl font-bold font-sans text-[#1B4D3E]">
                  Gangguan Tampilan Transaksi
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  Terjadi kendala saat merender detail transaksi. Silakan coba muat ulang halaman.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => this.setState({ hasError: false })}
                  className="px-6 py-2.5 bg-[#1B4D3E] text-white text-xs font-bold rounded-full hover:bg-[#153e32] transition-colors cursor-pointer"
                >
                  Muat Ulang
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function DetailTransaksiSkeleton() {
  return (
    <div className="bg-[#FCFCFC] text-[#111111] font-jost pb-24 text-left animate-pulse">
      <div className="max-w-4xl mx-auto px-6 pt-8 space-y-6">
        <div className="h-4 w-36 bg-gray-200 rounded-md" />
        <div className="bg-white border border-[#DDE9DF] rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-gray-100 pb-6">
            <div className="space-y-2">
              <div className="h-6 w-48 bg-gray-200 rounded-md" />
              <div className="h-3.5 w-32 bg-gray-100 rounded-md" />
            </div>
            <div className="h-8 w-28 bg-gray-200 rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="h-4 w-32 bg-gray-200 rounded-md" />
              <div className="h-3.5 w-48 bg-gray-100 rounded-md" />
              <div className="h-3.5 w-40 bg-gray-100 rounded-md" />
            </div>
            <div className="space-y-3">
              <div className="h-4 w-32 bg-gray-200 rounded-md" />
              <div className="h-3.5 w-56 bg-gray-100 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailTransaksiInner({ orderId: propOrderId }) {
  const router = useRouter();
  const routeParams = useParams();
  const { currentUser } = useLayout();

  // Safely determine order ID from props or route params
  const resolveTargetOrderId = useCallback(() => {
    const raw = propOrderId || routeParams?.orderId || routeParams?.id || (Array.isArray(routeParams?.path) ? routeParams.path[0] : '');
    if (raw && String(raw).trim()) {
      try {
        return decodeURIComponent(String(raw).trim());
      } catch (_) {
        return String(raw).trim();
      }
    }
    return '';
  }, [propOrderId, routeParams]);

  const [resolvedId, setResolvedId] = useState(resolveTargetOrderId);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);

  useEffect(() => {
    let nextId = resolveTargetOrderId();
    if (!nextId && typeof window !== 'undefined' && window.location.pathname) {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && (last.startsWith('ORD-') || last.includes('-'))) {
        try {
          nextId = decodeURIComponent(last.trim());
        } catch (_) {
          nextId = last.trim();
        }
      }
    }
    if (nextId) setResolvedId(nextId);
  }, [resolveTargetOrderId]);

  const fetchOrderDetail = useCallback(async () => {
    const targetId = resolvedId || resolveTargetOrderId();
    if (!targetId) {
      setErrorState({
        type: 'NOT_FOUND',
        message: 'ID transaksi tidak ditemukan pada tautan.'
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorState(null);

    // Retrieve active token: prioritize currentUser, fallback to localStorage
    let activeToken = currentUser?.sessionToken;
    if (!activeToken && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('tanico_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          activeToken = parsed?.sessionToken;
        }
      } catch (_) {}
    }

    const headers = { 'Accept': 'application/json' };
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(targetId)}`, {
        headers,
        credentials: 'include'
      });

      const contentType = res.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      }

      if (res.ok && data) {
        // Handle both direct order object and { success: true, ...order } format
        const finalOrder = data.order || data;
        if (finalOrder && finalOrder.id) {
          setOrder(finalOrder);
          setErrorState(null);
        } else {
          setErrorState({
            type: 'NOT_FOUND',
            message: data.error || `Data transaksi "${targetId}" tidak valid.`
          });
        }
      } else if (res.status === 401) {
        setErrorState({
          type: 'AUTH_REQUIRED',
          message: data?.error || 'Silakan masuk ke akun Anda untuk melihat detail transaksi ini.'
        });
      } else if (res.status === 403) {
        setErrorState({
          type: 'FORBIDDEN',
          message: data?.error || 'Akses ditolak: Transaksi ini adalah milik pengguna lain.'
        });
      } else if (res.status === 404) {
        setErrorState({
          type: 'NOT_FOUND',
          message: data?.error || `Pesanan dengan ID "${targetId}" tidak ditemukan.`
        });
      } else {
        setErrorState({
          type: 'SERVER_ERROR',
          message: data?.error || 'Terjadi gangguan sistem saat memuat pesanan.'
        });
      }
    } catch (err) {
      console.error('[DetailTransaksi] Fetch exception:', err);
      setErrorState({
        type: 'SERVER_ERROR',
        message: 'Gagal terhubung ke server Express API.'
      });
    } finally {
      setLoading(false);
    }
  }, [resolvedId, currentUser, resolveTargetOrderId]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // 1. Loading Skeleton State
  if (loading) {
    return <DetailTransaksiSkeleton />;
  }

  // 2. Error States (Auth Required, Forbidden, Not Found, Server Error)
  if (errorState) {
    return (
      <div className="bg-[#FCFCFC] text-[#111111] font-jost pb-24 text-left">
        <div className="max-w-4xl mx-auto px-6 pt-8">
          <Link
            href="/akun/transaksi"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#1B4D3E] hover:underline mb-8 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>KEMBALI KE RIWAYAT TRANSAKSI</span>
          </Link>

          <div className="bg-white border border-[#DDE9DF] rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-xs">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-gray-50 border border-gray-100">
              {errorState.type === 'AUTH_REQUIRED' && <Lock className="w-8 h-8 text-amber-600" />}
              {errorState.type === 'FORBIDDEN' && <Lock className="w-8 h-8 text-red-600" />}
              {errorState.type === 'NOT_FOUND' && <SearchX className="w-8 h-8 text-gray-500" />}
              {errorState.type === 'SERVER_ERROR' && <AlertCircle className="w-8 h-8 text-red-600" />}
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="text-xl font-bold font-sans text-[#1B4D3E]">
                {errorState.type === 'AUTH_REQUIRED' && 'Login Diperlukan'}
                {errorState.type === 'FORBIDDEN' && 'Akses Ditolak'}
                {errorState.type === 'NOT_FOUND' && 'Transaksi Tidak Ditemukan'}
                {errorState.type === 'SERVER_ERROR' && 'Gangguan Memuat Transaksi'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                {errorState.message}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {errorState.type === 'AUTH_REQUIRED' && (
                <Link
                  href="/login"
                  className="px-6 py-2.5 bg-[#1B4D3E] text-white text-xs font-bold rounded-full hover:bg-[#153e32] transition-colors"
                >
                  Masuk ke Akun
                </Link>
              )}
              {errorState.type === 'SERVER_ERROR' && (
                <button
                  onClick={fetchOrderDetail}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1B4D3E] text-white text-xs font-bold rounded-full hover:bg-[#153e32] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba Lagi</span>
                </button>
              )}
              <Link
                href="/akun/transaksi"
                className="px-6 py-2.5 bg-[#FCFCFC] border border-[#DDE9DF] text-[#1B4D3E] text-xs font-bold rounded-full hover:border-[#1B4D3E] transition-colors"
              >
                Riwayat Transaksi
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return <DetailTransaksiSkeleton />;
  }

  // 3. Normal Order View
  return (
    <div className="bg-[#FCFCFC] text-[#111111] font-jost pb-24 text-left">
      {/* Print Overlay - visible only when printing */}
      <div className="hidden print:block fixed inset-0 bg-white z-[99999] p-12 text-black">
        <div className="border border-black p-8 max-w-2xl mx-auto space-y-6">
          <div className="flex justify-between items-center border-b border-black pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">TANICO INVOICE</h1>
              <p className="text-xs text-gray-500">UMKM Sayur Segar Organik Kab. Bangka</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold">{order.id}</p>
              <p suppressHydrationWarning>{formatDateTime(order.createdAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-bold text-gray-400">PENERIMA:</p>
              <p className="font-bold">{order.customerName}</p>
              <p>{order.phone}</p>
              <p>{order.address}{order.subdistrict ? `, ${order.subdistrict}` : ''}</p>
            </div>
            <div>
              <p className="font-bold text-gray-400">INFO METODE BAYAR:</p>
              <p className="font-bold uppercase">{order.paymentMethod || 'Transfer'}</p>
              <p className="font-bold uppercase text-green-700">STATUS: {order.status}</p>
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="py-2">NAMA PRODUK</th>
                <th className="py-2 text-center">QTY</th>
                <th className="py-2 text-right">HARGA UNIT</th>
                <th className="py-2 text-right">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2">{item.name} <span className="text-[10px] text-gray-400">({item.unit || 'pack'})</span></td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">{formatRupiah(item.price)}</td>
                  <td className="py-2 text-right">{formatRupiah((item.price || 0) * (item.quantity || 1))}</td>
                </tr>
              ))}
              <tr className="font-bold text-sm">
                <td colSpan={3} className="py-4 text-right">TOTAL AKHIR:</td>
                <td className="py-4 text-right">{formatRupiah(order.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Screen Layout */}
      <div className="max-w-4xl mx-auto px-6 pt-8 print:hidden">
        {/* Back Link */}
        <Link 
          href="/akun/transaksi"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#1B4D3E] hover:underline mb-8 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>KEMBALI KE RIWAYAT TRANSAKSI</span>
        </Link>

        <div className="bg-white border border-[#DDE9DF] rounded-3xl p-8 md:p-10 shadow-xs space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-6 border-b border-[#DDE9DF] pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <ClipboardCheck className="w-6 h-6 text-[#1B4D3E]" />
                <h1 className="text-xl md:text-2xl font-bold font-sans text-[#1B4D3E]">Detail Invoice</h1>
              </div>
              <p className="text-xs text-gray-400 mt-1">ID Transaksi: <span className="font-bold text-gray-600">{order.id}</span></p>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 h-10 px-5 bg-[#FCFCFC] border border-[#DDE9DF] hover:border-[#1B4D3E] text-[#1B4D3E] text-xs font-bold rounded-full cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Invoice</span>
            </button>
          </div>

          {/* Status Tracker */}
          <div className="p-6 bg-green-50/50 border border-green-100 rounded-2xl flex gap-4 items-start">
            <AlertCircle className="w-5 h-5 text-green-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-green-700">Status Pesanan: {order.status}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Pesanan Anda telah tercatat pada sistem kami. Sayur organik segar dijadwalkan dipetik pada fajar hari dan segera didistribusikan langsung ke meja makan Anda.
              </p>
            </div>
          </div>

          {/* Shipping Coordinates & Payment Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-y border-[#DDE9DF] py-8">
            <div className="space-y-4">
              <h3 className="font-bold font-sans text-[#1B4D3E] text-sm uppercase tracking-wider">Detail Pengiriman</h3>
              <div className="space-y-2.5 text-xs text-gray-600">
                <div className="flex gap-2.5">
                  <User className="w-4 h-4 text-gray-400 shrink-0" />
                  <p className="font-semibold text-gray-800">{order.customerName}</p>
                </div>
                <div className="flex gap-2.5">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <p>{order.phone}</p>
                </div>
                <div className="flex gap-2.5">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                  <p>{order.address}{order.subdistrict ? `, ${order.subdistrict}` : ''}, Kabupaten Bangka</p>
                </div>
                {order.fulfillmentMethod && (
                  <div className="flex gap-2.5 pt-1">
                    <Truck className="w-4 h-4 text-gray-400 shrink-0" />
                    <p className="font-medium text-[#1B4D3E]">
                      Metode Pengiriman: <span className="font-bold">{order.fulfillmentMethod === 'DELIVERY' ? 'Pengiriman Langsung ke Rumah' : order.fulfillmentMethod}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold font-sans text-[#1B4D3E] text-sm uppercase tracking-wider">Informasi Transaksi</h3>
              <div className="space-y-2.5 text-xs text-gray-600">
                <div className="flex gap-2.5">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <p suppressHydrationWarning>{formatDateTime(order.createdAt)}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">Metode Pembayaran</p>
                  <p className="font-bold text-[#1B4D3E] uppercase mt-0.5">{order.paymentMethod || 'Transfer'}</p>
                </div>
                {order.voucherCode && (
                  <div className="flex items-center gap-2 pt-1 text-emerald-700">
                    <Tag className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold">Voucher Diterapkan: {order.voucherCode}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table Items */}
          <div className="space-y-4">
            <h3 className="font-bold font-sans text-[#1B4D3E] text-sm uppercase tracking-wider">Rincian Belanja</h3>
            <div className="border border-[#DDE9DF] rounded-2xl overflow-hidden">
              <div className="divide-y divide-[#DDE9DF]">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="p-4 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-[#1B4D3E]">{item.name}</p>
                      <p className="text-gray-400 mt-0.5">Jumlah: {item.quantity} x {formatRupiah(item.price)} / {item.unit || 'pack'}</p>
                    </div>
                    <p className="font-bold text-gray-700">{formatRupiah((item.price || 0) * (item.quantity || 1))}</p>
                  </div>
                ))}
              </div>

              <div className="bg-[#FCFCFC] p-5 border-t border-[#DDE9DF] flex justify-between items-center">
                <p className="font-bold text-xs text-[#1B4D3E]">TOTAL KESELURUHAN</p>
                <p className="font-extrabold text-base text-[#1B4D3E]">{formatRupiah(order.totalAmount)}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function DetailTransaksiClient({ orderId }) {
  return (
    <DetailErrorBoundary>
      <DetailTransaksiInner orderId={orderId} />
    </DetailErrorBoundary>
  );
}

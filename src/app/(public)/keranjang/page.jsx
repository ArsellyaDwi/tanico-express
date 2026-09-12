"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useLayout } from '@/context/LayoutContext';
import { ShoppingBag, ArrowRight, Trash2, Plus, Minus, ShieldCheck, Truck } from 'lucide-react';
import PageLayoutWrapper from '@/components/layout/PageLayoutWrapper';
import { formatRupiah } from '@/utils/formatters';

function CartPageContent() {
  const router = useRouter();
  const { cart, removeFromCart, updateQuantity, clearCart, cartSubtotal } = useCart();
  const { addToast } = useLayout();

  const shippingCost = cartSubtotal > 50000 ? 0 : (cart.length > 0 ? 10000 : 0);
  const totalAmount = cartSubtotal + shippingCost;

  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-[#1B4D3E]">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold font-sans text-[#1B4D3E]">Keranjang Belanja Kosong</h1>
        <p className="text-gray-500 text-sm max-w-sm">
          Anda belum memilih produk sayur atau buah organik segar. Yuk jelajahi pilihan panen terbaik kami!
        </p>
        <Link
          href="/produk"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#1B4D3E] hover:bg-[#143D31] text-white text-sm font-semibold rounded-full shadow-md transition-colors"
        >
          <span>Mulai Belanja</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1B4D3E]">Keranjang Belanja</h1>
          <p className="text-sm text-gray-500 mt-1">{cart.length} jenis produk organik siap dikirim</p>
        </div>
        <button
          onClick={() => {
            clearCart();
            if (addToast) addToast('Keranjang belanja telah dikosongkan', 'info');
          }}
          className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Kosongkan</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Item List */}
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <div
              key={item.id || item.productId}
              className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 flex gap-4 items-center shadow-xs hover:border-emerald-100 transition-colors"
            >
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 rounded-xl overflow-hidden shrink-0">
                <Image
                  src={item.image || item.images?.[0] || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300'}
                  alt={item.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-base text-gray-900 truncate">{item.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{item.unit || 'per pack'}</p>
                <p className="text-sm font-bold text-[#1B4D3E] mt-1.5">{formatRupiah(item.price)}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <button
                    onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                    className="p-1.5 hover:bg-gray-200 text-gray-600 transition-colors"
                    aria-label="Kurangi"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-xs font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1.5 hover:bg-gray-200 text-gray-600 transition-colors"
                    aria-label="Tambah"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                  aria-label="Hapus produk"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <div className="pt-2">
            <Link
              href="/produk"
              className="text-xs font-semibold text-[#1B4D3E] hover:underline inline-flex items-center gap-1.5"
            >
              <span>+ Tambah Produk Lain</span>
            </Link>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-5">
          <h2 className="font-bold text-lg text-gray-900 border-b border-gray-100 pb-3">Ringkasan Pesanan</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal Produk</span>
              <span className="font-medium text-gray-900">{formatRupiah(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Ongkos Kirim</span>
              <span className="font-medium text-emerald-600">
                {shippingCost === 0 ? 'GRATIS (Promo)' : formatRupiah(shippingCost)}
              </span>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-between text-base font-bold text-gray-900">
              <span>Total Tagihan</span>
              <span className="text-[#1B4D3E] text-lg">{formatRupiah(totalAmount)}</span>
            </div>
          </div>

          <button
            onClick={() => router.push('/checkout')}
            className="w-full h-12 flex items-center justify-center gap-2 bg-[#1B4D3E] hover:bg-[#143D31] text-white font-bold text-sm rounded-full shadow-md transition-colors"
          >
            <span>Lanjut ke Pembayaran</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="space-y-2 pt-2 text-[11px] text-gray-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Garansi 100% Segar & Organik Bersertifikat</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Pengiriman Cepat Langsung dari Kebun Mitra</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  return (
    <PageLayoutWrapper>
      <CartPageContent />
    </PageLayoutWrapper>
  );
}

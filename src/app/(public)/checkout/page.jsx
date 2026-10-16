"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLayout } from '@/context/LayoutContext';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, ArrowLeft, CreditCard, MapPin, Phone, User, Ticket, Check, AlertCircle } from 'lucide-react';
import PageLayoutWrapper from '@/components/layout/PageLayoutWrapper';
import { formatRupiah } from '@/utils/formatters';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, addToast } = useLayout();
  const { cart, clearCart, loadCart, loading: isCartLoading } = useCart();

  // Detect Buy Now mode
  const isBuyNowParam = searchParams.get('buyNow') === 'true' || searchParams.get('buyNow') === '1';
  const paramProductId = searchParams.get('productId') || '';
  const paramQty = Math.max(1, parseInt(searchParams.get('quantity'), 10) || 1);
  const paramWeightGrams = searchParams.get('weightGrams') ? parseInt(searchParams.get('weightGrams'), 10) : null;

  const [isBuyNow, setIsBuyNow] = useState(isBuyNowParam);
  const [directProduct, setDirectProduct] = useState(null);
  const [directQty, setDirectQty] = useState(paramQty);
  const [directWeightGrams, setDirectWeightGrams] = useState(paramWeightGrams);
  const [isDirectProductLoading, setIsDirectProductLoading] = useState(isBuyNowParam);
  const [directProductError, setDirectProductError] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState('DELIVERY'); // 'DELIVERY' or 'PICKUP'
  const [paymentMethod, setPaymentMethod] = useState('Transfer Bank');
  const [voucherCode, setVoucherCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [voucherApplied, setVoucherApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingServerCart, setIsCheckingServerCart] = useState(!isBuyNowParam);

  // Load direct product details if Buy Now mode is active
  useEffect(() => {
    let resolvedProductId = paramProductId;
    let resolvedQty = paramQty;
    let resolvedWeight = paramWeightGrams;

    if (!resolvedProductId && typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('tanico_buy_now');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.productId) {
            resolvedProductId = parsed.productId;
            resolvedQty = parsed.quantity || 1;
            resolvedWeight = parsed.weightGrams || null;
            setIsBuyNow(true);
          }
        }
      } catch (_) {}
    }

    if (!resolvedProductId) {
      if (isBuyNowParam) {
        setDirectProductError('Produk pembelian langsung tidak valid.');
        setIsDirectProductLoading(false);
      }
      return;
    }

    setDirectQty(resolvedQty);
    setDirectWeightGrams(resolvedWeight);

    let isMounted = true;
    setIsDirectProductLoading(true);

    fetch(`/api/products/${encodeURIComponent(resolvedProductId)}`)
      .then(res => {
        if (!res.ok) throw new Error('Produk tidak ditemukan di database.');
        return res.json();
      })
      .then(prod => {
        if (!isMounted) return;
        if (!prod || !prod.id) {
          throw new Error('Produk tidak ditemukan.');
        }
        if (prod.stock < resolvedQty) {
          setDirectProductError(`Stok produk "${prod.name}" tidak mencukupi (sisa: ${prod.stock}, diminta: ${resolvedQty}).`);
        }
        setDirectProduct(prod);
      })
      .catch(err => {
        if (isMounted) {
          console.error('Failed to load direct buy product:', err);
          setDirectProductError(err.message || 'Gagal memuat produk pembelian langsung.');
        }
      })
      .finally(() => {
        if (isMounted) setIsDirectProductLoading(false);
      });

    return () => { isMounted = false; };
  }, [isBuyNowParam, paramProductId, paramQty, paramWeightGrams]);

  // Synchronize cart directly from Express API on checkout mount/refresh ONLY for regular cart checkout
  useEffect(() => {
    if (isBuyNow) {
      setIsCheckingServerCart(false);
      return;
    }

    let isMounted = true;
    const syncCart = async () => {
      try {
        if (typeof loadCart === 'function') {
          await loadCart(true);
        }
      } catch (err) {
        console.error('Failed to reload cart on checkout mount:', err);
      } finally {
        if (isMounted) {
          setIsCheckingServerCart(false);
        }
      }
    };
    syncCart();
    return () => {
      isMounted = false;
    };
  }, [isBuyNow, currentUser?.id, loadCart]);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setPhone(currentUser.phone || '');
      setAddress(currentUser.address || '');
      setSubdistrict(currentUser.subdistrict || '');
    }
  }, [currentUser]);

  // Determine active items being checked out
  const activeCheckoutItems = isBuyNow
    ? (directProduct ? [{
        id: directProduct.id,
        productId: directProduct.id,
        name: directProduct.name,
        price: Number(directProduct.discountPrice && directProduct.discountPrice > 0 ? directProduct.discountPrice : directProduct.price || 0),
        quantity: directQty,
        unit: directProduct.unit || '',
        image: directProduct.image || directProduct.images?.[0]?.url || directProduct.images?.[0] || '',
        weightGrams: directWeightGrams
      }] : [])
    : cart;

  const subtotal = activeCheckoutItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const shippingCost = fulfillmentMethod === 'PICKUP' ? 0 : (subtotal > 50000 ? 0 : 10000);
  const finalTotal = Math.max(0, subtotal + shippingCost - discount);

  const applyVoucher = () => {
    if (voucherCode.trim().toUpperCase() === 'TANICOPERDANA') {
      setDiscount(15000);
      setVoucherApplied(true);
      if (addToast) addToast('Voucher TANICOPERDANA berhasil digunakan! Diskon Rp 15.000.', 'success');
    } else {
      if (addToast) addToast('Kode voucher tidak valid.', 'error');
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (isBuyNow && directProductError) {
      if (addToast) addToast(directProductError, 'error');
      return;
    }

    if (activeCheckoutItems.length === 0) {
      if (addToast) addToast(isBuyNow ? 'Produk pembelian langsung tidak tersedia.' : 'Keranjang Anda kosong.', 'error');
      return;
    }

    if (!name.trim() || !phone.trim()) {
      if (addToast) addToast('Harap lengkapi nama penerima dan nomor WhatsApp.', 'error');
      return;
    }

    if (fulfillmentMethod === 'DELIVERY') {
      if (!address.trim() || !subdistrict.trim()) {
        if (addToast) addToast('Harap lengkapi alamat pengiriman dan kecamatan Anda.', 'error');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const userObj = currentUser || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('tanico_user') || 'null') : null);
      const reqHeaders = { 'Content-Type': 'application/json' };
      if (userObj?.sessionToken) {
        reqHeaders['Authorization'] = `Bearer ${userObj.sessionToken}`;
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: reqHeaders,
        credentials: 'include',
        body: JSON.stringify({
          isDirectBuy: isBuyNow,
          customerName: name.trim(),
          customerEmail: userObj?.email || '',
          phone: phone.trim(),
          address: fulfillmentMethod === 'PICKUP' ? 'Bangka, Gg. Singkep, Air Ruai' : address.trim(),
          subdistrict: fulfillmentMethod === 'PICKUP' ? 'Air Ruai' : subdistrict.trim(),
          fulfillmentMethod,
          paymentMethod,
          voucherCode: voucherApplied ? voucherCode : '',
          items: activeCheckoutItems.map(item => ({
            productId: item.productId || item.id,
            name: item.name || '',
            price: item.price || 0,
            quantity: item.quantity,
            unit: item.unit || '',
            image: item.image || ''
          }))
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        if (addToast) addToast(data.error || 'Gagal memproses pesanan. Silakan coba lagi.', 'error');
        return;
      }

      const createdOrder = data.order;

      // Simpan ke localStorage untuk halaman pembayaran
      localStorage.setItem('tanico_active_checkout_id', createdOrder.id);
      localStorage.setItem('tanico_active_checkout_total', String(createdOrder.totalAmount));

      // Jika Direct Buy: JANGAN bersihkan keranjang! Hapus hanya session pembelian langsung
      if (isBuyNow) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('tanico_buy_now');
        }
      } else {
        // Jika checkout keranjang normal: bersihkan isi keranjang
        clearCart();
      }

      if (addToast) addToast('Pemesanan berhasil dicatat! Menuju halaman pembayaran.', 'success');

      router.push('/payment');
    } catch (err) {
      console.error('Checkout error:', err);
      if (addToast) addToast(err.message || 'Gagal memproses pesanan. Silakan coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if ((isCheckingServerCart || isCartLoading || isDirectProductLoading) && activeCheckoutItems.length === 0 && !directProductError) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-[#1B4D3E]/20 border-t-[#1B4D3E] rounded-full animate-spin"></div>
        <p className="text-gray-500 text-sm">
          {isBuyNow ? 'Menyiapkan produk pembelian langsung...' : 'Menyelaraskan data keranjang belanja...'}
        </p>
      </div>
    );
  }

  if (isBuyNow && directProductError) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="w-16 h-16 text-rose-500" />
        <h2 className="text-2xl font-bold font-sans text-[#1B4D3E]">Gagal Memuat Produk</h2>
        <p className="text-gray-500 text-sm max-w-sm">{directProductError}</p>
        <button
          onClick={() => router.push('/produk')}
          className="px-6 py-2.5 bg-[#1B4D3E] text-white text-xs font-bold rounded-full cursor-pointer hover:bg-[#143D31]"
        >
          Kembali ke Katalog
        </button>
      </div>
    );
  }

  if (!isBuyNow && cart.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <ShoppingBag className="w-16 h-16 text-gray-300" />
        <h2 className="text-2xl font-bold font-sans text-[#1B4D3E]">Keranjang Belanja Kosong</h2>
        <p className="text-gray-500 text-sm max-w-sm">Anda belum menambahkan sayur organik segar fajar pilihan ke dalam keranjang belanja.</p>
        <button
          onClick={() => router.push('/produk')}
          className="px-6 py-2.5 bg-[#1B4D3E] text-white text-xs font-bold rounded-full cursor-pointer hover:bg-[#143D31]"
        >
          Belanja Sayur Segar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#FCFCFC] text-[#111111] font-jost pb-24 text-left">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => router.push(isBuyNow && directProduct ? `/produk/${encodeURIComponent(directProduct.id)}` : '/produk')}
            className="flex items-center gap-1 text-xs font-bold text-[#1B4D3E] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isBuyNow ? 'KEMBALI KE DETAIL PRODUK' : 'KEMBALI KE KATALOG'}</span>
          </button>

          {isBuyNow && (
            <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold rounded-full">
              Mode Beli Sekarang (1 Produk)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Shipping Form & Payment Column */}
          <div className="lg:col-span-7 bg-white border border-[#DDE9DF] rounded-3xl p-8 shadow-xs space-y-8">
            <h2 className="text-xl font-bold font-sans text-[#1B4D3E] border-b border-[#DDE9DF] pb-4">Detail Pengiriman</h2>

            {/* Pilihan Metode Pengiriman: ORDER / PENGANTARAN vs PICK UP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFulfillmentMethod('DELIVERY')}
                className={`p-3.5 rounded-2xl border text-xs font-bold transition-all flex flex-col items-start gap-1 cursor-pointer text-left ${
                  fulfillmentMethod === 'DELIVERY'
                    ? 'border-[#1B4D3E] bg-[#1B4D3E]/5 text-[#1B4D3E] ring-1 ring-[#1B4D3E]'
                    : 'border-[#DDE9DF] text-gray-500 hover:border-[#1B4D3E]/40'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold">ORDER / PENGANTARAN</span>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    fulfillmentMethod === 'DELIVERY' ? 'border-[#1B4D3E] bg-[#1B4D3E]' : 'border-gray-300'
                  }`}>
                    {fulfillmentMethod === 'DELIVERY' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <span className="text-[10px] font-normal text-gray-500">Pesanan diantar kurir ke alamat rumah Anda</span>
              </button>

              <button
                type="button"
                onClick={() => setFulfillmentMethod('PICKUP')}
                className={`p-3.5 rounded-2xl border text-xs font-bold transition-all flex flex-col items-start gap-1 cursor-pointer text-left ${
                  fulfillmentMethod === 'PICKUP'
                    ? 'border-[#1B4D3E] bg-[#1B4D3E]/5 text-[#1B4D3E] ring-1 ring-[#1B4D3E]'
                    : 'border-[#DDE9DF] text-gray-500 hover:border-[#1B4D3E]/40'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold">PICK UP</span>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    fulfillmentMethod === 'PICKUP' ? 'border-[#1B4D3E] bg-[#1B4D3E]' : 'border-gray-300'
                  }`}>
                    {fulfillmentMethod === 'PICKUP' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <span className="text-[10px] font-normal text-gray-500">Ambil langsung di toko (Bebas Ongkir)</span>
              </button>
            </div>
            
            <form onSubmit={handlePlaceOrder} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Penerima Pesanan</label>
                  <div className="relative h-11">
                    <User className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Nama Penerima"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-full bg-gray-50 border border-[#DDE9DF] focus:border-[#1B4D3E] focus:bg-white rounded-xl text-sm pl-11 pr-4 outline-none transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Nomor WhatsApp HP</label>
                  <div className="relative h-11">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="Contoh: 0812XXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-full bg-gray-50 border border-[#DDE9DF] focus:border-[#1B4D3E] focus:bg-white rounded-xl text-sm pl-11 pr-4 outline-none transition-all duration-300"
                    />
                  </div>
                </div>
              </div>

              {/* Conditional: PICK UP (Statis Toko) vs ORDER/PENGANTARAN (Form Alamat) */}
              {fulfillmentMethod === 'PICKUP' ? (
                <div className="bg-[#1B4D3E]/5 border border-[#DDE9DF] rounded-2xl p-4 flex items-start gap-3.5">
                  <MapPin className="w-5 h-5 text-[#1B4D3E] shrink-0 mt-0.5" />
                  <div className="text-left space-y-1">
                    <p className="text-[11px] font-bold text-[#1B4D3E] uppercase tracking-wider">Lokasi Pengambilan Toko (Pick Up)</p>
                    <p className="text-sm font-semibold text-[#111111]">Bangka, Gg. Singkep, Air Ruai</p>
                    <p className="text-xs text-gray-500">
                      Pesanan Anda akan disiapkan di toko TaniCo. Anda tidak perlu memasukkan alamat pengiriman dan tidak dikenakan ongkos kirim.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Kecamatan (Kab. Bangka)</label>
                    <div className="relative h-11">
                      <MapPin className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required={fulfillmentMethod === 'DELIVERY'}
                        placeholder="Contoh: Pemali, Merawang, Sungailiat"
                        value={subdistrict}
                        onChange={(e) => setSubdistrict(e.target.value)}
                        className="w-full h-full bg-gray-50 border border-[#DDE9DF] focus:border-[#1B4D3E] focus:bg-white rounded-xl text-sm pl-11 pr-4 outline-none transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Alamat Rumah Lengkap</label>
                    <div className="relative h-11">
                      <MapPin className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required={fulfillmentMethod === 'DELIVERY'}
                        placeholder="Jl. Raya, Blok, No Rumah..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full h-full bg-gray-50 border border-[#DDE9DF] focus:border-[#1B4D3E] focus:bg-white rounded-xl text-sm pl-11 pr-4 outline-none transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              <div className="space-y-4 pt-4 border-t border-[#DDE9DF]">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#1B4D3E]">Metode Pembayaran</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'Transfer Bank', desc: 'Virtual Account BCA, Mandiri, BNI' },
                    { id: 'Dompet Digital', desc: 'GoPay, QRIS, ShopeePay' }
                  ].map((p) => (
                    <label
                      key={p.id}
                      onClick={() => setPaymentMethod(p.id)}
                      className={`p-4 border rounded-2xl flex items-start gap-4 cursor-pointer transition-all ${
                        paymentMethod === p.id
                          ? 'border-[#1B4D3E] bg-[#1B4D3E]/5'
                          : 'border-[#DDE9DF] hover:border-[#1B4D3E]/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        checked={paymentMethod === p.id}
                        onChange={() => {}}
                        className="mt-0.5 accent-[#1B4D3E]"
                      />
                      <div>
                        <p className="font-bold text-xs text-[#1B4D3E]">{p.id}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{p.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (isBuyNow && Boolean(directProductError))}
                className="w-full h-12 flex items-center justify-center gap-2 bg-[#1B4D3E] hover:bg-[#143D31] active:bg-[#0F2D24] text-white font-bold text-xs rounded-full shadow-md cursor-pointer transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CreditCard className="w-4.5 h-4.5" />
                    <span>Lanjutkan Pembayaran ({formatRupiah(finalTotal)})</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Cart Bill Details Column */}
          <div className="lg:col-span-5 bg-white border border-[#DDE9DF] rounded-3xl p-8 shadow-xs space-y-6">
            <div className="border-b border-[#DDE9DF] pb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold font-sans text-[#1B4D3E]">Ringkasan Pesanan</h2>
              {isBuyNow && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Pembelian Langsung
                </span>
              )}
            </div>

            <div className="divide-y divide-[#DDE9DF] max-h-60 overflow-y-auto pr-2">
              {activeCheckoutItems.map((item) => (
                <div key={item.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-[#1B4D3E]">{item.name}</p>
                    <p className="text-gray-400 mt-0.5">Jumlah: {item.quantity} x {formatRupiah(item.price)}{item.unit ? ` / ${item.unit}` : ''}</p>
                  </div>
                  <p className="font-bold text-gray-700">{formatRupiah(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>

            {/* Promo Code Input */}
            <div className="pt-4 border-t border-[#DDE9DF] space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Punya Kode Voucher?</p>
              <div className="flex gap-2 h-10">
                <div className="relative flex-grow">
                  <Ticket className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    disabled={voucherApplied}
                    placeholder="Contoh: TANICOPERDANA"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    className="w-full h-full bg-gray-50 border border-[#DDE9DF] rounded-xl pl-9 pr-3 text-xs font-semibold focus:border-[#1B4D3E] outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyVoucher}
                  disabled={voucherApplied}
                  className={`px-4 bg-[#1B4D3E] hover:bg-[#143D31] text-white text-[10px] font-bold rounded-xl flex items-center gap-1 shrink-0 ${
                    voucherApplied ? 'bg-green-600 hover:bg-green-600' : ''
                  }`}
                >
                  {voucherApplied ? <Check className="w-3.5 h-3.5" /> : 'Gunakan'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400">Gunakan voucher <span className="font-bold text-[#1B4D3E]">TANICOPERDANA</span> untuk diskon Rp 15.000!</p>
            </div>

            {/* Bill Receipts */}
            <div className="pt-4 border-t border-[#DDE9DF] space-y-2.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal Sayur</span>
                <span className="font-semibold">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Ongkos Kirim Fajar</span>
                <span className="font-semibold">
                  {shippingCost === 0 ? <span className="text-green-600 font-bold uppercase tracking-wider text-[10px]">GRATIS</span> : formatRupiah(shippingCost)}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Diskon Voucher</span>
                  <span className="font-bold">- {formatRupiah(discount)}</span>
                </div>
              )}

              <div className="pt-4 border-t border-[#DDE9DF] flex justify-between items-center text-sm">
                <span className="font-bold text-[#1B4D3E]">TOTAL BELANJA</span>
                <span className="font-extrabold text-[#1B4D3E] text-base">{formatRupiah(finalTotal)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <PageLayoutWrapper>
      <Suspense fallback={
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-10 h-10 border-3 border-[#1B4D3E]/20 border-t-[#1B4D3E] rounded-full animate-spin"></div>
          <p className="text-gray-500 text-sm">Memuat halaman checkout...</p>
        </div>
      }>
        <CheckoutContent />
      </Suspense>
    </PageLayoutWrapper>
  );
}
"use client";

import React, { Suspense } from 'react';
import StockManager from '@/components/admin/stock/StockManager';

export default function StockPembelianSubpage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">Memuat riwayat pembelian...</div>}>
      <StockManager initialTab="pembelian" />
    </Suspense>
  );
}

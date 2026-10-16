"use client";

import React, { Suspense } from 'react';
import StockManager from '@/components/admin/stock/StockManager';

export default function StockRiwayatSubpage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">Memuat riwayat perubahan stok...</div>}>
      <StockManager initialTab="riwayat" />
    </Suspense>
  );
}

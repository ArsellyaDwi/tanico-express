"use client";

import React, { Suspense } from 'react';
import StockManager from '@/components/admin/stock/StockManager';

export default function StockMutasiSubpage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">Memuat mutasi stok...</div>}>
      <StockManager initialTab="mutasi" />
    </Suspense>
  );
}

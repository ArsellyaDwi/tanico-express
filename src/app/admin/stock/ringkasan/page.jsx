"use client";

import React, { Suspense } from 'react';
import StockManager from '@/components/admin/stock/StockManager';

export default function StockRingkasanSubpage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">Memuat ringkasan stok...</div>}>
      <StockManager initialTab="ringkasan" />
    </Suspense>
  );
}

"use client";

import React, { Suspense } from 'react';
import StockManager from '@/components/admin/stock/StockManager';

export default function StockOpnameSubpage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">Memuat stock opname...</div>}>
      <StockManager initialTab="opname" />
    </Suspense>
  );
}

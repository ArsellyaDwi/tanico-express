"use client";

import React from 'react';

export const STOCK_TABS = [
  {
    id: 'ringkasan',
    label: 'Ringkasan Stok'
  },
  {
    id: 'pembelian',
    label: 'Pembelian'
  },
  {
    id: 'opname',
    label: 'Stock Opname'
  },
  {
    id: 'mutasi',
    label: 'Mutasi Stok'
  },
  {
    id: 'riwayat',
    label: 'Riwayat Perubahan Stok'
  }
];

export default function StockNav({ 
  activeTab, 
  onSelectTab, 
  lowStockCount = 0,
  outOfStockCount = 0,
  ordersCount = 0
}) {
  return (
    <div className="border-b border-gray-200">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mb-px">
        {STOCK_TABS.map((tab) => {
          const isActive = activeTab === tab.id;

          // Subtle count badge if applicable
          let countBadge = null;
          if (tab.id === 'ringkasan' && (lowStockCount > 0 || outOfStockCount > 0)) {
            const count = outOfStockCount + lowStockCount;
            countBadge = (
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                isActive 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {count}
              </span>
            );
          } else if (tab.id === 'pembelian' && ordersCount > 0) {
            countBadge = (
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                isActive 
                  ? 'bg-gray-200 text-gray-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {ordersCount}
              </span>
            );
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'border-[#174C3C] text-[#174C3C] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <span>{tab.label}</span>
              {countBadge}
            </button>
          );
        })}
      </div>
    </div>
  );
}

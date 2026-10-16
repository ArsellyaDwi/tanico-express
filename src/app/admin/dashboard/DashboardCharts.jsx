"use client";

import React from 'react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { formatRupiah } from '@/utils/formatters';

export function SalesTrendChart({ salesTrendData }) {
  const data = Array.isArray(salesTrendData) ? salesTrendData : [];
  if (data.length === 0) {
    return (
      <div className="w-full h-full bg-[#F8FAF9] rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">
        Belum ada data tren penjualan.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#174C3C" stopOpacity={0.25}/>
            <stop offset="95%" stopColor="#174C3C" stopOpacity={0.01}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDE9DF" />
        <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'sans-serif' }} stroke="#9CA3AF" />
        <YAxis tick={{ fontSize: 9, fontFamily: 'sans-serif' }} stroke="#9CA3AF" tickFormatter={(v) => `Rp${v >= 1000 ? (v / 1000) + 'k' : v}`} />
        <Tooltip 
          contentStyle={{ background: '#FFF', border: '1px solid #DDE9DF', borderRadius: '12px', fontSize: '11px', fontFamily: 'sans-serif' }} 
          formatter={(value, name) => [
            name === 'Pendapatan' ? formatRupiah(Number(value)) : `${value} Pesanan`,
            name
          ]}
        />
        <Area type="monotone" dataKey="Pendapatan" stroke="#174C3C" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function OrdersTrendChart({ salesTrendData }) {
  const data = Array.isArray(salesTrendData) ? salesTrendData : [];
  if (data.length === 0) {
    return (
      <div className="w-full h-full bg-[#F8FAF9] rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">
        Belum ada data tren pesanan.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDE9DF" />
        <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'sans-serif' }} stroke="#9CA3AF" />
        <YAxis tick={{ fontSize: 9, fontFamily: 'sans-serif' }} stroke="#9CA3AF" allowDecimals={false} />
        <Tooltip 
          contentStyle={{ background: '#FFF', border: '1px solid #DDE9DF', borderRadius: '12px', fontSize: '11px', fontFamily: 'sans-serif' }} 
          formatter={(value) => [`${value} Transaksi`, 'Jumlah Pesanan']}
        />
        <Bar dataKey="Pesanan" fill="#6E9C7C" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryPieChart({ categoryChartData, COLORS }) {
  const data = Array.isArray(categoryChartData) ? categoryChartData.filter(d => (d?.value || 0) > 0) : [];
  const palette = Array.isArray(COLORS) && COLORS.length > 0 ? COLORS : ['#174C3C', '#6E9C7C', '#AD8B3A', '#8D6E63', '#A1887F', '#BCAAA4'];

  if (data.length === 0) {
    return (
      <div className="w-full h-full bg-[#F8FAF9] rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">
        Belum ada omzet kategori.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={75}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value) => [formatRupiah(Number(value)), 'Omzet']}
          contentStyle={{ fontSize: '10px', borderRadius: '8px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function OrderStatusBarChart({ orderStatusData }) {
  const data = Array.isArray(orderStatusData) ? orderStatusData : [];
  if (data.length === 0) {
    return (
      <div className="w-full h-full bg-[#F8FAF9] rounded-xl flex items-center justify-center text-xs text-gray-400 font-sans">
        Belum ada data status pesanan.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDE9DF" />
        <XAxis dataKey="status" tick={{ fontSize: 9, fontFamily: 'sans-serif' }} stroke="#9CA3AF" />
        <YAxis tick={{ fontSize: 9, fontFamily: 'sans-serif' }} stroke="#9CA3AF" allowDecimals={false} />
        <Tooltip 
          contentStyle={{ fontSize: '10px', borderRadius: '8px' }}
          formatter={(value, name) => [
            name === 'Jumlah' ? `${value} Pesanan` : formatRupiah(Number(value)),
            name
          ]}
        />
        <Bar dataKey="Jumlah" fill="#6E9C7C" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry?.status === 'Selesai' ? '#174C3C' : entry?.status === 'Dibatalkan' ? '#EF4444' : '#6E9C7C'} 
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

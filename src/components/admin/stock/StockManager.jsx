"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { useAdmin } from '@/components/admin/AdminShell';
import StockNav, { STOCK_TABS } from './StockNav';
import StockSummaryTab from './StockSummaryTab';
import StockPurchasesTab from './StockPurchasesTab';
import StockOpnameTab from './StockOpnameTab';
import StockMutationTab from './StockMutationTab';
import StockAuditHistoryTab from './StockAuditHistoryTab';

// Module-level in-memory cache for ultra-fast instant subpage navigation
let cachedStockData = null;
let cachedStockTimestamp = 0;
const STOCK_CACHE_TTL = 45000; // 45 seconds

export function clearStockClientCache() {
  cachedStockData = null;
  cachedStockTimestamp = 0;
}

export default function StockManager({ initialTab = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const {
    products = [],
    refreshProducts,
    handleEditProduct,
    addToast,
    handleAddActivityLog
  } = useAdmin();

  // Resolve active tab from props, URL query parameter, or pathname
  const activeTabFromUrl = useMemo(() => {
    if (initialTab) return initialTab;
    
    const qTab = searchParams.get('tab');
    if (qTab && STOCK_TABS.some(t => t.id === qTab)) {
      return qTab;
    }

    if (pathname) {
      const segments = pathname.split('/').filter(Boolean);
      const lastSeg = segments[segments.length - 1];
      if (STOCK_TABS.some(t => t.id === lastSeg)) {
        return lastSeg;
      }
    }

    return 'ringkasan';
  }, [initialTab, searchParams, pathname]);

  const [activeTab, setActiveTab] = useState(activeTabFromUrl);

  // Sync tab state when URL changes
  useEffect(() => {
    if (activeTabFromUrl && activeTabFromUrl !== activeTab) {
      setActiveTab(activeTabFromUrl);
    }
  }, [activeTabFromUrl]);

  // Tab switch handler
  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.push(`/admin/stock?${params.toString()}`, { scroll: false });
  };

  // Helper for auth headers
  const getAuthHeaders = useCallback(() => {
    if (typeof window === 'undefined') return {};
    try {
      const u = JSON.parse(localStorage.getItem('tanico_user') || 'null');
      return u?.sessionToken ? { Authorization: `Bearer ${u.sessionToken}` } : {};
    } catch (e) {
      return {};
    }
  }, []);

  // Backend state for orders, stock history, and opname
  const [orders, setOrders] = useState(cachedStockData?.orders || []);
  const [stockHistory, setStockHistory] = useState(cachedStockData?.stockHistory || []);
  const [opnameHistory, setOpnameHistory] = useState(cachedStockData?.opnameHistory || []);
  const [isLoadingData, setIsLoadingData] = useState(!cachedStockData);

  // Fetch all backend data
  const fetchAllStockData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedStockData && (now - cachedStockTimestamp < STOCK_CACHE_TTL)) {
      setOrders(cachedStockData.orders);
      setStockHistory(cachedStockData.stockHistory);
      setOpnameHistory(cachedStockData.opnameHistory);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    try {
      const headers = getAuthHeaders();

      const [ordersRes, historyRes, opnameRes] = await Promise.allSettled([
        fetch('/api/admin/orders', { headers }),
        fetch('/api/admin/stock/history?limit=300', { headers }),
        fetch('/api/admin/stock-opname', { headers })
      ]);

      let nextOrders = orders;
      let nextHistory = stockHistory;
      let nextOpname = opnameHistory;

      if (ordersRes.status === 'fulfilled' && ordersRes.value.ok) {
        const oData = await ordersRes.value.json();
        nextOrders = Array.isArray(oData) ? oData : (Array.isArray(oData?.items) ? oData.items : []);
        setOrders(nextOrders);
      }

      if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
        const hData = await historyRes.value.json();
        nextHistory = Array.isArray(hData) ? hData : [];
        setStockHistory(nextHistory);
      }

      if (opnameRes.status === 'fulfilled' && opnameRes.value.ok) {
        const opData = await opnameRes.value.json();
        nextOpname = Array.isArray(opData) ? opData : (Array.isArray(opData?.items) ? opData.items : []);
        setOpnameHistory(nextOpname);
      }

      cachedStockData = {
        orders: nextOrders,
        stockHistory: nextHistory,
        opnameHistory: nextOpname
      };
      cachedStockTimestamp = Date.now();

      if (typeof refreshProducts === 'function') {
        refreshProducts(force);
      }
    } catch (err) {
      console.error('Error fetching stock data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [getAuthHeaders, refreshProducts, orders, stockHistory, opnameHistory]);

  useEffect(() => {
    fetchAllStockData();
  }, [fetchAllStockData]);

  const lowStockCount = useMemo(() => {
    return products.filter(p => {
      const s = Number(p?.stock ?? 0);
      return s > 0 && s <= 10;
    }).length;
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter(p => Number(p?.stock ?? 0) <= 0).length;
  }, [products]);

  return (
    <div className="space-y-4 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block">
            MANAJEMEN PERSEDIAAN
          </span>
          <h1 className="text-xl sm:text-2xl text-[#174C3C] font-bold mt-0.5">
            Pengelolaan <span className="italic font-normal text-[#6E9C7C]">Stok</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={fetchAllStockData}
          disabled={isLoadingData}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-md shadow-2xs transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
          <span>Perbarui Data</span>
        </button>
      </div>

      {/* Internal Navigation */}
      <StockNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        lowStockCount={lowStockCount}
        outOfStockCount={outOfStockCount}
        ordersCount={orders.length}
      />

      {/* Subpage Content */}
      <div className="pt-2">
        {activeTab === 'ringkasan' && (
          <StockSummaryTab
            products={products}
            stockHistory={stockHistory}
            isLoading={isLoadingData}
            onRefresh={fetchAllStockData}
            onNavigateTab={handleSelectTab}
          />
        )}

        {activeTab === 'pembelian' && (
          <StockPurchasesTab
            orders={orders}
            stockHistory={stockHistory}
            isLoading={isLoadingData}
            onRefresh={fetchAllStockData}
          />
        )}

        {activeTab === 'opname' && (
          <StockOpnameTab
            products={products}
            opnameHistory={opnameHistory}
            isLoading={isLoadingData}
            onRefresh={fetchAllStockData}
            refreshProducts={refreshProducts}
            addToast={addToast}
            handleAddActivityLog={handleAddActivityLog}
          />
        )}

        {activeTab === 'mutasi' && (
          <StockMutationTab
            products={products}
            stockHistory={stockHistory}
            isLoading={isLoadingData}
            onRefresh={fetchAllStockData}
            refreshProducts={refreshProducts}
            addToast={addToast}
            handleAddActivityLog={handleAddActivityLog}
          />
        )}

        {activeTab === 'riwayat' && (
          <StockAuditHistoryTab
            products={products}
            stockHistory={stockHistory}
            isLoading={isLoadingData}
            onRefresh={fetchAllStockData}
          />
        )}
      </div>
    </div>
  );
}

"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  Bell, 
  ChevronDown, 
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { useLayout } from '@/context/LayoutContext';
import Toasts from '@/components/ui/Toasts';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { clearStockClientCache } from '@/components/admin/stock/StockManager';

const AdminContext = createContext(null);

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminShell / AdminProvider');
  }
  return context;
}

export default function AdminShell({ children }) {
  const { currentUser, loginSuccess: layoutLoginSuccess, logout: layoutLogout } = useLayout() || {};
  const router = useRouter();
  const pathname = usePathname();

  const [isCheckingAuth, setIsCheckingAuth] = useState(pathname !== '/admin/login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleSessionExpired = React.useCallback(() => {
    if (pathname === '/admin/login' || pathname.startsWith('/admin/login')) {
      return;
    }
    setIsAuthenticated(false);
    setIsCheckingAuth(false);
    setProducts([]);
    setCategories([]);
    setOrders([]);
    setReviews([]);
    setContacts([]);
    setBanners([]);
    setAdminProfile(null);
    try {
      clearStockClientCache();
    } catch (_) {}
    cacheTimestamps.current = {
      products: 0,
      categories: 0,
      orders: 0,
      reviews: 0,
      contacts: 0,
      settings: 0,
    };
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tanico_admin_user');
      router.replace('/admin/login');
    } else {
      router.replace('/admin/login');
    }
  }, [pathname, router]);

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' }).catch(() => {});
    } catch (e) {}

    if (typeof layoutLogout === 'function') {
      layoutLogout();
    }
    handleSessionExpired();
  };

  // Responsive sidebar toggler
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // DATABASE STATES
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [banners, setBanners] = useState([]);
  const [settings, setSettings] = useState({ id: 'default', siteName: 'TaniCo Admin' });
  const [adminProfile, setAdminProfile] = useState({
    name: 'Administrator',
    role: 'ADMIN',
    email: 'admin@tanico.id',
    avatar: '/avatars/admin.jpg'
  });
  const [logs, setLogs] = useState([]);

  // TOAST MESSAGING STATE
  const [toasts, setToasts] = useState([]);
  const settingsLoadedRef = React.useRef(false);
  const cacheTimestamps = React.useRef({
    products: 0,
    categories: 0,
    orders: 0,
    reviews: 0,
    contacts: 0,
    settings: 0,
  });
  const CACHE_TTL = 45000; // 45 seconds cache TTL for seamless navigation

  const getAuthHeaders = React.useCallback(() => {
    const u = currentUser || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('tanico_user') || 'null') : null);
    return u?.sessionToken ? { Authorization: `Bearer ${u.sessionToken}` } : {};
  }, [currentUser]);

  const refreshProducts = React.useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - cacheTimestamps.current.products < CACHE_TTL) return;
    try {
      const res = await fetch('/api/admin/products', { headers: getAuthHeaders(), credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        handleSessionExpired();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setProducts(data);
          cacheTimestamps.current.products = Date.now();
        }
      }
    } catch (e) {}
  }, [getAuthHeaders, handleSessionExpired]);

  const refreshCategories = React.useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - cacheTimestamps.current.categories < CACHE_TTL) return;
    try {
      const res = await fetch('/api/admin/categories', { headers: getAuthHeaders(), credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        handleSessionExpired();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCategories(data);
          cacheTimestamps.current.categories = Date.now();
        }
      }
    } catch (e) {}
  }, [getAuthHeaders, handleSessionExpired]);

  const refreshOrders = React.useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - cacheTimestamps.current.orders < CACHE_TTL) return;
    try {
      const res = await fetch('/api/admin/orders', { headers: getAuthHeaders(), credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        handleSessionExpired();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOrders(data);
          cacheTimestamps.current.orders = Date.now();
        }
      }
    } catch (e) {}
  }, [getAuthHeaders, handleSessionExpired]);

  const refreshReviews = React.useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - cacheTimestamps.current.reviews < CACHE_TTL) return;
    try {
      const res = await fetch('/api/admin/reviews', { headers: getAuthHeaders(), credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        handleSessionExpired();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setReviews(data);
          cacheTimestamps.current.reviews = Date.now();
        }
      }
    } catch (e) {}
  }, [getAuthHeaders, handleSessionExpired]);

  const refreshContacts = React.useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - cacheTimestamps.current.contacts < CACHE_TTL) return;
    try {
      const res = await fetch('/api/admin/contacts', { headers: getAuthHeaders(), credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        handleSessionExpired();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setContacts(data);
          cacheTimestamps.current.contacts = Date.now();
        }
      }
    } catch (e) {}
  }, [getAuthHeaders, handleSessionExpired]);

  const refreshSettings = React.useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - cacheTimestamps.current.settings < CACHE_TTL) return;
    try {
      const res = await fetch('/api/admin/settings', { headers: getAuthHeaders(), credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        handleSessionExpired();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          setSettings(data);
          cacheTimestamps.current.settings = Date.now();
        }
      }
    } catch (e) {}
  }, [getAuthHeaders, handleSessionExpired]);

  // Route-targeted data fetcher with cache check
  const fetchAdminData = React.useCallback(async () => {
    const p = pathname || '';
    const promises = [];

    // Always fetch settings once if not loaded
    if (!settingsLoadedRef.current) {
      promises.push(refreshSettings().then(() => { settingsLoadedRef.current = true; }));
    }

    if (p.includes('/produk') || p.includes('/products')) {
      promises.push(refreshProducts(), refreshCategories());
    } else if (p.includes('/kategori') || p.includes('/categories')) {
      promises.push(refreshCategories());
    } else if (p.includes('/pesanan') || p.includes('/orders')) {
      promises.push(refreshOrders());
    } else if (p.includes('/ulasan') || p.includes('/reviews')) {
      promises.push(refreshReviews());
    } else if (p.includes('/kontak') || p.includes('/contacts')) {
      promises.push(refreshContacts());
    } else if (p.includes('/stok') || p.includes('/stock')) {
      promises.push(refreshProducts());
    } else if (p.includes('/analitik') || p.includes('/analytics')) {
      promises.push(refreshOrders(), refreshProducts(), refreshCategories());
    } else if (p.includes('/pengaturan') || p.includes('/settings') || p.includes('/homepage')) {
      promises.push(refreshSettings());
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }, [pathname, refreshCategories, refreshContacts, refreshOrders, refreshProducts, refreshReviews, refreshSettings]);

  useEffect(() => {
    if (pathname === '/admin/login' || pathname.startsWith('/admin/login') || !isAuthenticated) {
      return;
    }
    let isMounted = true;
    async function loadAdminData() {
      try {
        const u = currentUser || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('tanico_user') || 'null') : null);

        if (u) {
          setAdminProfile({
            name: u?.name || 'Administrator',
            role: (typeof u?.role === 'string' ? u?.role : (u?.role?.name || 'Admin')).toUpperCase(),
            email: u?.email || '',
            avatar: u?.image || u?.avatar || ''
          });
        }

        if (isMounted) {
          await fetchAdminData();
        }
      } catch (err) {
        console.error('Error loading admin data:', err);
      }
    }
    loadAdminData();
    return () => { isMounted = false; };
  }, [currentUser, isAuthenticated, pathname, fetchAdminData]);

  // Session user switch detector (prevents cross-session data leakage)
  const prevUserIdRef = React.useRef(null);
  useEffect(() => {
    const curId = currentUser?.id || currentUser?.userId;
    if (prevUserIdRef.current && curId && prevUserIdRef.current !== curId) {
      handleSessionExpired();
    }
    if (curId) {
      prevUserIdRef.current = curId;
    }
  }, [currentUser, handleSessionExpired]);

  // Periodic session validity check (every 60s and on tab visibility change)
  useEffect(() => {
    if (!isAuthenticated || pathname === '/admin/login') return;

    let isChecking = false;
    const checkSession = async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        const res = await fetch('/api/admin/auth/me', { headers: getAuthHeaders() });
        if (res.status === 401 || res.status === 403) {
          handleSessionExpired();
        }
      } catch (_) {
        // Network offline, do not aggressively logout
      } finally {
        isChecking = false;
      }
    };

    const intervalId = setInterval(checkSession, 60000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated, pathname, getAuthHeaders, handleSessionExpired]);

  const addToast = (message, type = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const handleAddActivityLog = (action) => {
    setLogs(prev => [{ id: Date.now(), action, time: 'Baru saja' }, ...prev]);
  };

  // CRUD PRODUCTS
  const handleAddProduct = async (newProduct) => {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(newProduct)
      });
      if (res.ok) {
        const saved = await res.json();
        setProducts(prev => [saved, ...prev]);
        cacheTimestamps.current.products = Date.now();
        addToast(`Produk "${newProduct.name}" berhasil diterbitkan!`, 'success');
        handleAddActivityLog(`Menerbitkan produk baru "${newProduct.name}"`);
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast(`Gagal menambahkan produk: ${errData.error || 'Terjadi kesalahan pada server'}`, 'error');
      }
    } catch (err) {
      console.error('Error adding product:', err);
      addToast(`Gagal menambahkan produk: ${err.message}`, 'error');
    }
  };

  const handleEditProduct = async (edited) => {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(edited)
      });
      if (res.ok) {
        const saved = await res.json().catch(() => null);
        setProducts(prev => prev.map(p => p.id === edited.id ? (saved || edited) : p));
        cacheTimestamps.current.products = Date.now();
        addToast(`Perubahan produk "${edited.name}" berhasil disimpan!`, 'success');
        handleAddActivityLog(`Memperbarui rincian produk "${edited.name}"`);
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast(`Gagal memperbarui produk: ${errData.error || 'Terjadi kesalahan pada server'}`, 'error');
      }
    } catch (err) {
      console.error('Error updating product:', err);
      addToast(`Gagal memperbarui produk: ${err.message}`, 'error');
    }
  };

  const handleDeleteProduct = async (id, name) => {
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders()
        }
      });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== id));
        cacheTimestamps.current.products = Date.now();
        addToast(`Produk "${name}" berhasil dihapus.`, 'success');
        handleAddActivityLog(`Menghapus produk "${name}"`);
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast(`Gagal menghapus produk: ${errData.error || 'Terjadi kesalahan pada server'}`, 'error');
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      addToast(`Gagal menghapus produk: ${err.message}`, 'error');
    }
  };

  // CRUD CATEGORIES
  const handleSaveCategories = async (updatedCategories) => {
    try {
      await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(updatedCategories)
      });
      setCategories(updatedCategories);
      cacheTimestamps.current.categories = Date.now();
    } catch (err) {
      console.error('Error saving categories:', err);
    }
  };

  // CRUD ORDERS (Status Transitions)
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updated = await res.json().catch(() => null);
        setOrders(prev => prev.map(o => o.id === orderId ? (updated || { ...o, status: newStatus }) : o));
        cacheTimestamps.current.orders = Date.now();
        addToast(`Status Pesanan ${orderId} diubah ke ${newStatus.toUpperCase()}`, 'success');
        handleAddActivityLog(`Mengubah status pesanan ${orderId} menjadi ${newStatus}`);
        if (newStatus === 'Dibatalkan') {
          refreshProducts(true);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.error || 'Gagal memperbarui status pesanan', 'error');
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      addToast(err.message || 'Koneksi gagal saat memperbarui pesanan', 'error');
    }
  };

  // REVIEWS & CONTACTS
  const handleSaveReviews = async (updatedReviews) => {
    try {
      setReviews(updatedReviews);
      await fetch('/api/admin/reviews', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(updatedReviews)
      });
    } catch (err) {
      console.error('Error saving reviews:', err);
    }
  };

  const handleSaveContacts = async (updatedContacts) => {
    try {
      setContacts(updatedContacts);
      await fetch('/api/admin/contacts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(updatedContacts)
      });
    } catch (err) {
      console.error('Error saving contacts:', err);
    }
  };

  // CUSTOMIZATION & SETTINGS
  const handleSaveBanners = (updatedBanners) => {
    setBanners(updatedBanners);
  };

  const handleSaveSettings = async (updatedSetting) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(updatedSetting)
      });
      if (res.ok) {
        const saved = await res.json();
        setSettings(saved || updatedSetting);
        return { success: true, data: saved };
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Failed to save settings:', err);
        return { success: false, error: err.error || 'Gagal menyimpan pengaturan' };
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      return { success: false, error: err.message || 'Koneksi gagal' };
    }
  };

  const handleSaveAdminProfile = (updatedProfile) => {
    setAdminProfile(updatedProfile);
  };

  // QUICK ACTIONS TRIGGERED FROM OVERVIEW
  const handleQuickAction = (action) => {
    if (action === 'add-product') {
      router.push('/admin/products');
      setTimeout(() => {
        const addBtn = document.querySelector('[aria-label="Tambah Produk"]');
        if (addBtn) addBtn.click();
      }, 100);
    } else if (action === 'restock') {
      router.push('/admin/stock');
    } else if (action.startsWith('restock-')) {
      const prodId = action.replace('restock-', '');
      router.push('/admin/stock');
      setTimeout(() => {
        const selectEl = document.querySelector('select');
        if (selectEl) {
          selectEl.value = prodId;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 100);
    }
  };

  const handleBackToStorefront = () => {
    router.push('/');
  };

  const getActiveUser = () => {
    if (currentUser) {
      const cRole = (typeof currentUser.role === 'string' ? currentUser.role : (currentUser.role?.name || '')).toUpperCase();
      if (cRole === 'ADMIN' || cRole === 'SUPER_ADMIN' || cRole === 'SUPERADMIN' || currentUser.isAdmin) {
        return currentUser;
      }
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('tanico_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          const u = parsed.user || parsed;
          if (u) {
            const roleStr = (typeof u.role === 'string' ? u.role : (u.role?.name || '')).toUpperCase();
            if (roleStr === 'ADMIN' || roleStr === 'SUPER_ADMIN' || roleStr === 'SUPERADMIN' || u.isAdmin) {
              return u;
            }
          }
        }
      } catch (e) {}
    }
    return null;
  };

  useEffect(() => {
    let isMounted = true;

    if (pathname === '/admin/login' || pathname.startsWith('/admin/login')) {
      setIsCheckingAuth(false);
      return;
    }

    if (isAuthenticated) {
      setIsCheckingAuth(false);
      return;
    }

    async function verifyAdminAuth() {
      // 1. Check local session
      const u = getActiveUser();
      if (u) {
        const roleStr = (typeof u.role === 'string' ? u.role : (u.role?.name || '')).toUpperCase();
        if (roleStr === 'ADMIN' || roleStr === 'SUPER_ADMIN' || roleStr === 'SUPERADMIN' || u.isAdmin) {
          if (isMounted) {
            setAdminProfile({
              name: u?.name || 'Administrator',
              role: roleStr || 'ADMIN',
              email: u?.email || '',
              avatar: u?.image || u?.avatar || ''
            });
            setIsAuthenticated(true);
            setIsCheckingAuth(false);
          }
          return;
        }
      }

      // 2. Asynchronous fallback check via /api/admin/auth/me (handles cookies)
      try {
        const res = await fetch('/api/admin/auth/me', {
          headers: getAuthHeaders(),
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          const userObj = data.user || data;
          if (userObj) {
            const roleStr = (typeof userObj.role === 'string' ? userObj.role : (userObj.role?.name || '')).toUpperCase();
            if (roleStr === 'ADMIN' || roleStr === 'SUPER_ADMIN' || roleStr === 'SUPERADMIN') {
              if (typeof window !== 'undefined') {
                localStorage.setItem('tanico_user', JSON.stringify({ ...userObj, role: roleStr }));
              }
              if (isMounted) {
                setAdminProfile({
                  name: userObj.name || 'Administrator',
                  role: roleStr,
                  email: userObj.email || '',
                  avatar: userObj.avatar || userObj.image || ''
                });
                setIsAuthenticated(true);
                setIsCheckingAuth(false);
              }
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Session verification via /api/admin/auth/me error:', err);
      }

      // 3. Truly unauthenticated, safely redirect to login
      if (isMounted) {
        setIsAuthenticated(false);
        setIsCheckingAuth(false);
        if (pathname !== '/admin/login' && !pathname.startsWith('/admin/login')) {
          router.replace('/admin/login');
        }
      }
    }

    verifyAdminAuth();

    return () => {
      isMounted = false;
    };
  }, [currentUser, isAuthenticated, pathname, router, getActiveUser, getAuthHeaders]);

  // If current route is /admin/login, render children directly without admin layout wrapper
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // If checking authentication, show clean minimal loader
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#F6F8F6] flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-[#174C3C] mx-auto" />
          <p className="mt-3 text-xs text-gray-500 font-medium">Memverifikasi sesi admin...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, prevent layout rendering while redirect completes with clean feedback
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F6F8F6] flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-[#174C3C] mx-auto" />
          <p className="mt-3 text-xs text-gray-500 font-medium">Mengarahkan ke login admin...</p>
        </div>
      </div>
    );
  }

  const categoryNamesList = categories.map(c => c.name);

  const contextValue = {
    products,
    setProducts,
    categories,
    categoryNamesList,
    orders,
    reviews,
    contacts,
    banners,
    settings,
    adminProfile,
    logs,
    toasts,
    addToast,
    removeToast: (id) => setToasts(prev => prev.filter(t => t.id !== id)),
    refreshAdminData: fetchAdminData,
    refreshProducts,
    refreshCategories,
    refreshOrders,
    refreshReviews,
    refreshContacts,
    refreshSettings,
    handleAddActivityLog,
    handleAddProduct,
    handleEditProduct,
    handleDeleteProduct,
    handleSaveCategories,
    handleUpdateOrderStatus,
    handleSaveReviews,
    handleSaveContacts,
    handleSaveBanners,
    handleSaveSettings,
    handleSaveAdminProfile,
    handleQuickAction,
    onBackToStorefront: handleBackToStorefront
  };

  return (
    <AdminContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#FCFCFC] text-[#202020] flex relative selection:bg-[#DCEFE0] selection:text-[#174C3C] font-sans">
        
        {/* 1. LEFT SIDEBAR COMPONENT */}
        <AdminSidebar 
          onLogout={handleAdminLogout}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
        />

        {/* 2. RIGHT WORKSPACE AREA */}
        <div className="flex-1 lg:pl-64 flex flex-col min-h-screen overflow-x-hidden">
          
          {/* Top bar header */}
          <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#DDE9DF] py-3.5 px-6 md:px-8 lg:px-12 flex items-center justify-between">
            
            {/* Mobile Hamburg trigger */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg text-[#174C3C]"
                aria-label="Buka Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Back to website button */}
              <button
                onClick={handleBackToStorefront}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-sans uppercase tracking-wider text-gray-500 hover:text-[#174C3C] transition-colors cursor-pointer group font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Kembali Ke Toko</span>
              </button>
            </div>

            {/* Quick status & Admin metadata row */}
            <div className="flex items-center gap-5">
              {/* Notification simulated badge */}
              <button 
                onClick={() => addToast('Pusat Notifikasi: Sistem berjalan normal.', 'info')}
                className="p-2 text-gray-400 hover:text-[#174C3C] transition-colors relative cursor-pointer" 
                aria-label="Notifikasi"
              >
                <Bell className="w-4 h-4" strokeWidth={1.5} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#6E9C7C] rounded-full"></span>
              </button>

              {/* User credentials */}
              <div 
                onClick={() => router.push('/admin/profile')}
                className="flex items-center gap-2.5 pl-4 border-l border-gray-200/60 cursor-pointer group"
              >
                {adminProfile?.avatar ? (
                  <img 
                    src={adminProfile.avatar} 
                    alt="Profil Admin" 
                    className="w-8 h-8 rounded-full object-cover border border-gray-100 group-hover:border-[#174C3C] transition-all"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#174C3C] text-white font-bold text-xs flex items-center justify-center border border-gray-100 group-hover:border-[#174C3C] transition-all">
                    {adminProfile?.name ? adminProfile.name.charAt(0).toUpperCase() : 'A'}
                  </div>
                )}
                <div className="text-left hidden md:block">
                  <span className="font-sans text-xs font-bold text-[#174C3C] block leading-none">{adminProfile.name}</span>
                  <span className="font-sans text-[8px] text-gray-400 uppercase tracking-widest font-semibold mt-0.5 block">{adminProfile.role}</span>
                </div>
                <ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors hidden md:block" />
              </div>
            </div>

          </header>

          {/* Dynamic sub-screen viewport */}
          <main className="flex-1 p-3.5 sm:p-6 md:p-8 lg:p-10 overflow-y-auto">
            <div key={pathname} className="animate-in fade-in duration-75">
              {children}
            </div>
          </main>

        </div>

        {/* 3. ABSOLUTE TOAST NOTIFICATIONS ALERTS CONTAINER */}
        <Toasts toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      </div>
    </AdminContext.Provider>
  );
}

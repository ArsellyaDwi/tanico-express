"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { logger } from '@/utils/logger';

const CartContext = createContext(null);

export function CartProvider({ children, currentUser, onAddToast }) {
  // Helper to safely retrieve current user from prop or local storage
  const getActiveUser = useCallback(() => {
    if (currentUser && (currentUser.id || currentUser.userId)) {
      return currentUser;
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('tanico_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.id || parsed.userId)) return parsed;
        }
      } catch (_) {}
    }
    return null;
  }, [currentUser]);

  // Helper to normalize cart items
  const normalizeCartItems = useCallback((items) => {
    if (!Array.isArray(items)) return [];
    return items.map((item) => {
      const productObj = item.product || {
        id: item.productId || item.id,
        name: item.name || '',
        price: Number(item.price || item.discountPrice || 0),
        unit: item.unit || '',
        image: item.image || item.images?.[0] || ''
      };
      return {
        ...productObj,
        product: productObj,
        productId: item.productId || item.id,
        id: item.productId || item.id,
        quantity: Number(item.quantity) || 1,
        weightGrams: item.weightGrams || item.weight || null,
        cartItemId: item.cartItemId || item.id
      };
    });
  }, []);

  // Initialize cart from localStorage cache on client mount
  const [cart, setCart] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('tanico_cart_cache');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCart(parsed);
          }
        }
      } catch (_) {}
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const isFetchingCartRef = useRef(false);
  const fetchedUserIdRef = useRef(null);
  const previousUserIdRef = useRef(null);

  // Sync cart state to localStorage cache
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (cart && cart.length > 0) {
          localStorage.setItem('tanico_cart_cache', JSON.stringify(cart));
        } else {
          localStorage.removeItem('tanico_cart_cache');
        }
      } catch (_) {}
    }
  }, [cart]);

  // Get auth headers for Express API calls
  const getAuthHeaders = useCallback(() => {
    const user = getActiveUser();
    if (!user) return {};
    const userId = user.id || user.userId;
    const token = user.sessionToken || user.token;
    const headers = {};
    if (userId) {
      headers['x-user-id'] = userId;
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getActiveUser]);

  // Load cart from server (Express API -> Prisma -> PostgreSQL)
  const loadCart = useCallback(async (force = false) => {
    const user = getActiveUser();
    const userId = user?.id || user?.userId;

    if (!userId) {
      // Guest mode: cart is managed locally
      return;
    }

    if (!force && fetchedUserIdRef.current === userId) {
      return;
    }
    if (isFetchingCartRef.current) return;

    isFetchingCartRef.current = true;

    try {
      setLoading(true);
      const res = await fetch('/api/cart', {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeCartItems(data);

        if (Array.isArray(normalized)) {
          if (normalized.length > 0) {
            setCart(normalized);
          } else if (force) {
            setCart([]);
          }
        }
        fetchedUserIdRef.current = userId;
      }
    } catch (err) {
      logger.error('Failed to load cart from server:', err);
    } finally {
      setLoading(false);
      isFetchingCartRef.current = false;
    }
  }, [getActiveUser, getAuthHeaders, normalizeCartItems]);

  // Merge guest cart on login and sync server cart
  useEffect(() => {
    const user = getActiveUser();
    const currentUserId = user?.id || user?.userId;

    if (currentUserId) {
      if (previousUserIdRef.current !== currentUserId) {
        previousUserIdRef.current = currentUserId;

        // Check if there are local guest items to merge into user cart in PostgreSQL
        const currentItems = cart.filter(it => it.productId || it.id);
        if (currentItems.length > 0) {
          fetch('/api/cart/merge', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            },
            credentials: 'include',
            body: JSON.stringify({
              items: currentItems.map(it => ({
                productId: it.productId || it.id,
                quantity: it.quantity || 1
              }))
            })
          })
            .then(res => res.json())
            .then(data => {
              if (data && data.success && Array.isArray(data.items)) {
                setCart(normalizeCartItems(data.items));
                fetchedUserIdRef.current = currentUserId;
              } else {
                loadCart(true);
              }
            })
            .catch(err => {
              logger.error('Failed to merge guest cart:', err);
              loadCart(true);
            });
        } else {
          loadCart(true);
        }
      }
    } else {
      previousUserIdRef.current = null;
      fetchedUserIdRef.current = null;
    }
  }, [currentUser?.id, getActiveUser, getAuthHeaders, normalizeCartItems, loadCart, cart]);

  // Add item to cart
  const addToCart = useCallback(async (product, qty = 1, weightGrams = null, customPrice = null, options = {}) => {
    const productId = product?.id || product?.productId;
    if (!productId) {
      if (onAddToast) onAddToast("ID produk tidak valid.", "error");
      return false;
    }

    const user = getActiveUser();
    let previousCart = [];

    setCart(prevCart => {
      previousCart = prevCart;
      const existing = prevCart.find(item => item.id === productId || item.productId === productId);
      if (existing) {
        return prevCart.map(item =>
          (item.id === productId || item.productId === productId)
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      } else {
        const normalizedNewItem = {
          ...product,
          id: productId,
          product,
          productId,
          quantity: qty,
          weightGrams: weightGrams || product.weightGrams || product.weight || null,
          price: customPrice || product.discountPrice || product.price || 0
        };
        return [...prevCart, normalizedNewItem];
      }
    });

    if (!options.silentToast && onAddToast) {
      onAddToast(`Berhasil menambahkan ${product.name || 'Produk'} ke keranjang.`, 'success');
    }

    // If user is authenticated, sync directly to Express API -> Prisma -> PostgreSQL
    if (user && (user.id || user.userId)) {
      try {
        const res = await fetch('/api/cart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          credentials: 'include',
          body: JSON.stringify({ productId, quantity: qty })
        });
        if (!res.ok) throw new Error('Failed to add item to cart on server');
        return true;
      } catch (err) {
        logger.error('Cart sync error, reverting:', err);
        setCart(previousCart);
        if (onAddToast) onAddToast("Gagal menyelaraskan Keranjang dengan server.", "error");
        return false;
      }
    }

    return true;
  }, [getActiveUser, getAuthHeaders, onAddToast]);

  // Update quantity (if qty <= 0, remove item)
  const updateCartQty = useCallback(async (productId, qty) => {
    const user = getActiveUser();
    let previousCart = [];
    let isFound = false;

    setCart(prevCart => {
      previousCart = prevCart;
      const existing = prevCart.find(item => item.id === productId || item.productId === productId);
      if (!existing) return prevCart;
      isFound = true;

      if (qty <= 0) {
        return prevCart.filter(item => item.id !== productId && item.productId !== productId);
      } else {
        return prevCart.map(item =>
          (item.id === productId || item.productId === productId)
            ? { ...item, quantity: qty }
            : item
        );
      }
    });

    if (!isFound) return;

    if (qty <= 0 && onAddToast) {
      onAddToast('Produk dihapus dari keranjang.', 'info');
    }

    if (user && (user.id || user.userId)) {
      if (qty <= 0) {
        try {
          const res = await fetch(`/api/cart/${productId}`, {
            method: 'DELETE',
            headers: {
              ...getAuthHeaders()
            },
            credentials: 'include'
          });
          if (!res.ok) throw new Error('Failed to delete cart item');
        } catch (err) {
          logger.error('Error deleting cart item:', err);
          setCart(previousCart);
        }
      } else {
        try {
          const res = await fetch('/api/cart', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            },
            credentials: 'include',
            body: JSON.stringify({ productId, setQuantity: qty })
          });
          if (!res.ok) throw new Error('Failed to update cart quantity');
        } catch (err) {
          logger.error('Error updating cart item qty:', err);
          setCart(previousCart);
        }
      }
    }
  }, [getActiveUser, getAuthHeaders, onAddToast]);

  const removeFromCart = useCallback(async (productId) => {
    await updateCartQty(productId, 0);
  }, [updateCartQty]);

  // Clear cart (after checkout or user action)
  const clearCart = useCallback(async () => {
    const user = getActiveUser();
    setCart([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('tanico_cart_cache');
      } catch (_) {}
    }

    if (user && (user.id || user.userId)) {
      try {
        await fetch('/api/cart', {
          method: 'DELETE',
          headers: {
            ...getAuthHeaders()
          },
          credentials: 'include'
        });
      } catch (err) {
        logger.error('Failed to clear cart on server:', err);
      }
    }
  }, [getActiveUser, getAuthHeaders]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
  }, [cart]);

  const value = useMemo(() => ({
    cart,
    cartCount,
    cartSubtotal,
    loading,
    addToCart,
    updateCartQty,
    updateQuantity: updateCartQty,
    removeFromCart,
    clearCart,
    loadCart
  }), [cart, cartCount, cartSubtotal, loading, addToCart, updateCartQty, removeFromCart, clearCart, loadCart]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}

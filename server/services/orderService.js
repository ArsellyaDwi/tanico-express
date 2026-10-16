import prisma from './prisma.js';
import { clearAllCache } from './cache.js';
import { recordStockMutation, STOCK_MUTATION_SOURCES } from './stockService.js';

/**
 * Executes an interactive transaction function with automatic retry for transient
 * conflicts (e.g. PostgreSQL P2034 deadlock, P2028 closed transaction, pool timeout).
 * Ensures consistency by rolling back completely on failure so retries NEVER duplicate history.
 */
export async function runWithTransactionRetry(txFn, maxRetries = 2) {
  let attempt = 0;
  while (true) {
    try {
      return await txFn();
    } catch (err) {
      attempt++;
      const isTransient =
        err?.code === 'P2034' ||
        err?.code === 'P2028' ||
        err?.message?.includes('Transaction not found') ||
        err?.message?.includes('Transaction ID is invalid') ||
        err?.message?.includes('closed transaction') ||
        err?.message?.includes('deadlock detected') ||
        err?.message?.includes('could not obtain lock') ||
        err?.message?.includes('53300') ||
        err?.message?.includes('40P01');

      if (isTransient && attempt <= maxRetries) {
        console.warn(`[OrderService] Transient transaction conflict (attempt ${attempt}/${maxRetries}), retrying:`, err.message);
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt) + Math.random() * 50));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Atomic customer checkout processor.
 * Guarantees that:
 * 1. Product existence and stock availability are strictly verified against current database state.
 * 2. Prices and order total are recalculated using database prices (frontend prices are never trusted).
 * 3. Stock decrement and mutation history creation are executed atomically within a database transaction.
 * 4. Concurrent checkouts cannot cause negative stock.
 *
 * @param {object} params
 * @param {string} params.customerName
 * @param {string} params.phone
 * @param {string} params.address
 * @param {string} [params.subdistrict]
 * @param {string} [params.notes]
 * @param {string} [params.paymentMethod]
 * @param {string} [params.fulfillmentMethod] - 'DELIVERY' | 'PICKUP'
 * @param {string} [params.customerEmail]
 * @param {string} [params.userId]
 * @param {string} [params.voucherCode]
 * @param {Array} params.items - Cart items [{ productId, quantity }]
 * @returns {Promise<object>} Created Order
 */
export async function createCheckoutOrderAtomic({
  customerName,
  phone,
  address,
  subdistrict = '',
  notes = '',
  paymentMethod = 'tf',
  fulfillmentMethod = 'DELIVERY',
  customerEmail = '',
  userId = null,
  voucherCode = '',
  items = [],
  isDirectBuy = false
}) {
  const isPickup = String(fulfillmentMethod).toUpperCase() === 'PICKUP';
  const finalFulfillment = isPickup ? 'PICKUP' : 'DELIVERY';

  const finalName = String(customerName || '').trim();
  const finalPhone = String(phone || '').trim();
  const finalAddress = isPickup
    ? 'Bangka, Gg. Singkep, Air Ruai'
    : String(address || '').trim();
  const finalSubdistrict = isPickup
    ? (subdistrict || 'Air Ruai')
    : String(subdistrict || '').trim();

  if (!finalName || !finalPhone) {
    throw new Error('Nama penerima dan nomor WhatsApp wajib diisi.');
  }

  if (!isPickup && !finalAddress) {
    throw new Error('Alamat pengiriman wajib diisi untuk metode antar (DELIVERY).');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Keranjang belanja Anda kosong.');
  }

  // Pre-fetch products to validate availability and compute authoritative prices
  const productIds = items
    .map(it => it.productId || it.id)
    .filter(Boolean);

  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds } }
  });

  const productMap = new Map(dbProducts.map(p => [p.id, p]));

  // Verify all products exist and calculate authoritative total
  let subtotal = 0;
  const validatedItems = [];

  for (const item of items) {
    const pid = item.productId || item.id;
    const dbProd = productMap.get(pid);

    if (!dbProd) {
      throw new Error(`Produk dengan ID "${pid}" tidak ditemukan di database.`);
    }

    const qty = parseInt(item.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Kuantitas untuk produk "${dbProd.name}" tidak valid.`);
    }

    if (dbProd.stock < qty) {
      throw new Error(
        `Stok produk "${dbProd.name}" tidak mencukupi (tersedia: ${dbProd.stock} ${dbProd.unit || 'kg'}, diminta: ${qty} ${dbProd.unit || 'kg'}).`
      );
    }

    const unitPrice =
      dbProd.discountPrice !== null &&
      dbProd.discountPrice !== undefined &&
      Number(dbProd.discountPrice) > 0
        ? Number(dbProd.discountPrice)
        : Number(dbProd.price);

    subtotal += unitPrice * qty;

    validatedItems.push({
      productId: dbProd.id,
      name: dbProd.name,
      price: unitPrice,
      quantity: qty,
      unit: dbProd.unit || 'kg',
      image: dbProd.image || ''
    });
  }

  const shippingCost = isPickup ? 0 : (subtotal > 50000 ? 0 : 10000);
  let discount = 0;
  if (voucherCode && String(voucherCode).trim().toUpperCase() === 'TANICOPERDANA') {
    discount = 15000;
  }
  const calculatedTotal = Math.max(0, subtotal + shippingCost - discount);

  const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // ATOMIC DATABASE TRANSACTION WITH SAFE TIMEOUT & RETRY
  const order = await runWithTransactionRetry(async () => {
    return await prisma.$transaction(async (tx) => {
      // Deterministically sort items by productId to completely avoid circular database deadlocks
      const sortedItems = [...validatedItems].sort((a, b) =>
        String(a.productId).localeCompare(String(b.productId))
      );

      // 1. Re-check and decrement stock atomically with row-level safety
      for (const item of sortedItems) {
        const freshProd = await tx.product.findUnique({
          where: { id: item.productId }
        });

        if (!freshProd || Number(freshProd.stock) < item.quantity) {
          throw new Error(
            `Stok produk "${freshProd?.name || item.name}" tidak mencukupi saat proses checkout (sisa: ${freshProd?.stock || 0}, diminta: ${item.quantity}).`
          );
        }

        const currentStock = Number(freshProd.stock);
        const stockBefore = currentStock;
        const stockAfter = currentStock - item.quantity;

        // Atomic conditional decrement: guarantees row locking in PostgreSQL and prevents overselling
        const updateRes = await tx.product.updateMany({
          where: {
            id: freshProd.id,
            stock: { gte: item.quantity }
          },
          data: {
            stock: { decrement: item.quantity },
            soldCount: { increment: item.quantity }
          }
        });

        if (updateRes.count === 0) {
          throw new Error(
            `Stok produk "${freshProd.name || item.name}" tidak mencukupi saat proses checkout (stok telah berubah secara bersamaan).`
          );
        }

        // Record mutation history immediately within the transaction
        await recordStockMutation({
          client: tx,
          productId: freshProd.id,
          productName: freshProd.name || item.name,
          type: 'Keluar',
          quantity: item.quantity,
          source: STOCK_MUTATION_SOURCES.PURCHASE,
          orderId,
          actorName: finalName,
          stockBefore,
          stockAfter,
          unit: freshProd.unit || item.unit || 'kg',
          notes: `Pembelian pelanggan ${finalName}`
        });
      }

      // 2. Create Order & OrderItems
      const createdOrder = await tx.order.create({
        data: {
          id: orderId,
          customerName: finalName,
          phone: finalPhone,
          address: finalAddress,
          subdistrict: finalSubdistrict,
          notes: String(notes || '').trim(),
          totalAmount: calculatedTotal,
          status: 'Menunggu',
          paymentMethod: paymentMethod || 'tf',
          fulfillmentMethod: finalFulfillment,
          customerEmail: String(customerEmail || '').trim(),
          userId: userId || null,
          voucherCode: String(voucherCode || '').trim(),
          items: {
            create: validatedItems.map(it => ({
              productId: it.productId,
              name: it.name,
              price: it.price,
              quantity: it.quantity,
              unit: it.unit,
              image: it.image
            }))
          }
        },
        include: {
          items: true,
          user: true
        }
      });

      // 3. Clear user's active cart in database ONLY IF this was a cart checkout (not direct buy)
      if (userId && !isDirectBuy) {
        const userCart = await tx.cart.findUnique({ where: { userId } });
        if (userCart) {
          await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });
        }
      }

      return createdOrder;
    }, {
      maxWait: 10000, // 10s pool wait
      timeout: 25000  // 25s execution timeout to prevent premature closed-transaction errors
    });
  });

  clearAllCache();
  return order;
}

/**
 * Atomic order status updater.
 * Guarantees that:
 * 1. Progressing active statuses ('Menunggu' -> 'Diproses' -> 'Dikirim' -> 'Selesai') DOES NOT deduct stock again.
 * 2. Canceling ('Dibatalkan') returns stock to inventory and logs mutation EXACTLY ONCE.
 * 3. Multiple cancellations cannot cause duplicate stock replenishment.
 * 4. Re-activating a canceled order re-checks availability and deducts stock safely.
 *
 * @param {string} orderId
 * @param {string} newStatus - 'Menunggu' | 'Diproses' | 'Dikirim' | 'Selesai' | 'Dibatalkan'
 * @param {string} [actorName='Admin TaniCo']
 * @returns {Promise<object>} Updated Order
 */
export async function updateOrderStatusAtomic(orderId, newStatus, actorName = 'Admin TaniCo') {
  if (!orderId || !newStatus) {
    throw new Error('ID pesanan dan status baru wajib disediakan.');
  }

  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true }
  });

  if (!existingOrder) {
    throw new Error(`Pesanan dengan ID "${orderId}" tidak ditemukan.`);
  }

  const currentStatus = existingOrder.status;
  if (currentStatus === newStatus) {
    return existingOrder;
  }

  const isTransitionToCancel = newStatus === 'Dibatalkan' && currentStatus !== 'Dibatalkan';
  const isTransitionFromCancel = currentStatus === 'Dibatalkan' && newStatus !== 'Dibatalkan';

  const updatedOrder = await runWithTransactionRetry(async () => {
    return await prisma.$transaction(async (tx) => {
      // Re-verify current status inside transaction to prevent race conditions
      const freshOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, user: true }
      });

      if (!freshOrder) {
        throw new Error(`Pesanan "${orderId}" tidak ditemukan saat transaksi.`);
      }

      // 1. CANCELLATION: Return stock and record mutation
      if (isTransitionToCancel) {
        if (freshOrder.status === 'Dibatalkan') {
          return freshOrder; // Already canceled, prevent duplicate return!
        }

        for (const item of freshOrder.items) {
          if (!item.productId) continue;

          const prod = await tx.product.findUnique({
            where: { id: item.productId }
          });

          if (prod) {
            const stockBefore = prod.stock;
            const stockAfter = prod.stock + item.quantity;
            const newSoldCount = Math.max(0, (prod.soldCount || 0) - item.quantity);

            await tx.product.update({
              where: { id: prod.id },
              data: {
                stock: { increment: item.quantity },
                soldCount: newSoldCount
              }
            });

            await recordStockMutation({
              client: tx,
              productId: prod.id,
              productName: prod.name,
              type: 'Masuk',
              quantity: item.quantity,
              source: STOCK_MUTATION_SOURCES.CANCELLATION,
              orderId,
              actorName,
              stockBefore,
              stockAfter,
              unit: prod.unit || 'kg',
              notes: `Pengembalian stok pesanan ${orderId} dibatalkan`
            });
          }
        }
      }

      // 2. RE-ACTIVATION from Canceled: Check stock and deduct again
      if (isTransitionFromCancel) {
        for (const item of freshOrder.items) {
          if (!item.productId) continue;

          const prod = await tx.product.findUnique({
            where: { id: item.productId }
          });

          if (!prod || prod.stock < item.quantity) {
            throw new Error(
              `Gagal mengaktifkan kembali pesanan: Stok produk "${prod?.name || item.name}" tidak mencukupi (sisa: ${prod?.stock || 0}, dibutuhkan: ${item.quantity}).`
            );
          }

          const stockBefore = prod.stock;
          const stockAfter = prod.stock - item.quantity;

          const updateRes = await tx.product.updateMany({
            where: {
              id: prod.id,
              stock: { gte: item.quantity }
            },
            data: {
              stock: { decrement: item.quantity },
              soldCount: { increment: item.quantity }
            }
          });

          if (updateRes.count === 0) {
            throw new Error(
              `Gagal mengaktifkan kembali pesanan: Stok produk "${prod?.name || item.name}" tidak mencukupi (stok berubah secara bersamaan).`
            );
          }

          await recordStockMutation({
            client: tx,
            productId: prod.id,
            productName: prod.name,
            type: 'Keluar',
            quantity: item.quantity,
            source: STOCK_MUTATION_SOURCES.PURCHASE,
            orderId,
            actorName,
            stockBefore,
            stockAfter,
            unit: prod.unit || 'kg',
            notes: `Alokasi ulang stok karena status pesanan ${orderId} diaktifkan kembali ke ${newStatus}`
          });
        }
      }

      // 3. Normal transition (e.g. 'Menunggu' -> 'Diproses' -> 'Dikirim' -> 'Selesai'):
      // Does NOT alter stock because it was already allocated at checkout.
      const result = await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
        include: { items: true, user: true }
      });

      return result;
    }, {
      maxWait: 10000,
      timeout: 25000
    });
  });

  clearAllCache();
  return updatedOrder;
}

/**
 * Atomic order deletion.
 * If an active order (not yet canceled) is deleted, restores stock so inventory remains intact.
 *
 * @param {string} orderId
 * @param {string} [actorName='Admin TaniCo']
 */
export async function deleteOrderAtomic(orderId, actorName = 'Admin TaniCo') {
  if (!orderId) throw new Error('ID pesanan wajib disediakan.');

  await runWithTransactionRetry(async () => {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true }
      });

      if (!order) return;

      // If order was not yet canceled, restore stock to prevent phantom loss
      if (order.status !== 'Dibatalkan') {
        for (const item of order.items) {
          if (!item.productId) continue;
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          if (prod) {
            const stockBefore = prod.stock;
            const stockAfter = prod.stock + item.quantity;
            await tx.product.update({
              where: { id: prod.id },
              data: {
                stock: { increment: item.quantity },
                soldCount: Math.max(0, (prod.soldCount || 0) - item.quantity)
              }
            });

            await recordStockMutation({
              client: tx,
              productId: prod.id,
              productName: prod.name,
              type: 'Masuk',
              quantity: item.quantity,
              source: STOCK_MUTATION_SOURCES.CANCELLATION,
              orderId,
              actorName,
              stockBefore,
              stockAfter,
              unit: prod.unit || 'kg',
              notes: `Pengembalian stok akibat penghapusan pesanan ${orderId}`
            });
          }
        }
      }

      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.order.delete({ where: { id: orderId } });
    }, {
      maxWait: 10000,
      timeout: 25000
    });
  });

  clearAllCache();
}

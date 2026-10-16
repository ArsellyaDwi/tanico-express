import prisma from './prisma.js';

/**
 * Standard categories for stock mutation sources across TaniCo
 */
export const STOCK_MUTATION_SOURCES = {
  PURCHASE: 'PURCHASE',
  CANCELLATION: 'CANCELLATION',
  RESTOCK: 'RESTOCK',
  MANUAL_OUT: 'MANUAL_OUT',
  STOCK_OPNAME: 'STOCK_OPNAME',
  MANUAL: 'MANUAL'
};

/**
 * Record a stock mutation into StockHistory.
 * Can be run within an existing transaction by passing tx as the client.
 *
 * @param {object} params
 * @param {object} [params.client] - Prisma client or transaction client
 * @param {string} params.productId - Product ID
 * @param {string} [params.productName] - Product Name
 * @param {string} params.type - 'Masuk' | 'Keluar'
 * @param {number} params.quantity - Positive quantity
 * @param {string} [params.source] - One of STOCK_MUTATION_SOURCES
 * @param {string} [params.orderId] - Referenced order ID if applicable
 * @param {string} [params.actorName] - Person or system triggering mutation
 * @param {string} [params.notes] - Custom notes or explanation
 * @param {number} [params.stockBefore] - Stock before change
 * @param {number} [params.stockAfter] - Stock after change
 * @param {string} [params.unit] - Product unit (e.g. 'kg')
 */
export async function recordStockMutation({
  client = prisma,
  productId,
  productName,
  type,
  quantity,
  source = STOCK_MUTATION_SOURCES.MANUAL,
  orderId,
  actorName = 'Sistem TaniCo',
  notes = '',
  stockBefore,
  stockAfter,
  unit = 'kg'
}) {
  const qtyNum = Math.abs(parseInt(quantity, 10)) || 0;
  if (qtyNum <= 0) return null;

  // Resolve product name and unit only if not provided
  let finalProdName = productName;
  let finalUnit = unit || 'kg';
  if (!finalProdName) {
    try {
      // Use root prisma client instead of transaction client (client may be tx)
      // to avoid putting PostgreSQL transactions into an aborted state on failure
      const prod = await prisma.product.findUnique({
        where: { id: productId },
        select: { name: true, unit: true }
      });
      finalProdName = prod?.name || `Produk #${productId}`;
      if (prod?.unit) finalUnit = prod.unit;
    } catch (_) {
      finalProdName = `Produk #${productId}`;
    }
  }

  // Construct structured notes preserving context and actor
  let prefix = '';
  switch (source) {
    case STOCK_MUTATION_SOURCES.PURCHASE:
      prefix = `[PEMBELIAN${orderId ? ` - ${orderId}` : ''}]`;
      break;
    case STOCK_MUTATION_SOURCES.CANCELLATION:
      prefix = `[PEMBATALAN${orderId ? ` - ${orderId}` : ''}]`;
      break;
    case STOCK_MUTATION_SOURCES.STOCK_OPNAME:
      prefix = '[STOCK OPNAME]';
      break;
    case STOCK_MUTATION_SOURCES.RESTOCK:
      prefix = '[RESTOK]';
      break;
    case STOCK_MUTATION_SOURCES.MANUAL_OUT:
      prefix = '[PENGURANGAN MANUAL]';
      break;
    default:
      prefix = `[MUTASI ${type.toUpperCase()}]`;
  }

  let stockContext = '';
  if (stockBefore !== undefined && stockAfter !== undefined) {
    stockContext = ` (Stok: ${stockBefore} -> ${stockAfter} ${finalUnit})`;
  }

  const cleanNotes = notes ? ` ${notes.trim()}` : '';
  const actorStr = actorName ? ` [Oleh: ${actorName}]` : '';
  const finalNotes = `${prefix}${stockContext}${cleanNotes}${actorStr}`.trim();

  const dbClient = client || prisma;
  return await dbClient.stockHistory.create({
    data: {
      productId,
      productName: finalProdName,
      type: type === 'Masuk' ? 'Masuk' : 'Keluar',
      quantity: qtyNum,
      notes: finalNotes,
      timestamp: new Date()
    }
  });
}

/**
 * Parses structured metadata from StockHistory notes so API consumers
 * have direct typed access to source, orderId, stockBefore, stockAfter, and actorName.
 */
export function parseStockHistoryRecord(record) {
  if (!record) return null;
  const notes = record.notes || '';

  // Determine source
  let source = STOCK_MUTATION_SOURCES.MANUAL;
  if (notes.includes('[PEMBELIAN')) {
    source = STOCK_MUTATION_SOURCES.PURCHASE;
  } else if (notes.includes('[PEMBATALAN')) {
    source = STOCK_MUTATION_SOURCES.CANCELLATION;
  } else if (notes.includes('[STOCK OPNAME')) {
    source = STOCK_MUTATION_SOURCES.STOCK_OPNAME;
  } else if (notes.includes('[RESTOK')) {
    source = STOCK_MUTATION_SOURCES.RESTOCK;
  } else if (notes.includes('[PENGURANGAN MANUAL')) {
    source = STOCK_MUTATION_SOURCES.MANUAL_OUT;
  } else {
    source = record.type === 'Masuk' ? STOCK_MUTATION_SOURCES.RESTOCK : STOCK_MUTATION_SOURCES.MANUAL_OUT;
  }

  // Extract order reference
  let orderId = null;
  const orderMatch = notes.match(/\[(?:PEMBELIAN|PEMBATALAN)\s*-\s*([^\]]+)\]/i) || notes.match(/(ORD-[A-Za-z0-9_-]+)/i);
  if (orderMatch) {
    orderId = orderMatch[1].trim();
  }

  // Extract stockBefore and stockAfter
  let stockBefore = null;
  let stockAfter = null;
  let unit = null;
  const stockMatch = notes.match(/\(Stok:\s*([0-9.]+)\s*->\s*([0-9.]+)(?:\s*([a-zA-Z]+))?\)/i);
  if (stockMatch) {
    stockBefore = parseFloat(stockMatch[1]);
    stockAfter = parseFloat(stockMatch[2]);
    unit = stockMatch[3] || null;
  }

  // Extract actor
  let actorName = null;
  const actorMatch = notes.match(/\[Oleh:\s*([^\]]+)\]/i);
  if (actorMatch) {
    actorName = actorMatch[1].trim();
  }

  // Clean note
  let cleanNotes = notes
    .replace(/\[(?:PEMBELIAN|PEMBATALAN|STOCK OPNAME|RESTOK|PENGURANGAN MANUAL|MUTASI [^\]]+)[^\]]*\]/gi, '')
    .replace(/\(Stok:\s*[0-9.]+\s*->\s*[0-9.]+(?:\s*[a-zA-Z]+)?\)/gi, '')
    .replace(/\[Oleh:\s*[^\]]+\]/gi, '')
    .trim();

  return {
    ...record,
    source,
    orderId,
    stockBefore,
    stockAfter,
    unit: unit || record.product?.unit || 'kg',
    actorName: actorName || 'Admin TaniCo',
    cleanNotes: cleanNotes || '-'
  };
}

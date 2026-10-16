import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes.js';
import productsRoutes from './routes/productsRoutes.js';
import categoriesRoutes from './routes/categoriesRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import ordersRoutes from './routes/ordersRoutes.js';
import checkoutRoutes from './routes/checkoutRoutes.js';
import reviewsRoutes from './routes/reviewsRoutes.js';
import contactsRoutes from './routes/contactsRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { heroBannersRouter, heroBenefitsRouter } from './routes/bannersRoutes.js';
import activityLogsRoutes from './routes/activityLogsRoutes.js';
import homeRoutes from './routes/homeRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { uploadFile } from './controllers/adminController.js';
import { upload } from './middleware/upload.js';
import { requireAdmin } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { clearAllCache } from './services/cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../public/uploads');

const app = express();
app.set('trust proxy', 1);

// Middleware
const envAllowed = (process.env.FRONTEND_URL || process.env.APP_URL || '')
  .split(',')
  .map(url => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set([
  ...envAllowed,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://0.0.0.0:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
]);

function isOriginAllowed(origin) {
  if (!origin) return true; // Server-to-server, SSR, mobile, curl
  if (allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.vercel.app') ||
      host.endsWith('.run.app') ||
      host.endsWith('.ai.studio') ||
      host.endsWith('.googleusercontent.com')
    ) {
      return true;
    }
  } catch (_) {}
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy: Origin '${origin}' is not allowed.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token', 'Cookie']
}));
app.use(cookieParser());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static uploaded files
app.use(['/uploads', '/api/uploads'], express.static(uploadsDir));

// Root route for service info & health status verification
app.get(['/', '/api'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'TaniCo Express API Backend',
    health: '/api/health',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'TaniCo Express API Backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Cache Revalidation handler
app.all(['/api/revalidate', '/revalidate'], (req, res) => {
  clearAllCache();
  res.json({
    success: true,
    revalidated: true,
    service: 'Express API Backend',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes (support both /api/* and /* in case serverless proxy strips prefix)
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/products', '/products'], productsRoutes);
app.use(['/api/categories', '/categories'], categoriesRoutes);
app.use(['/api/cart', '/cart'], cartRoutes);
app.use(['/api/orders', '/orders', '/api/order', '/order'], ordersRoutes);
app.use(['/api/checkout', '/checkout'], checkoutRoutes);
app.use(['/api/reviews', '/reviews'], reviewsRoutes);
app.use(['/api/contacts', '/contacts'], contactsRoutes);
app.use(['/api/gallery', '/gallery'], galleryRoutes);
app.use(['/api/settings', '/settings'], settingsRoutes);
app.use(['/api/hero-banners', '/hero-banners'], heroBannersRouter);
app.use(['/api/hero-benefits', '/hero-benefits'], heroBenefitsRouter);
app.use(['/api/activity-logs', '/activity-logs'], activityLogsRoutes);
app.use(['/api/home', '/home'], homeRoutes);
app.use(['/api/admin', '/admin'], adminRoutes);

// Direct upload route for convenience (requires Admin authentication)
app.post(['/api/upload', '/upload'], requireAdmin, upload.single('file'), uploadFile);

// 404 Catch-All Handler for API routes - Ensures ALWAYS returning JSON, never HTML
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint '${req.method} ${req.originalUrl || req.url}' tidak ditemukan.`,
    status: 404
  });
});

// Error handling middleware
app.use(errorHandler);

export default app;

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes.js';
import productsRoutes from './routes/productsRoutes.js';
import categoriesRoutes from './routes/categoriesRoutes.js';
import articlesRoutes from './routes/articlesRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import ordersRoutes from './routes/ordersRoutes.js';
import checkoutRoutes from './routes/checkoutRoutes.js';
import reviewsRoutes from './routes/reviewsRoutes.js';
import contactsRoutes from './routes/contactsRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import testimonialsRoutes from './routes/testimonialsRoutes.js';
import partnersRoutes from './routes/partnersRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { heroBannersRouter, heroBenefitsRouter } from './routes/bannersRoutes.js';
import activityLogsRoutes from './routes/activityLogsRoutes.js';
import homeRoutes from './routes/homeRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { uploadFile } from './controllers/adminController.js';
import { upload } from './middleware/upload.js';
import { requireAdmin } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.set('trust proxy', 1);

// Middleware
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim().replace(/\/+$/, ''))
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server, SSR)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token', 'Cookie']
}));
app.use(cookieParser());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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

// Mount Routes (support both /api/* and /* in case serverless proxy strips prefix)
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/products', '/products'], productsRoutes);
app.use(['/api/categories', '/categories'], categoriesRoutes);
app.use(['/api/articles', '/articles'], articlesRoutes);
app.use(['/api/cart', '/cart'], cartRoutes);
app.use(['/api/wishlist', '/wishlist'], wishlistRoutes);
app.use(['/api/orders', '/orders'], ordersRoutes);
app.use(['/api/checkout', '/checkout'], checkoutRoutes);
app.use(['/api/reviews', '/reviews'], reviewsRoutes);
app.use(['/api/contacts', '/contacts'], contactsRoutes);
app.use(['/api/gallery', '/gallery'], galleryRoutes);
app.use(['/api/testimonials', '/testimonials'], testimonialsRoutes);
app.use(['/api/partners', '/partners'], partnersRoutes);
app.use(['/api/settings', '/settings'], settingsRoutes);
app.use(['/api/hero-banners', '/hero-banners'], heroBannersRouter);
app.use(['/api/hero-benefits', '/hero-benefits'], heroBenefitsRouter);
app.use(['/api/activity-logs', '/activity-logs'], activityLogsRoutes);
app.use(['/api/home', '/home'], homeRoutes);
app.use(['/api/admin', '/admin'], adminRoutes);

// Direct upload route for convenience (requires Admin authentication)
app.post(['/api/upload', '/upload'], requireAdmin, upload.single('file'), uploadFile);

// Error handling middleware
app.use(errorHandler);

export default app;

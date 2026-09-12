import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  getPartners,
  createPartner,
  updatePartner,
  deletePartner
} from '../controllers/partnersController.js';
import {
  getHeroBanners,
  createHeroBanner,
  updateHeroBanner,
  deleteHeroBanner,
  getHeroBenefits,
  createHeroBenefit,
  updateHeroBenefit,
  deleteHeroBenefit
} from '../controllers/bannersController.js';
import {
  adminLogin,
  adminLogout,
  adminMe,
  getAdminProfile,
  updateAdminProfile,
  getAdminDashboard,
  getAdminAnalytics,
  listAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  listAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  listAdminStock,
  updateAdminStock,
  listAdminOrders,
  updateAdminOrderStatus,
  deleteAdminOrder,
  listAdminCustomers,
  updateAdminCustomer,
  deleteAdminCustomer,
  listAdminReviews,
  updateAdminReview,
  deleteAdminReview,
  listAdminArticles,
  createAdminArticle,
  updateAdminArticle,
  deleteAdminArticle,
  listAdminGallery,
  createAdminGallery,
  updateAdminGallery,
  deleteAdminGallery,
  listAdminTestimonials,
  createAdminTestimonial,
  updateAdminTestimonial,
  deleteAdminTestimonial,
  listAdminContacts,
  updateAdminContact,
  deleteAdminContact,
  listAdminCarts,
  deleteAdminCart,
  listAdminWishlists,
  deleteAdminWishlist,
  getAdminSettings,
  updateAdminSettings,
  uploadFile,
  checkMediaInUse,
  cleanupMedia,
  replaceMedia
} from '../controllers/adminController.js';

const router = Router();

// Public login
router.post('/auth/login', adminLogin);

// Protected routes (requireAdmin)
router.use(requireAdmin);

// Auth & Profile
router.post('/auth/logout', adminLogout);
router.get('/auth/me', adminMe);
router.get('/profile', getAdminProfile);
router.put('/profile', updateAdminProfile);

// Dashboard & Analytics
router.get('/dashboard', getAdminDashboard);
router.get('/analytics', getAdminAnalytics);

// Products
router.get('/products', listAdminProducts);
router.post('/products', createAdminProduct);
router.put('/products', updateAdminProduct);
router.put('/products/:id', updateAdminProduct);
router.delete('/products/:id', deleteAdminProduct);

// Categories
router.get('/categories', listAdminCategories);
router.post('/categories', createAdminCategory);
router.put('/categories', updateAdminCategory);
router.put('/categories/:id', updateAdminCategory);
router.delete('/categories/:id', deleteAdminCategory);

// Stock
router.get('/stock', listAdminStock);
router.put('/stock', updateAdminStock);
router.put('/stock/:id', updateAdminStock);
router.patch('/stock/:id', updateAdminStock);

// Orders
router.get('/orders', listAdminOrders);
router.put('/orders/:id', updateAdminOrderStatus);
router.delete('/orders/:id', deleteAdminOrder);

// Customers
router.get('/customers', listAdminCustomers);
router.put('/customers/:id', updateAdminCustomer);
router.delete('/customers/:id', deleteAdminCustomer);

// Reviews
router.get('/reviews', listAdminReviews);
router.put('/reviews', updateAdminReview);
router.put('/reviews/:id', updateAdminReview);
router.delete('/reviews/:id', deleteAdminReview);

// Articles
router.get('/articles', listAdminArticles);
router.post('/articles', createAdminArticle);
router.put('/articles', updateAdminArticle);
router.put('/articles/:id', updateAdminArticle);
router.delete('/articles/:id', deleteAdminArticle);

// Gallery
router.get('/gallery', listAdminGallery);
router.post('/gallery', createAdminGallery);
router.put('/gallery', updateAdminGallery);
router.put('/gallery/:id', updateAdminGallery);
router.delete('/gallery/:id', deleteAdminGallery);

// Testimonials
router.get('/testimonials', listAdminTestimonials);
router.post('/testimonials', createAdminTestimonial);
router.put('/testimonials', updateAdminTestimonial);
router.put('/testimonials/:id', updateAdminTestimonial);
router.delete('/testimonials/:id', deleteAdminTestimonial);

// Partners
router.get('/partners', getPartners);
router.post('/partners', createPartner);
router.put('/partners', updatePartner);
router.put('/partners/:id', updatePartner);
router.delete('/partners/:id', deletePartner);

// Hero Banners
router.get('/hero-banners', getHeroBanners);
router.post('/hero-banners', createHeroBanner);
router.put('/hero-banners', updateHeroBanner);
router.put('/hero-banners/:id', updateHeroBanner);
router.delete('/hero-banners/:id', deleteHeroBanner);

// Hero Benefits
router.get('/hero-benefits', getHeroBenefits);
router.post('/hero-benefits', createHeroBenefit);
router.put('/hero-benefits', updateHeroBenefit);
router.put('/hero-benefits/:id', updateHeroBenefit);
router.delete('/hero-benefits/:id', deleteHeroBenefit);

// Contacts
router.get('/contacts', listAdminContacts);
router.put('/contacts', updateAdminContact);
router.put('/contacts/:id', updateAdminContact);
router.delete('/contacts/:id', deleteAdminContact);

// Cart & Wishlist
router.get('/cart', listAdminCarts);
router.delete('/cart/:id', deleteAdminCart);
router.get('/wishlist', listAdminWishlists);
router.delete('/wishlist/:id', deleteAdminWishlist);

// Settings
router.get('/settings', getAdminSettings);
router.put('/settings', updateAdminSettings);
router.post('/settings', updateAdminSettings);

// File Upload
router.post('/upload', upload.single('file'), uploadFile);

// Media Lifecycle & Orphan Verification
router.post('/media/check-in-use', checkMediaInUse);
router.post('/media/cleanup', cleanupMedia);
router.post('/media/replace', replaceMedia);

export default router;

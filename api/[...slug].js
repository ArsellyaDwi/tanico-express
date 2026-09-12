import handler from './index.js';

/**
 * Vercel Serverless Catch-All Route for /api/*
 * Directly matches any subpath under /api/ using Vercel's native filesystem router.
 */
export default function catchAllHandler(req, res) {
  // If slug is provided via Vercel catch-all param, reconstruct path if needed
  if (req.query && req.query.slug && (!req.url || req.url === '/' || req.url === '/api')) {
    const slugParts = Array.isArray(req.query.slug) ? req.query.slug : [req.query.slug];
    const pathStr = slugParts.join('/');
    const urlObj = new URL(req.url || '/', 'http://localhost');
    urlObj.searchParams.delete('slug');
    const search = urlObj.search;
    req.url = `/api/${pathStr}${search}`;
  }

  return handler(req, res);
}

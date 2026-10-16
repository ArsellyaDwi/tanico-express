import handler from './index.js';

/**
 * Vercel Serverless Catch-All Route for /api/*
 * Directly matches any subpath under /api/ using Vercel's native filesystem router.
 */
export default function catchAllHandler(req, res) {
  // If slug is provided via Vercel catch-all param, reconstruct path
  if (req.query && req.query.slug) {
    const slugParts = Array.isArray(req.query.slug)
      ? req.query.slug
      : String(req.query.slug).split('/').filter(Boolean);
    const pathStr = slugParts.join('/');

    // Reconstruct search parameters excluding the internal Vercel 'slug' parameter
    let search = '';
    try {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      urlObj.searchParams.delete('slug');
      search = urlObj.search;
    } catch (_) {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(req.query)) {
        if (key !== 'slug') {
          if (Array.isArray(val)) {
            val.forEach(v => params.append(key, v));
          } else if (val !== undefined && val !== null) {
            params.append(key, String(val));
          }
        }
      }
      const s = params.toString();
      search = s ? `?${s}` : '';
    }

    req.url = `/api/${pathStr}${search}`;
    delete req.query.slug;
  }

  return handler(req, res);
}

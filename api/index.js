import app from '../server/app.js';

/**
 * Serverless entry point for Vercel deployment.
 * Handles path normalization across various Vercel rewrite modes:
 * 1. If Vercel rewrites /api/(.*) to /api?__path=$1, restore /api/${__path}.
 * 2. If Vercel rewrites /api/(.*) to /api with x-forwarded-uri or x-matched-path, restore full URL.
 * 3. Retains query strings, headers, and body for downstream Express routes.
 */
export default function handler(req, res) {
  // 1. Check for path passed via query parameter (from vercel.json rewrite: /api?__path=$1)
  if (req.query && req.query.__path) {
    const subpath = Array.isArray(req.query.__path) ? req.query.__path.join('/') : req.query.__path;
    const cleanSubpath = subpath.replace(/^\/+/, '');
    
    // Preserve any existing query parameters other than __path
    const urlObj = new URL(req.url, 'http://localhost');
    urlObj.searchParams.delete('__path');
    const search = urlObj.search;
    
    req.url = `/api/${cleanSubpath}${search}`;
    delete req.query.__path;
  } else {
    // 2. Check headers Vercel edge/lambda provides on rewrites
    const forwardUri = req.headers['x-forwarded-uri'] || 
                       req.headers['x-matched-path'] || 
                       req.headers['x-original-url'];

    // If req.url was flattened to /api or / by a Vercel rewrite, restore from forwardUri
    if ((req.url === '/api' || req.url === '/' || req.url === '') && forwardUri && forwardUri !== '/' && forwardUri !== '/api') {
      req.url = forwardUri;
    }
  }

  // 3. Ensure req.url starts with /
  if (req.url && !req.url.startsWith('/')) {
    req.url = `/${req.url}`;
  }

  return app(req, res);
}


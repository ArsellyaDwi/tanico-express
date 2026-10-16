import app from '../server/app.js';

/**
 * Serverless entry point for Vercel deployment.
 * Handles path normalization across various Vercel rewrite modes:
 * 1. If Vercel rewrites /api/(.*) to /api?__path=$1, restore /api/${__path}.
 * 2. If Vercel rewrites /api/(.*) to /api with x-forwarded-uri or x-matched-path, restore full URL.
 * 3. Extracts __path from either req.query.__path OR raw req.url searchParams.
 * 4. Retains query strings, headers, and body for downstream Express routes.
 */
export default function handler(req, res) {
  let rawUrl = req.url || '/';
  if (!rawUrl.startsWith('/')) {
    rawUrl = `/${rawUrl}`;
  }

  let subpath = null;
  let urlObj = null;

  try {
    urlObj = new URL(rawUrl, 'http://localhost');
    if (req.query && req.query.__path) {
      subpath = Array.isArray(req.query.__path) ? req.query.__path.join('/') : req.query.__path;
    } else if (urlObj.searchParams.has('__path')) {
      subpath = urlObj.searchParams.get('__path');
    }
  } catch (_) {
    urlObj = null;
  }

  if (subpath) {
    const cleanSubpath = String(subpath).replace(/^\/+/, '');
    if (urlObj) {
      urlObj.searchParams.delete('__path');
      const search = urlObj.search;
      req.url = `/api/${cleanSubpath}${search}`;
    } else {
      req.url = `/api/${cleanSubpath}`;
    }
    if (req.query) delete req.query.__path;
  } else if (urlObj && (urlObj.pathname === '/' || urlObj.pathname === '')) {
    req.url = `/api${urlObj.search}`;
  } else {
    req.url = rawUrl;
  }

  // Ensure req.url starts with /
  if (req.url && !req.url.startsWith('/')) {
    req.url = `/${req.url}`;
  }

  return app(req, res);
}

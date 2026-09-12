/**
 * Sanitizes and normalizes the backend API base URL:
 * - Trims whitespace
 * - Ensures a proper http/https protocol prefix
 * - Strips trailing slashes
 * - Strips trailing '/api' to prevent double prefix (/api/api/...)
 */
export function sanitizeApiBaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (!url) return '';

  // Ensure protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  // Remove trailing slashes
  url = url.replace(/\/+$/, '');

  // Strip trailing /api to prevent double /api/api/...
  url = url.replace(/\/api$/i, '');

  // Strip trailing slashes again just in case
  url = url.replace(/\/+$/, '');

  return url;
}

/**
 * Helper to get the base URL for API requests.
 * - In the browser: returns an empty string so requests use relative paths (handled by Next.js rewrites to Express).
 * - On the server (Next.js SSR / Server Components):
 *   Uses INTERNAL_API_URL pointing to the production Express backend.
 *   Production environment MUST NOT silently fallback to localhost.
 */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    return '';
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const rawInternalUrl = process.env.INTERNAL_API_URL;

  // 1. Explicit internal API URL override
  if (rawInternalUrl && rawInternalUrl.trim()) {
    return sanitizeApiBaseUrl(rawInternalUrl);
  }

  // 2. Canonical production App URL (e.g. https://tanico.id or custom domain)
  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    return sanitizeApiBaseUrl(process.env.APP_URL);
  }

  // 3. Vercel Project Production URL (e.g. tanico.vercel.app)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return sanitizeApiBaseUrl(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  // 4. Vercel deployment URL (e.g. tanico-xxx.vercel.app)
  if (process.env.VERCEL_URL) {
    return sanitizeApiBaseUrl(`https://${process.env.VERCEL_URL}`);
  }

  // Fallback to Express backend port (default 5000)
  const port = process.env.BACKEND_PORT || 5000;
  return `http://127.0.0.1:${port}`;
}


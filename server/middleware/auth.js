import { verifySessionToken } from '../services/tokenService.js';
import prisma from '../services/prisma.js';

export function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.cookies && req.cookies.tanico_session) {
    return req.cookies.tanico_session;
  }
  if (req.cookies && req.cookies.tanico_admin_session) {
    return req.cookies.tanico_admin_session;
  }
  if (req.headers['x-session-token']) {
    return req.headers['x-session-token'];
  }
  if (req.query && req.query.token) {
    return String(req.query.token).trim();
  }
  return null;
}

export async function resolveUser(req) {
  if (req.user && req.userId) {
    return req.user;
  }

  const token = extractToken(req);
  if (token) {
    const payload = await verifySessionToken(token);
    const id = payload?.id || payload?.userId || payload?.sub;
    if (id) {
      req.user = {
        ...payload,
        id,
        role: payload.role?.name || payload.role || 'CUSTOMER'
      };
      req.userId = id;
      return req.user;
    }

    // Direct database user ID fallback (UUID lookup)
    const directUser = await prisma.user.findUnique({
      where: { id: token },
      include: { role: true }
    }).catch(() => null);

    if (directUser) {
      req.user = {
        id: directUser.id,
        email: directUser.email,
        name: directUser.name,
        role: directUser.role?.name || 'CUSTOMER'
      };
      req.userId = directUser.id;
      return req.user;
    }
  }

  // Header x-user-id fallback with database verification
  const headerUserId = req.headers['x-user-id'];
  if (headerUserId) {
    const headerUser = await prisma.user.findUnique({
      where: { id: headerUserId },
      include: { role: true }
    }).catch(() => null);

    if (headerUser) {
      req.user = {
        id: headerUser.id,
        email: headerUser.email,
        name: headerUser.name,
        role: headerUser.role?.name || 'CUSTOMER'
      };
      req.userId = headerUser.id;
      return req.user;
    }
  }

  req.user = null;
  req.userId = null;
  return null;
}

export async function getAuthenticatedUserId(req) {
  const user = await resolveUser(req);
  return user?.id || null;
}

export async function authenticate(req, res, next) {
  try {
    await resolveUser(req);
    next();
  } catch (err) {
    req.user = null;
    req.userId = null;
    next();
  }
}

export async function requireAuth(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Gagal memverifikasi sesi login.' });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Akses administrator memerlukan login.' });
    }

    const payload = await verifySessionToken(token);
    if (!payload || !payload.id) {
      return res.status(401).json({ error: 'Sesi administrator tidak valid atau telah berakhir.' });
    }

    const roleName = (payload.role || '').toUpperCase();
    if (roleName !== 'ADMIN' && roleName !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Akses ditolak: Memerlukan hak akses administrator.' });
    }

    // Verify against DB if prisma available
    if (prisma) {
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        include: { role: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Pengguna administrator tidak ditemukan.' });
      }

      const statusUpper = (user.status || 'AKTIF').toUpperCase();
      if (statusUpper === 'NONAKTIF' || statusUpper === 'NON-AKTIF' || statusUpper === 'DISABLED') {
        return res.status(403).json({ error: 'Akun administrator ini telah dinonaktifkan.' });
      }

      const dbRole = (user.role?.name || '').toUpperCase();
      if (dbRole !== 'ADMIN' && dbRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Pengguna tidak memiliki wewenang administrator.' });
      }

      req.adminUser = user;
    }

    req.user = payload;
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    return res.status(401).json({ error: 'Terjadi kesalahan otorisasi administrator.' });
  }
}

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

async function verifySessionToken(token) {
  try {
    const secretKey = process.env.SESSION_SECRET || process.env.SUPABASE_JWT_SECRET || 'tanico_secure_default_session_secret_key_32chars_min';
    const secret = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith('/admin') && !pathname.startsWith('/api/admin');
  const isAdminApi = pathname.startsWith('/api/admin');

  if (isAdminPage || isAdminApi) {
    if (pathname === '/api/admin/auth/login' || pathname === '/api/admin/auth/logout') {
      return NextResponse.next();
    }

    let sessionToken = request.cookies.get('tanico_session')?.value;
    if (!sessionToken) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        sessionToken = authHeader.substring(7).trim();
      } else if (request.headers.get('x-session-token')) {
        sessionToken = request.headers.get('x-session-token');
      }
    }

    let isValidAdmin = false;

    if (sessionToken) {
      const payload = await verifySessionToken(sessionToken);
      if (payload) {
        const roleStr = typeof payload.role === 'object' ? payload.role?.name : payload.role;
        const roleUpper = (roleStr || '').toUpperCase();
        if (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') {
          isValidAdmin = true;
        }
      }
    }

    if (isAdminApi) {
      if (!isValidAdmin) {
        return NextResponse.json(
          { error: 'Unauthorized - Admin access required' },
          { status: 403 }
        );
      }
      return NextResponse.next();
    }

    const isLoginPage = pathname === '/admin/login';
    if (isLoginPage) {
      if (isValidAdmin) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      return NextResponse.next();
    }

    if (!isValidAdmin) {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      if (sessionToken) {
        response.cookies.set('tanico_session', '', { path: '/', maxAge: 0 });
      }
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

async function verifySessionToken(token) {
  try {
    const secretKey = process.env.SESSION_SECRET || 'tanico_secure_default_session_secret_key_32chars_min';
    const secret = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Next.js Frontend Middleware
 * ONLY handles UI page routing and redirects for /admin pages.
 * All API routes (/api/*) are handled exclusively by the Express backend.
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Never intercept API routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Admin UI page protection
  if (pathname.startsWith('/admin')) {
    // Check tanico_admin_session first, then tanico_session
    const sessionToken = request.cookies.get('tanico_admin_session')?.value || request.cookies.get('tanico_session')?.value;

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

    const isLoginPage = pathname === '/admin/login' || pathname === '/admin/login/';
    if (isLoginPage) {
      if (isValidAdmin) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      return NextResponse.next();
    }

    if (pathname === '/admin' || pathname === '/admin/') {
      if (isValidAdmin) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      } else {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
    }

    if (!isValidAdmin) {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      if (request.cookies.has('tanico_admin_session')) {
        response.cookies.set('tanico_admin_session', '', { path: '/', maxAge: 0 });
      }
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
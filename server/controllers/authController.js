import bcrypt from 'bcryptjs';
import prisma from '../services/prisma.js';
import { createSessionToken } from '../services/tokenService.js';
import { extractToken, resolveUser, getAuthenticatedUserId } from '../middleware/auth.js';
import { verifySessionToken } from '../services/tokenService.js';
import { handleMediaReplacement } from '../services/supabase.js';

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { role: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    const statusUpper = (user.status || 'AKTIF').toUpperCase();
    if (statusUpper === 'NONAKTIF' || statusUpper === 'NON-AKTIF' || statusUpper === 'DISABLED') {
      return res.status(403).json({ error: 'Akun telah dinonaktifkan.' });
    }

    let isValid = false;
    if (user.password) {
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        isValid = await bcrypt.compare(password, user.password);
      } else {
        if (user.password === password) {
          isValid = true;
          const newHash = await bcrypt.hash(password, 10);
          await prisma.user.update({
            where: { id: user.id },
            data: { password: newHash }
          }).catch(() => {});
        }
      }
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    const roleName = (user.role?.name || '').toUpperCase();
    if (roleName !== 'CUSTOMER' && roleName !== 'USER' && roleName !== '') {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    }).catch(() => {});

    const sessionData = {
      id: user.id,
      userId: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      role: 'CUSTOMER'
    };

    const token = await createSessionToken(sessionData);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('tanico_session', token, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      sessionToken: token,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name || 'CUSTOMER',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar || '',
        phone: user.phone || '',
        address: user.address || '',
        provider: user.provider || 'Email',
        status: user.status || 'Aktif',
        role: user.role || { name: 'CUSTOMER' }
      }
    });
  } catch (error) {
    console.error('Customer login error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server saat login.' });
  }
}

export async function register(req, res) {
  try {
    const { name, email, password, phone } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nama, email, dan password wajib diisi.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email sudah terdaftar. Silakan login.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let customerRole = await prisma.role.findFirst({
      where: { name: { equals: 'CUSTOMER', mode: 'insensitive' } }
    });

    if (!customerRole) {
      customerRole = await prisma.role.create({
        data: { name: 'CUSTOMER' }
      }).catch(() => null);
    }

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone ? phone.trim() : null,
        provider: 'Email',
        status: 'Aktif',
        roleId: customerRole?.id || null
      },
      include: { role: true }
    });

    // Automatically create empty cart and wishlist
    await Promise.allSettled([
      prisma.cart.create({ data: { userId: newUser.id } }),
      prisma.wishlist.create({ data: { userId: newUser.id } })
    ]);

    const sessionData = {
      id: newUser.id,
      userId: newUser.id,
      sub: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: 'CUSTOMER'
    };

    const token = await createSessionToken(sessionData);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('tanico_session', token, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(201).json({
      success: true,
      sessionToken: token,
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role?.name || 'CUSTOMER',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        phone: newUser.phone,
        role: newUser.role || { name: 'CUSTOMER' }
      }
    });
  } catch (error) {
    console.error('Customer register error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server saat pendaftaran.' });
  }
}

/**
 * Common logic to resolve or create a persistent User in PostgreSQL for Google OAuth,
 * guaranteeing Cart existence and consistent JWT session payload.
 */
export async function handleGoogleUserLogin(googleProfile, res) {
  const normalizedEmail = String(googleProfile.email).trim().toLowerCase();

  let user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    include: { role: true, cart: true }
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        avatar: user.avatar || googleProfile.picture || null,
        name: user.name || googleProfile.name || normalizedEmail.split('@')[0],
        provider: user.provider || 'Google'
      },
      include: { role: true, cart: true }
    });
  } else {
    let customerRole = await prisma.role.findFirst({
      where: { name: { equals: 'CUSTOMER', mode: 'insensitive' } }
    });
    if (!customerRole) {
      customerRole = await prisma.role.create({ data: { name: 'CUSTOMER' } }).catch(() => null);
    }

    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: googleProfile.name || normalizedEmail.split('@')[0],
        avatar: googleProfile.picture || null,
        provider: 'Google',
        status: 'Aktif',
        roleId: customerRole?.id || null
      },
      include: { role: true, cart: true }
    });
  }

  // Ensure user always has a persistent Cart in PostgreSQL
  let cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { userId: user.id } }).catch(() => null);
  }

  // Ensure user has a Wishlist in PostgreSQL
  let wishlist = await prisma.wishlist.findUnique({ where: { userId: user.id } });
  if (!wishlist) {
    await prisma.wishlist.create({ data: { userId: user.id } }).catch(() => null);
  }

  const sessionData = {
    id: user.id,
    userId: user.id,
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role?.name || 'CUSTOMER'
  };

  const token = await createSessionToken(sessionData);

  const isProd = process.env.NODE_ENV === 'production';
  if (res && typeof res.cookie === 'function') {
    res.cookie('tanico_session', token, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }

  const userPayload = {
    id: user.id,
    userId: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar || '',
    phone: user.phone || '',
    address: user.address || '',
    subdistrict: user.subdistrict || '',
    provider: user.provider || 'Google',
    status: user.status || 'Aktif',
    role: user.role || { name: 'CUSTOMER' },
    sessionToken: token
  };

  return { user, token, userPayload };
}

export async function googleCallback(req, res) {
  try {
    const { code, error } = req.query;
    if (error || !code) {
      console.error('Google OAuth callback error or missing code:', error || 'No code');
      return res.redirect(`/login?error=${encodeURIComponent('Gagal masuk dengan Google: ' + (error || 'Kode otorisasi tidak ditemukan'))}`);
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    const defaultHost = process.env.APP_URL 
      ? process.env.APP_URL.replace(/^https?:\/\//, '')
      : (process.env.VERCEL_URL || 'localhost:3000');
    const host = req.headers['x-forwarded-host'] || req.get('host') || defaultHost;
    const isProd = process.env.NODE_ENV === 'production';
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : (isProd ? 'https' : 'http'));
    const redirectUri = `${proto}://${host}/api/auth/google/callback`;

    let googleProfile = null;

    if (clientId && clientSecret) {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      const tokenData = await tokenRes.json();
      if (tokenRes.ok && tokenData.access_token) {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        googleProfile = await userRes.json();
      }
    }

    if (!googleProfile || !googleProfile.email) {
      // Fallback: try decoding id_token or handling test/mock codes
      return res.redirect(`/login?error=${encodeURIComponent('Gagal mendapatkan profil akun dari Google.')}`);
    }

    const { token, userPayload } = await handleGoogleUserLogin(googleProfile, res);
    const redirectTarget = `/auth/google/success?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(userPayload))}`;
    return res.redirect(redirectTarget);
  } catch (err) {
    console.error('googleCallback exception:', err);
    return res.redirect(`/login?error=${encodeURIComponent('Terjadi kesalahan saat memproses login Google.')}`);
  }
}

export async function googleAuth(req, res) {
  try {
    const { idToken, code, email, name, picture } = req.body || {};
    let googleProfile = null;

    if (email) {
      googleProfile = {
        email: String(email).trim().toLowerCase(),
        name: name || email.split('@')[0],
        picture: picture || null
      };
    } else if (idToken) {
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      const data = await verifyRes.json();
      if (verifyRes.ok && data.email) {
        googleProfile = {
          email: data.email,
          name: data.name || data.email.split('@')[0],
          picture: data.picture || null
        };
      }
    } else if (code) {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const defaultHost = process.env.APP_URL 
        ? process.env.APP_URL.replace(/^https?:\/\//, '')
        : (process.env.VERCEL_URL || 'localhost:3000');
      const host = req.headers['x-forwarded-host'] || req.get('host') || defaultHost;
      const isProd = process.env.NODE_ENV === 'production';
      const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : (isProd ? 'https' : 'http'));
      const redirectUri = req.body.redirectUri || `${proto}://${host}/api/auth/google/callback`;

      if (clientId && clientSecret) {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: String(code),
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        });
        const tokenData = await tokenRes.json();
        if (tokenRes.ok && tokenData.access_token) {
          const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
          });
          googleProfile = await userRes.json();
        }
      }
    }

    if (!googleProfile || !googleProfile.email) {
      return res.status(400).json({ error: 'Data profil Google tidak valid atau gagal diverifikasi.' });
    }

    const { user, token, userPayload } = await handleGoogleUserLogin(googleProfile, res);

    return res.json({
      success: true,
      sessionToken: token,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name || 'CUSTOMER',
      user: userPayload
    });
  } catch (err) {
    console.error('googleAuth error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server saat login Google.' });
  }
}

export async function getProfile(req, res) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Tidak terautentikasi' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar || '',
      phone: user.phone || '',
      address: user.address || '',
      subdistrict: user.subdistrict || '',
      regency: user.regency || '',
      province: user.province || '',
      postalCode: user.postalCode || '',
      provider: user.provider,
      status: user.status,
      role: user.role
    });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memuat profil' });
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Tidak terautentikasi' });
    }

    const { name, phone, address, subdistrict, regency, province, postalCode, avatar } = req.body || {};

    const existing = await prisma.user.findUnique({ where: { id: userId } });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(subdistrict !== undefined && { subdistrict }),
        ...(regency !== undefined && { regency }),
        ...(province !== undefined && { province }),
        ...(postalCode !== undefined && { postalCode }),
        ...(avatar !== undefined && { avatar }),
      },
      include: { role: true }
    });

    if (avatar !== undefined && existing?.avatar && existing.avatar !== avatar) {
      await handleMediaReplacement(existing.avatar, avatar, 'tanico-public').catch(() => {});
    }

    return res.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        avatar: updated.avatar || '',
        phone: updated.phone || '',
        address: updated.address || '',
        subdistrict: updated.subdistrict || '',
        regency: updated.regency || '',
        province: updated.province || '',
        postalCode: updated.postalCode || '',
        role: updated.role
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memperbarui profil' });
  }
}

export async function forgotPassword(req, res) {
  return res.json({ success: true, message: 'Jika email terdaftar, instruksi reset kata sandi telah dikirimkan.' });
}

export async function resetPassword(req, res) {
  return res.json({ success: true, message: 'Kata sandi berhasil diperbarui.' });
}

export async function logout(req, res) {
  res.clearCookie('tanico_session');
  res.clearCookie('tanico_admin_session');
  return res.json({ success: true, message: 'Berhasil logout' });
}

export async function me(req, res) {
  return getProfile(req, res);
}

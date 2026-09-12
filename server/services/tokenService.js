import { SignJWT, jwtVerify } from 'jose';

const getSecretKey = () => {
  const secretKey = process.env.SESSION_SECRET || process.env.SUPABASE_JWT_SECRET || 'tanico_secure_default_session_secret_key_32chars_min';
  return new TextEncoder().encode(secretKey);
};

export async function createSessionToken(payload, expirationTime = '7d') {
  const secret = getSecretKey();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(secret);
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (err) {
    return null;
  }
}

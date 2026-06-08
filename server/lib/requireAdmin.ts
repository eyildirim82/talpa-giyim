import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Admin yetkilendirme middleware'i.
 *
 * 1. Authorization: Bearer <token> başlığından Supabase access token'ını alır.
 * 2. Token'ı önce YEREL doğrular (HMAC imzası + exp). Bu, her istekte Supabase
 *    Auth'a (`/auth/v1/user`) gidilen ağ turunu ortadan kaldırır.
 * 3. Kullanıcının e-postasını bellekte cache'lenen `public.admins` allowlist'inde arar.
 *
 * Performans/güvenlik dengesi:
 *  - Yerel doğrulama yalnızca SUPABASE_JWT_SECRET tanımlıysa ve token HS256 ise yapılır.
 *  - Yapılamazsa (secret yok / asimetrik imza / imza geçersiz / email claim'i yok),
 *    eski davranışa GÜVENLİ GERİ DÖNÜŞ: yetkili `auth.getUser()` ağ doğrulaması.
 *    Yani secret eklenmeden önce de hiçbir şey kırılmaz; secret eklenince hızlanır.
 *
 * Yanıtlar:
 *  - 401: token yok / geçersiz / kullanıcı çözülemedi.
 *  - 403: geçerli kullanıcı ama admin değil.
 */

type JwtPayload = { email?: string; exp?: number; nbf?: number; [k: string]: unknown };

/** HS256 JWT'yi yerel doğrular. Doğrulanamazsa null döner (çağıran geri dönüşe geçer). */
function verifyJwtHs256(token: string, secret: string | undefined): JwtPayload | null {
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  // Yalnızca simetrik HS256 yerel doğrulanır; alg=none / asimetrik → geri dönüş.
  if (header.alg !== 'HS256') return null;

  const expected = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest();
  const signature = Buffer.from(signatureB64, 'base64url');
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    return null;
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && now >= payload.exp) return null; // süresi geçmiş
  if (typeof payload.nbf === 'number' && now < payload.nbf) return null;  // henüz geçerli değil
  return payload;
}

/** Token'dan e-posta çözer: önce yerel doğrulama, olmazsa yetkili getUser. */
async function resolveAdminEmail(token: string): Promise<string | null> {
  const payload = verifyJwtHs256(token, process.env.SUPABASE_JWT_SECRET);
  if (payload && typeof payload.email === 'string' && payload.email) {
    return payload.email;
  }
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user?.email) return null;
  return user.email;
}

// admins allowlist'i bellekte cache (sıcak instance başına). `admins` tablosu uygulama
// içinden değiştirilmediği için TTL'li cache yeterli; değişiklik en geç TTL kadar gecikir.
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;
let adminAllowlist: { emails: Set<string>; at: number } | null = null;

async function isAdminEmail(email: string): Promise<boolean> {
  const target = email.toLowerCase();
  let cache = adminAllowlist;
  if (!cache || Date.now() - cache.at >= ADMIN_CACHE_TTL_MS) {
    const { data, error } = await supabaseAdmin.from('admins').select('email');
    if (error) throw error;
    cache = {
      emails: new Set((data ?? []).map((r) => String((r as { email: string }).email).toLowerCase())),
      at: Date.now(),
    };
    adminAllowlist = cache;
  }
  return cache.emails.has(target);
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Yetkisiz erişim.' });
    return;
  }

  try {
    const email = await resolveAdminEmail(token);
    if (!email) {
      res.status(401).json({ error: 'Yetkisiz erişim.' });
      return;
    }

    if (!(await isAdminEmail(email))) {
      res.status(403).json({ error: 'Bu hesabın yönetici yetkisi bulunmuyor.' });
      return;
    }

    next();
  } catch (err) {
    console.error('requireAdmin doğrulama hatası:', err);
    res.status(401).json({ error: 'Yetkisiz erişim.' });
  }
}

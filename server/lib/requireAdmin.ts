import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Admin yetkilendirme middleware'i.
 *
 * 1. Authorization: Bearer <token> başlığından Supabase access token'ını alır.
 * 2. Token'ı Supabase Auth ile doğrulayıp kullanıcıyı çözer.
 * 3. Kullanıcının e-postasını `public.admins` allowlist tablosunda arar.
 *    Sadece bu tabloda kayıtlı e-postalar /api/admin/* rotalarına erişebilir.
 *
 * Yanıtlar:
 *  - 401: token yok / geçersiz / kullanıcı çözülemedi.
 *  - 403: geçerli kullanıcı ama admin değil.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Yetkisiz erişim.' });
    return;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user?.email) {
      res.status(401).json({ error: 'Yetkisiz erişim.' });
      return;
    }

    const { data: admin, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('email')
      .eq('email', user.email.toLowerCase())
      .maybeSingle();

    if (adminError) throw adminError;

    if (!admin) {
      res.status(403).json({ error: 'Bu hesabın yönetici yetkisi bulunmuyor.' });
      return;
    }

    next();
  } catch (err) {
    console.error('requireAdmin doğrulama hatası:', err);
    res.status(401).json({ error: 'Yetkisiz erişim.' });
  }
}

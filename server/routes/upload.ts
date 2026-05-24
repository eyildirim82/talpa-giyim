import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers['authorization']?.replace('Bearer ', '') ?? '';
  if (!token) { res.status(401).json({ error: 'Yetkisiz erişim.' }); return; }
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) { res.status(401).json({ error: 'Yetkisiz erişim.' }); return; }
    next();
  } catch { res.status(401).json({ error: 'Yetkisiz erişim.' }); }
}

router.post('/admin/upload', requireAdmin, async (req: Request, res: Response) => {
  const { filename, contentType, data } = req.body as {
    filename: string;
    contentType: string;
    data: string; // base64
  };

  if (!filename || !contentType || !data) {
    res.status(400).json({ error: 'filename, contentType ve data zorunludur.' });
    return;
  }

  try {
    const buffer = Buffer.from(data, 'base64');
    const ext = filename.split('.').pop() ?? 'bin';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('campaign-images')
      .upload(uniqueName, buffer, { contentType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('campaign-images')
      .getPublicUrl(uniqueName);

    res.json({ url: publicUrl });
  } catch (err) {
    console.error('Görsel yükleme hatası:', err);
    res.status(500).json({ error: 'Görsel yüklenemedi.' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdmin } from '../lib/requireAdmin.js';

const router = Router();

// Dosya verisini sunucu üzerinden geçirmek yerine, Supabase Storage için bir
// "signed upload URL" üretiyoruz. İstemci dosyayı doğrudan Supabase'e yükler.
// Böylece Vercel serverless'ın ~4.5MB body limiti ve base64 şişmesi devre dışı kalır.
router.post('/admin/upload', requireAdmin, async (req: Request, res: Response) => {
  const { filename } = req.body as { filename: string };

  if (!filename) {
    res.status(400).json({ error: 'filename zorunludur.' });
    return;
  }

  try {
    const ext = filename.split('.').pop() ?? 'bin';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error: signError } = await supabaseAdmin.storage
      .from('campaign-images')
      .createSignedUploadUrl(uniqueName);

    if (signError) throw signError;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('campaign-images')
      .getPublicUrl(uniqueName);

    res.json({ path: data.path, token: data.token, publicUrl });
  } catch (err) {
    console.error('Görsel yükleme hatası:', err);
    res.status(500).json({ error: 'Görsel yüklenemedi.' });
  }
});

export default router;

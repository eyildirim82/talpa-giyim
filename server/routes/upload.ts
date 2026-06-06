import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdmin } from '../lib/requireAdmin.js';

const router = Router();

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

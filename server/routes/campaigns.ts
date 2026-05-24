import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select(
        'id, slug, title, description, partner_name, partner_logo_url, cover_image_url, discount_label, is_featured, featured_order, valid_until, max_codes_per_user, terms'
      )
      .eq('is_active', true)
      .order('featured_order', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Kampanyalar alınamadı:', err);
    res.status(500).json({ error: 'Kampanyalar alınamadı.' });
  }
});

export default router;

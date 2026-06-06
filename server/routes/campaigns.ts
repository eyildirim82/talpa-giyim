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

    const campaignsWithStock = await Promise.all(
      (data ?? []).map(async (c) => {
        const { count, error: countError } = await supabaseAdmin
          .from('campaign_codes')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', c.id)
          .eq('is_used', false);

        if (countError) throw countError;

        return {
          ...c,
          has_codes: (count ?? 0) > 0,
          is_low_stock: (count ?? 0) > 0 && (count ?? 0) <= 10,
        };
      })
    );

    res.json(campaignsWithStock);
  } catch (err) {
    console.error('Kampanyalar alınamadı:', err);
    res.status(500).json({ error: 'Kampanyalar alınamadı.' });
  }
});

export default router;

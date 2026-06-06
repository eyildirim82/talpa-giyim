import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    // Kampanyalar + stok sayımları tek RPC ile (eski N+1 yerine). Toplu e-posta
    // anında her ziyaretçi için ayrı sayım sorgusu atılmasını önler.
    const [{ data, error }, stockRes] = await Promise.all([
      supabaseAdmin
        .from('campaigns')
        .select(
          'id, slug, title, description, partner_name, partner_logo_url, cover_image_url, discount_label, is_featured, featured_order, valid_until, max_codes_per_user, terms'
        )
        .eq('is_active', true)
        .order('featured_order', { ascending: false }),
      supabaseAdmin.rpc('campaign_stock_counts'),
    ]);

    if (error) throw error;
    if (stockRes.error) throw stockRes.error;

    const stockMap = new Map<string, { total: number; used: number }>();
    for (const row of (stockRes.data ?? []) as { campaign_id: string; total: number; used: number }[]) {
      stockMap.set(row.campaign_id, { total: Number(row.total), used: Number(row.used) });
    }

    const campaignsWithStock = (data ?? []).map((c) => {
      const s = stockMap.get(c.id) ?? { total: 0, used: 0 };
      const remaining = s.total - s.used;
      // Eşik admin sağlık ekranıyla aynı: kalanın %15'i, en az 25 adet kala uyar.
      const threshold = Math.max(Math.ceil(s.total * 0.15), 25);
      return {
        ...c,
        has_codes: remaining > 0,
        is_low_stock: remaining > 0 && remaining <= threshold,
      };
    });

    res.json(campaignsWithStock);
  } catch (err) {
    console.error('Kampanyalar alınamadı:', err);
    res.status(500).json({ error: 'Kampanyalar alınamadı.' });
  }
});

export default router;

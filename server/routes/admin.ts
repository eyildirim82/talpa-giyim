import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || token !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Yetkisiz erişim.' });
    return;
  }

  next();
}

router.use(requireAdmin);

// GET /api/admin/campaigns — tüm kampanyalar + kod istatistikleri
router.get('/admin/campaigns', async (req: Request, res: Response) => {
  try {
    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const campaignsWithStats = await Promise.all(
      (campaigns ?? []).map(async (campaign) => {
        const { count: totalCodes } = await supabaseAdmin
          .from('campaign_codes')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id);

        const { count: usedCodes } = await supabaseAdmin
          .from('campaign_codes')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .eq('is_used', true);

        return {
          ...campaign,
          totalCodes: totalCodes ?? 0,
          usedCodes: usedCodes ?? 0,
          remainingCodes: (totalCodes ?? 0) - (usedCodes ?? 0),
        };
      })
    );

    res.json(campaignsWithStats);
  } catch (err) {
    console.error('Admin kampanyalar alınamadı:', err);
    res.status(500).json({ error: 'Kampanyalar alınamadı.' });
  }
});

// POST /api/admin/campaigns — yeni kampanya oluştur
router.post('/admin/campaigns', async (req: Request, res: Response) => {
  const { slug, title, discount_label } = req.body as Record<string, unknown>;

  if (!slug || !title || !discount_label) {
    res.status(400).json({ error: 'slug, title ve discount_label zorunludur.' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert(req.body as Record<string, unknown>)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Kampanya oluşturulamadı:', err);
    res.status(500).json({ error: 'Kampanya oluşturulamadı.' });
  }
});

// PUT /api/admin/campaigns/:id — kampanya güncelle
router.put('/admin/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .update(req.body as Record<string, unknown>)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      res.status(404).json({ error: 'Kampanya bulunamadı.' });
      return;
    }

    res.json(data);
  } catch (err) {
    console.error('Kampanya güncellenemedi:', err);
    res.status(500).json({ error: 'Kampanya güncellenemedi.' });
  }
});

// POST /api/admin/campaigns/:id/codes — bulk kod yükle
router.post('/admin/campaigns/:id/codes', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { codes } = req.body as { codes: unknown };

  if (!Array.isArray(codes) || codes.length === 0) {
    res.status(400).json({ error: 'Geçerli bir kod listesi gönderin.' });
    return;
  }

  const rows = (codes as string[]).map((code) => ({
    campaign_id: id,
    code,
    is_used: false,
  }));

  try {
    const { data, error } = await supabaseAdmin
      .from('campaign_codes')
      .insert(rows)
      .select();

    if (error) throw error;
    res.json({ success: true, inserted: data?.length ?? 0 });
  } catch (err) {
    console.error('Kodlar yüklenemedi:', err);
    res.status(500).json({ error: 'Kodlar yüklenemedi.' });
  }
});

// GET /api/admin/stats — genel istatistikler
router.get('/admin/stats', async (req: Request, res: Response) => {
  try {
    const { count: totalCampaigns } = await supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact', head: true });

    const { count: totalCodes } = await supabaseAdmin
      .from('campaign_codes')
      .select('*', { count: 'exact', head: true });

    const { count: usedCodes } = await supabaseAdmin
      .from('campaign_codes')
      .select('*', { count: 'exact', head: true })
      .eq('is_used', true);

    res.json({
      totalCampaigns: totalCampaigns ?? 0,
      totalCodes: totalCodes ?? 0,
      usedCodes: usedCodes ?? 0,
      remainingCodes: (totalCodes ?? 0) - (usedCodes ?? 0),
    });
  } catch (err) {
    console.error('İstatistikler alınamadı:', err);
    res.status(500).json({ error: 'İstatistikler alınamadı.' });
  }
});

export default router;

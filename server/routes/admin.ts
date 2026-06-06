import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdmin } from '../lib/requireAdmin.js';

const router = Router();

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
    // Detect duplicates first
    const codesOnly = (codes as string[]).map((c) => c.trim()).filter(Boolean);
    const { data: existing } = await supabaseAdmin
      .from('campaign_codes')
      .select('code')
      .eq('campaign_id', id)
      .in('code', codesOnly);

    const existingSet = new Set((existing ?? []).map((r: { code: string }) => r.code));
    const toInsert = rows.filter((r) => !existingSet.has(r.code));

    let insertedCount = 0;
    if (toInsert.length > 0) {
      const { data: insData, error: insError } = await supabaseAdmin
        .from('campaign_codes')
        .insert(toInsert)
        .select();
      if (insError) throw insError;
      insertedCount = insData?.length ?? 0;
    }

    res.json({
      success: true,
      inserted: insertedCount,
      duplicates: Array.from(existingSet),
    });
  } catch (err) {
    console.error('Kodlar yüklenemedi:', err);
    res.status(500).json({ error: 'Kodlar yüklenemedi.' });
  }
});

// DELETE /api/admin/reset — tüm kodları ve talepleri sil (kampanyalar korunur)
router.delete('/admin/reset', async (req: Request, res: Response) => {
  try {
    const { error: codesError } = await supabaseAdmin
      .from('campaign_codes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // tümünü sil

    if (codesError) throw codesError;

    const { error: claimsError } = await supabaseAdmin
      .from('campaign_claims')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (claimsError) throw claimsError;

    res.json({ success: true, message: 'Tüm kodlar ve talepler silindi.' });
  } catch (err) {
    console.error('Sistem sıfırlama hatası:', err);
    res.status(500).json({ error: 'Sıfırlama başarısız.' });
  }
});

// GET /api/admin/campaigns/:id/lookup?tc_no= — TC sorgusu
router.get('/admin/campaigns/:id/lookup', async (req: Request, res: Response) => {
  const { id } = req.params;
  const tc_no = req.query['tc_no'] as string | undefined;

  if (!tc_no) {
    res.status(400).json({ error: 'tc_no parametresi zorunludur.' });
    return;
  }

  try {
    const { data: codes, error } = await supabaseAdmin
      .from('campaign_codes')
      .select('code, claimed_at')
      .eq('campaign_id', id)
      .eq('claimed_by_tc', tc_no)
      .order('claimed_at', { ascending: true });

    if (error) throw error;

    if (!codes || codes.length === 0) {
      res.json({ found: false });
      return;
    }

    res.json({
      found: true,
      tc_no,
      codes: codes.map((c: { code: string; claimed_at: string | null }) => ({
        code: c.code,
        claimed_at: c.claimed_at,
      })),
    });
  } catch (err) {
    console.error('TC sorgu hatası:', err);
    res.status(500).json({ error: 'Sorgu başarısız.' });
  }
});

// GET /api/admin/campaigns/:id/preview — son kodlar ve talepler
router.get('/admin/campaigns/:id/preview', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const [codesRes, claimsRes] = await Promise.all([
      supabaseAdmin
        .from('campaign_codes')
        .select('code, is_used, claimed_by_tc, claimed_at')
        .eq('campaign_id', id)
        .order('claimed_at', { ascending: false, nullsFirst: false })
        .limit(20),
      supabaseAdmin
        .from('campaign_claims')
        .select('tc_no, claimed_at')
        .eq('campaign_id', id)
        .order('claimed_at', { ascending: false })
        .limit(20),
    ]);

    if (codesRes.error) throw codesRes.error;
    if (claimsRes.error) throw claimsRes.error;

    res.json({
      codes: codesRes.data ?? [],
      claims: claimsRes.data ?? [],
    });
  } catch (err) {
    console.error('Önizleme hatası:', err);
    res.status(500).json({ error: 'Önizleme alınamadı.' });
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

// GET /api/admin/campaigns/:id/export — tüm kodları ve talepleri dışa aktar (CSV formatında)
router.get('/admin/campaigns/:id/export', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // 1. Kampanyayı bul
    const { data: campaign, error: campError } = await supabaseAdmin
      .from('campaigns')
      .select('title, slug')
      .eq('id', id)
      .maybeSingle();

    if (campError) throw campError;
    if (!campaign) {
      res.status(404).json({ error: 'Kampanya bulunamadı.' });
      return;
    }

    // 2. Tüm kodları çek
    const { data: codes, error: codesError } = await supabaseAdmin
      .from('campaign_codes')
      .select('code, is_used, claimed_by_tc, claimed_at')
      .eq('campaign_id', id)
      .order('claimed_at', { ascending: false, nullsFirst: false });

    if (codesError) throw codesError;

    // CSV hücresini güvenli biçimde yaz: formül enjeksiyonunu (=,+,-,@,tab,CR ile
    // başlayan değerler Excel'de çalışabilir) engelle ve tırnakları kaçır.
    const csvCell = (value: unknown): string => {
      let s = value == null ? '' : String(value);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };

    // 3. CSV oluştur (Excel Türkçe karakter desteği için UTF-8 BOM ekliyoruz)
    let csv = '\uFEFF';
    csv += 'İndirim Kodu,Kullanım Durumu,Kullanan T.C. No,Kullanım Tarihi\n';

    (codes ?? []).forEach((c) => {
      const status = c.is_used ? 'Kullanıldı' : 'Kullanılmadı';
      const tc = c.claimed_by_tc ?? '';
      const date = c.claimed_at ? new Date(c.claimed_at).toLocaleString('tr-TR') : '';
      csv += `${csvCell(c.code)},${csvCell(status)},${csvCell(tc)},${csvCell(date)}\n`;
    });

    const filename = `${campaign.slug}-kod-raporu.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (err) {
    console.error('Dışa aktarma hatası:', err);
    res.status(500).json({ error: 'Rapor oluşturulamadı.' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdmin } from '../lib/requireAdmin.js';
import { pingMemberService } from '../lib/memberHealth.js';

const router = Router();

router.use(requireAdmin);

// GET /api/admin/campaigns — tüm kampanyalar + kod istatistikleri
router.get('/admin/campaigns', async (req: Request, res: Response) => {
  try {
    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select('*, type:campaign_types(id, name, slug)')
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

// GET /api/admin/campaign-types — tür listesi (form + tür yönetimi)
router.get('/admin/campaign-types', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('campaign_types')
      .select('id, name, slug, sort_order')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    console.error('Türler alınamadı:', err);
    res.status(500).json({ error: 'Türler alınamadı.' });
  }
});

// POST /api/admin/campaigns — yeni kampanya oluştur
router.post('/admin/campaigns', async (req: Request, res: Response) => {
  const body = { ...(req.body as Record<string, unknown>) };
  const { slug, title, discount_label } = body;

  if (!slug || !title || !discount_label) {
    res.status(400).json({ error: 'slug, title ve discount_label zorunludur.' });
    return;
  }

  try {
    // Tür zorunlu olacak (DB'de NOT NULL'a geçilecek). type_id gelmezse
    // varsayılan türe (en düşük sort_order) düşerek hiçbir kaydı türsüz bırakma.
    if (!body.type_id) {
      const { data: defType } = await supabaseAdmin
        .from('campaign_types')
        .select('id')
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (defType) body.type_id = (defType as { id: string }).id;
    }

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Kampanya oluşturulamadı:', err);
    res.status(500).json({ error: 'Kampanya oluşturulamadı.' });
  }
});

// GET /api/admin/campaigns/:id — tekil kampanya + kod istatistikleri (detay ekranı)
router.get('/admin/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data: c, error } = await supabaseAdmin
      .from('campaigns')
      .select('*, type:campaign_types(id, name, slug)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!c) {
      res.status(404).json({ error: 'Kampanya bulunamadı.' });
      return;
    }
    const { count: total } = await supabaseAdmin
      .from('campaign_codes')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id);
    const { count: used } = await supabaseAdmin
      .from('campaign_codes')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id)
      .eq('is_used', true);
    res.json({
      ...c,
      totalCodes: total ?? 0,
      usedCodes: used ?? 0,
      remainingCodes: (total ?? 0) - (used ?? 0),
    });
  } catch (err) {
    console.error('Kampanya alınamadı:', err);
    res.status(500).json({ error: 'Kampanya alınamadı.' });
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

  // Temizle: trim + boşları at + aynı yükleme içindeki tekrarları ele.
  const uniqueCodes = Array.from(
    new Set((codes as unknown[]).map((c) => String(c).trim()).filter(Boolean))
  );
  if (uniqueCodes.length === 0) {
    res.status(400).json({ error: 'Geçerli bir kod listesi gönderin.' });
    return;
  }

  const rows = uniqueCodes.map((code) => ({ campaign_id: id, code, is_used: false }));
  try {
    // Kodlar TÜM kampanyalarda benzersizdir (campaign_codes_code_key UNIQUE). Halihazırda
    // (bu ya da başka bir kampanyada) var olan kodları ON CONFLICT DO NOTHING ile atla; tek
    // bir çakışan kod tüm yüklemeyi düşürmesin. Geri dönen satırlar gerçekten eklenenler →
    // kalanlar yinelenmiş sayılır.
    const { data: insData, error: insError } = await supabaseAdmin
      .from('campaign_codes')
      .upsert(rows, { onConflict: 'code', ignoreDuplicates: true })
      .select('code');
    if (insError) throw insError;

    const insertedSet = new Set((insData ?? []).map((r: { code: string }) => r.code));
    const duplicates = uniqueCodes.filter((code) => !insertedSet.has(code));

    res.json({
      success: true,
      inserted: insertedSet.size,
      duplicates,
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

// GET /api/admin/health — sağlık ekranı için anlık durum
// (servis hataları + sistem nabzı + kampanya bazında stok). Toplu stok sorgusu RPC ile.
router.get('/admin/health', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    // "Bugün" = İstanbul (UTC+3) günü. Gün başlangıcının UTC karşılığını hesapla.
    const ist = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const istMidnightUtc = new Date(
      Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, 0, 0) - 3 * 60 * 60 * 1000
    ).toISOString();

    const [failCountRes, lastFailRes, lastClaimRes, todayCountRes, campaignsRes, stockRes] =
      await Promise.all([
        supabaseAdmin
          .from('system_verify_failures')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', thirtyMinAgo),
        supabaseAdmin
          .from('system_verify_failures')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from('campaign_codes')
          .select('claimed_at')
          .not('claimed_at', 'is', null)
          .order('claimed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from('campaign_codes')
          .select('*', { count: 'exact', head: true })
          .gte('claimed_at', istMidnightUtc),
        supabaseAdmin
          .from('campaigns')
          .select('id, slug, title, is_active')
          .order('is_active', { ascending: false }),
        supabaseAdmin.rpc('campaign_stock_counts'),
      ]);

    if (campaignsRes.error) throw campaignsRes.error;
    if (stockRes.error) throw stockRes.error;

    const stockMap = new Map<string, { total: number; used: number }>();
    for (const row of (stockRes.data ?? []) as { campaign_id: string; total: number; used: number }[]) {
      stockMap.set(row.campaign_id, { total: Number(row.total), used: Number(row.used) });
    }

    const campaigns = (campaignsRes.data ?? []).map((c) => {
      const s = stockMap.get(c.id) ?? { total: 0, used: 0 };
      const remaining = s.total - s.used;
      // Eşik: kalanın %15'i, ama küçük kampanyalar için en az 25 adet kala uyar.
      const threshold = Math.max(Math.ceil(s.total * 0.15), 25);
      let status: 'no_codes' | 'out' | 'low' | 'ok';
      if (s.total === 0) status = 'no_codes';
      else if (remaining <= 0) status = 'out';
      else if (remaining <= threshold) status = 'low';
      else status = 'ok';
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        is_active: c.is_active,
        total: s.total,
        used: s.used,
        remaining,
        status,
      };
    });

    res.json({
      now: now.toISOString(),
      verifyFailures: {
        last30m: failCountRes.count ?? 0,
        lastAt: lastFailRes.data?.created_at ?? null,
      },
      pulse: {
        lastClaimAt: lastClaimRes.data?.claimed_at ?? null,
        todayCount: todayCountRes.count ?? 0,
      },
      campaigns,
    });
  } catch (err) {
    console.error('Sağlık verisi alınamadı:', err);
    res.status(500).json({ error: 'Sağlık verisi alınamadı.' });
  }
});

// GET /api/admin/health/probe — dış üye doğrulama servisini AKTİF yokla ("Şimdi test et")
router.get('/admin/health/probe', async (req: Request, res: Response) => {
  const result = await pingMemberService();
  res.json(result);
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

// ───────────────────────── Türler (CRUD) ─────────────────────────

function slugifyTr(text: string): string {
  const map: Record<string, string> = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'I': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u',
  };
  let s = text;
  for (const k in map) s = s.replace(new RegExp(k, 'g'), map[k]);
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// POST /api/admin/campaign-types — tür oluştur
router.post('/admin/campaign-types', async (req: Request, res: Response) => {
  const body = req.body as { name?: string; slug?: string; sort_order?: number };
  const name = body.name?.trim();
  if (!name) {
    res.status(400).json({ error: 'Tür adı zorunludur.' });
    return;
  }
  const slug = body.slug?.trim() || slugifyTr(name);
  try {
    let sortOrder = body.sort_order;
    if (sortOrder == null) {
      const { data: maxRow } = await supabaseAdmin
        .from('campaign_types')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      sortOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;
    }
    const { data, error } = await supabaseAdmin
      .from('campaign_types')
      .insert({ name, slug, sort_order: sortOrder })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') { res.status(409).json({ error: 'Bu slug zaten kullanımda.' }); return; }
      throw error;
    }
    res.status(201).json(data);
  } catch (err) {
    console.error('Tür oluşturulamadı:', err);
    res.status(500).json({ error: 'Tür oluşturulamadı.' });
  }
});

// PUT /api/admin/campaign-types/:id — tür güncelle
router.put('/admin/campaign-types/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as { name?: string; slug?: string; sort_order?: number };
  const patch: Record<string, unknown> = {};
  if (body.name != null) patch.name = body.name.trim();
  if (body.slug != null) patch.slug = body.slug.trim();
  if (body.sort_order != null) patch.sort_order = body.sort_order;
  try {
    const { data, error } = await supabaseAdmin
      .from('campaign_types')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      if (error.code === '23505') { res.status(409).json({ error: 'Bu slug zaten kullanımda.' }); return; }
      throw error;
    }
    if (!data) { res.status(404).json({ error: 'Tür bulunamadı.' }); return; }
    res.json(data);
  } catch (err) {
    console.error('Tür güncellenemedi:', err);
    res.status(500).json({ error: 'Tür güncellenemedi.' });
  }
});

// DELETE /api/admin/campaign-types/:id — tür sil (kullanımdaysa engellenir)
router.delete('/admin/campaign-types/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin.from('campaign_types').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') {
        res.status(409).json({
          error: 'Bu tür bir veya daha fazla kampanyada kullanılıyor. Önce o kampanyaları başka türe taşıyın.',
        });
        return;
      }
      throw error;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Tür silinemedi:', err);
    res.status(500).json({ error: 'Tür silinemedi.' });
  }
});

// ───────────────────────── Duyurular (CRUD) ─────────────────────────

// GET /api/admin/announcements — tüm duyurular (aktif + pasif)
router.get('/admin/announcements', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    console.error('Duyurular alınamadı:', err);
    res.status(500).json({ error: 'Duyurular alınamadı.' });
  }
});

// POST /api/admin/announcements — duyuru oluştur
router.post('/admin/announcements', async (req: Request, res: Response) => {
  const body = req.body as {
    message?: string; link_url?: string | null;
    link_campaign_id?: string | null; is_active?: boolean; sort_order?: number;
  };
  const message = body.message?.trim();
  if (!message) { res.status(400).json({ error: 'Duyuru metni zorunludur.' }); return; }
  try {
    let sortOrder = body.sort_order;
    if (sortOrder == null) {
      const { data: maxRow } = await supabaseAdmin
        .from('announcements')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      sortOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;
    }
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        message,
        link_url: body.link_url || null,
        link_campaign_id: body.link_campaign_id || null,
        is_active: body.is_active ?? false,
        sort_order: sortOrder,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Duyuru oluşturulamadı:', err);
    res.status(500).json({ error: 'Duyuru oluşturulamadı.' });
  }
});

// PUT /api/admin/announcements/:id — duyuru güncelle
router.put('/admin/announcements/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of ['message', 'link_url', 'link_campaign_id', 'is_active', 'sort_order']) {
    if (key in body) patch[key] = body[key];
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) { res.status(404).json({ error: 'Duyuru bulunamadı.' }); return; }
    res.json(data);
  } catch (err) {
    console.error('Duyuru güncellenemedi:', err);
    res.status(500).json({ error: 'Duyuru güncellenemedi.' });
  }
});

// DELETE /api/admin/announcements/:id — duyuru sil
router.delete('/admin/announcements/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Duyuru silinemedi:', err);
    res.status(500).json({ error: 'Duyuru silinemedi.' });
  }
});

// ───────────────────── Kampanya yaşam döngüsü ─────────────────────

// POST /api/admin/campaigns/:id/clone — kampanyayı kopyala (kodlar/talepler HARİÇ)
router.post('/admin/campaigns/:id/clone', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data: src, error: fetchErr } = await supabaseAdmin
      .from('campaigns')
      .select(
        'slug, title, description, partner_name, partner_logo_url, cover_image_url, ' +
        'discount_label, max_codes_per_user, valid_until, starts_at, terms, type_id, featured_order'
      )
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!src) { res.status(404).json({ error: 'Kampanya bulunamadı.' }); return; }

    const s = src as Record<string, unknown>;
    const newSlug = `${s.slug as string}-kopya-${Date.now().toString(36)}`;
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        ...s,
        slug: newSlug,
        title: `${s.title as string} (kopya)`,
        is_active: false,
        is_featured: false,
        is_archived: false,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Kampanya kopyalanamadı:', err);
    res.status(500).json({ error: 'Kampanya kopyalanamadı.' });
  }
});

// DELETE /api/admin/campaigns/:id — kampanyayı kalıcı sil (kodlar/talepler cascade)
router.delete('/admin/campaigns/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Kampanya silinemedi:', err);
    res.status(500).json({ error: 'Kampanya silinemedi.' });
  }
});

// ─────────────────────────── Kod havuzu ───────────────────────────

// GET /api/admin/campaigns/:id/codes?search=&page=&pageSize= — kod havuzu (arama + sayfalama)
router.get('/admin/campaigns/:id/codes', async (req: Request, res: Response) => {
  const { id } = req.params;
  const search = (req.query['search'] as string | undefined)?.trim();
  const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query['pageSize'] as string) ?? '50', 10) || 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  try {
    let q = supabaseAdmin
      .from('campaign_codes')
      .select('id, code, is_used, claimed_by_tc, claimed_at', { count: 'exact' })
      .eq('campaign_id', id);
    if (search) q = q.ilike('code', `%${search}%`);
    const { data, error, count } = await q
      .order('is_used', { ascending: true })
      .order('code', { ascending: true })
      .range(from, to);
    if (error) throw error;
    res.json({ codes: data ?? [], total: count ?? 0, page, pageSize });
  } catch (err) {
    console.error('Kod havuzu alınamadı:', err);
    res.status(500).json({ error: 'Kod havuzu alınamadı.' });
  }
});

// POST /api/admin/campaigns/:id/codes/one — tek kod ekle
router.post('/admin/campaigns/:id/codes/one', async (req: Request, res: Response) => {
  const { id } = req.params;
  const code = (req.body as { code?: string }).code?.trim();
  if (!code) { res.status(400).json({ error: 'Kod zorunludur.' }); return; }
  try {
    const { data, error } = await supabaseAdmin
      .from('campaign_codes')
      .insert({ campaign_id: id, code, is_used: false })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') { res.status(409).json({ error: 'Bu kod zaten mevcut.' }); return; }
      throw error;
    }
    res.status(201).json(data);
  } catch (err) {
    console.error('Kod eklenemedi:', err);
    res.status(500).json({ error: 'Kod eklenemedi.' });
  }
});

// PUT /api/admin/codes/:codeId — kod değerini düzelt (YALNIZ dağıtılmamış)
router.put('/admin/codes/:codeId', async (req: Request, res: Response) => {
  const { codeId } = req.params;
  const code = (req.body as { code?: string }).code?.trim();
  if (!code) { res.status(400).json({ error: 'Kod zorunludur.' }); return; }
  try {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('campaign_codes')
      .select('id, is_used')
      .eq('id', codeId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) { res.status(404).json({ error: 'Kod bulunamadı.' }); return; }
    if ((existing as { is_used: boolean }).is_used) {
      res.status(409).json({ error: 'Dağıtılmış kod düzenlenemez.' });
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('campaign_codes')
      .update({ code })
      .eq('id', codeId)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') { res.status(409).json({ error: 'Bu kod zaten mevcut.' }); return; }
      throw error;
    }
    res.json(data);
  } catch (err) {
    console.error('Kod güncellenemedi:', err);
    res.status(500).json({ error: 'Kod güncellenemedi.' });
  }
});

// DELETE /api/admin/codes/:codeId — tek kod sil (YALNIZ dağıtılmamış)
router.delete('/admin/codes/:codeId', async (req: Request, res: Response) => {
  const { codeId } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('campaign_codes')
      .delete()
      .eq('id', codeId)
      .eq('is_used', false)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) { res.status(409).json({ error: 'Kod bulunamadı veya dağıtılmış (silinemez).' }); return; }
    res.json({ success: true });
  } catch (err) {
    console.error('Kod silinemedi:', err);
    res.status(500).json({ error: 'Kod silinemedi.' });
  }
});

// POST /api/admin/codes/bulk-delete — toplu kod sil (YALNIZ dağıtılmamış; kullanılmışlar atlanır)
router.post('/admin/codes/bulk-delete', async (req: Request, res: Response) => {
  const ids = (req.body as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'Silinecek kod listesi gönderin.' });
    return;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('campaign_codes')
      .delete()
      .in('id', ids as string[])
      .eq('is_used', false)
      .select('id');
    if (error) throw error;
    res.json({ success: true, deleted: data?.length ?? 0 });
  } catch (err) {
    console.error('Toplu silme başarısız:', err);
    res.status(500).json({ error: 'Toplu silme başarısız.' });
  }
});

export default router;

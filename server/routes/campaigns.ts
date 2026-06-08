import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

// Public uçların döndürdüğü ortak kampanya alanları (+ gömülü tür).
const CAMPAIGN_FIELDS =
  'id, slug, title, description, partner_name, partner_logo_url, cover_image_url, ' +
  'discount_label, is_featured, featured_order, valid_until, starts_at, created_at, ' +
  'max_codes_per_user, terms, type:campaign_types(id, name, slug)';

type CampaignRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  partner_name: string | null;
  partner_logo_url: string | null;
  cover_image_url: string | null;
  discount_label: string | null;
  is_featured: boolean;
  featured_order: number | null;
  valid_until: string | null;
  starts_at: string | null;
  created_at: string;
  max_codes_per_user: number;
  terms: string | null;
  is_active?: boolean;
  is_archived?: boolean;
  type: { id: string; name: string; slug: string } | null;
};

type StockMap = Map<string, { total: number; used: number }>;

/** İstanbul (UTC+3) "bugün" — DATE karşılaştırmaları için (YYYY-MM-DD). */
function istanbulToday(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Kampanya başına stok sayımı (tek RPC; N+1 yok). */
async function getStockMap(): Promise<StockMap> {
  const stockRes = await supabaseAdmin.rpc('campaign_stock_counts');
  if (stockRes.error) throw stockRes.error;
  const map: StockMap = new Map();
  for (const row of (stockRes.data ?? []) as { campaign_id: string; total: number; used: number }[]) {
    map.set(row.campaign_id, { total: Number(row.total), used: Number(row.used) });
  }
  return map;
}

/** Ham kod sayılarını sızdırmadan stok bayraklarını ekler. */
function withStock(c: CampaignRow, stock: StockMap) {
  const s = stock.get(c.id) ?? { total: 0, used: 0 };
  const remaining = s.total - s.used;
  // Eşik admin sağlık ekranıyla aynı: kalanın %15'i, en az 25 adet kala uyar.
  const threshold = Math.max(Math.ceil(s.total * 0.15), 25);
  return {
    ...c,
    has_codes: remaining > 0,
    is_low_stock: remaining > 0 && remaining <= threshold,
  };
}

// GET /api/campaigns — vitrin: yalnızca CANLI kampanyalar
// (aktif + arşivsiz + başlangıcı gelmiş + süresi geçmemiş).
router.get('/campaigns', async (_req: Request, res: Response) => {
  try {
    const today = istanbulToday();
    const nowIso = new Date().toISOString();
    const [{ data, error }, stock] = await Promise.all([
      supabaseAdmin
        .from('campaigns')
        .select(CAMPAIGN_FIELDS)
        .eq('is_active', true)
        .eq('is_archived', false)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`valid_until.is.null,valid_until.gte.${today}`)
        .order('featured_order', { ascending: false }),
      getStockMap(),
    ]);
    if (error) throw error;
    // Vitrin herkese aynı; Vercel CDN'inde paylaşımlı cache (browser'da değil).
    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.json(((data ?? []) as unknown as CampaignRow[]).map((c) => withStock(c, stock)));
  } catch (err) {
    console.error('Kampanyalar alınamadı:', err);
    res.status(500).json({ error: 'Kampanyalar alınamadı.' });
  }
});

// GET /api/campaigns/archive — biten + arşivlenen (salt-okunur)
router.get('/campaigns/archive', async (_req: Request, res: Response) => {
  try {
    const today = istanbulToday();
    const [{ data, error }, stock] = await Promise.all([
      supabaseAdmin
        .from('campaigns')
        .select(CAMPAIGN_FIELDS)
        .or(`is_archived.eq.true,valid_until.lt.${today}`)
        .order('valid_until', { ascending: false, nullsFirst: false }),
      getStockMap(),
    ]);
    if (error) throw error;
    // Arşiv nadiren değişir → daha uzun CDN cache.
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.json(((data ?? []) as unknown as CampaignRow[]).map((c) => withStock(c, stock)));
  } catch (err) {
    console.error('Arşiv alınamadı:', err);
    res.status(500).json({ error: 'Arşiv alınamadı.' });
  }
});

// GET /api/campaign-types — vitrin sekmeleri / form için tür listesi
router.get('/campaign-types', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('campaign_types')
      .select('id, name, slug, sort_order')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    // Tür listesi nadiren değişir → uzun CDN cache.
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.json(data ?? []);
  } catch (err) {
    console.error('Türler alınamadı:', err);
    res.status(500).json({ error: 'Türler alınamadı.' });
  }
});

// GET /api/announcements — aktif duyurular (sırayla; döngü için)
router.get('/announcements', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('id, message, link_url, sort_order, link:campaigns(slug)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as unknown as {
      id: string; message: string; link_url: string | null;
      sort_order: number; link: { slug: string } | null;
    }[];
    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.json(
      rows.map((a) => ({
        id: a.id,
        message: a.message,
        link_url: a.link_url,
        link_slug: a.link?.slug ?? null,
        sort_order: a.sort_order,
      }))
    );
  } catch (err) {
    console.error('Duyurular alınamadı:', err);
    res.status(500).json({ error: 'Duyurular alınamadı.' });
  }
});

// GET /api/campaigns/:slug — tekil kampanya + durum (detay ekranı).
// NOT: /campaigns/archive'dan SONRA tanımlı olmalı (param eşleşmesi).
router.get('/campaigns/:slug', async (req: Request, res: Response) => {
  try {
    const today = istanbulToday();
    const now = Date.now();
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select(CAMPAIGN_FIELDS + ', is_active, is_archived')
      .eq('slug', req.params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Kampanya bulunamadı.' });
      return;
    }
    const c = data as unknown as CampaignRow;
    const stock = await getStockMap();
    const s = stock.get(c.id) ?? { total: 0, used: 0 };
    const remaining = s.total - s.used;
    const threshold = Math.max(Math.ceil(s.total * 0.15), 25);

    let status: string;
    if (c.is_archived) status = 'archived';
    else if (!c.is_active) status = 'inactive';
    else if (c.starts_at && new Date(c.starts_at).getTime() > now) status = 'scheduled';
    else if (c.valid_until && c.valid_until < today) status = 'expired';
    else if (remaining <= 0) status = 'sold_out';
    else status = 'live';

    // Stok'a duyarlı → kısa CDN cache (claim akışı sunucuda yeniden doğruluyor).
    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    res.json({
      ...c,
      has_codes: remaining > 0,
      is_low_stock: remaining > 0 && remaining <= threshold,
      status,
    });
  } catch (err) {
    console.error('Kampanya alınamadı:', err);
    res.status(500).json({ error: 'Kampanya alınamadı.' });
  }
});

export default router;

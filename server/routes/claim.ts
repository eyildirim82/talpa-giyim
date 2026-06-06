import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { verifyMember } from '../lib/memberVerify.js';
import { isValidTc } from '../lib/validateTc.js';
import { claimLimiter } from '../lib/rateLimit.js';

const router = Router();

type ClaimRpcResult =
  | { status: 'already_claimed'; codes: string[] }
  | { status: 'no_codes'; codes: string[] }
  | { status: 'claimed'; code: string; codes: string[]; limit_reached: boolean };

const BORCLU_MESSAGE =
  'Dernek aidat borçlarınız sebebiyle kampanya katılımınız sınırlandırılmıştır. Lütfen muhasebe birimi ile iletişime geçiniz.';

router.post('/claim-code', claimLimiter, async (req: Request, res: Response) => {
  const { tc_no, campaign_slug } = req.body as { tc_no: unknown; campaign_slug: unknown };

  if (!tc_no || typeof tc_no !== 'string' || !campaign_slug || typeof campaign_slug !== 'string') {
    res.status(400).json({ error: 'tc_no ve campaign_slug zorunludur.' });
    return;
  }

  if (!isValidTc(tc_no)) {
    res.status(400).json({ error: 'Geçersiz T.C. Kimlik Numarası.' });
    return;
  }

  try {
    // 1. Kampanyayı bul
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('id, is_active, max_codes_per_user, valid_until')
      .eq('slug', campaign_slug)
      .maybeSingle();

    if (campaignError) throw campaignError;

    if (!campaign) {
      res.status(404).json({ error: 'Kampanya bulunamadı.' });
      return;
    }

    if (!campaign.is_active) {
      res.status(400).json({ error: 'Bu kampanya şu an aktif değildir.' });
      return;
    }

    // valid_until bir DATE alanıdır; kampanya o günün sonuna kadar geçerlidir.
    // UTC tarih karşılaştırması ile "son geçerli günün başında dolma" hatası önlenir.
    if (campaign.valid_until) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      if (campaign.valid_until < today) {
        res.status(400).json({ error: 'Bu kampanya geçerliliğini yitirmiştir.' });
        return;
      }
    }

    // 2. Üye doğrula
    const verifyResult = await verifyMember(tc_no, campaign_slug);

    if (verifyResult.status === 'borclu') {
      res.status(403).json({ error: BORCLU_MESSAGE });
      return;
    }

    if (verifyResult.status === 'degil') {
      res.status(403).json({
        error: `TALPA üyelik kaydınıza ulaşılamamıştır.${verifyResult.reason ? ' (' + verifyResult.reason + ')' : ''}`,
      });
      return;
    }

    // 3. Atomik tahsis — limit kontrolü, kod seçimi ve claim kaydı tek transaction'da
    //    (advisory lock + FOR UPDATE SKIP LOCKED). Yarış durumları DB tarafında çözülür.
    const maxCodes = Number(campaign.max_codes_per_user) || 1;
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('claim_campaign_code', {
      p_campaign_id: campaign.id,
      p_tc_no: tc_no,
      p_max_codes: maxCodes,
    });

    if (rpcError) throw rpcError;

    const result = rpcData as ClaimRpcResult;

    if (result.status === 'already_claimed') {
      res.json({
        alreadyClaimed: true,
        codes: result.codes,
        message: 'Bu kampanyadan daha önce kod aldınız.',
      });
      return;
    }

    if (result.status === 'no_codes') {
      res.status(404).json({ error: 'Bu kampanyada dağıtılacak kod kalmamıştır.' });
      return;
    }

    // result.status === 'claimed'
    if (result.limit_reached) {
      res.json({
        alreadyClaimed: false,
        limitReached: true,
        codes: result.codes,
        message: 'Kampanya kodunuz teslim edildi.',
      });
    } else {
      res.json({
        alreadyClaimed: false,
        limitReached: false,
        code: result.code,
        message: 'Kampanya kodunuz başarıyla teslim edildi.',
      });
    }
  } catch (err) {
    console.error('Kod talep hatası:', err);
    res.status(500).json({ error: 'Sistem hatası.' });
  }
});

router.post('/my-codes', claimLimiter, async (req: Request, res: Response) => {
  const { tc_no } = req.body as { tc_no: unknown };

  if (!tc_no || typeof tc_no !== 'string') {
    res.status(400).json({ error: 'tc_no zorunludur.' });
    return;
  }

  if (!isValidTc(tc_no)) {
    res.status(400).json({ error: 'Geçersiz T.C. Kimlik Numarası.' });
    return;
  }

  try {
    // 1. Üye doğrula
    const verifyResult = await verifyMember(tc_no);
    const status = verifyResult.status;

    if (status === 'borclu') {
      res.status(403).json({ error: BORCLU_MESSAGE });
      return;
    }

    if (status === 'degil') {
      res.status(403).json({
        error: `TALPA üyelik kaydınıza ulaşılamamıştır.${verifyResult.reason ? ' (' + verifyResult.reason + ')' : ''}`,
      });
      return;
    }

    // 2. Üye doğrulanırsa, claimed_by_tc = tc_no olan kodları bul ve kampanyaları ile eşleştir
    const { data: claims, error: claimsError } = await supabaseAdmin
      .from('campaign_codes')
      .select('code, claimed_at, campaigns ( id, slug, title, discount_label, partner_name, partner_logo_url )')
      .eq('claimed_by_tc', tc_no)
      .order('claimed_at', { ascending: false });

    if (claimsError) throw claimsError;

    // 3. Verileri formatla
    const formattedClaims = (claims ?? []).map((claim: any) => {
      const campaign = Array.isArray(claim.campaigns) ? claim.campaigns[0] : claim.campaigns;
      return {
        code: claim.code,
        claimed_at: claim.claimed_at,
        campaign: campaign
          ? {
              id: campaign.id,
              slug: campaign.slug,
              title: campaign.title,
              discount_label: campaign.discount_label,
              partner_name: campaign.partner_name,
              partner_logo_url: campaign.partner_logo_url,
            }
          : null,
      };
    });

    res.json(formattedClaims);
  } catch (err) {
    console.error('Kodlar sorgulanamadı:', err);
    res.status(500).json({ error: 'Sistem hatası.' });
  }
});

export default router;

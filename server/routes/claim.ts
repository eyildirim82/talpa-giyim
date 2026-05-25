import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { verifyMember } from '../lib/memberVerify.js';

const router = Router();

router.post('/claim-code', async (req: Request, res: Response) => {
  const { tc_no, campaign_slug } = req.body as { tc_no: unknown; campaign_slug: unknown };

  if (!tc_no || typeof tc_no !== 'string' || !campaign_slug || typeof campaign_slug !== 'string') {
    res.status(400).json({ error: 'tc_no ve campaign_slug zorunludur.' });
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

    if (campaign.valid_until) {
      const validUntil = new Date(campaign.valid_until);
      if (isFinite(validUntil.getTime()) && validUntil < new Date()) {
        res.status(400).json({ error: 'Bu kampanya geçerliliğini yitirmiştir.' });
        return;
      }
    }

    // 2. Üye doğrula
    const verifyResult = await verifyMember(tc_no, campaign_slug);
    const status = verifyResult.status;

    if (status === 'borclu') {
      res.status(403).json({
        error:
          'Dernek aidat borçlarınız sebebiyle kampanya katılımınız sınırlandırılmıştır. Lütfen muhasebe birimi ile iletişime geçiniz.',
      });
      return;
    }

    if (status === 'degil') {
      res.status(403).json({
        error: `TALPA üyelik kaydınıza ulaşılamamıştır.${verifyResult.reason ? ' (' + verifyResult.reason + ')' : ''}`,
      });
      return;
    }

    // 3. Kullanıcının bu kampanyada aldığı kodları bul
    const { data: existingCodeRows, error: existingError } = await supabaseAdmin
      .from('campaign_codes')
      .select('code')
      .eq('campaign_id', campaign.id)
      .eq('claimed_by_tc', tc_no);

    if (existingError) throw existingError;

    const existingCodes = (existingCodeRows ?? []).map((r: { code: string }) => r.code);
    const maxCodes = Number(campaign.max_codes_per_user) || 1;

    if (existingCodes.length >= maxCodes) {
      res.json({
        alreadyClaimed: true,
        codes: existingCodes,
        message: 'Bu kampanyadan daha önce kod aldınız.',
      });
      return;
    }

    // 4. Kullanılmamış kod al
    const { data: codeRow, error: codeError } = await supabaseAdmin
      .from('campaign_codes')
      .select('id, code')
      .eq('campaign_id', campaign.id)
      .eq('is_used', false)
      .limit(1)
      .maybeSingle();

    if (codeError) throw codeError;

    if (!codeRow) {
      res.status(404).json({ error: 'Bu kampanyada dağıtılacak kod kalmamıştır.' });
      return;
    }

    // 5. Optimistic lock ile kodu güncelle
    const { data: updatedCode, error: updateError } = await supabaseAdmin
      .from('campaign_codes')
      .update({
        is_used: true,
        claimed_by_tc: tc_no,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', codeRow.id)
      .eq('is_used', false)
      .select('code')
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updatedCode) {
      res.status(409).json({ error: 'Kod alınırken çakışma oluştu, lütfen tekrar deneyin.' });
      return;
    }

    // 6. Talep kaydı oluştur
    await supabaseAdmin
      .from('campaign_claims')
      .insert({ campaign_id: campaign.id, tc_no })
      .then(() => null); // ON CONFLICT DO NOTHING — unique constraint bunu güvence altına alır

    // 7. Başarı — limit kontrolü
    const newCodes = [...existingCodes, updatedCode.code];

    if (newCodes.length >= maxCodes) {
      res.json({
        alreadyClaimed: false,
        limitReached: true,
        codes: newCodes,
        message: 'Kampanya kodunuz teslim edildi.',
      });
    } else {
      res.json({
        alreadyClaimed: false,
        limitReached: false,
        code: updatedCode.code,
        message: 'Kampanya kodunuz başarıyla teslim edildi.',
      });
    }
  } catch (err) {
    console.error('Kod talep hatası:', err);
    res.status(500).json({ error: 'Sistem hatası.' });
  }
});

export default router;

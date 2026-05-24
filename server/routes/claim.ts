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
      .select('id, is_active')
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

    // 2. Üye doğrula
    const status = await verifyMember(tc_no, campaign_slug);

    if (status === 'borclu') {
      res.status(403).json({
        error:
          'Dernek aidat borçlarınız sebebiyle kampanya katılımınız sınırlandırılmıştır. Lütfen muhasebe birimi ile iletişime geçiniz.',
      });
      return;
    }

    if (status === 'degil') {
      res.status(403).json({ error: 'TALPA üyelik kaydınıza ulaşılamamıştır.' });
      return;
    }

    // 3. Daha önce kod aldı mı?
    const { data: existingClaim } = await supabaseAdmin
      .from('campaign_claims')
      .select('id')
      .eq('campaign_id', campaign.id)
      .eq('tc_no', tc_no)
      .maybeSingle();

    if (existingClaim) {
      const { data: existingCode } = await supabaseAdmin
        .from('campaign_codes')
        .select('code')
        .eq('campaign_id', campaign.id)
        .eq('claimed_by_tc', tc_no)
        .maybeSingle();

      res.json({
        alreadyClaimed: true,
        code: existingCode?.code ?? null,
        message: 'Bu kampanyadan daha önce kod aldınız.',
      });
      return;
    }

    // 4. Kullanılmamış kod al — optimistic lock: .eq('is_used', false) update koşulunda tekrar kontrol edilir
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

    // 5. Kodu güncelle — is_used=false koşulu race condition'a karşı optimistic lock sağlar
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
      // Başka bir istek kodu kapti, yeniden dene mesajı ver
      res.status(409).json({ error: 'Kod alınırken çakışma oluştu, lütfen tekrar deneyin.' });
      return;
    }

    await supabaseAdmin
      .from('campaign_claims')
      .insert({ campaign_id: campaign.id, tc_no });

    // 6. Başarı
    res.json({
      alreadyClaimed: false,
      code: updatedCode.code,
      message: 'Kampanya kodunuz başarıyla teslim edildi.',
    });
  } catch (err) {
    console.error('Kod talep hatası:', err);
    res.status(500).json({ error: 'Sistem hatası.' });
  }
});

export default router;

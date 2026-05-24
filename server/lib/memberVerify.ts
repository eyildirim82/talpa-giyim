type MemberStatus = 'uye' | 'borclu' | 'degil';

type ApiResponse = {
  status: MemberStatus;
  reason?: string;
};

export async function verifyMember(tcNo: string, campaignSlug?: string): Promise<MemberStatus> {
  const apiUrl =
    process.env.TALPA_MEMBER_API_URL ?? 'https://talpa-uye.vercel.app/api/members/verify';
  const apiKey = process.env.TALPA_API_KEY ?? '';

  try {
    const body: Record<string, string> = { tcNo };
    if (campaignSlug) body.campaignSlug = campaignSlug;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as ApiResponse;

    if (res.status === 401) {
      console.error('TALPA Member API: geçersiz API key (401)');
      return 'degil';
    }

    if (res.status === 429) {
      console.error('TALPA Member API: rate limit aşıldı (429)');
      return 'degil';
    }

    if (res.status === 500) {
      console.error('TALPA Member API: sunucu hatası (500)', data.reason);
      return 'degil';
    }

    // 400 (invalid_tc_no) ve 404 (not_found) dahil tüm yanıtlarda
    // API zaten status: "degil" döndürür, direkt kullan.
    return data.status;
  } catch (err) {
    console.error('TALPA Member API isteği başarısız (network hatası):', err);
    return 'degil';
  }
}

type MemberStatus = 'uye' | 'borclu' | 'degil';

export async function verifyMember(tcNo: string, campaignSlug?: string): Promise<MemberStatus> {
  const apiUrl = process.env.TALPA_MEMBER_API_URL ?? 'https://talpa.org/api/members/verify';
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

    if (res.status === 429) {
      console.error('TALPA Member API rate limit aşıldı (429)');
      return 'degil';
    }

    if (!res.ok) {
      console.error(`TALPA Member API hata döndürdü: ${res.status}`);
      return 'degil';
    }

    const data = (await res.json()) as { status: MemberStatus };
    return data.status;
  } catch (err) {
    console.error('TALPA Member API isteği başarısız:', err);
    return 'degil';
  }
}

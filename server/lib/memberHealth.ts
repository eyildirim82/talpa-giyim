// Dış TALPA Üye servisini aktif yoklar (sağlık ekranındaki "Şimdi test et").
// /health ucu uye/borclu/degil iş mantığına dokunmadan yalnızca servis+DB ayakta mı bakar.

const HEALTH_TIMEOUT_MS = 6000;

export type PingResult = {
  ok: boolean;
  status: number | null; // HTTP durum kodu (ağ hatası/zaman aşımında null)
  ms: number; // yanıt süresi
  detail?: string; // 'ok' | 'timeout' | 'network' | servis durum metni
};

export async function pingMemberService(): Promise<PingResult> {
  const verifyUrl =
    process.env.TALPA_MEMBER_API_URL ?? 'https://talpa-uye.vercel.app/api/members/verify';
  // Sağlık URL'i: ayrı env yoksa verify URL'inden türet (/members/verify -> /health).
  const healthUrl =
    process.env.TALPA_MEMBER_HEALTH_URL ?? verifyUrl.replace(/\/members\/verify\/?$/, '/health');
  const apiKey = process.env.TALPA_API_KEY ?? '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
      signal: controller.signal,
    });
    const ms = Date.now() - started;
    let detail: string | undefined;
    try {
      const data = (await res.json()) as { status?: string };
      detail = data?.status;
    } catch {
      // gövde okunamazsa önemli değil — HTTP durumu yeterli sinyal
    }
    return { ok: res.ok, status: res.status, ms, detail };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { ok: false, status: null, ms: Date.now() - started, detail: aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timeout);
  }
}

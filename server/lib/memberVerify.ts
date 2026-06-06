// Dış TALPA Üye API'sinin döndürebileceği iş durumları.
type MemberStatus = 'uye' | 'borclu' | 'degil';

// Bizim ürettiğimiz ek durum: doğrulama servisine ulaşılamadı / beklenmeyen cevap.
// 'hata', "üye değil" ile KARIŞTIRILMAMALIDIR — servis tarafı bir sorun demektir.
type VerifyStatus = MemberStatus | 'hata';

type ApiResponse = {
  status: MemberStatus;
  reason?: string;
};

type VerifyResult = { status: VerifyStatus; reason?: string };

// Tek bir istek bu süreyi aşarsa iptal edilir; askıda kalan dış servis,
// 'hata' olarak işaretlenir (özellikle toplu e-posta anında bağlantıları tıkamaması için).
const REQUEST_TIMEOUT_MS = 8000;

/**
 * verifyMember — TALPA Üye API'sine sorar; 429/5xx/ağ hatalarında yeniden dener.
 *
 * Dönüş kuralı: yalnızca gerçek bir `status` alanı içeren temiz bir cevap
 * (uye/borclu/degil) KESİN sayılır. 401 (anahtar hatası), 5xx, ağ kopması,
 * zaman aşımı veya status alanı olmayan beklenmeyen cevaplar `hata` döndürür —
 * böylece servis arızasında gerçek bir üye yanlışlıkla "üye değil" diye reddedilmez.
 */
export async function verifyMember(
  tcNo: string,
  campaignSlug?: string,
  maxRetries = 3
): Promise<VerifyResult> {
  const apiUrl = process.env.TALPA_MEMBER_API_URL ?? 'https://talpa-uye.vercel.app/api/members/verify';
  const apiKey = process.env.TALPA_API_KEY ?? '';

  const body: Record<string, string> = { tcNo };
  if (campaignSlug) body.campaignSlug = campaignSlug;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      let data: ApiResponse | null = null;
      try {
        data = (await res.json()) as ApiResponse;
      } catch {
        // ignore JSON parse errors
      }

      if (res.status === 401) {
        // Yapılandırma hatası (yanlış/expired API anahtarı). Yeniden deneme fayda etmez
        // ve bu BİZİM tarafımızdaki bir sorun — üyeyi suçlamak yerine 'hata' döndür.
        console.error('TALPA Member API: invalid API key (401)');
        return { status: 'hata', reason: data?.reason };
      }

      if (res.status === 429) {
        // rate limited — retry with exponential backoff
        const delay = Math.pow(2, attempt) * 1000; // 1s,2s,4s...
        console.warn(`TALPA Member API rate limited (429). retrying in ${delay}ms`);
        lastError = { code: 429, reason: data?.reason };
        if (attempt < maxRetries - 1) await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (res.status >= 500) {
        console.error('TALPA Member API server error', res.status, data?.reason);
        lastError = { status: res.status, reason: data?.reason };
        if (attempt < maxRetries - 1) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }

      // Yalnızca gerçek bir durum alanı içeren cevap KESİNDİR.
      if (data && data.status) {
        return { status: data.status, reason: data.reason };
      }

      // status alanı olmayan beklenmeyen cevap (ör. bozuk 200 / 4xx). Kesin "üye değil"
      // saymak yanlış olur — servis düzgün cevap vermiyor demektir, 'hata' döndür.
      console.error('TALPA Member API: unexpected response without status field', res.status);
      return { status: 'hata', reason: data?.reason };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      console.error(`TALPA Member API request failed (${aborted ? 'timeout' : 'network'}):`, err);
      lastError = err;
      if (attempt < maxRetries - 1) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Tüm denemeler tükendi — güvenli tarafta kal ama 'hata' olarak işaretle (kod verilmez,
  // üyeye "servise ulaşılamadı, tekrar dene" denir; sağlık ekranı bunu görür).
  console.error('TALPA Member API: all retries exhausted', lastError);
  let reason: string | undefined = undefined;
  if (typeof lastError === 'object' && lastError !== null && 'reason' in lastError) {
    const errorObj = lastError as Record<string, unknown>;
    if (typeof errorObj.reason === 'string') {
      reason = errorObj.reason;
    }
  }
  return { status: 'hata', reason };
}

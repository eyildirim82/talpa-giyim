# TALPA Üye Doğrulama Entegrasyonu

**Summary**: TALPA Kampanyaları uygulamasının dış TALPA Üye API entegrasyonu, HTTP request/response şeması, iş mantığı durum tablosu ve rate-limiting/sunucu hataları için üstel geri çekilme (retry) politikası.
**Tags**: #member-verification #api #integration #retry-policy #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-06-08T16:00:00+03:00

---

## Content

Kampanya indirim kodlarının adil ve doğru bir şekilde yalnızca hak sahibi TALPA (Türkiye Havayolu Pilotları Derneği) üyelerine dağıtılmasını sağlamak amacıyla, dış bir **TALPA Üye API** servisiyle entegrasyon sağlanmıştır.

Sunucu tarafındaki doğrulama mantığı [server/lib/memberVerify.ts](../../server/lib/memberVerify.ts) içinde yer alır ve `verifyMember` fonksiyonu ile yönetilir.

---

## 🔗 Doğrulama Endpoint Detayları

* **Endpoint:** `POST https://talpa-uye.vercel.app/api/members/verify` (Ortam değişkeninden ezilebilir: `TALPA_MEMBER_API_URL`)
* **Headers:**
  * `Content-Type: application/json`
  * `X-API-Key: <TALPA_API_KEY>`

### İstek Gövdesi (Request Body)
İstek, sorgulanan üyenin T.C. Kimlik Numarasını ve opsiyonel olarak kampanya slug'ını içerir:
```json
{
  "tcNo": "12345678901",
  "campaignSlug": "brooks-brothers-2026"
}
```

---

## 🚦 Yanıt Durumları ve İş Mantığı (Business Logic)

`verifyMember` iki tür durum üretir: dış API'nin döndürdüğü **iş durumları** (`uye` / `borclu` / `degil`) ve yalnızca **bizim** ürettiğimiz **`hata`** durumu. `hata`, dış API'nin doğru bir cevap **veremediği** (servis çökük, anahtar yanlış, zaman aşımı) anlamına gelir ve `degil` ("üye değil") ile **asla karıştırılmamalıdır**.

| Dönen Durum (`status`) | Açıklama | Sunucu Aksiyonu |
| :--- | :--- | :--- |
| **`uye`** | Aktif üye, aidat borcu bulunmuyor. | Kod tahsis aşamasına geçilir. |
| **`borclu`** | Aktif üye ancak aidat borcu bulunuyor. | Kod alımı engellenir (**403 Forbidden**). Muhasebe birimi uyarısı döner. |
| **`degil`** | Üye kaydı yok, üye pasif ya da bu kampanyaya erişim yetkisi whitelist dışı. | Kod alımı engellenir (**403 Forbidden**). |
| **`hata`** | Servise ulaşılamadı / beklenmeyen cevap (401, 5xx, ağ kopması, timeout veya `status` alanı olmayan gövde). | Gerçek üye yanlışlıkla reddedilmez: claim/my-codes uç noktaları **503 "servise ulaşılamıyor, tekrar deneyin"** döner ve hata sağlık ekranı için kaydedilir (bkz. [database.md](database.md#-do%C4%9Frulama-hatas%C4%B1-g%C3%BCnl%C3%BC%C4%9F%C3%BC-system_verify_failures)). |

> [!IMPORTANT]
> **Tasarım kararı (2026-06):** Eski sürümde servis çökerse `verifyMember` "güvenli tarafta kalmak" için `degil` dönüyordu; bu, dış servis arızalandığında **gerçek üyelerin "üye kaydınıza ulaşılamadı" hatasıyla reddedilmesine** yol açıyordu. Artık servis arızası `hata` olarak ayrıştırılır → kullanıcıya kod verilmez **ama** suçlanmaz; "birkaç dakika sonra tekrar deneyin" mesajı gösterilir ve olay [Sistem Sağlık Ekranı](admin.md#-sistem-sa%C4%9Fl%C4%B1%C4%9F%C4%B1-paneli)'nde görünür.

---

## 🔁 Hata Toleransı & Yeniden Deneme (Retry) Politikası

Ağ kesintileri veya dış servisin aşırı yüklenmesi gibi geçici hatalarda üye memnuniyetini korumak ve kesintisiz hizmet sunmak için `verifyMember` fonksiyonu **üstel geri çekilme (exponential backoff)** ve **yeniden deneme (retry)** mimarisiyle donatılmıştır.

Fonksiyon varsayılan olarak **3 deneme (maxRetries = 3)** yapacak şekilde tasarlanmıştır:

### 1. Rate Limit (HTTP 429) Yönetimi
Dış servis tarafından rate limit uygulandığında (HTTP 429), sunucu her denemede bekleme süresini ikiye katlayarak (`Math.pow(2, attempt) * 1000`) bekler ve tekrar dener:
* 1. Hata sonrası bekleme: **1 saniye**
* 2. Hata sonrası bekleme: **2 saniye**
* 3. Hata sonrası bekleme: **4 saniye**

### 2. Dış Sunucu Hataları (HTTP 5xx) ve Ağ Hataları (Network Errors)
Dış API sunucusundan 500'lü hata kodları döndüğünde veya ağ bağlantısı koptuğunda, sunucu doğrusal artan bir süreyle (`500 * (attempt + 1)`) bekleyip denemeyi yineler:
* 1. Hata sonrası bekleme: **500 ms**
* 2. Hata sonrası bekleme: **1000 ms**
* 3. Hata sonrası bekleme: **1500 ms**

### 3. API Yetkilendirme Hataları (HTTP 401)
API anahtarının yanlış/expired olması gibi kalıcı yapılandırma hatalarında **yeniden deneme yapılmaz**. Bu **bizim** tarafımızdaki bir sorun olduğu için üyeyi suçlamak yerine doğrudan `"hata"` durumu döner ve sunucu konsoluna `invalid API key (401)` basılır.

### 4. İstek Zaman Aşımı (Timeout)
Her istek bir `AbortController` ile **8 saniye** (`REQUEST_TIMEOUT_MS = 8000`) sonra iptal edilir. Askıda kalan dış servis — özellikle toplu e-posta anındaki yığılmada — bağlantıları tıkamasın diye timeout bir ağ hatası gibi ele alınır ve yeniden denenir; tüm denemeler timeout ile biterse `"hata"` (detay: `timeout`) döner.

### 5. Beklenmeyen Cevap (status alanı yok)
Sunucu 2xx/4xx dönse bile gövdede geçerli bir `status` alanı yoksa (bozuk cevap) bu **kesin "üye değil" sayılmaz** — servis düzgün çalışmıyor demektir, `"hata"` döner.

### 6. Denemelerin Tüketilmesi (Exhaustion)
Tüm denemeler (429/5xx/ağ/timeout) başarısız olursa, sistem en son alınan hatayı loglar ve `"hata"` durumu döndürerek işlemi sonlandırır. **Kod verilmez**, fakat üyeye "servise ulaşılamadı, tekrar deneyin" denir (HTTP 503) ve olay sağlık ekranına yansır.

---

## 🛠️ Örnek Kod Implementasyonu

Aşağıda [server/lib/memberVerify.ts](../../server/lib/memberVerify.ts) dosyasındaki temel akış gösterilmektedir:

```typescript
// Dönüş tipi: dış API'nin iş durumları + bizim 'hata' durumumuz
type VerifyStatus = 'uye' | 'borclu' | 'degil' | 'hata';
const REQUEST_TIMEOUT_MS = 8000; // istek başına AbortController timeout'u

export async function verifyMember(
  tcNo: string,
  campaignSlug?: string,
  maxRetries = 3
): Promise<{ status: VerifyStatus; reason?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(apiUrl, { /* ...headers, signal: controller.signal */ });
      let data = null;
      try { data = await res.json(); } catch { /* gövde okunamadı */ }

      // 401 = bizim anahtar hatamız → üyeyi suçlama, 'hata' dön (retry'sız)
      if (res.status === 401) return { status: 'hata', reason: data?.reason };

      if (res.status === 429) { /* exp. backoff: 1s,2s,4s */ continue; }
      if (res.status >= 500) { /* linear backoff: 0.5s,1s,1.5s */ continue; }

      // Yalnızca geçerli bir status alanı içeren cevap KESİNDİR
      if (data && data.status) return { status: data.status, reason: data.reason };

      // status yok → bozuk cevap, kesin "üye değil" sayma
      return { status: 'hata', reason: data?.reason };
    } catch (err) {
      // ağ hatası / timeout (AbortError) → linear backoff ile retry
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }
  // tüm denemeler tükendi → 'hata' (degil DEĞİL)
  return { status: 'hata' };
}
```

## Related Notes

- [[README]]
- [[architecture]]
- [[api]]

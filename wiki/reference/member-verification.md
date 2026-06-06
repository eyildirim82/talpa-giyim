# TALPA Üye Doğrulama Entegrasyonu

**Summary**: TALPA Kampanyaları uygulamasının dış TALPA Üye API entegrasyonu, HTTP request/response şeması, iş mantığı durum tablosu ve rate-limiting/sunucu hataları için üstel geri çekilme (retry) politikası.
**Tags**: #member-verification #api #integration #retry-policy #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-05-26T12:35:00+03:00

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

Üye API'sinden dönen `status` değerine göre Express sunucusu claim işlemini yönlendirir:

| Dönen Durum (`status`) | Açıklama | Sunucu Aksiyonu |
| :--- | :--- | :--- |
| **`uye`** | Aktif üye, aidat borcu bulunmuyor. | Kod tahsis aşamasına geçilir. |
| **`borclu`** | Aktif üye ancak aidat borcu bulunuyor. | Kod alımı engellenir (**403 Forbidden**). Muhasebe birimi uyarısı döner. |
| **`degil`** | Üye kaydı yok, üye pasif ya da bu kampanyaya erişim yetkisi whitelist dışı. | Kod alımı engellenir (**403 Forbidden**). |

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
API anahtarının yanlış olması gibi kalıcı yapılandırma hatalarında **yeniden deneme yapılmaz**. Doğrudan üye bulunamadı (`degil`) yanıtı döner ve sunucu konsoluna hata basılır.

### 4. Denemelerin Tüketilmesi (Exhaustion)
Tüm denemeler başarısız olursa, sistem en son alınan hatayı loglar ve güvenli tarafta kalmak adına `"degil"` durumu döndürerek işlemi sonlandırır.

---

## 🛠️ Örnek Kod Implementasyonu

Aşağıda [server/lib/memberVerify.ts](../../server/lib/memberVerify.ts) dosyasındaki temel akış gösterilmektedir:

```typescript
export async function verifyMember(
  tcNo: string,
  campaignSlug?: string,
  maxRetries = 3
): Promise<VerifyResult> {
  // ... Kurulum ve URL tanımları
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(apiUrl, { ... });
      
      if (res.status === 401) return { status: 'degil' };

      if (res.status === 429) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue; // Retry
      }

      if (res.status >= 500) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue; // Retry
      }

      const data = await res.json();
      return { status: data.status, reason: data.reason };
    } catch (err) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue; // Retry
    }
  }
  return { status: 'degil' };
}
```

## Related Notes

- [[README]]
- [[architecture]]
- [[api]]

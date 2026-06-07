# API Uç Noktaları (Endpoints) Dokümantasyonu

**Summary**: TALPA Kampanyaları uygulamasının API uç noktaları dokümantasyonu; üye uç noktaları (public) ve korunan yönetici (admin) uç noktalarını içerir.
**Tags**: #api #endpoints #routing #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-06-07T12:00:00+03:00

---

## Content

API sunucusu, `/api` önekiyle hizmet verir. Üye uç noktaları halka açıkken, yönetici (admin) uç noktaları yetkilendirme katmanıyla korunmaktadır.

---

## 👥 Üye Uç Noktaları (Public API)

> [!NOTE]
> `/api/claim-code` ve `/api/my-codes` uç noktaları **IP başına dakikada 10 istekle** sınırlıdır; aşıldığında **429** döner. Ayrıca `tc_no` sunucu tarafında algoritmik olarak doğrulanır; geçersizse **400 "Geçersiz T.C. Kimlik Numarası."** döner.

> [!IMPORTANT]
> **503 — Doğrulama servisi geçici hata:** Üye doğrulama servisine ulaşılamazsa (`verifyMember` → `hata`) hem `/api/claim-code` hem de `/api/my-codes` **503** döner: `{ "error": "Üyelik doğrulama servisine şu an ulaşılamıyor. Lütfen birkaç dakika sonra tekrar deneyin." }`. Bu durumda gerçek üye `degil` ile reddedilmez; olay `system_verify_failures` tablosuna kaydedilir. Bkz. [member-verification.md](member-verification.md#-yan%C4%B1t-durumlar%C4%B1-ve-i%C5%9F-mant%C4%B1%C4%9F%C4%B1-business-logic).

### 1. Aktif Kampanyaları Getir
Aktif yayında olan (`is_active = true`) tüm kampanyaları `featured_order` azalan sırada listeler. Her kampanya için stok bilgisi **tek bir RPC** (`campaign_stock_counts()`) ile toplanır; eski sürümdeki kampanya başına ayrı sayım sorgusu (N+1) kaldırılmıştır — toplu e-posta anında her ziyaretçi için yüzlerce sorgu atılmasını önler.

* **URL:** `/api/campaigns`
* **Metot:** `GET`
* **Yetkilendirme:** Yok
* **cURL Test Komutu:**
  ```bash
  curl -X GET http://localhost:3001/api/campaigns
  ```
* **Başarılı Yanıt (200 OK):**
  ```json
  [
    {
      "id": "7fbe5012-e544-4822-a9b0-31db72b64d0b",
      "slug": "brooks-brothers-2026",
      "title": "Brooks Brothers Kampanyası",
      "description": "Tüm Brooks Brothers mağazalarında geçerli ek %10 indirim.",
      "partner_name": "Brooks Brothers",
      "partner_logo_url": "https://xxxx.supabase.co/storage/v1/object/public/campaign-images/logo.png",
      "cover_image_url": "https://xxxx.supabase.co/storage/v1/object/public/campaign-images/cover.jpg",
      "discount_label": "%10 İndirim",
      "is_featured": true,
      "featured_order": 5,
      "valid_until": "2026-12-31",
      "max_codes_per_user": 1,
      "terms": "Kampanya koşulları buraya yazılır...",
      "has_codes": true,
      "is_low_stock": false
    }
  ]
  ```
  > **`has_codes` / `is_low_stock`:** Stok durumu sunucuda türetilir; ham kod sayıları **istemciye sızdırılmaz**. `has_codes = false` → stok tükendi ("Tükendi" rozeti, buton kilitli). `is_low_stock = true` → kalan kod eşiğin altında ("Son kodlar!" uyarısı). Eşik admin sağlık ekranıyla **aynıdır**: `max(ceil(total * 0.15), 25)` — yani kalanın %15'i, küçük kampanyalarda en az 25 adet.

---

### 2. İndirim Kodu Talep Et (Claim)
TC Kimlik Numarası doğrulaması yaparak üyeye yeni indirim kodu tahsis eder.

* **URL:** `/api/claim-code`
* **Metot:** `POST`
* **Yetkilendirme:** Yok
* **cURL Test Komutu:**
  ```bash
  curl -X POST http://localhost:3001/api/claim-code \
    -H "Content-Type: application/json" \
    -d '{"tc_no": "12345678901", "campaign_slug": "brooks-brothers-2026"}'
  ```
* **İstek Gövdesi (Request Body):**
  ```json
  {
    "tc_no": "12345678901",
    "campaign_slug": "brooks-brothers-2026"
  }
  ```
* **Başarılı Yanıtlar (200 OK):**
  
  * **Senaryo A: Yeni Kod Başarıyla Teslim Edildi (Limit Dolmadı):**
    ```json
    {
      "alreadyClaimed": false,
      "limitReached": false,
      "code": "BB-10-XYZ123",
      "message": "Kampanya kodunuz başarıyla teslim edildi."
    }
    ```
  * **Senaryo B: Yeni Kod Teslim Edildi ve Kullanıcı Limitine Ulaşıldı:**
    ```json
    {
      "alreadyClaimed": false,
      "limitReached": true,
      "codes": ["BB-10-XYZ123"],
      "message": "Kampanya kodunuz teslim edildi."
    }
    ```
  * **Senaryo C: Kullanıcı Zaten Önceden Kod Almış (Yeni Kod Üretilmedi):**
    ```json
    {
      "alreadyClaimed": true,
      "codes": ["BB-10-XYZ123"],
      "message": "Bu kampanyadan daha önce kod aldınız."
    }
    ```

* **Hata Yanıtları:**
  * **400 Bad Request:** Eksik parametre veya geçersiz kampanya.
    ```json
    { "error": "Bu kampanya şu an aktif değildir." }
    ```
  * **403 Forbidden (Aidat Borcu):**
    ```json
    { "error": "Dernek aidat borçlarınız sebebiyle kampanya katılımınız sınırlandırılmıştır. Lütfen muhasebe birimi ile iletişime geçiniz." }
    ```
  * **403 Forbidden (Üye Değil):**
    ```json
    { "error": "TALPA üyelik kaydınıza ulaşılamamıştır." }
    ```
  * **404 Not Found (Kod Yok):**
    ```json
    { "error": "Bu kampanyada dağıtılacak kod kalmamıştır." }
    ```
  * **409 Conflict:** Çakışma yaşanırsa.
    ```json
    { "error": "Kod alınırken çakışma oluştu, lütfen tekrar deneyin." }
    ```
  * **503 Service Unavailable:** Üye doğrulama servisine ulaşılamadı (geçici).
    ```json
    { "error": "Üyelik doğrulama servisine şu an ulaşılamıyor. Lütfen birkaç dakika sonra tekrar deneyin." }
    ```

---

### 3. Üyenin Tüm Kodlarını Getir (My Codes)
TC Kimlik doğrulaması yaparak, üyenin tüm kampanyalarda daha önce aldığı kodları kampanya bilgileriyle birlikte döner. Üye kendi kod geçmişini görüntülemek için kullanır.

* **URL:** `/api/my-codes`
* **Metot:** `POST`
* **Yetkilendirme:** Yok (üyelik `verifyMember` ile doğrulanır)
* **cURL Test Komutu:**
  ```bash
  curl -X POST http://localhost:3001/api/my-codes \
    -H "Content-Type: application/json" \
    -d '{"tc_no": "12345678901"}'
  ```
* **İstek Gövdesi:** `{ "tc_no": "12345678901" }`
* **Başarılı Yanıt (200 OK):**
  ```json
  [
    {
      "code": "BB-10-XYZ123",
      "claimed_at": "2026-05-26T10:00:00Z",
      "campaign": {
        "id": "7fbe5012-e544-4822-a9b0-31db72b64d0b",
        "slug": "brooks-brothers-2026",
        "title": "Brooks Brothers Kampanyası",
        "discount_label": "%10 İndirim",
        "partner_name": "Brooks Brothers",
        "partner_logo_url": "https://xxxx.supabase.co/.../logo.png"
      }
    }
  ]
  ```
* **Hata Yanıtları:** `400` (tc_no eksik/geçersiz), `403` (borçlu / üye değil), `503` (doğrulama servisine ulaşılamadı — tekrar denenebilir), `500` (sistem hatası).

---

## 🛠️ Yönetici Uç Noktaları (Admin API)

Tüm yönetici API'leri HTTP `Authorization` başlığında geçerli bir JWT token bekler ve token sahibinin e-postası `admins` allowlist tablosunda kayıtlı olmalıdır (bkz. [admin.md](admin.md)).

* **Header:** `Authorization: Bearer <supabase_access_token>`
* **401 Unauthorized:** Token yok veya geçersiz.
* **403 Forbidden:** Token geçerli ancak kullanıcı `admins` tablosunda değil (`{ "error": "Bu hesabın yönetici yetkisi bulunmuyor." }`).

---

### 1. Tüm Kampanyaları Listele (İstatistiklerle Birlikte)
* **URL:** `/api/admin/campaigns`
* **Metot:** `GET`
* **cURL Test Komutu:**
  ```bash
  curl -X GET http://localhost:3001/api/admin/campaigns \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ"
  ```
* **Başarılı Yanıt (200 OK):**
  ```json
  [
    {
      "id": "7fbe5012-e544-4822-a9b0-31db72b64d0b",
      "slug": "brooks-brothers-2026",
      "title": "Brooks Brothers Kampanyası",
      "totalCodes": 150,
      "usedCodes": 45,
      "remainingCodes": 105
    }
  ]
  ```

---

### 2. Yeni Kampanya Oluştur
* **URL:** `/api/admin/campaigns`
* **Metot:** `POST`
* **cURL Test Komutu:**
  ```bash
  curl -X POST http://localhost:3001/api/admin/campaigns \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ" \
    -H "Content-Type: application/json" \
    -d '{"slug": "network-2026", "title": "Network %15 İndirim", "discount_label": "%15 İndirim"}'
  ```

---

### 3. Kampanya Bilgilerini Güncelle
* **URL:** `/api/admin/campaigns/:id`
* **Metot:** `PUT`
* **cURL Test Komutu:**
  ```bash
  curl -X PUT http://localhost:3001/api/admin/campaigns/7fbe5012-e544-4822-a9b0-31db72b64d0b \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ" \
    -H "Content-Type: application/json" \
    -d '{"is_active": true, "is_featured": true}'
  ```

---

### 4. Bulk (Toplu) Kod Yükle
* **URL:** `/api/admin/campaigns/:id/codes`
* **Metot:** `POST`
* **cURL Test Komutu:**
  ```bash
  curl -X POST http://localhost:3001/api/admin/campaigns/7fbe5012-e544-4822-a9b0-31db72b64d0b/codes \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ" \
    -H "Content-Type: application/json" \
    -d '{"codes": ["CODE1", "CODE2", "CODE3"]}'
  ```
* **Başarılı Yanıt (200 OK):**
  ```json
  {
    "success": true,
    "inserted": 2,
    "duplicates": ["CODE1"]
  }
  ```

---

### 5. Görsel Yükle (Image Upload)
* **URL:** `/api/admin/upload`
* **Metot:** `POST`
* **Açıklama:** Dosya verisini sunucu üzerinden geçirmez. Supabase Storage için bir
  *signed upload URL* (`path` + `token`) döner; istemci dosyayı bu token ile
  doğrudan Supabase'e yükler (`uploadToSignedUrl`). Bu sayede Vercel serverless'ın
  ~4.5MB istek gövdesi limiti ve base64 şişmesi devre dışı kalır.
* **cURL Test Komutu:**
  ```bash
  curl -X POST http://localhost:3001/api/admin/upload \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ" \
    -H "Content-Type: application/json" \
    -d '{"filename": "logo.png"}'
  ```
* **Başarılı Yanıt (200 OK):**
  ```json
  {
    "path": "1700000000000-abc123.png",
    "token": "SIGNED_UPLOAD_TOKEN",
    "publicUrl": "https://<proje>.supabase.co/storage/v1/object/public/campaign-images/1700000000000-abc123.png"
  }
  ```

---

### 6. Üye Kod Sorgulama (Lookup)
* **URL:** `/api/admin/campaigns/:id/lookup?tc_no=12345678901`
* **Metot:** `GET`
* **cURL Test Komutu:**
  ```bash
  curl -X GET http://localhost:3001/api/admin/campaigns/7fbe5012-e544-4822-a9b0-31db72b64d0b/lookup?tc_no=12345678901 \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ"
  ```

---

### 7. Genel İstatistikler
* **URL:** `/api/admin/stats`
* **Metot:** `GET`
* **cURL Test Komutu:**
  ```bash
  curl -X GET http://localhost:3001/api/admin/stats \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ"
  ```

---

### 8. Kampanya Önizleme
* **URL:** `/api/admin/campaigns/:id/preview`
* **Metot:** `GET`
* **cURL Test Komutu:**
  ```bash
  curl -X GET http://localhost:3001/api/admin/campaigns/7fbe5012-e544-4822-a9b0-31db72b64d0b/preview \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ"
  ```

---

### 9. Sistemi Sıfırla (Reset)
* **URL:** `/api/admin/reset`
* **Metot:** `DELETE`
* **cURL Test Komutu:**
  ```bash
  curl -X DELETE http://localhost:3001/api/admin/reset \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ"
  ```

---

### 10. Kod Raporunu Dışa Aktar (CSV Export)
Kampanyaya ait tüm kodları, kullanım durumlarını ve teslim alan T.C. numaralarını UTF-8 BOM'lu (Excel uyumlu) bir CSV dosyası olarak indirir.

* **URL:** `/api/admin/campaigns/:id/export`
* **Metot:** `GET`
* **Yanıt:** `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="<slug>-kod-raporu.csv"`
* **Sütunlar:** `İndirim Kodu, Kullanım Durumu, Kullanan T.C. No, Kullanım Tarihi`
* **cURL Test Komutu:**
  ```bash
  curl -X GET http://localhost:3001/api/admin/campaigns/7fbe5012-e544-4822-a9b0-31db72b64d0b/export \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ" -O
  ```

---

### 11. Sistem Sağlık Durumu (Health Snapshot)
Sistem Sağlık Ekranını besleyen anlık durum: dış servis hataları, sistem nabzı ve kampanya bazında stok. Stok sayımları tek RPC (`campaign_stock_counts()`) ile alınır. Detay: [admin.md](admin.md#-sistem-sa%C4%9Fl%C4%B1%C4%9F%C4%B1-paneli).

* **URL:** `/api/admin/health`
* **Metot:** `GET`
* **cURL Test Komutu:**
  ```bash
  curl -X GET http://localhost:3001/api/admin/health \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ"
  ```
* **Başarılı Yanıt (200 OK):**
  ```json
  {
    "now": "2026-06-07T09:00:00.000Z",
    "verifyFailures": { "last30m": 0, "lastAt": null },
    "pulse": { "lastClaimAt": "2026-06-07T08:58:12.000Z", "todayCount": 142 },
    "campaigns": [
      {
        "id": "7fbe5012-...",
        "slug": "brooks-brothers-2026",
        "title": "Brooks Brothers Kampanyası",
        "is_active": true,
        "total": 500,
        "used": 142,
        "remaining": 358,
        "status": "ok"
      }
    ]
  }
  ```
  * `verifyFailures.last30m`: son 30 dakikadaki `system_verify_failures` kaydı sayısı.
  * `pulse.todayCount`: **İstanbul (UTC+3)** gününde dağıtılan kod adedi (gün başlangıcı UTC'ye çevrilerek sayılır).
  * `campaigns[].status`: `ok` · `low` (kalan ≤ eşik) · `out` (stok bitti) · `no_codes` (hiç kod yüklenmemiş). Eşik: `max(ceil(total*0.15), 25)`.

---

### 12. Dış Servisi Aktif Yokla (Probe — "Şimdi test et")
Dış üye doğrulama servisinin `/health` ucunu aktif olarak yoklar; `uye/borclu/degil` iş mantığına dokunmaz, yalnızca servis + DB ayakta mı bakar. 6 sn timeout'lu.

* **URL:** `/api/admin/health/probe`
* **Metot:** `GET`
* **cURL Test Komutu:**
  ```bash
  curl -X GET http://localhost:3001/api/admin/health/probe \
    -H "Authorization: Bearer SIZIN_JWT_TOKENINIZ"
  ```
* **Başarılı Yanıt (200 OK):**
  ```json
  { "ok": true, "status": 200, "ms": 187, "detail": "ok" }
  ```
  * `ok=false, status=null` → ağ hatası/timeout (`detail`: `network` | `timeout`).
  * `status=404` → `/health` ucu henüz yayında değil (dış `talpa-uye` deploy bekliyor); panel bunu **kırmızı değil gri** ("yayında değil") gösterir.
  * Sağlık URL'i `TALPA_MEMBER_HEALTH_URL`'den; tanımlı değilse `TALPA_MEMBER_API_URL`'in `/members/verify` → `/health` dönüşümünden türetilir.

## Related Notes

- [[README]]
- [[admin]]
- [[architecture]]

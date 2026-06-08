# API Uç Noktaları (Endpoints) Dokümantasyonu

**Summary**: TALPA Kampanyaları uygulamasının API uç noktaları; public vitrin uçları (kampanya/arşiv/tür/duyuru), üye kod uçları ve korunan yönetici (admin) uçları (kampanya/kod/tür/duyuru CRUD, sağlık, export).
**Tags**: #api #endpoints #routing #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-06-08T16:00:00+03:00

---

## Content

API sunucusu `/api` önekiyle hizmet verir. Vitrin (public) uçları halka açıkken, yönetici uçları yetkilendirme katmanıyla korunur. Public vitrin uçları, herkese aynı veriyi döndürdüğü için Vercel CDN'inde paylaşımlı olarak cache'lenir (`Cache-Control: public, s-maxage=…`).

---

## 🌐 Vitrin Uç Noktaları (Public)

### 1. Aktif (Canlı) Kampanyaları Getir
Vitrinde gösterilen **canlı** kampanyaları döner: `is_active = true` **ve** `is_archived = false` **ve** (`starts_at` boş ya da geçmiş) **ve** (`valid_until` boş ya da bugünden büyük/eşit). `featured_order` azalan sırada. Stok tek RPC (`campaign_stock_counts()`) ile alınır.

* **URL:** `/api/campaigns` · **Metot:** `GET` · **Yetki:** Yok
* **Cache:** `public, s-maxage=60, stale-while-revalidate=300`
* **Başarılı Yanıt (200 OK):**
  ```json
  [
    {
      "id": "7fbe5012-…",
      "slug": "brooks-brothers-2026",
      "title": "Brooks Brothers Kampanyası",
      "description": "…",
      "partner_name": "Brooks Brothers",
      "partner_logo_url": "https://…/logo.png",
      "cover_image_url": "https://…/cover.jpg",
      "discount_label": "%10 İndirim",
      "is_featured": true,
      "featured_order": 5,
      "valid_until": "2026-12-31",
      "starts_at": null,
      "created_at": "2026-05-01T08:00:00Z",
      "max_codes_per_user": 1,
      "terms": "…",
      "type": { "id": "…", "name": "Giyim", "slug": "giyim" },
      "has_codes": true,
      "is_low_stock": false
    }
  ]
  ```
  > **`type`:** Kampanyanın türü (gömülü; vitrin sekmelerinde/filtrede kullanılır). **`has_codes` / `is_low_stock`:** Stok sunucuda türetilir; ham kod sayıları **istemciye sızdırılmaz**. `has_codes = false` → "Tükendi". `is_low_stock = true` → "Son fırsat". Eşik admin sağlık ekranıyla aynı: `max(ceil(total * 0.15), 25)`.

---

### 2. Arşiv Kampanyaları
Biten veya arşivlenen kampanyalar (salt-okunur): `is_archived = true` **veya** `valid_until < bugün`. `valid_until` azalan sırada.

* **URL:** `/api/campaigns/archive` · **Metot:** `GET` · **Yetki:** Yok
* **Cache:** `public, s-maxage=300, stale-while-revalidate=600`
* Yanıt biçimi `/api/campaigns` ile aynıdır.

---

### 3. Kampanya Türleri
Vitrin sekmeleri ve admin formları için tür listesi (`sort_order` artan).

* **URL:** `/api/campaign-types` · **Metot:** `GET` · **Yetki:** Yok
* **Yanıt:** `[{ "id": "…", "name": "Giyim", "slug": "giyim", "sort_order": 0 }]`

---

### 4. Aktif Duyurular
Anasayfa duyuru şeridini besler (`is_active = true`, `sort_order` artan). Bir duyuru kampanyaya bağlıysa o kampanyanın `slug`'ı `link_slug` olarak döner.

* **URL:** `/api/announcements` · **Metot:** `GET` · **Yetki:** Yok
* **Yanıt:** `[{ "id": "…", "message": "…", "link_url": null, "link_slug": "brooks-brothers-2026", "sort_order": 0 }]`

---

### 5. Tekil Kampanya (Detay)
Detay ekranı için tek kampanya + **türetilmiş durum**. `/campaigns/archive`'dan sonra tanımlıdır (rota eşleşmesi).

* **URL:** `/api/campaigns/:slug` · **Metot:** `GET` · **Yetki:** Yok
* **Cache:** `public, s-maxage=30, stale-while-revalidate=120`
* **Ek alan `status`:** `archived` · `inactive` · `scheduled` (başlangıç gelecekte) · `expired` (bitiş geçti) · `sold_out` (kod kalmadı) · `live`. Ayrıca `has_codes` / `is_low_stock` döner.
* **404:** Kampanya bulunamazsa `{ "error": "Kampanya bulunamadı." }`.

---

## 👥 Üye Kod Uç Noktaları (Public)

> [!NOTE]
> `/api/claim-code` ve `/api/my-codes` **IP başına dakikada 10 istekle** sınırlıdır; aşıldığında **429** döner. `tc_no` sunucuda algoritmik doğrulanır; geçersizse **400 "Geçersiz T.C. Kimlik Numarası."**.

> [!IMPORTANT]
> **503 — Doğrulama servisi geçici hata:** Üye doğrulama servisine ulaşılamazsa (`verifyMember → hata`) hem `/api/claim-code` hem `/api/my-codes` **503** döner: `{ "error": "Üyelik doğrulama servisine şu an ulaşılamıyor. Lütfen birkaç dakika sonra tekrar deneyin." }`. Gerçek üye `degil` ile reddedilmez; olay `system_verify_failures`'a kaydedilir. Bkz. [member-verification.md](member-verification.md).

### 6. İndirim Kodu Talep Et (Claim)
* **URL:** `/api/claim-code` · **Metot:** `POST` · **Yetki:** Yok
* **İstek Gövdesi:** `{ "tc_no": "12345678901", "campaign_slug": "brooks-brothers-2026" }`
* **Başarılı Yanıtlar (200 OK):**
  * **A — Yeni kod (limit dolmadı):** `{ "alreadyClaimed": false, "limitReached": false, "code": "BB-10-XYZ123", "message": "Kampanya kodunuz başarıyla teslim edildi." }`
  * **B — Yeni kod + limit doldu:** `{ "alreadyClaimed": false, "limitReached": true, "codes": ["BB-10-XYZ123"], "message": "Kampanya kodunuz teslim edildi." }`
  * **C — Daha önce almış:** `{ "alreadyClaimed": true, "codes": ["BB-10-XYZ123"], "message": "Bu kampanyadan daha önce kod aldınız." }`
* **Hata Yanıtları:** `400` (eksik parametre / pasif / süresi geçmiş kampanya / geçersiz TC) · `403` (`borclu` / `degil`) · `404` (kod kalmadı veya kampanya yok) · `503` (doğrulama servisine ulaşılamadı) · `500` (sistem hatası).

---

### 7. Üyenin Tüm Kodları (My Codes)
Üyenin tüm kampanyalarda aldığı kodları kampanya bilgisiyle döner.

* **URL:** `/api/my-codes` · **Metot:** `POST` · **Yetki:** Yok (`verifyMember` ile doğrulanır)
* **İstek Gövdesi:** `{ "tc_no": "12345678901" }`
* **Başarılı Yanıt (200 OK):**
  ```json
  [
    {
      "code": "BB-10-XYZ123",
      "claimed_at": "2026-05-26T10:00:00Z",
      "campaign": {
        "id": "7fbe5012-…", "slug": "brooks-brothers-2026",
        "title": "Brooks Brothers Kampanyası", "discount_label": "%10 İndirim",
        "partner_name": "Brooks Brothers", "partner_logo_url": "https://…/logo.png"
      }
    }
  ]
  ```
* **Hata Yanıtları:** `400` · `403` · `503` · `500`.

---

## 🛠️ Yönetici Uç Noktaları (Admin API)

Tüm admin uçları `Authorization: Bearer <supabase_access_token>` bekler; token sahibinin e-postası `admins` allowlist tablosunda olmalıdır (bkz. [admin.md](admin.md)). Doğrulama önce **yerel HS256** (`SUPABASE_JWT_SECRET`), olmazsa `auth.getUser()` ile yapılır.

* **401:** Token yok/geçersiz. · **403:** Geçerli kullanıcı ama admin değil (`{ "error": "Bu hesabın yönetici yetkisi bulunmuyor." }`).

### Kampanyalar
| # | Metot & URL | Açıklama |
| :- | :--- | :--- |
| 1 | `GET /api/admin/campaigns` | Tüm kampanyalar (tür gömülü) + `totalCodes`/`usedCodes`/`remainingCodes`. `created_at` azalan. |
| 2 | `GET /api/admin/campaigns/:id` | Tekil kampanya + kod istatistikleri (detay ekranı). |
| 3 | `POST /api/admin/campaigns` | Yeni kampanya (`slug`, `title`, `discount_label` zorunlu). `type_id` verilmezse varsayılan türe (en düşük `sort_order`) düşer. **201**. |
| 4 | `PUT /api/admin/campaigns/:id` | Kampanya güncelle (gövdedeki alanlar). |
| 5 | `POST /api/admin/campaigns/:id/clone` | Kampanyayı **kodlar/talepler hariç** kopyalar (`-kopya-…` slug, pasif/arşivsiz). **201**. |
| 6 | `DELETE /api/admin/campaigns/:id` | Kampanyayı **kalıcı** siler (kodlar/talepler cascade). |

### Kod Yönetimi
| # | Metot & URL | Açıklama |
| :- | :--- | :--- |
| 7 | `POST /api/admin/campaigns/:id/codes` | **Toplu** kod yükle. `{ "codes": [...] }`. Kodlar **TÜM kampanyalarda benzersiz** olduğundan `ON CONFLICT (code) DO NOTHING` ile çakışanlar atlanır. Yanıt: `{ "success": true, "inserted": 2, "duplicates": ["CODE1"] }`. |
| 8 | `GET /api/admin/campaigns/:id/codes?search=&page=&pageSize=` | Kod havuzu (arama + sayfalama; `pageSize` ≤ 100). Yanıt: `{ "codes": [...], "total": N, "page", "pageSize" }`. |
| 9 | `POST /api/admin/campaigns/:id/codes/one` | Tek kod ekle. **201** / **409** (kod zaten var). |
| 10 | `PUT /api/admin/codes/:codeId` | Kod değerini düzelt — **yalnız dağıtılmamış**. **409** dağıtılmışsa/çakışmada. |
| 11 | `DELETE /api/admin/codes/:codeId` | Tek kod sil — **yalnız dağıtılmamış**. **409** dağıtılmış/bulunamadı. |
| 12 | `POST /api/admin/codes/bulk-delete` | `{ "ids": [...] }` — dağıtılmamış olanları siler (kullanılmışlar atlanır). Yanıt: `{ "success": true, "deleted": N }`. |
| 13 | `GET /api/admin/campaigns/:id/lookup?tc_no=…` | Üyenin bu kampanyadan aldığı kodlar. `{ "found": false }` veya `{ "found": true, "tc_no", "codes": [{ "code", "claimed_at" }] }`. |
| 14 | `GET /api/admin/campaigns/:id/preview` | Son 20 kod + son 20 claim (canlı önizleme). |
| 15 | `GET /api/admin/campaigns/:id/export` | Tüm kodları **CSV** indirir (UTF-8 BOM, Excel uyumlu, formül-enjeksiyonu korumalı). `Content-Disposition: attachment; filename="<slug>-kod-raporu.csv"`. Sütunlar: `İndirim Kodu, Kullanım Durumu, Kullanan T.C. No, Kullanım Tarihi`. |

### Türler (Campaign Types)
| # | Metot & URL | Açıklama |
| :- | :--- | :--- |
| 16 | `GET /api/admin/campaign-types` | Tür listesi (`sort_order` artan). |
| 17 | `POST /api/admin/campaign-types` | Tür oluştur (`name` zorunlu; `slug` verilmezse Türkçe-uyumlu slugify; `sort_order` verilmezse sona eklenir). **201** / **409** (slug çakışması). |
| 18 | `PUT /api/admin/campaign-types/:id` | Tür güncelle (`name`/`slug`/`sort_order`). **409** slug çakışması. |
| 19 | `DELETE /api/admin/campaign-types/:id` | Tür sil. **409** ("kullanımda" — FK ihlali; önce kampanyaları taşıyın). |

### Duyurular (Announcements)
| # | Metot & URL | Açıklama |
| :- | :--- | :--- |
| 20 | `GET /api/admin/announcements` | Tüm duyurular (aktif + pasif), `sort_order` artan. |
| 21 | `POST /api/admin/announcements` | Duyuru oluştur (`message` zorunlu; `link_url` / `link_campaign_id` / `is_active` / `sort_order` opsiyonel). **201**. |
| 22 | `PUT /api/admin/announcements/:id` | Duyuru güncelle (yalnız gönderilen alanlar). |
| 23 | `DELETE /api/admin/announcements/:id` | Duyuru sil. |

### Genel / Sistem
| # | Metot & URL | Açıklama |
| :- | :--- | :--- |
| 24 | `GET /api/admin/stats` | `totalCampaigns`, `totalCodes`, `usedCodes`, `remainingCodes`. |
| 25 | `POST /api/admin/upload` | Görsel için **signed upload URL** döner (`{ filename }` → `{ path, token, publicUrl }`). Dosya sunucudan geçmez; istemci doğrudan Storage'a yükler. |
| 26 | `DELETE /api/admin/reset` | Tüm `campaign_codes` + `campaign_claims` siler; kampanya/tür şablonları korunur. |
| 27 | `GET /api/admin/health` | Sağlık anlık durumu (aşağıda). |
| 28 | `GET /api/admin/health/probe` | Dış servisi aktif yokla (aşağıda). |

---

### Sistem Sağlık Durumu (`GET /api/admin/health`)
Dış servis hataları + sistem nabzı + kampanya bazında stok. Stok tek RPC (`campaign_stock_counts()`).

```json
{
  "now": "2026-06-08T09:00:00.000Z",
  "verifyFailures": { "last30m": 0, "lastAt": null },
  "pulse": { "lastClaimAt": "2026-06-08T08:58:12.000Z", "todayCount": 142 },
  "campaigns": [
    { "id": "7fbe5012-…", "slug": "brooks-brothers-2026", "title": "…",
      "is_active": true, "total": 500, "used": 142, "remaining": 358, "status": "ok" }
  ]
}
```
* `verifyFailures.last30m`: son 30 dk'daki `system_verify_failures` sayısı.
* `pulse.todayCount`: **İstanbul (UTC+3)** gününde dağıtılan kod adedi.
* `campaigns[].status`: `ok` · `low` (kalan ≤ eşik) · `out` (bitti) · `no_codes`. Eşik: `max(ceil(total*0.15), 25)`.

### Dış Servisi Aktif Yokla (`GET /api/admin/health/probe`)
Dış servisin `/health` ucunu yoklar (iş mantığına dokunmaz, 6 sn timeout).
```json
{ "ok": true, "status": 200, "ms": 187, "detail": "ok" }
```
* `ok=false, status=null` → ağ hatası/timeout (`detail`: `network` | `timeout`).
* `status=404` → `/health` henüz yayında değil; panel **gri** ("yayında değil") gösterir.

## Related Notes

- [[README]]
- [[admin]]
- [[architecture]]
- [[database]]

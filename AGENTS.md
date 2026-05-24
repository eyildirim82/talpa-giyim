# TALPA Kampanyalar — AGENTS.md

## Proje Amacı

TALPA üyelerine özel indirim kodu kampanyalarını yöneten full-stack web uygulaması.
Üyeler TC kimlik numarasıyla doğrulanır, aktif kampanyaları görür ve indirim kodu alır.

---

## Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Express 5 (Vercel Serverless Functions)
- **Veritabanı:** Supabase (PostgreSQL)
- **Deployment:** Vercel
- **Üye Doğrulama:** TALPA Member API (harici)

---

## Klasör Yapısı

```
src/                          # React frontend
  pages/
    HomePage.tsx              # Featured kampanya grid (anasayfa)
    CampaignPage.tsx          # Tekil kampanya + kod alma (/kampanya/:slug)
    AdminDashboard.tsx        # Yönetim paneli (/admin)
  components/
    CampaignCard.tsx          # Kampanya grid kartı
    FeaturedHero.tsx          # Anasayfa büyük featured kart
    CodeDisplay.tsx           # Kod gösterimi + kopyala butonu
  lib/
    supabase.ts               # Supabase anon key client (sadece okuma)

server/
  routes/
    campaigns.ts              # GET /api/campaigns
    claim.ts                  # POST /api/claim-code
    admin.ts                  # /api/admin/* route'ları
  lib/
    supabaseAdmin.ts          # Supabase service_role client (yazma)
    memberVerify.ts           # TALPA Member API entegrasyonu

api/
  index.ts                    # Vercel serverless entry point
```

---

## Ortam Değişkenleri

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...         # service_role key, anon değil
TALPA_MEMBER_API_URL=https://talpa.org/api/members/verify
TALPA_API_KEY=xxxx
ADMIN_PASSWORD=xxxx
```

---

## Veritabanı Şeması

### campaigns
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | uuid PK | gen_random_uuid() |
| slug | text UNIQUE | URL tanımlayıcı (brooks-brothers-2026) |
| title | text | Kampanya başlığı |
| description | text | Kısa açıklama |
| partner_name | text | Partner firma adı |
| partner_logo_url | text | Partner logo URL |
| cover_image_url | text | Kapak görseli URL |
| discount_label | text | "%10 İndirim" gibi kısa etiket |
| is_active | boolean | Kampanya yayında mı |
| is_featured | boolean | Anasayfada öne çıkacak mı |
| featured_order | int | Öne çıkma sırası (yüksek = önce) |
| max_codes_per_user | int | Üye başına maksimum kod (default: 1) |
| valid_until | date | Kampanya bitiş tarihi |
| terms | text | Kampanya koşulları (uzun metin) |
| created_at | timestamptz | Oluşturulma zamanı |

### campaign_codes
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | uuid PK | gen_random_uuid() |
| campaign_id | uuid FK | campaigns(id) on delete cascade |
| code | text UNIQUE | İndirim kodu |
| is_used | boolean | Kullanıldı mı |
| claimed_by_tc | text | Kullanan üyenin TC'si |
| claimed_at | timestamptz | Alınma zamanı |

### campaign_claims
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | uuid PK | gen_random_uuid() |
| campaign_id | uuid FK | campaigns(id) on delete cascade |
| tc_no | text | Üyenin TC kimlik numarası |
| claimed_at | timestamptz | Talep zamanı |
| UNIQUE | — | (campaign_id, tc_no) çifti tekil |

---

## TALPA Member API

### Endpoint
```
POST https://talpa.org/api/members/verify
```

### Headers
```
Content-Type: application/json
X-API-Key: process.env.TALPA_API_KEY
```

### Request Body
```json
{
  "tcNo": "12345678901",
  "campaignSlug": "brooks-brothers-2026"
}
```

### Response
```json
{ "status": "uye" }    // Aktif üye, borcu yok → devam
{ "status": "borclu" } // Aktif üye, borcu var → engelle
{ "status": "degil" }  // Üye değil / pasif / kampanya erişimi yok → engelle
```

### Hata Durumları
- `campaignSlug` gönderilirse whitelist kontrolü de yapılır
- `status: "degil"` her türlü erişim engeli için döner
- 400 → geçersiz TC formatı, 401 → hatalı API key, 429 → rate limit, 500 → sunucu hatası

---

## server/lib/memberVerify.ts — Implementasyon Kuralları

```typescript
// Dönüş tipi
type MemberStatus = "uye" | "borclu" | "degil";

async function verifyMember(tcNo: string, campaignSlug?: string): Promise<MemberStatus>
```

- Fetch başarısız olursa (network, 5xx) → `"degil"` döndür, hata logla
- Rate limit (429) gelirse → `"degil"` döndür
- Her durumda `status` alanını döndür

---

## server/routes/claim.ts — Kod Dağıtım Akışı

```
POST /api/claim-code
Body: { tc_no: string, campaign_slug: string }
```

1. `campaigns` tablosundan `slug` ile kampanyayı bul
   → Bulunamazsa **404**: "Kampanya bulunamadı."
   → `is_active=false` ise **400**: "Bu kampanya şu an aktif değildir."

2. `verifyMember(tc_no, campaign_slug)` çağır
   → `"borclu"` → **403**: "Dernek aidat borçlarınız sebebiyle kampanya katılımınız sınırlandırılmıştır. Lütfen muhasebe birimi ile iletişime geçiniz."
   → `"degil"` → **403**: "TALPA üyelik kaydınıza ulaşılamamıştır."

3. `campaign_claims` tablosunda `(campaign_id, tc_no)` var mı kontrol et
   → **Varsa:** `campaign_codes`'dan `claimed_by_tc = tc_no` olan kodu bul
   → `{ alreadyClaimed: true, code, message: "Bu kampanyadan daha önce kod aldınız." }` dön

4. `campaign_codes`'dan `is_used = false` bir kod al
   ```sql
   SELECT * FROM campaign_codes
   WHERE campaign_id = $1 AND is_used = false
   LIMIT 1
   FOR UPDATE SKIP LOCKED
   ```
   → Yoksa **404**: "Bu kampanyada dağıtılacak kod kalmamıştır."

5. Transaction içinde:
   - `campaign_codes`: `is_used = true`, `claimed_by_tc = tc_no`, `claimed_at = now()`
   - `campaign_claims`: yeni satır ekle `(campaign_id, tc_no)`

6. `{ alreadyClaimed: false, code, message: "Kampanya kodunuz başarıyla teslim edildi." }` dön

---

## server/routes/admin.ts — Kurallar

Tüm route'lar şu middleware'den geçer:
```
Authorization: Bearer <ADMIN_PASSWORD>
```

### Route Listesi
| Method | Path | Açıklama |
|--------|------|----------|
| GET | /api/admin/campaigns | Tüm kampanyalar + kod istatistikleri |
| POST | /api/admin/campaigns | Yeni kampanya oluştur |
| PUT | /api/admin/campaigns/:id | Kampanya güncelle |
| POST | /api/admin/campaigns/:id/codes | Bulk kod yükle `{ codes: string[] }` |
| GET | /api/admin/stats | Genel istatistikler |

Kod istatistikleri her kampanya için:
```json
{
  "totalCodes": 100,
  "usedCodes": 45,
  "remainingCodes": 55
}
```

---

## src/pages/HomePage.tsx — Kurallar

- `GET /api/campaigns` fetch et (is_active=true, featured_order sıralı)
- `is_featured=true` olanlar arasında en yüksek `featured_order` → `<FeaturedHero />`
- Geri kalan kampanyalar → `<CampaignCard />` 2 kolonlu grid
- Loading state: skeleton kartlar
- Hata state: "Kampanyalar yüklenemedi" mesajı
- Kampanya yoksa: "Şu an aktif kampanya bulunmamaktadır"

---

## src/pages/CampaignPage.tsx — Kurallar

Route: `/kampanya/:slug`

- Campaigns listesini fetch et, slug'a göre filtrele
- Kampanya bulunamazsa → anasayfaya yönlendir
- TC girişi formu → `POST /api/claim-code` çağır
- `alreadyClaimed: true` → "Bu kampanyadan daha önce kod aldınız" uyarısıyla kodu göster
- `alreadyClaimed: false` → başarı animasyonu + kod göster
- Kopyala butonu: clipboard API
- Sayfanın altında kampanya `terms` metni

---

## Admin Dashboard — Kurallar

### Auth
Mevcut şifre sistemi korunur. `localStorage`'da tutulur.

### Ana Görünüm
- Üstte genel istatistikler: toplam kampanya, toplam kod, dağıtılan kod
- Kampanya kartları: title, slug, aktif/featured toggle'lar, kod istatistikleri
- "Yeni Kampanya Oluştur" butonu → modal form

### Yeni Kampanya Formu (Modal)
Zorunlu alanlar: `slug`, `title`, `discount_label`
Opsiyonel: `description`, `partner_name`, `partner_logo_url`,
`cover_image_url`, `valid_until`, `max_codes_per_user`, `terms`

### Kod Yükleme
Excel okuma için mevcut `readFirstColumn` mantığı korunur.
`POST /api/admin/campaigns/:id/codes` ile yüklenir.

---

## Stil Kuralları

`src/index.css` üzerindeki dark navy teması korunur.

```css
--bg-dark: #0f172a
--bg-card: #1e293b
--text-main: #f8fafc
--text-muted: #94a3b8
--primary: #1a2f5c
--accent: #10b981
--danger: #ef4444
--border-color: #334155
```

Yeni component yazarken bu değişkenleri kullan, inline renk kullanma.

---

## Vercel Deployment

`vercel.json`:
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.ts" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

`api/index.ts` → `server.ts`'deki Express app'i export eder.

---

## Genel Kurallar

- TypeScript strict mode — `any` kullanma
- Tüm Supabase yazma işlemleri `server/lib/supabaseAdmin.ts` üzerinden
- Frontend'de asla `SUPABASE_SERVICE_KEY` kullanılmaz
- Hata mesajları her zaman Türkçe
- `console.error` sadece sunucu tarafında, frontend'de kullanma
- Her route'da try/catch, unhandled rejection bırakma

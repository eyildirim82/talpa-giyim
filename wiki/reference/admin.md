# Yönetici (Admin) Paneli Kullanım Kılavuzu

**Summary**: Yönetici Paneli (/admin) kılavuzu — sol-menü kabuk, kimlik doğrulama (yerel JWT + allowlist), sistem sağlık ekranı, kampanya yönetimi (klon/arşiv/sil), kod havuzu, türler, duyurular, ayarlar.
**Tags**: #admin #dashboard #manual #system-health #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-06-08T16:00:00+03:00

---

## Content

Yönetici paneli (`/admin`), yeniden tasarlanan arayüzle birlikte artık **sol kenar çubuklu, nested-rotalı bir kabuk** ([AdminApp.tsx](../../src/admin/AdminApp.tsx)) üzerinden çalışır. Kenar çubuğundaki bölümler:

| Bölüm | Yol | İçerik |
| :-- | :-- | :-- |
| **Genel Bakış** | `/admin` | Sistem sağlığı kartı + 4 temel sayaç |
| **Kampanyalar** | `/admin/kampanyalar` | Kampanya listesi (filtre/toggle/klon/arşiv/sil/yeni) |
| ↳ Kampanya Detayı | `/admin/kampanyalar/:id` | Düzenle + görsel/kod yükleme + kod havuzu + TC sorgu + CSV |
| **Türler** | `/admin/turler` | Kampanya türleri CRUD + sıralama |
| **Duyurular** | `/admin/duyurular` | Duyuru CRUD + sıralama + aktif/pasif |
| **Ayarlar** | `/admin/ayarlar` | Tehlikeli bölge: sistemi sıfırla |

İşlem sonuçları, panelin üstünde 4 sn görünen global bildirim şeridiyle (`notify`) gösterilir.

---

## 🔐 Kimlik Doğrulama ve Yetkilendirme

Giriş **iki aşamalıdır**: önce geçerli Supabase oturumu (authentication), ardından `admins` allowlist'te yer alma (authorization).

* **Giriş:** [Login.tsx](../../src/admin/Login.tsx) split-screen e-posta/şifre ekranı (`signInWithPassword`; şifre göster/gizle). Oturum yoksa AdminApp doğrudan bu ekranı render eder.
* **Oturum & token:** Supabase JWT'yi `localStorage`'da tutar; [useAuth.ts](../../src/admin/useAuth.ts) her API isteğinde **canlı** access token taşıyan `getAuthHeaders` üretir.
* **Sunucu doğrulaması:** `/api/admin/*` istekleri `Authorization: Bearer <token>` taşır. Paylaşılan middleware [server/lib/requireAdmin.ts](../../server/lib/requireAdmin.ts):
  1. Token'ı önce **yerel HS256** doğrular (`SUPABASE_JWT_SECRET` tanımlıysa) — her istekte Supabase Auth'a ağ turu atmadan. Yapamazsa güvenli şekilde `auth.getUser()` ağ doğrulamasına döner. Çözülemezse **401**.
  2. E-postayı **bellekte 5 dk cache'lenen** `public.admins` allowlist'inde arar. Yoksa **403 "Bu hesabın yönetici yetkisi bulunmuyor."**.
* **Admin eklemek:** Kişinin Supabase Auth kullanıcısı olması + e-postasının eklenmesi gerekir:
  ```sql
  insert into public.admins (email) values ('yeni-admin@ornek.com');
  ```
  > Cache nedeniyle yeni admin en geç ~5 dk içinde (veya instance yenilenince) etkilidir.

> [!IMPORTANT]
> `admin.ts` ve `upload.ts` aynı `requireAdmin`'i kullanır. Eski `ADMIN_PASSWORD` env tabanlı doğrulama **kaldırılmıştır**.

---

## 🩺 Sistem Sağlığı Paneli (Genel Bakış)

Genel Bakış'ın üstünde canlı **Sistem Sağlığı** kartı yer alır ([SystemHealthDS.tsx](../../src/admin/SystemHealthDS.tsx)). Amaç **sessiz arızayı** önlemektir.

**Ana ışık (özet):** 🟢 "Her şey yolunda" · 🟡 "Dikkat gerekiyor" (servis aralıklı hata **veya** stok azaldı/bitti — stok kasıtlı olarak sarıdır) · 🔴 "Servis sorunu" (**yalnızca** dış servis yanıt vermiyorsa).

**Üç alt panel:**
1. **Üye Doğrulama Servisi** — durum + **"Şimdi test et"** (`/api/admin/health/probe`, ms gösterir) + son 30 dk servis hatası sayısı. `/health` yayında değilse **gri** ("yayında değil").
2. **Sistem Nabzı** — son kodun dağıtım zamanı + **bugün** (İstanbul saatiyle) dağıtılan adet. Bilinçli renksiz.
3. **Stok Durumu** — aktif kampanyaları kalan koda göre sıralar; ilerleme çubuğu + `TÜKENDİ`/`KOD YOK`/`N kaldı`. İlk 8 gösterilir.

> [!NOTE]
> Sağlık verisi 25 sn'de, dış servis yoklaması 60 sn'de bir yenilenir; **sekme arka plandayken durur**. Sağ üstteki 🔄 anlık yeniler.

### 4 Temel Sayaç
Sağlık altında `/api/admin/stats`'tan: **Toplam Kampanya · Toplam Kod · Dağıtılan · Kalan**.

---

## ⚙️ Kampanya Yönetimi (Kampanyalar)

[Campaigns.tsx](../../src/admin/sections/Campaigns.tsx) — tüm kampanyaları satır kartları olarak listeler. Üstte **arama** (başlık/slug), **tür filtresi** ve **durum filtresi** (Canlı/Zamanlanmış/Süresi geçti/Arşiv/Pasif) bulunur.

Her satırda hızlı işlemler:
* **Aktif / Öne çıkan** toggle'ları (`PUT` ile anında).
* **Düzenle** (✎) → kampanya detayı.
* **Klonla** (⧉) → `POST …/clone`; kodlar/talepler **hariç** pasif kopya.
* **Arşivle / Arşivden çıkar** (`is_archived` toggle).
* **Sil** (🗑) → `DELETE …/:id`; kampanya + kodları + talepleri **kalıcı** (tarayıcı onayı ile).

### Yeni Kampanya
"Yeni Kampanya" modal formu: **Başlık\*** (slug otomatik türetilir), **Slug\***, **Tür**, **İndirim Etiketi\***, Partner Adı, Açıklama, Partner Logo/Kapak URL, **Başlangıç** ve **Bitiş** tarihleri, **Üye Başına Maks. Kod**, Koşullar.

> [!NOTE]
> Yeni kampanya **Pasif** ve **Öne çıkarılmamış** oluşturulur (`is_active=false`, `is_featured=false`). Tür seçilmezse sunucu varsayılan türe (en düşük `sort_order`) düşürür. Vitrine çıkmak için **canlı** koşulları sağlamalıdır (aktif + arşivsiz + başlamış + süresi geçmemiş).

---

## 📄 Kampanya Detayı

[CampaignDetail.tsx (admin)](../../src/admin/sections/CampaignDetail.tsx) üç bölümlüdür:

### 1. Düzenle
Tüm alanlar + **Aktif / Öne çıkan / Arşiv** toggle'ları + Öne Çıkma Sırası. "Kaydet" → `PUT /api/admin/campaigns/:id`.

### Görsel Yükleme (Logo & Kapak)
URL elle girilebilir **veya** dosya seçilerek yüklenir:
1. Görsel **tarayıcıda sıkıştırılır** ([imageCompress.ts](../../src/lib/imageCompress.ts)).
2. `POST /api/admin/upload` ile **signed upload URL** alınır.
3. İstemci dosyayı bu token'la **doğrudan Supabase Storage**'a yükler (`uploadToSignedUrl`) — Vercel ~4.5 MB body limitini ve base64 şişmesini aşmaz. Dönen `publicUrl` forma yazılır ve küçük önizleme gösterilir.

### 2. Kod Yükleme + Kullanım
* **Excel/CSV yükleme:** `.xlsx/.xls/.csv` dosyasının **yalnız ilk sütunu** (`xlsx` ile) okunur; tespit edilen kod adedi gösterilir; "Kodları Yükle" → `POST …/:id/codes`. Kodlar **tüm kampanyalarda benzersiz** olduğundan zaten kayıtlı olanlar atlanır ve bildirimde belirtilir.
* **CSV İndir:** `GET …/:id/export` — tüm kodlar UTF-8 BOM'lu CSV (formül enjeksiyonu korumalı).
* **Kullanım özeti:** Toplam / Dağıtılan / Kalan + ilerleme çubuğu.

### 3. Kod Havuzu (`CodePool`)
Kampanyanın kodlarını **aranabilir, sayfalanabilir** tablo olarak yönetir (`GET …/:id/codes?search=&page=&pageSize=50`):
* **Tek kod ekle** (`POST …/codes/one`).
* **Düzenle / Sil** — **yalnız dağıtılmamış** kodlarda (`PUT|DELETE /api/admin/codes/:codeId`).
* **Toplu seç + sil** — dağıtılmamışları seçip `POST /api/admin/codes/bulk-delete` (kullanılmışlar atlanır).
* Her satır: kod, durum (Dağıtıldı/Kalan), kullanan TC, tarih.

### TC Sorgu
Bir üyenin bu kampanyadan aldığı kod(lar)ı ve tarihleri gösterir (`GET …/:id/lookup?tc_no=…`).

---

## 🏷️ Türler

[Types.tsx](../../src/admin/sections/Types.tsx) — kampanya türlerini yönetir (vitrin sekmeleri + filtre): **ekle**, **adını düzenle**, **sırala** (↑/↓; iki kaydın `sort_order`'ı takas edilir), **sil**. Bir tür **kullanımdaysa** silinemez (**409**; önce o kampanyaları başka türe taşıyın). Slug, ad girilince Türkçe-uyumlu otomatik üretilir.

---

## 📣 Duyurular

[Announcements.tsx](../../src/admin/sections/Announcements.tsx) — anasayfa duyuru şeridini yönetir: **ekle/düzenle** (mesaj zorunlu), **aktif/pasif** toggle, **sırala** (↑/↓), **sil**. Bir duyuru opsiyonel olarak bir **kampanyaya** (iç link) **veya** bir **dış URL**'ye bağlanabilir (kampanya seçiliyse URL yok sayılır). Yalnız **aktif** duyurular `/api/announcements` ile vitrine çıkar.

---

## 🚨 Ayarlar — Sistemi Sıfırla

[Settings.tsx](../../src/admin/sections/Settings.tsx) — **tehlikeli bölge**. `DELETE /api/admin/reset` ile tüm `campaign_codes` ve `campaign_claims` **kalıcı** silinir; **kampanya ve tür şablonları korunur**. Geri alınamaz; çalıştırmak için onay kutusuna **`SIFIRLA`** yazılması gerekir.

## Related Notes

- [[README]]
- [[api]]
- [[frontend]]
- [[architecture]]

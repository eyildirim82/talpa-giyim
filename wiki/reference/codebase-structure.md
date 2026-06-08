# Proje Klasör Yapısı ve Dosya Haritası

**Summary**: Projenin dizin yapısı ve her bir dosyanın üstlendiği görevlerin detaylı açıklamaları. Frontend "Modern Minimal" yeniden tasarımı ve genişleyen admin paneliyle güncel.
**Tags**: #codebase #structure #directories #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-06-08T16:00:00+03:00

---

## Content

Bu belgede, projenin dizin yapısı ve her bir dosyanın üstlendiği görevler detaylandırılmıştır. Kod tabanında değişiklik yapmadan önce dosyaların rollerini anlamak için bu haritayı referans alabilirsiniz.

> [!NOTE]
> **Frontend yeniden tasarlandı (2026-06).** Eski koyu (dark navy) arayüz, **Modern Minimal** (açık tema, mobil-öncelikli) bir tasarım sistemiyle değiştirildi. Tüm yeni stiller `src/styles/design-system.css` içinde `.ds` / `ds-` ön ekiyle kapsanır. Eski `src/pages/HomePage.tsx`, `CampaignPage.tsx`, `AdminDashboard.tsx`, `src/components/CampaignCard.tsx`, `FeaturedHero.tsx`, `SystemHealth.tsx` ve `src/App.css` **kaldırılmıştır**.

---

## 📂 Genel Dizin Ağacı

```text
talpa-giyim/
├── api/                        # Vercel Serverless Uç Noktaları
│   └── index.ts                # Sunucusuz Express entry point (server.ts'i export eder)
├── server/                     # Backend API Kaynak Kodları
│   ├── lib/                    # Ortak Kütüphaneler ve Servisler
│   │   ├── memberVerify.ts     # TALPA API doğrulama, Retry + 'hata' durumu
│   │   ├── memberHealth.ts     # Dış servisi aktif yoklama (pingMemberService)
│   │   ├── systemEvents.ts     # Doğrulama hatalarını system_verify_failures'a yazar
│   │   ├── supabaseAdmin.ts    # Supabase service_role (Admin) istemcisi
│   │   ├── requireAdmin.ts     # Admin yetki middleware'i (yerel JWT + admins allowlist cache)
│   │   ├── validateTc.ts       # Sunucu tarafı T.C. Kimlik No doğrulaması
│   │   └── rateLimit.ts        # Public uç noktalar için IP bazlı hız sınırı
│   └── routes/                 # API Yönlendirme Katmanları (Controller)
│       ├── admin.ts            # /api/admin/* (kampanya/kod/tür/duyuru CRUD, sağlık, export)
│       ├── campaigns.ts        # GET /api/campaigns, /campaigns/archive, /campaigns/:slug,
│       │                       #   /campaign-types, /announcements (public vitrin)
│       ├── claim.ts            # POST /api/claim-code, /api/my-codes (kod alma iş akışı)
│       └── upload.ts           # POST /api/admin/upload (signed upload URL)
├── src/                        # Frontend (React) Kaynak Kodları
│   ├── assets/                 # Statik Varlıklar (hero.png, react/vite svg)
│   ├── components/
│   │   └── ds/                 # Tasarım sistemi (üye tarafı) bileşenleri
│   │       ├── DsNav.tsx          # Üye üst barı (Arşiv / Kodlarım)
│   │       ├── AnnouncementBar.tsx# Aktif duyuru şeridi (sırayla döner)
│   │       ├── CampaignCardDS.tsx # Kampanya kartı (+ stok/ended rozetleri)
│   │       ├── FeaturedHeroDS.tsx # Öne çıkan kampanya hero'su
│   │       ├── Badge.tsx          # Küçük durum rozeti (accent/danger/warning/neutral/info)
│   │       └── Button.tsx         # Tasarım sistemi butonu (primary/accent/ghost)
│   ├── admin/                  # Yönetici paneli (sol-menü kabuk, nested rotalar)
│   │   ├── AdminApp.tsx           # Admin kabuğu: kenar çubuğu + <Routes>
│   │   ├── Login.tsx              # E-posta/şifre giriş ekranı (split-screen)
│   │   ├── useAuth.ts             # Supabase oturumu + canlı token başlığı üreticisi
│   │   ├── ctx.ts                 # AdminCtx (email, getAuthHeaders, signOut, notify)
│   │   ├── SystemHealthDS.tsx     # Sistem sağlığı kartı (canlı izleme)
│   │   └── sections/
│   │       ├── Overview.tsx       # Genel bakış: sağlık + 4 sayaç
│   │       ├── Campaigns.tsx      # Kampanya listesi (filtre, toggle, klon, arşiv, sil, yeni)
│   │       ├── CampaignDetail.tsx # Kampanya düzenle + kod havuzu + upload + TC sorgu + CSV
│   │       ├── Types.tsx          # Kampanya türleri CRUD (+ sıralama)
│   │       ├── Announcements.tsx  # Duyuru CRUD (+ sıralama, kampanya/URL bağlantısı)
│   │       └── Settings.tsx       # Sistemi sıfırla (tehlikeli bölge)
│   ├── lib/                    # Frontend Yardımcı Kodları
│   │   ├── supabase.ts            # Anonim Supabase istemcisi (yalnızca auth + signed upload)
│   │   ├── imageCompress.ts       # Yüklemeden önce tarayıcıda görsel sıkıştırma
│   │   ├── cover.ts               # Görselsiz kampanyalar için deterministik gradient tonu
│   │   ├── tc.ts                  # İstemci T.C. Kimlik No doğrulaması (isValidTC)
│   │   └── types.ts               # Paylaşılan tipler (Campaign, CampaignType, Announcement…)
│   ├── pages/                  # Üye (public) Sayfa Arayüzleri
│   │   ├── Home.tsx               # Anasayfa: hero + tür sekmeleri + arama/sıralama + grid
│   │   ├── CampaignDetail.tsx     # Kampanya detayı + kod talep formu
│   │   ├── MyCodes.tsx            # "Kodlarım": TCKN ile alınan tüm kodlar
│   │   └── Archive.tsx            # Arşiv: süresi geçmiş/arşivlenmiş kampanyalar
│   ├── styles/
│   │   └── design-system.css      # Tasarım sistemi (.ds / ds-*) — tek kaynak
│   ├── index.css               # Minimal global sıfırlama
│   ├── App.tsx                 # Router: /, /kodlarim, /arsiv, /kampanya/:slug, /admin/*
│   └── main.tsx                # React DOM render başlangıcı
├── public/                     # Statik dosyalar (talpa-logo.webp, favicon'lar, icons.svg…)
├── wiki/                       # Sistem Wiki ve Geliştirici Belgeleri
├── database.sqlite             # (Legacy) Eski veritabanı yedeği — artık kullanılmıyor
├── index.html                  # Vite istemci ana HTML şablonu
├── package.json                # Proje bağımlılıkları ve çalıştırma scriptleri
├── server.ts                   # Express sunucu başlatma ve yapılandırma dosyası
├── tsconfig.json               # TypeScript derleme ayarları
└── vercel.json                 # Vercel yönlendirme + regions ("sin1")
```

---

## 🎯 Dosyaların Detaylı Görevleri

### Sunucu ve Altyapı Dosyaları
* **[server.ts](../../server.ts):** Express uygulamasını ayağa kaldırır, `trust proxy` ayarlar, CORS (`CORS_ORIGINS`) ve JSON gövde limitlerini (`10mb`) tanımlar, dört alt router'ı (`campaigns`, `claim`, `admin`, `upload`) `/api` altına bağlar. Yalnızca yerel (`NODE_ENV !== 'production'`) ortamda `3001` portundan dinler.
* **[vercel.json](../../vercel.json):** Vercel için URL yönlendirme (rewrite) kuralları **ve** dağıtım bölgesi (`"regions": ["sin1"]` — Singapur). `/api/*` → `api/index.ts`, diğer her şey → `index.html`.
* **[api/index.ts](../../api/index.ts):** Express uygulamasını Vercel Serverless Function olarak dışa aktarır (`import app from '../server.js'; export default app;`).

---

### Backend (`server/`) Dosyaları
* **[server/lib/memberVerify.ts](../../server/lib/memberVerify.ts):** Dış TALPA Üye API'sine bağlanır. HTTP 429/5xx ve ağ hatalarında akıllıca yeniden denemeler yapar; her istekte 8 sn timeout uygular. Servise ulaşılamazsa `degil` yerine ayrı bir `'hata'` durumu döner (gerçek üye haksız reddedilmez).
* **[server/lib/memberHealth.ts](../../server/lib/memberHealth.ts):** `pingMemberService` — dış servisin `/health` ucunu 6 sn timeout'la aktif yoklar; sağlık ekranındaki "Şimdi test et" bunu kullanır.
* **[server/lib/systemEvents.ts](../../server/lib/systemEvents.ts):** `recordVerifyFailure` — doğrulama `'hata'` döndüğünde `system_verify_failures` tablosuna best-effort tek satır yazar.
* **[server/lib/supabaseAdmin.ts](../../server/lib/supabaseAdmin.ts):** `SUPABASE_SERVICE_KEY` ile tam yetkili veritabanı bağlantısı açar. İstemciye asla sızdırılmaz.
* **[server/lib/requireAdmin.ts](../../server/lib/requireAdmin.ts):** Admin yetki middleware'i. Önce `SUPABASE_JWT_SECRET` ile token'ı **yerel HS256** doğrular (her istekte ağ turunu önler); yapamazsa güvenli şekilde `auth.getUser()` ağ doğrulamasına döner. Çözülen e-postayı **bellekte 5 dk cache'lenen** `admins` allowlist'inde arar. 401 (token yok/geçersiz) · 403 (admin değil).
* **[server/routes/campaigns.ts](../../server/routes/campaigns.ts):** Public vitrin uçları: `GET /campaigns` (yalnız **canlı**: aktif + arşivsiz + başlamış + süresi geçmemiş), `GET /campaigns/archive` (biten/arşivlenen), `GET /campaign-types`, `GET /announcements` (aktif), `GET /campaigns/:slug` (tekil + türetilmiş `status`). Stok tek RPC (`campaign_stock_counts`) ile alınır (N+1 yok); ham sayılar sızmadan `has_codes`/`is_low_stock` türetilir. Yanıtlara `Cache-Control` (Vercel CDN) eklenir.
* **[server/routes/claim.ts](../../server/routes/claim.ts):** `/claim-code` ve `/my-codes`. T.C. doğrular, üyelik sorgular ve atomik RPC (`claim_campaign_code`) ile güvenli kod tahsisi yapar. Doğrulama `'hata'` dönerse 503 verir ve olayı kaydeder.
* **[server/routes/admin.ts](../../server/routes/admin.ts):** Korumalı admin API'leri (tek `requireAdmin` ile sarılı). Kampanya CRUD + klon + arşiv + sil, **tür** CRUD (`campaign_types`), **duyuru** CRUD (`announcements`), **kod havuzu** (arama/sayfalama, tek ekle/düzelt/sil, toplu sil), toplu kod yükleme, TCKN sorgu, önizleme, istatistik, CSV export (formül enjeksiyonu korumalı), ve **sağlık** uçları (`/admin/health`, `/admin/health/probe`).
* **[server/routes/upload.ts](../../server/routes/upload.ts):** `POST /api/admin/upload` — dosyayı sunucudan geçirmeden Supabase Storage için **signed upload URL** (`path` + `token` + `publicUrl`) döner.

---

### Frontend (`src/`) Dosyaları

**Çatı**
* **[src/App.tsx](../../src/App.tsx):** Rotalar — `/` (Home), `/kodlarim` (MyCodes), `/arsiv` (Archive), `/kampanya/:slug` (CampaignDetail), `/admin/*` (AdminApp, nested). `styles/design-system.css`'i bir kez import eder.

**Üye sayfaları (`pages/`)**
* **[Home.tsx](../../src/pages/Home.tsx):** `/api/campaigns`, `/api/campaign-types`, `/api/announcements`'ı paralel çeker. Öne çıkanları hero olarak, geri kalanı grid'de gösterir; tür sekmeleri, istemci-içi arama ve sıralama (varsayılan/yeni/bitişe yakın) sunar. Yüklenirken skeleton.
* **[CampaignDetail.tsx](../../src/pages/CampaignDetail.tsx):** `/api/campaigns/:slug`'tan kampanyayı çeker; `status`'a göre (live/scheduled/expired/sold_out…) formu açar/kapatır. TCKN ile `POST /claim-code`; 503'te "Tekrar Dene". Başarıda kod kutusu + panoya kopyalama + "Tüm kodlarım" linki.
* **[MyCodes.tsx](../../src/pages/MyCodes.tsx):** TCKN ile `POST /my-codes`. Detaydan `state.tc` ile gelince otomatik sorgular. 503 UX'i burada da var.
* **[Archive.tsx](../../src/pages/Archive.tsx):** `/api/campaigns/archive`'i listeler; kartlar `ended` (tıklanamaz, "Sona erdi").

**Üye bileşenleri (`components/ds/`)**
* **[DsNav.tsx](../../src/components/ds/DsNav.tsx):** Sticky üst bar; TALPA logosu + Arşiv / Kodlarım linkleri.
* **[AnnouncementBar.tsx](../../src/components/ds/AnnouncementBar.tsx):** Aktif duyuruları tek satır şeritte 6 sn'de bir döndürür (hover'da durur); iç kampanya linki `/kampanya/:slug`, dış link yeni sekme.
* **[CampaignCardDS.tsx](../../src/components/ds/CampaignCardDS.tsx):** Kampanya kartı; görsel yoksa `coverTone` ile deterministik gradient. `Tükendi`/`Son fırsat`/`Sona erdi` rozetleri.
* **[FeaturedHeroDS.tsx](../../src/components/ds/FeaturedHeroDS.tsx):** Öne çıkan kampanya hero'su (koyu kapak + scrim + emerald CTA).

**Yönetici paneli (`admin/`)**
* **[AdminApp.tsx](../../src/admin/AdminApp.tsx):** Oturum yoksa `Login`, varsa sol kenar çubuğu (Genel Bakış / Kampanyalar / Türler / Duyurular / Ayarlar) + nested `<Routes>`. Üst tarafta global bildirim (`notify`) şeridi. `AdminCtx` sağlayıcısıdır.
* **[Login.tsx](../../src/admin/Login.tsx):** E-posta/şifre split-screen giriş; `signInWithPassword`.
* **[useAuth.ts](../../src/admin/useAuth.ts):** Supabase oturumunu izler; her istekte **canlı** access token taşıyan `getAuthHeaders` üretir.
* **[ctx.ts](../../src/admin/ctx.ts):** `AdminCtx` / `useAdmin` — `email`, `getAuthHeaders`, `signOut`, `notify`.
* **[SystemHealthDS.tsx](../../src/admin/SystemHealthDS.tsx):** Canlı sistem sağlığı kartı; `/api/admin/health` (25 sn) ve `/health/probe` (60 sn) periyodik yoklar, sekme gizliyken durur.
* **sections/** — bkz. [admin.md](admin.md): `Overview`, `Campaigns`, `CampaignDetail` (kod havuzu dahil), `Types`, `Announcements`, `Settings`.

**Yardımcılar (`lib/`)**
* **[supabase.ts](../../src/lib/supabase.ts):** Anon Supabase istemcisi — yalnızca admin auth ve signed-URL yükleme için (veri okuma değil).
* **[imageCompress.ts](../../src/lib/imageCompress.ts):** Görselleri Storage'a yüklemeden tarayıcıda yeniden boyutlandırıp sıkıştırır.
* **[cover.ts](../../src/lib/cover.ts):** `coverTone(key)` — görselsiz kampanyalara slug'dan deterministik gradient tonu (5 ton).
* **[tc.ts](../../src/lib/tc.ts):** `isValidTC(tc)` — istemci T.C. Kimlik No biçim/algoritma kontrolü.
* **[types.ts](../../src/lib/types.ts):** `Campaign`, `CampaignType`, `Announcement`, `CampaignStatus` tipleri.

## Related Notes

- [[README]]
- [[architecture]]
- [[frontend]]
- [[admin]]

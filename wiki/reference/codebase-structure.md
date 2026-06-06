# Proje Klasör Yapısı ve Dosya Haritası

**Summary**: Projenin dizin yapısı ve her bir dosyanın üstlendiği görevlerin detaylı açıklamaları.
**Tags**: #codebase #structure #directories #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-05-26T12:35:00+03:00

---

## Content

Bu belgede, projenin dizin yapısı ve her bir dosyanın üstlendiği görevler detaylandırılmıştır. Kod tabanında değişiklik yapmadan önce dosyaların rollerini anlamak için bu haritayı referans alabilirsiniz.

---

## 📂 Genel Dizin Ağacı

```text
talpa-giyim/
├── api/                        # Vercel Serverless Uç Noktaları
│   └── index.ts                # Sunucusuz Express entry point
├── server/                     # Backend API Kaynak Kodları
│   ├── lib/                    # Ortak Kütüphaneler ve Servisler
│   │   ├── memberVerify.ts     # TALPA API doğrulama ve Retry mantığı
│   │   ├── supabaseAdmin.ts    # Supabase service_role (Admin) istemcisi
│   │   ├── requireAdmin.ts     # Admin yetki middleware'i (admins allowlist)
│   │   ├── validateTc.ts       # Sunucu tarafı T.C. Kimlik No doğrulaması
│   │   └── rateLimit.ts        # Public uç noktalar için IP bazlı hız sınırı
│   └── routes/                 # API Yönlendirme Katmanları (Controller)
│       ├── admin.ts            # /api/admin/* (İdari rotalar, istatistik, kilit)
│       ├── campaigns.ts        # GET /api/campaigns (Aktif kampanya listeleme)
│       ├── claim.ts            # POST /api/claim-code (Kod alma iş akışı)
│       └── upload.ts           # POST /api/admin/upload (Storage dosya yükleme)
├── src/                        # Frontend (React) Kaynak Kodları
│   ├── assets/                 # Statik Varlıklar (Görseller, logolar)
│   ├── components/             # Yeniden Kullanılabilir Bileşenler
│   │   ├── CampaignCard.tsx    # Kampanya listeleme kartı
│   │   └── FeaturedHero.tsx    # Öne çıkan kampanya afişi (Hero)
│   ├── lib/                    # Frontend Yardımcı Kodları
│   │   ├── supabase.ts         # Anonim Supabase okuma istemcisi
│   │   └── types.ts            # Paylaşılan TypeScript tipleri
│   ├── pages/                  # Sayfa Arayüzleri
│   │   ├── AdminDashboard.tsx  # Yönetim paneli arayüzü ve CRUD formları
│   │   ├── CampaignPage.tsx    # Kod talep etme ve kopyalama sayfası
│   │   └── HomePage.tsx        # Anasayfa, kampanya grid, "kodlarımı sorgula"
│   ├── App.css                 # Arayüz yerleşim stilleri
│   ├── App.tsx                 # Sayfa yönlendirme şablonu (Router)
│   ├── index.css               # Renk paleti, CSS değişkenleri ve global stiller
│   └── main.tsx                # React DOM render başlangıcı
├── wiki/                       # Sistem Wiki ve Geliştirici Belgeleri
├── database.sqlite             # (Legacy) Eski veritabanı yedeği
├── index.html                  # Vite istemci ana HTML şablonu
├── package.json                # Proje bağımlılıkları ve çalıştırma scriptleri
├── server.ts                   # Express sunucu başlatma ve yapılandırma dosyası
├── tsconfig.json               # TypeScript derleme ayarları
└── vercel.json                 # Vercel sunucusuz yönlendirme tanımları
```

---

## 🎯 Dosyaların Detaylı Görevleri

### Sunucu ve Altyapı Dosyaları
* **[server.ts](../../server.ts):** Express uygulamasını ayağa kaldırır, CORS ve JSON gövde limitlerini (`10mb`) tanımlar, alt rotaları bağlar. Yerel geliştirme ortamında `3001` portundan dinleme yapar.
* **[vercel.json](../../vercel.json):** Vercel edge sunucuları için URL yönlendirme kurallarını saklar.
* **[api/index.ts](../../api/index.ts):** Express uygulamasını Vercel Serverless Function standartlarına uygun olarak dışa aktarır.

---

### Backend (`server/`) Dosyaları
* **[server/lib/memberVerify.ts](../../server/lib/memberVerify.ts):** Dış TALPA Üye API'sine bağlanır. HTTP 429 rate limitlerinde ve 500 hatalarında akıllıca üstel yeniden denemeler gerçekleştirir.
* **[server/lib/supabaseAdmin.ts](../../server/lib/supabaseAdmin.ts):** Yazma, güncelleme ve silme yetkisine sahip `SUPABASE_SERVICE_KEY` ile veritabanı bağlantısı açar. Güvenlik için istemci tarafına asla sızdırılmamalıdır.
* **[server/routes/campaigns.ts](../../server/routes/campaigns.ts):** Kullanıcılara gösterilecek olan yayındaki kampanyaları `featured_order` sırasına göre veritabanından çekip döner.
* **[server/routes/claim.ts](../../server/routes/claim.ts):** T.C. Kimlik doğrulaması yapar, aidat durumunu sorgular, limit aşımını kontrol eder ve optimistik kilit kullanarak üyeye güvenli şekilde indirim kodu tahsis eder.
* **[server/routes/admin.ts](../../server/routes/admin.ts):** Yönetici paneli üzerindeki kampanya ekleme, düzenleme, TCKN sorgulama, envanter önizleme ve sistemi sıfırlama işlemlerini yürüten korumalı API rotalarını barındırır.
* **[server/routes/upload.ts](../../server/routes/upload.ts):** Yönetici panelinden yüklenen logo ve kapak resimlerini Base64 formatında alıp Supabase Storage `campaign-images` bucket'ına yükler.

---

### Frontend (`src/`) Dosyaları
* **[src/App.tsx](../../src/App.tsx):** Navbar yerleşimini barındırır ve istemci tarafındaki sayfa adreslerini tanımlar.
* **[src/pages/HomePage.tsx](../../src/pages/HomePage.tsx):** API'den kampanyaları çeker. En üst sırada öne çıkan kampanyayı afiş olarak, diğerlerini ise grid şeklinde listeler. Yükleme esnasında skeleton kartlar gösterir.
* **[src/pages/CampaignPage.tsx](../../src/pages/CampaignPage.tsx):** Üyenin T.CK.N. girdiği form sayfasını çizer. Algoritmik T.C. kontrolü yapar ve kodu başarıyla aldıktan sonra panoya kopyalama imkanı verir.
* **[src/pages/AdminDashboard.tsx](../../src/pages/AdminDashboard.tsx):** Supabase Auth ile yönetici girişi yaptırır. Yeni kampanya ekleme modal'ını, toplu kod yükleme aracını, veritabanı önizleme tablolarını yönetir.
* **[src/components/FeaturedHero.tsx](../../src/components/FeaturedHero.tsx):** Öne çıkan kampanyanın ana sayfada geniş afiş şeklinde gösterilmesini sağlayan görsel arayüz bileşenidir.
* **[src/components/CampaignCard.tsx](../../src/components/CampaignCard.tsx):** Kampanyaların ana sayfadaki grid içerisinde kartlar halinde sergilenmesini sağlayan bileşendir.

## Related Notes

- [[README]]
- [[architecture]]

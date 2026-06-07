# Yönetici (Admin) Paneli Kullanım Kılavuzu

**Summary**: TALPA Kampanyaları uygulamasının Yönetici Paneli (/admin) kullanım kılavuzu; kimlik doğrulama, sistem sağlık ekranı, kampanya yönetimi, toplu kod yükleme ve canlı veri izleme süreçleri.
**Tags**: #admin #dashboard #manual #system-health #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-06-07T12:00:00+03:00

---

## Content

Yönetici paneli (`/admin`), kampanyaların oluşturulması, güncellenmesi, dış ortaklardan alınan kodların Excel formatında toplu olarak yüklenmesi ve üyelerin kod geçmişlerinin izlenmesi gibi kritik idari süreçlerin yürütüldüğü arayüzdür.

---

## 🔐 Kimlik Doğrulama ve Yetkilendirme (Login & Authorization)

Yönetici paneline giriş, Supabase Auth mekanizması ile güvence altına alınmıştır. Doğrulama **iki aşamalıdır**: önce geçerli bir Supabase oturumu (authentication), ardından `admins` allowlist tablosunda yer alma (authorization).

* **Giriş Bilgileri:** Yöneticiler, Supabase Auth'ta kayıtlı e-posta ve şifreleri ile giriş yaparlar (`signInWithPassword`).
* **Oturum Yönetimi:** Oturum açıldığında, Supabase istemcisi JWT Token'ı `localStorage` üzerinde saklar.
* **API Güvenliği:** Sunucu tarafındaki `/api/admin/*` rotalarına atılan tüm istekler `Authorization: Bearer <token>` başlığında bu JWT Token'ı taşımalıdır. Paylaşılan Express middleware'i [server/lib/requireAdmin.ts](../../server/lib/requireAdmin.ts) şu adımları uygular:
  1. Token'ı `supabaseAdmin.auth.getUser(token)` ile doğrulayıp kullanıcıyı çözer. Token yoksa/geçersizse **401** döner.
  2. Çözülen kullanıcının e-postasını `public.admins` tablosunda arar. **Allowlist'te değilse `403 "Bu hesabın yönetici yetkisi bulunmuyor."`** döner.
* **Admin Eklemek:** Yeni bir yönetici yetkilendirmek için kişinin Supabase Auth kullanıcısı olması ve e-postasının `admins` tablosuna eklenmesi gerekir:
  ```sql
  insert into public.admins (email) values ('yeni-admin@ornek.com');
  ```

> [!IMPORTANT]
> Hem [server/routes/admin.ts](../../server/routes/admin.ts) hem de [server/routes/upload.ts](../../server/routes/upload.ts) bu tek paylaşılan `requireAdmin` fonksiyonunu kullanır. Eskiden var olan paylaşılan `ADMIN_PASSWORD` env tabanlı doğrulama kaldırılmıştır; `.env.example` içindeki `ADMIN_PASSWORD` satırı artık kullanılmamaktadır.

---

## 🩺 Sistem Sağlığı Paneli

Panelin **en üstünde**, giriş yapan yöneticinin sistemin durumunu tek bakışta görmesini sağlayan **Sistem Sağlığı** kartı yer alır ([SystemHealth.tsx](../../src/components/SystemHealth.tsx)). Amaç **sessiz arızayı** önlemektir: kampanyalar toplu e-postayla duyurulduğunda herkes aynı anda girer ve bir aksaklık fark edilmezse çok sayıda üye etkilenir.

**Ana ışık (özet durum):**
* 🟢 **Yeşil — "Her şey yolunda":** Dış servis çalışıyor ve stok sorunu yok.
* 🟡 **Sarı — "Dikkat gerekiyor":** Servis aralıklı hata veriyor **veya** bir/birkaç kampanyada stok azaldı/bitti. (Stok sorunu kasıtlı olarak sarıdır — kırmızının alarm değeri korunur.)
* 🔴 **Kırmızı — "Servis sorunu":** **Yalnızca** dış üye doğrulama servisi yanıt vermiyorsa yanar.

**Üç alt panel:**
1. **Üye Doğrulama Servisi:** Dış servisin durumu. **"Şimdi test et"** butonu `/api/admin/health/probe` ile servisi aktif yoklar (yanıt süresini ms olarak gösterir). Otomatik yoklama 60 sn'de bir yapılır. Ayrıca son 30 dakikadaki servis hatası sayısı (`system_verify_failures`) gösterilir. `/health` ucu henüz yayında değilse durum **gri** ("yayında değil") görünür — kırmızı değil.
2. **Sistem Nabzı:** Son kodun ne zaman dağıtıldığı ("az önce", "5 dk önce"…) ve **bugün** (İstanbul saatiyle) dağıtılan toplam kod adedi. Bilinçli olarak renksizdir (yanlış alarm vermesin).
3. **Stok Durumu:** Aktif kampanyaları kalan koda göre sıralar; her biri için ilerleme çubuğu ve `TÜKENDİ` / `KOD YOK` / `N kaldı` etiketi. Düşük stok eşiği: `max(ceil(total*0.15), 25)`.

> [!NOTE]
> Veri 25 sn'de bir, dış servis yoklaması 60 sn'de bir otomatik yenilenir; **sekme arka plandayken yenileme durur** (gereksiz yük ve dış servisi dövmemek için). Sağ üstteki 🔄 butonu anlık yeniler. Tüm veriler `/api/admin/health` ve `/api/admin/health/probe`'dan gelir (bkz. [api.md](api.md#11-sistem-sa%C4%9Fl%C4%B1k-durumu-health-snapshot)).

---

## 📊 Genel İstatistikler (Dashboard)

Sağlık panelinin altında sistemin genel durumunu özetleyen 4 temel sayaç yer alır. Bu veriler `/api/admin/stats` uç noktasından çekilir:
1. **Toplam Kampanya:** Sistemdeki aktif ve pasif tüm kampanyaların sayısı.
2. **Toplam Kod:** Sisteme yüklenmiş toplam indirim kodu adedi.
3. **Dağıtılan Kod:** Üyeler tarafından teslim alınmış (`is_used = true`) kod adedi.
4. **Kalan Kod:** Hala dağıtılabilir durumda olan (`is_used = false`) kullanılmamış kod adedi.

---

## ⚙️ Kampanya Yönetimi

Kampanyalar listesinde her kampanya için aşağıdaki işlemler yapılabilir:

### 1. Yeni Kampanya Oluşturma
"Yeni Kampanya" butonu ile açılan modal form üzerinden aşağıdaki bilgiler girilerek oluşturulur:
* **Slug (Zorunlu):** Kampanyanın URL tanımlayıcısı (Örn: `network-2026`). Türkçe karakter ve boşluk içermemelidir.
* **Başlık (Zorunlu):** Kampanya adı (Örn: `Network %15 İndirim Ayrıcalığı`).
* **İndirim Etiketi (Zorunlu):** Arayüzde vurgulanacak indirim oranı (Örn: `%15 İndirim`).
* **Partner Adı & Logo URL:** Anlaşma yapılan firmanın adı ve logosu.
* **Kapak Görseli URL:** Kampanya detay sayfasında arka plan olarak kullanılacak görsel.
* **Bitiş Tarihi:** Kampanyanın son geçerlilik tarihi (opsiyonel).
* **Üye Başına Maks. Kod:** Bir üyenin bu kampanyadan alabileceği en fazla kod limiti (Varsayılan: `1`).
* **Kampanya Koşulları:** Sayfanın altında listelenecek hukuki/idari kullanım şartları.

> [!NOTE]
> Yeni oluşturulan kampanyalar varsayılan olarak **Pasif (is_active = false)** ve **Öne Çıkarılmamış (is_featured = false)** olarak oluşturulur. Kontroller yapıldıktan sonra arayüzdeki toggle butonları ile yayına alınabilirler.

### 2. Kampanya Detaylarını Güncelleme
Her kampanya kartının yanındaki ok ikonuna tıklanarak kampanya detay formu açılır. Formda yapılan değişiklikler **"Kaydet"** butonu ile sunucuya gönderilir (`PUT /api/admin/campaigns/:id`).

### 3. Görsel Yükleme (Logo & Kapak)
Partner logosu ve kapak görseli, URL elle girmek yerine dosya seçilerek yüklenebilir. Akış:
1. Seçilen görsel **tarayıcıda sıkıştırılır** ([imageCompress.ts](../../src/lib/imageCompress.ts)): en uzun kenar 1600 px'e indirilir, hedef boyut ~4.5 MB (bucket limiti 5 MB'ın altında). PNG/WebP saydamlığı korunmaya çalışılır; sığmazsa beyaz arka planlı JPEG'e düşülür. SVG ve GIF olduğu gibi bırakılır.
2. Sunucudan `POST /api/admin/upload` ile bir **signed upload URL** (`path` + `token`) alınır.
3. İstemci dosyayı bu token ile **doğrudan Supabase Storage**'a yükler (`uploadToSignedUrl`) — dosya Vercel serverless üzerinden geçmez, böylece ~4.5 MB body limiti ve base64 şişmesi aşılmaz. Dönen `publicUrl` forma yazılır.

---

## 📂 Kod Yükleme (Excel / CSV)

Kampanya detayında yer alan "Kod Yükleme" alanı, anlaşmalı firmadan gelen indirim kodlarının sisteme aktarılmasını sağlar:
* **Dosya Formatı:** `.xlsx`, `.xls` veya `.csv` dosyaları desteklenir.
* **Çalışma Mantığı:** Frontend tarafında `xlsx` kütüphanesi yardımıyla dosyanın **yalnızca ilk sütunu** okunur, satırlar temizlenerek kod listesi oluşturulur.
* **Mükerrerlik Koruması:** Sunucu tarafındaki `/api/admin/campaigns/:id/codes` API'si, yüklenen kodları veritabanında o kampanya için zaten var olan kodlarla karşılaştırır. Sistemde mevcut olan mükerrer kodlar elenir, yalnızca benzersiz yeni kodlar veritabanına eklenir.

---

## 🔍 T.C. Kimlik No ile Üye Sorgulama (Lookup)

Bir üyenin kampanyadan kod alıp almadığını kontrol etmek veya üyenin kaybettiği kodunu tekrar görüntülemek için "TC Sorgula" özelliği kullanılır:
* Kampanya kartındaki **"TC Sorgula"** butonuna basılır.
* 11 haneli T.CK.N. girilerek sorgulama başlatılır (`GET /api/admin/campaigns/:id/lookup?tc_no=...`).
* Üye kod almışsa, **aldığı kodlar** ve **teslim edilme tarihleri (UTC)** listelenir.

---

## 👁️ Canlı Veritabanı Önizleme (Preview)

Kampanya detay panelinin altında yer alan "Veritabanı Önizleme" bölümü, yöneticilerin veritabanındaki son hareketleri canlı olarak takip etmesini sağlar:
* **Kodlar Tablosu:** Kampanyaya ait yüklenen ve dağıtılan en son 20 indirim kodunun durumunu, alan üyenin T.C. Kimlik numarasını ve dağıtım tarihini gösterir.
* **Talepler (Claims) Tablosu:** İndirim kodunu almak için yapılan en son 20 başarılı doğrulamayı ve zaman damgalarını (zaman çizelgesi olarak) listeler.

---

## 🚨 Sistemi Sıfırlama (System Reset)

Yönetim panelinin sağ üst köşesinde bulunan **"Sistemi Sıfırla"** butonu, tüm kampanya indirim kodlarını ve üye talep kayıtlarını temizler:
* **Kapsam:** `campaign_codes` ve `campaign_claims` tablolarındaki tüm veriler tamamen silinir.
* **İstisna:** Tanımlanmış olan **kampanya şablonları (`campaigns`) silinmez**, sadece stokları ve claim geçmişleri sıfırlanır.
* **Güvenlik:** Bu işlem geri alınamaz bir veri temizleme işlemidir. Çalıştırılmadan önce yöneticiden tarayıcı onayı (`window.confirm`) istenir.

## Related Notes

- [[README]]
- [[api]]
- [[architecture]]

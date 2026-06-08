# TALPA Kampanya ve İndirim Kodu Yönetim Sistemi

**Summary**: TALPA Kampanyaları uygulamasının geliştirici wiki ana sayfası, sistem dizin yapısı, yerel kurulum kılavuzu ve LLM Wiki kullanım rehberi.
**Tags**: #wiki #index #documentation #setup #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-06-08T16:00:00+03:00

---

## Content

TALPA (Türkiye Havayolu Pilotları Derneği) üyelerine özel anlaşmalı firmalardan alınan indirim kodlarını yöneten ve dağıtan full-stack web uygulamasıdır. Bu wiki, sistemin mimarisini, veri modelini, API uç noktalarını ve iş kurallarını belgelemek amacıyla oluşturulmuştur.

> [!NOTE]
> **Güncel durum (2026-06):** Üye arayüzü "**Modern Minimal**" (açık tema, mobil-öncelikli) olarak yeniden tasarlandı; anasayfa tür sekmeleri/arama, ayrı **Kodlarım** ve **Arşiv** sayfaları eklendi. Yönetici paneli sol-menülü nested bir kabuğa dönüştü ve **Türler**, **Duyurular**, kampanya **klon/arşiv/sil** ve aranabilir **kod havuzu** yetenekleri kazandı. Veri modeline `campaign_types` ve `announcements` tabloları ile `campaigns` üzerine `type_id`, `starts_at`, `is_archived` alanları eklendi.

---

## 📌 Wiki İçindekiler Paneli

- [📖 Genel Bakış & Kurulum](README.md)
- [📂 Proje Klasör Yapısı ve Dosya Haritası](reference/codebase-structure.md)
- [🏗️ Sistem Mimarisi ve Kod Dağıtım Akışı](reference/architecture.md)
- [🗄️ Veritabanı Şeması & İlişkiler](reference/database.md)
- [🔗 API Uç Noktaları (Endpoints)](reference/api.md)
- [👤 TALPA Üye Doğrulama Entegrasyonu](reference/member-verification.md)
- [💻 İstemci (Frontend) Uygulama ve Stil Rehberi](reference/frontend.md)
- [🛠️ Yönetici (Admin) Paneli Kullanım Kılavuzu](reference/admin.md)
- [⚡ Sunucu Dağıtımı (Deployment) ve Vercel Ayarları](reference/deployment.md)

---

## 🤖 Andrej Karpathy'nin LLM Wiki Yapısı

Bu wiki dizini, **Andrej Karpathy'nin LLM Wiki** konseptine uygun şekilde yapılandırılmıştır. Dosyalar, kodlama ajanlarının (Claude Code vb.) ve Obsidian gibi yerel markdown editörlerinin bilgiyi en hızlı ve verimli şekilde tarayıp anlamlandırabileceği bir formatta tutulmaktadır.

### Dizin Yapısı:
- `_templates/`: Yeni dokümanlar eklemek için şablon dosyası (`note.md`).
- `projects/`: Proje spesifikasyonları ve aktif iş notları.
- `research/`: Araştırma ve konsept notları.
- `reference/`: Sisteme ait temel teknik belgeler (yukarıdaki içindekiler paneli burayı gösterir).
- `meetings/`: Toplantı notları.
- `inbox/`: Düzenlenmeyi bekleyen ham/geçici notlar.

### Claude Code ile Wiki'yi Sorgulama:
Terminal üzerinden `wiki` dizinine gidip Claude Code'u başlatarak doğrudan kendi bilgi tabanınızı sorgulayabilirsiniz:
```bash
cd wiki
claude
```
**Örnek Sorgular:**
* *"Veritabanında optimistik kilit mantığı hangi alanlar üzerinde ve nasıl kuruldu?"*
* *"TALPA üye API'sinden 429 veya 500 hatası alındığında sistem nasıl bir retry politikası izliyor?"*
* *"Yönetim paneli üzerinden toplu kod yüklerken mükerrer kod kontrolü nasıl yapılıyor?"*

---

## 💻 Teknoloji Yığını (Stack)

Uygulama, modern ve ölçeklenebilir teknolojilerle inşa edilmiştir:

| Katman | Teknoloji | Açıklama |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Vite | Hızlı, bileşen tabanlı istemci arayüzü |
| **Backend** | Express 5 (TypeScript / tsx) | API sunucusu, Vercel Serverless Function uyumlu |
| **Veritabanı** | Supabase (PostgreSQL) | Bulut veritabanı, veri depolama ve kimlik doğrulama |
| **Dosya Depolama**| Supabase Storage | Görseller (kampanya kapakları ve logolar) için |
| **Paket Yöneticisi**| npm | Bağımlılık yönetimi |
| **Sunucu Dağıtımı**| Vercel | Sunucusuz (serverless) dağıtım altyapısı |

---

## ⚙️ Ortam Değişkenleri (.env)

Projeyi yerelde ve canlı ortamda çalıştırmak için aşağıdaki ortam değişkenleri gereklidir. Yerel testler için kök dizinde bir `.env` dosyası bulunmalıdır.

```env
# Supabase Bağlantı Bilgileri
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...          # service_role key (sadece sunucu tarafında kullanılır)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...       # anon key (frontend: yalnızca auth + signed upload)

# Opsiyonel: Admin JWT'lerini her istekte Supabase Auth'a gitmeden YEREL doğrulamak için.
# Supabase paneli → Settings → API → "JWT Secret" (legacy/HS256). Tanımlanmazsa sistem
# güvenli şekilde getUser() ağ doğrulamasına geri döner (eski davranış, hiçbir şey kırılmaz).
SUPABASE_JWT_SECRET=

# TALPA Üye Doğrulama Servisi
TALPA_MEMBER_API_URL=https://talpa-uye.vercel.app/api/members/verify
TALPA_API_KEY=xxxx                   # TALPA Member API için gizli anahtar
# Opsiyonel: Sağlık ekranının aktif yoklaması için dış servisin /health ucu.
# Boş bırakılırsa TALPA_MEMBER_API_URL'den (/members/verify -> /health) türetilir.
TALPA_MEMBER_HEALTH_URL=

# Uygulama Ayarları
PORT=3001
NODE_ENV=development

# CORS — izin verilen origin'ler (virgülle ayrılmış). Boş bırakılırsa tüm
# origin'lere açıktır (yalnızca yerel geliştirme için). Canlıda doldurun:
CORS_ORIGINS=https://talpa-giyim.vercel.app
```

> [!NOTE]
> Public uç noktalar IP başına hız sınırına tabidir (`express-rate-limit`). Vercel arkasında gerçek IP'nin alınması için sunucuda `trust proxy` etkindir.

---

## 🚀 Projeyi Yerelde Çalıştırma

Projeyi yerel makinenizde kurmak ve çalıştırmak için aşağıdaki adımları takip edebilirsiniz:

1. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   ```

2. **Geliştirme Sunucularını Çalıştırın (Eşzamanlı):**
   Vite geliştirme sunucusunu ve Express API sunucusunu aynı anda çalıştırmak için:
   ```bash
   npm run dev:all
   ```
   * İstemci Arayüzü: `http://localhost:5173`
   * API Sunucusu: `http://localhost:3001`

3. **Yalnızca API Sunucusunu Çalıştırmak İçin:**
   ```bash
   npm run dev:server
   ```

4. **Yalnızca Frontend Sunucusunu Çalıştırmak İçin:**
   ```bash
   npm run dev
   ```

5. **Üretim Modu İçin Derleme (Build):**
   ```bash
   npm run build
   ```

## Related Notes

- [[reference/architecture]]
- [[reference/api]]
- [[reference/database]]

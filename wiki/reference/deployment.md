# Sunucu Dağıtımı (Deployment) ve Vercel Ayarları

**Summary**: TALPA Kampanyaları uygulamasının Vercel platformunda Express ve React bir arada sunucusuz (serverless) dağıtım (deployment) mimarisi ve vercel.json yapılandırması.
**Tags**: #deployment #vercel #serverless #build #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-06-08T16:00:00+03:00

---

## Content

Uygulama, hem frontend statik dosyalarını hem de backend API rotalarını tek bir çatı altında sunan **Vercel** platformu üzerinde çalışacak şekilde yapılandırılmıştır.

---

## ⚙️ Vercel Yapılandırması (`vercel.json`)

Kök dizindeki [vercel.json](../../vercel.json) dosyası, gelen isteklerin doğru katmanlara yönlendirilmesini (rewriting) yönetir:

```json
{
  "regions": ["sin1"],
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.ts"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Yönlendirme Kurallarının Çalışma Mantığı:
1. **Bölge (`regions: ["sin1"]`):** Serverless işlevler **Singapur** bölgesinde çalışır — hem Supabase projesine hem dış TALPA Üye API'sine yakınlık için. Bölge değiştirilirse veritabanı/dış servis gecikmesi (latency) artabilir.
2. **API İstekleri (`/api/...`):** `/api/` önekiyle başlayan tüm çağrılar `api/index.ts` sunucusuz işlevine (Serverless Function) yönlendirilir.
3. **Frontend Yönlendirmeleri (`/(...)`):** API harici tüm yollar doğrudan istemci kök dosyası olan `index.html`'e yönlendirilir. Bu sayede tarayıcıda doğrudan `/admin`, `/kodlarim`, `/arsiv` veya `/kampanya/brooks-brothers` yazıldığında Vercel'de 404 oluşmaz; yönlendirme tarayıcıda `react-router-dom` (History API) ile kontrol edilir.

---

## ⚡ Serverless Giriş Noktası (`api/index.ts`)

Vercel, `api` dizini altında export edilen Express nesnelerini otomatik olarak sunucusuz işlevlere dönüştürür. [api/index.ts](../../api/index.ts) dosyası Express uygulamasını sunucu dosyasından içeri aktararak export eder:

```typescript
import app from '../server.js';
export default app;
```

Sunucu tarafındaki yerel dinleme döngüsü (`app.listen`) yalnızca **üretim dışı (local development)** ortamda tetiklenir ([server.ts](../../server.ts)):

```typescript
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`API Sunucusu http://localhost:${PORT} adresinde çalışıyor. (DEV)`);
  });
}
```
Üretim ortamında (Vercel) ise Express uygulaması sadece istek geldiğinde uyanan ve yanıt döndükten sonra uykuya geçen serverless bir yapıda çalışır.

---

## 📦 Derleme ve Canlıya Alma (Build & Deployment)

Vercel paneli üzerinde proje kurulumu yapılırken aşağıdaki ayarlar kullanılmalıdır:

1. **Framework Preset:** `Vite`
2. **Build Command (Derleme Komutu):** `npm run build`
   * Bu komut arka planda `tsc -b && vite build` çalıştırarak öncelikle TypeScript kodlarının derlenmesini sağlar, ardından Vite ile frontend kaynak kodlarını optimize edilmiş static dosyalara dönüştürerek `dist` klasörüne yazar.
3. **Output Directory (Çıktı Dizini):** `dist`
4. **Environment Variables (Ortam Değişkenleri):**
   * Canlı ortamın çalışması için [README.md](../README.md) dosyasındaki tüm ortam değişkenleri Vercel Dashboard -> Settings -> Environment Variables alanına eklenmelidir.
   * **Dikkat:** `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` değişkenlerinin istemci tarafında okunabilmesi için mutlaka derleme (build) aşamasında tanımlanmış olması gerekir.
   * **Opsiyonel `SUPABASE_JWT_SECRET`:** Admin JWT'lerini her istekte Supabase Auth'a gitmeden **yerel** (HS256) doğrulamak için (Supabase → Settings → API → "JWT Secret"). Tanımlanmazsa sistem güvenli şekilde `getUser()` ağ doğrulamasına döner; eklenince admin uçları belirgin biçimde hızlanır. Bkz. [admin.md](admin.md#-kimlik-doğrulama-ve-yetkilendirme).
   * **Opsiyonel `TALPA_MEMBER_HEALTH_URL`:** Sistem Sağlık Ekranındaki aktif yoklama (probe) için dış servisin sağlık ucu. Tanımlanmazsa `TALPA_MEMBER_API_URL`'in `/members/verify` → `/health` dönüşümünden otomatik türetilir; çoğu kurulumda ayrıca tanımlamaya gerek yoktur.

---

## 🩺 İki Repo & Sağlık Ucu (`/health`) Bağımlılığı

Sistem Sağlık Ekranındaki **aktif servis yoklaması**, dış [talpa-uye](../../README.md) servisinin `GET /api/members/health` (kısaca `/health`) ucuna bağlıdır. Bu iki repo **ayrı ayrı deploy edilir**:

1. **`talpa-uye`** — `/health` ucunu yayınlamalı (servis + DB ayakta mı kontrolü).
2. **Bu repo (`talpa-giyim`)** — `pingMemberService` + `/api/admin/health/probe` + sağlık paneli.

> [!NOTE]
> `/health` ucu **henüz yayında değilse** (dış servis deploy beklerken) sağlık paneli servis durumunu **kırmızı değil, gri** ("Sağlık ucu yayında değil") gösterir — yanlış alarm vermez. Pasif hata günlüğü (`system_verify_failures`) bu durumdan bağımsız çalışmaya devam eder.

---

## 🌐 Canlı Proje Bilgileri ve CORS

Proje Vercel'de **`erkan's projects`** takımı altında **`talpa-giyim`** adıyla barınır. Production domain'leri:

* `https://talpa-giyim.vercel.app` (birincil alias)
* `https://talpa-giyim-git-main-erkans-projects-eca02b7e.vercel.app` (git `main` branch)

### CORS_ORIGINS Ayarı
Frontend ve `/api` aynı deployment'tan, **aynı origin** üzerinden servis edildiği için uygulamanın kendi istekleri CORS'a takılmaz; bu değişken yalnızca *başka* origin'lerden gelen API çağrılarını kısıtlar.

| Key | Value (Production) |
| :--- | :--- |
| `CORS_ORIGINS` | `https://talpa-giyim.vercel.app` |

Birden fazla origin için virgülle ayırın (örn. özel alan adı eklendiğinde): `https://talpa-giyim.vercel.app,https://kampanya.talpa.org`. Değişken eklendikten/değiştirildikten sonra etkili olması için **yeniden deploy** gerekir. Boş bırakılırsa CORS tüm origin'lere açık kalır.

> [!NOTE]
> Public uç noktalardaki hız sınırı (`express-rate-limit`) serverless'ta in-memory store kullandığı için her çalışma örneğinde sıfırlanır (best-effort). Gerçek istemci IP'sinin alınabilmesi için [server.ts](../../server.ts) içinde `app.set('trust proxy', 1)` ayarlanmıştır.

> [!NOTE]
> **CDN cache:** Public vitrin uçları herkese aynı veriyi döndürdüğü için `Cache-Control: public, s-maxage=…, stale-while-revalidate=…` ile **Vercel paylaşımlı CDN'inde** cache'lenir (tarayıcıda değil): `/api/campaigns` ve `/api/announcements` 60 sn, `/api/campaigns/archive` ve `/api/campaign-types` 300 sn, `/api/campaigns/:slug` 30 sn. Böylece toplu e-posta anındaki yığılmada origin'e giden istek sayısı düşer; kampanya/stok değişiklikleri en geç bu süre kadar gecikir. Kod talebi (`/api/claim-code`) her zaman sunucuda gerçek-zamanlı doğrulanır (cache'lenmez).

## Related Notes

- [[README]]
- [[architecture]]
- [[api]]

# Sunucu Dağıtımı (Deployment) ve Vercel Ayarları

**Summary**: TALPA Kampanyaları uygulamasının Vercel platformunda Express ve React bir arada sunucusuz (serverless) dağıtım (deployment) mimarisi ve vercel.json yapılandırması.
**Tags**: #deployment #vercel #serverless #build #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-05-26T12:35:00+03:00

---

## Content

Uygulama, hem frontend statik dosyalarını hem de backend API rotalarını tek bir çatı altında sunan **Vercel** platformu üzerinde çalışacak şekilde yapılandırılmıştır.

---

## ⚙️ Vercel Yapılandırması (`vercel.json`)

Kök dizindeki [vercel.json](../../vercel.json) dosyası, gelen isteklerin doğru katmanlara yönlendirilmesini (rewriting) yönetir:

```json
{
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
1. **API İstekleri (`/api/...`):** `/api/` önekiyle başlayan tüm çağrılar `api/index.ts` sunucusuz işlevine (Serverless Function) yönlendirilir.
2. **Frontend Yönlendirmeleri (`/(...)`):** API harici tüm yollar doğrudan istemci kök dosyası olan `index.html`'e yönlendirilir. Bu sayede, tarayıcıda doğrudan `/admin` veya `/kampanya/brooks-brothers` yazıldığında sayfanın Vercel tarafında 404 hatası vermesi önlenir ve yönlendirme işlemi tarayıcıda `react-router-dom` (History API) tarafından kontrol edilir.

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

## Related Notes

- [[README]]
- [[architecture]]
- [[api]]

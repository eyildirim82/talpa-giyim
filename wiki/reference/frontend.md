# İstemci (Frontend) Uygulama ve Stil Rehberi

**Summary**: TALPA Kampanyaları uygulamasının React 19 istemci mimarisi, yönlendirme kuralları (routing), vanilla CSS tasarım sistemi, stok rozetleri/503 UX ve istemci tarafı T.C. Kimlik doğrulama algoritması.
**Tags**: #frontend #react #vanilla-css #routing #tc-validation #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-06-07T12:00:00+03:00

---

## Content

İstemci uygulaması, **React 19**, **TypeScript** ve **Vite** üzerine kurulu tek sayfalı bir uygulamadır (SPA). Bileşenlerin tasarımları, projenin modern ve premium görünümünü korumak adına TailwindCSS yerine özel yazılmış **Vanilla CSS** ile yönetilmektedir.

---

## 🧭 Sayfa Yönlendirmeleri (Routing)

Yönlendirme yönetimi `react-router-dom` kütüphanesi ile [App.tsx](../../src/App.tsx) içinde tanımlanmıştır:

* `/` -> **[HomePage.tsx](../../src/pages/HomePage.tsx):** Aktif kampanyaların listelendiği ana sayfa. Ayrıca üyenin TCKN girip daha önce aldığı tüm kodları görebildiği **"Kodlarımı Sorgula"** aracını barındırır (`POST /api/my-codes`).
* `/kampanya/:slug` -> **[CampaignPage.tsx](../../src/pages/CampaignPage.tsx):** Üyenin T.C. Kimlik numarasını girip indirim kodu talep ettiği tekil kampanya detay sayfası.
* `/admin` -> **[AdminDashboard.tsx](../../src/pages/AdminDashboard.tsx):** Yetkili kullanıcıların sistem sağlığını, kampanyaları ve kod envanterini yönettiği arayüz.

---

## 🎨 Tasarım Sistemi ve CSS Değişkenleri

Uygulamanın görsel estetiği [index.css](../../src/index.css) dosyasındaki koyu lacivert (dark navy) tema değişkenlerine dayanır:

```css
:root {
  --bg-dark: #0f172a;        /* Genel arka plan rengi */
  --bg-card: #1e293b;        /* Kartlar ve form kutularının arka planı */
  --text-main: #f8fafc;      /* Birincil beyaz metin rengi */
  --text-muted: #94a3b8;     /* İkincil gri metin rengi */
  --primary: #1a2f5c;        /* Kurumsal koyu lacivert vurgu rengi */
  --accent: #10b981;         /* Başarı ve buton vurgu rengi (Zümrüt Yeşili) */
  --danger: #ef4444;         /* Hata ve uyarı rengi (Kırmızı) */
  --border-color: #334155;   /* Çerçeve ve sınır çizgisi rengi */
}
```

### Görsel Tasarım Kuralları:
* **Glassmorphism:** Kampanya detay sayfasındaki kartlar `backdrop-filter: blur(14px)` ve yarı şeffaf arka plan rengi (`rgba(30, 41, 59, 0.88)`) ile yarı saydam bir cam etkisi kazanmıştır.
* **Micro-Animations:** Formların yüklenme durumlarında `lucide-react` paketinden `Loader2` ikonu `@keyframes spin` animasyonuyla döner. Kampanya kartları üzerinde hafif bir hover animasyonu mecesuttur.

---

## 🧩 Çekirdek Bileşenler (Core Components)

### 1. `FeaturedHero.tsx`
* **Görevi:** Yayındaki kampanyalar arasında `is_featured = true` olan ve en yüksek `featured_order` değerine sahip olan kampanyayı ana sayfanın en üstünde büyük bir görsel ve vurgulu bir şekilde sergiler.
* **Tasarım:** Geniş kapak görseli, gölgeli degrade geçişi ve doğrudan kampanya detayına yönlendiren "Kampanyayı İncele" butonu barındırır.

### 2. `CampaignCard.tsx`
* **Görevi:** Ana sayfada öne çıkan haricindeki diğer tüm aktif kampanyaları 2'li veya 3'lü grid düzeninde listelemek için kullanılan kart bileşenidir.
* **Özellikler:** Kampanya başlığı, partner logo görseli, indirim oranı etiketi ve son katılım tarihini içerir. Stok durumuna göre **"Tükendi"** (`has_codes === false`, buton kilitli) veya **"Son kodlar!"** (`is_low_stock`) rozeti gösterir.

### 3. `SystemHealth.tsx`
* **Görevi:** Yönetici panelinin en üstünde yer alan **Sistem Sağlığı** kartı; dış servis durumu, sistem nabzı ve stok durumunu canlı izler. Yalnızca admin tarafından görülür.
* **Çalışma:** `/api/admin/health` (25 sn) ve `/api/admin/health/probe` (60 sn) uç noktalarını periyodik yoklar; sekme gizliyken durur. Detaylı kullanım için bkz. [admin.md](admin.md#-sistem-sa%C4%9Fl%C4%B1%C4%9F%C4%B1-paneli).
* **Props:** `getAuthHeaders: () => Promise<Record<string,string>>` — her çağrıda canlı Supabase oturum token'ını okur.

---

## 📉 Stok Durumu Rozetleri (Sold-out / Low-stock)

`/api/campaigns` her kampanyayla birlikte sunucuda türetilen `has_codes` ve `is_low_stock` bayraklarını döndürür (ham kod sayıları istemciye sızmaz). UI bu bayraklara göre davranır — [FeaturedHero.tsx](../../src/components/FeaturedHero.tsx), [CampaignCard.tsx](../../src/components/CampaignCard.tsx) ve [CampaignPage.tsx](../../src/pages/CampaignPage.tsx):

* `has_codes === false` → **"Tükendi"** rozeti; "Kodu Al" butonu pasif/kilitli.
* `is_low_stock === true` (ve stok var) → **"Son kodlar!"** uyarısı; buton aktif kalır.
* İki bayrak da yoksa normal akış. Eşik backend ile birebir aynıdır: `max(ceil(total*0.15), 25)`.

---

## 🔌 Servis Ulaşılamıyor (503) Deneyimi

Üye doğrulama servisi geçici olarak çökerse backend `degil` yerine **503** döner (bkz. [member-verification.md](member-verification.md)). İstemci bu durumu özel olarak ele alır: kullanıcıyı "üye değil" diye **kırmızı reddetmek yerine**, nötr bir bilgi kutusu ve **"Tekrar Dene"** butonu gösterir.

* **[CampaignPage.tsx](../../src/pages/CampaignPage.tsx)** (kod alma): `res.status === 503` → "Doğrulama servisine şu an ulaşılamıyor… birkaç dakika sonra tekrar deneyin." + `RefreshCw` ikonlu Tekrar Dene.
* **[HomePage.tsx](../../src/pages/HomePage.tsx)** (Kodlarımı Sorgula): aynı 503 mantığı; "Deneniyor…" / "Tekrar Dene".

---

## 🔒 T.C. Kimlik Numarası Doğrulama Algoritması

Kampanya sayfasında istek sunucuya gönderilmeden önce frontend tarafında tarayıcı yükünü azaltmak amacıyla T.C. Kimlik Numarası biçimsel algoritma kontrolünden geçirilir:

```typescript
function isValidTC(tc: string): boolean {
  // 1. Kural: 11 haneli olmalı, tamamen rakamlardan oluşmalı ve ilk hanesi 0 olmamalıdır.
  if (tc.length !== 11 || !/^\d+$/.test(tc) || tc[0] === '0') return false;
  
  const d = tc.split('').map(Number);
  
  // 2. Kural: 1, 3, 5, 7 ve 9. hanelerin toplamının 7 katından;
  // 2, 4, 6 ve 8. hanelerin toplamı çıkarıldığında elde edilen sonucun 10'a bölümünden kalan (mod 10),
  // bize 10. haneyi vermelidir.
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];
  if ((oddSum * 7 - evenSum) % 10 !== d[9]) return false;
  
  // 3. Kural: İlk 10 hanenin toplamının 10'a bölümünden kalan (mod 10),
  // bize 11. haneyi vermelidir.
  const total = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return total % 10 === d[10];
}
```
* **Kullanıcı Deneyimi:** T.C. Kimlik hanesi girişi esnasında sayısal olmayan tüm girdiler regex (`/\D/g`) ile temizlenir ve en fazla 11 karakter yazılmasına izin verilir. Hatalı biçim tespit edilirse arayüzde Türkçe hata bildirimi gösterilir.

---

## 🖼️ İstemci Tarafı Görsel Sıkıştırma (`imageCompress.ts`)

Yöneticinin yüklediği logo/kapak görselleri Supabase Storage'a gönderilmeden **tarayıcıda** yeniden boyutlandırılıp sıkıştırılır ([src/lib/imageCompress.ts](../../src/lib/imageCompress.ts)). Böylece `campaign-images` bucket'ının 5 MB limiti aşılmaz ve üye sayfaları daha hızlı yüklenir.

```typescript
const optimized = await compressImage(file); // varsayılan: 1600px, q=0.82, ≤4.5MB
```

* `createImageBitmap` ile (yoksa `<img>`'e düşerek) çözer, canvas'a yeniden çizer.
* En uzun kenarı **1600 px**'e ölçekler; hedef üst boyut **~4.5 MB** (limitin altında pay).
* PNG/WebP **saydamlığını korumayı** dener; sığmazsa beyaz arka planlı **JPEG**'e düşer ve kalite 0.4'e kadar kademeli azaltılır.
* **SVG/GIF** dokunulmadan bırakılır (vektör/animasyon bozulmasın). Küçültmeye gerek yoksa orijinal dosya olduğu gibi döner.

Sıkıştırılmış dosya ardından signed upload URL ile doğrudan Storage'a yüklenir (bkz. [admin.md](admin.md#3-g%C3%B6rsel-y%C3%BCkleme-logo--kapak)).

## Related Notes

- [[README]]
- [[admin]]

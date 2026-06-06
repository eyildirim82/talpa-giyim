# İstemci (Frontend) Uygulama ve Stil Rehberi

**Summary**: TALPA Kampanyaları uygulamasının React 19 istemci mimarisi, yönlendirme kuralları (routing), vanilla CSS tasarım sistemi ve istemci tarafı T.C. Kimlik doğrulama algoritması.
**Tags**: #frontend #react #vanilla-css #routing #tc-validation #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-05-26T12:35:00+03:00

---

## Content

İstemci uygulaması, **React 19**, **TypeScript** ve **Vite** üzerine kurulu tek sayfalı bir uygulamadır (SPA). Bileşenlerin tasarımları, projenin modern ve premium görünümünü korumak adına TailwindCSS yerine özel yazılmış **Vanilla CSS** ile yönetilmektedir.

---

## 🧭 Sayfa Yönlendirmeleri (Routing)

Yönlendirme yönetimi `react-router-dom` kütüphanesi ile [App.tsx](../../src/App.tsx) içinde tanımlanmıştır:

* `/` -> **[HomePage.tsx](../../src/pages/HomePage.tsx):** Aktif kampanyaların listelendiği ana sayfa arayüzü.
* `/kampanya/:slug` -> **[CampaignPage.tsx](../../src/pages/CampaignPage.tsx):** Üyenin T.C. Kimlik numarasını girip indirim kodu talep ettiği tekil kampanya detay sayfası.
* `/admin` -> **[AdminDashboard.tsx](../../src/pages/AdminDashboard.tsx):** Yetkili kullanıcıların kampanyaları ve kod envanterini yönettiği arayüz.

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
* **Özellikler:** Kampanya başlığı, partner logo görseli, indirim oranı etiketi ve son katılım tarihini içerir.

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

## Related Notes

- [[README]]
- [[admin]]

# İstemci (Frontend) Uygulama ve Stil Rehberi

**Summary**: React 19 istemci mimarisi, "Modern Minimal" tasarım sistemi (açık tema, mobil-öncelikli, `.ds`/`ds-*`), yönlendirme, üye sayfaları/bileşenleri, stok rozetleri, durum (status) yönetimi, 503 UX ve istemci T.C. doğrulaması.
**Tags**: #frontend #react #design-system #routing #tc-validation #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-06-08T16:00:00+03:00

---

## Content

İstemci, **React 19 + TypeScript + Vite** üzerine kurulu tek sayfalı bir uygulamadır (SPA). 2026-06'da arayüz **sıfırdan yeniden tasarlandı**: eski koyu (dark navy) tema yerine **Modern Minimal** — açık, "üye loncası" estetiğinde, **mobil-öncelikli** bir tasarım sistemi geldi. Tüm stiller TailwindCSS yerine özel **Vanilla CSS** ile, tek dosyada ([src/styles/design-system.css](../../src/styles/design-system.css)) `.ds` / `ds-` ön ekiyle kapsanır.

> [!NOTE]
> Eski dosyalar (`HomePage.tsx`, `CampaignPage.tsx`, `AdminDashboard.tsx`, `components/CampaignCard.tsx`, `FeaturedHero.tsx`, `SystemHealth.tsx`, `App.css`) **kaldırıldı**. Yeni yapı için bkz. [codebase-structure.md](codebase-structure.md).

---

## 🧭 Sayfa Yönlendirmeleri (Routing)

Yönlendirme `react-router-dom` ile [App.tsx](../../src/App.tsx) içinde tanımlanır:

| Yol | Bileşen | Açıklama |
| :-- | :-- | :-- |
| `/` | [Home.tsx](../../src/pages/Home.tsx) | Vitrin: öne çıkan hero(lar), tür sekmeleri, arama/sıralama, kampanya grid'i. |
| `/kampanya/:slug` | [CampaignDetail.tsx](../../src/pages/CampaignDetail.tsx) | Tekil kampanya + TCKN ile kod talep formu. |
| `/kodlarim` | [MyCodes.tsx](../../src/pages/MyCodes.tsx) | "Kodlarım": TCKN ile alınan tüm kodlar (`POST /api/my-codes`). |
| `/arsiv` | [Archive.tsx](../../src/pages/Archive.tsx) | Süresi geçmiş/arşivlenmiş kampanyalar (salt-okunur). |
| `/admin/*` | [AdminApp.tsx](../../src/admin/AdminApp.tsx) | Yönetici paneli (nested rotalar). Bkz. [admin.md](admin.md). |

> "Kodlarımı sorgula" eskiden anasayfa içindeydi; artık ayrı bir `/kodlarim` sayfasıdır. Detay sayfasından başarı sonrası "Tüm kodlarım" linki TCKN'yi `state` ile taşır ve sayfa otomatik sorgular.

---

## 🎨 Tasarım Sistemi ve Token'lar

Tema, **açık zemin (slate) + TALPA navy + emerald vurgu** üzerine kuruludur. Token'lar `--ds-*` değişkenleridir ([design-system.css](../../src/styles/design-system.css)); kök sarmalayıcı `.ds` açık-tema bağlamını kurar. Tipografi: **Inter**.

```css
:root {
  /* Zemin & yüzey */
  --ds-bg: #f1f5f9;          /* slate-100 sayfa zemini */
  --ds-surface: #ffffff;     /* kartlar, paneller */
  --ds-sunken: #f1f5f9;      /* input / iç kuyular */
  /* Kenarlık & metin */
  --ds-border: #e2e8f0;
  --ds-ink: #0f172a;         /* slate-900 ana metin */
  --ds-ink-soft: #475569;
  --ds-ink-faint: #64748b;
  /* Birincil aksiyon — TALPA navy */
  --ds-primary: #1a2f5c;
  /* Vurgu — emerald (kod, başarı, claim CTA) */
  --ds-accent: #059669;
  /* Semantik */
  --ds-success: #059669; --ds-danger: #dc2626; --ds-warning: #d97706; --ds-info: #2563eb;
  /* Yarıçap / gölge / odak halkası ... (bkz. dosya) */
}
```

### Görsel kurallar
* **Tek vurgu disiplini:** Birincil aksiyon **navy**, "kod al/başarı" vurgusu **emerald**. Rozetlerde vurgu (mavi/emerald) ile semantik renkler (kırmızı/sarı) ayrı tutulur.
* **Görselsiz kampanyalar:** Kapak görseli yoksa `lib/cover.ts`'teki `coverTone(slug)` ile **deterministik gradient** seçilir (`ds-cover-ph--{bb|navy|warm|slate|green}`) ve marka adı watermark olarak yazılır.
* **Cam (glass) detay:** Kampanya detayında içerik, kapak üzerinde `ds-glass` panelde durur.
* **Mikro-animasyon:** `lucide-react` `Loader2` + `ds-spin`; kartlarda hover; kopyalamada `ds-toast`.
* **Mobil-öncelikli:** `ds-grid` ve toolbar küçük ekrandan büyür; admin kenar çubuğu daralır.

---

## 🧩 Üye Tarafı Bileşenleri (`components/ds/`)

| Bileşen | Görevi |
| :-- | :-- |
| [DsNav.tsx](../../src/components/ds/DsNav.tsx) | Sticky cam üst bar; TALPA logosu + **Arşiv** / **Kodlarım** linkleri. |
| [AnnouncementBar.tsx](../../src/components/ds/AnnouncementBar.tsx) | Aktif duyuruları tek satır şeritte 6 sn'de bir döndürür (hover'da durur, nokta navigasyonu). İç kampanya linki `/kampanya/:slug`, dış link yeni sekme. |
| [CampaignCardDS.tsx](../../src/components/ds/CampaignCardDS.tsx) | Grid kartı. `Tükendi`/`Son fırsat`/`Sona erdi` rozetleri; `ended` ise tıklanamaz. |
| [FeaturedHeroDS.tsx](../../src/components/ds/FeaturedHeroDS.tsx) | Öne çıkan kampanya hero'su (koyu kapak + scrim + "ÖNE ÇIKAN" rozeti + emerald CTA). |
| [Badge.tsx](../../src/components/ds/Badge.tsx) | Küçük rozet — `accent`/`danger`/`warning`/`neutral`/`info`. |
| [Button.tsx](../../src/components/ds/Button.tsx) | Buton — `primary`/`accent`/`ghost`, `block`. |

---

## 🧾 Kampanya Durumu (`status`) ve UI Davranışı

Tekil kampanya ucu (`/api/campaigns/:slug`) sunucu tarafında türetilmiş bir `status` döndürür ([lib/types.ts](../../src/lib/types.ts) `CampaignStatus`). [CampaignDetail.tsx](../../src/pages/CampaignDetail.tsx) buna göre davranır:

* `archived` / `inactive` → kullanıcı anasayfaya yönlendirilir (vitrinde olmamalı).
* `scheduled` → "Bu kampanya yakında başlayacak", form **kapalı**.
* `expired` → "Bu kampanya sona erdi", form **kapalı**.
* `sold_out` (veya `has_codes === false`) → "Dağıtılacak kod kalmamıştır", buton **kilitli** ("Tükendi").
* `is_low_stock` → "Sınırlı sayıda kod kaldı" uyarısı; buton aktif.
* `live` → normal kod alma akışı.

Grid/hero kartlarında ise `/api/campaigns` ve `/api/campaigns/archive`'in döndürdüğü `has_codes` / `is_low_stock` (ve arşivde `ended`) bayrakları kullanılır. Eşik backend ile birebir: `max(ceil(total*0.15), 25)`.

---

## 🔌 Servis Ulaşılamıyor (503) Deneyimi

Doğrulama servisi geçici çökerse backend `degil` yerine **503** döner. İstemci kullanıcıyı "üye değil" diye **kırmızı reddetmez**; nötr bilgi kutusu + **"Tekrar Dene"** gösterir:
* [CampaignDetail.tsx](../../src/pages/CampaignDetail.tsx) (kod alma) ve [MyCodes.tsx](../../src/pages/MyCodes.tsx) (sorgu): `res.status === 503` → "birkaç dakika sonra tekrar deneyin" + `RefreshCw` ile yeniden dene.

---

## 🔒 T.C. Kimlik Numarası Doğrulaması (`lib/tc.ts`)

İstek sunucuya gitmeden önce istemcide biçim/algoritma kontrolü yapılır ([src/lib/tc.ts](../../src/lib/tc.ts) — `isValidTC`). Sunucu (`server/lib/validateTc.ts`) yine bağımsız doğrular.

```typescript
export function isValidTC(tc: string): boolean {
  if (tc.length !== 11 || !/^\d+$/.test(tc) || tc[0] === '0') return false;
  const d = tc.split('').map(Number);
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];
  if ((oddSum * 7 - evenSum) % 10 !== d[9]) return false;
  const total = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return total % 10 === d[10];
}
```
* **UX:** Girişte sayısal olmayan karakterler (`/\D/g`) temizlenir, en fazla 11 hane; 11 hanede yeşil/kırmızı kenarlık ve ikon (geçerli/geçersiz) gösterilir.

---

## 🖼️ İstemci Tarafı Görsel Sıkıştırma (`imageCompress.ts`)

Yöneticinin yüklediği logo/kapak görselleri Storage'a gönderilmeden **tarayıcıda** yeniden boyutlandırılıp sıkıştırılır ([src/lib/imageCompress.ts](../../src/lib/imageCompress.ts)). `compressImage(file)` en uzun kenarı ~1600 px'e ölçekler, hedef üst boyut ~4.5 MB; PNG/WebP saydamlığını korumaya çalışır, sığmazsa beyaz arka planlı JPEG'e düşer; SVG/GIF dokunulmaz. Çıktı, signed upload URL ile doğrudan Storage'a yüklenir (bkz. [admin.md](admin.md#görsel-yükleme-logo--kapak)).

> [!NOTE]
> Veri okuma için `lib/supabase.ts` istemcisi **kullanılmaz**; o yalnızca admin auth (`signInWithPassword`, oturum/token) ve `uploadToSignedUrl` içindir. Tüm kampanya/kod verisi Express `/api` üzerinden gelir.

## Related Notes

- [[README]]
- [[admin]]
- [[codebase-structure]]
- [[api]]

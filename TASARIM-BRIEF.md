# TALPA Ayrıcalıklar — Tasarım Brief'i & Ekran Spesifikasyonu

> Harici tasarım (Figma vb.) için handoff dokümanı. Wireframe'ler **kaba yerleşim**dir; ölçü/oran değil, **içerik ve durum** rehberidir.

---

## 1. Uygulama nedir?
TALPA (havayolu pilotları camiası) üyelerine özel **kod dağıtım / ayrıcalık platformu**. Üye **T.C. kimlik numarasıyla** üyeliğini doğrular, anlaşmalı markalardan kişiye özel **indirim kodu** alır. Tek kuruluş (TALPA); kampanyalar **türlerine** göre ayrılır. Tek yönetici.

- **Üye tarafı** — herkese açık, **mobil-öncelikli** (üyeler toplu e-postadan telefonla gelir). Hesap yok; kimlik = TC.
- **Admin tarafı** — yalnız yönetici; masaüstü ağırlıklı.

## 2. Tasarım dili (öneri)
- **Modern Minimal** — açık zemin, bol beyaz alan, büyük tipografi, ince çizgiler (ağır gölge yok).
- **Renk:** zemin `#FFFFFF` / `#F6F7F9` · metin ink `#0E1726` · **tek vurgu gök mavisi `#1D4ED8`**. Semantik: başarı yeşil, hata kırmızı, uyarı amber (vurgudan ayrı).
- **Tipografi:** tek aile, net hiyerarşi. **Köşe** 12–16px · **boşluk** 8'in katları.
- **Genişlik:** içerik max ~1040px; kod/form ekranları ~600px. **Breakpoint** ~520px (mobil) / ~760px (tablet+).

## 3. Veri modeli (tasarımı etkileyen kavramlar)
- **Kampanya:** başlık · slug · açıklama · partner adı+logo · kapak · indirim etiketi · **tür** · başlangıç & bitiş tarihi · üye başına maks. kod · koşullar · aktif/öne çıkan/arşiv · kod sayıları (toplam/dağıtılan/kalan).
- **Tür:** ad + sıra.
- **Kod:** değer · durum (**Kalan** / **Dağıtılmış**) · alan TC · tarih.
- **Duyuru:** mesaj · link (kampanya/URL) · aktif · sıra.
- **Türetilen kampanya durumu:** Canlı · Yakında · Sona erdi · Tükendi · Arşiv · Pasif.

---

# A. ÜYE EKRANLARI

## Paylaşılan: duyuru şeridi + üst bar (her üye ekranında)
```
┌───────────────────────────────────────────┐
│  ▸ Yeni kampanya yakında!            • •    │ duyuru şeridi (mavi, döner; yoksa gizli)
├───────────────────────────────────────────┤
│  ✈ TALPA Ayrıcalıklar       Arşiv  Kodlarım │ üst bar (sticky, cam efekti)
└───────────────────────────────────────────┘
```
- Duyuru şeridi: birden çok aktif duyuru **6 sn'de sırayla döner**, üstüne gelince durur, noktalar (≥2). Opsiyonel link. Yoksa hiç görünmez.

---

## A1. Vitrin — `/`
**Amaç:** açık kampanyaları gez, birini seç.

### Mobil
```
┌──────────────────────────────┐
│ ▸ Duyuru                 • •  │
│ ✈ TALPA        Arşiv  Kodlarım│
├──────────────────────────────┤
│ ÜYELERE ÖZEL                 │
│ Ayrıcalıklarınız             │
│ TALPA üyeliğinize özel...    │
│                              │
│ ÖNE ÇIKAN                    │
│ ┌──────────────────────────┐ │
│ │      [kapak görseli]     │ │
│ │ 🏷%25                    │ │
│ │ Brooks Brothers          │ │
│ │ Sonbahar koleksiyonu...  │ │
│ │ 31.12.2026     Kodu Al → │ │
│ └──────────────────────────┘ │
│ [Tümü][İndirim][Hediye]…     │ ← tür sekmeleri (≥2 tür)
│                              │
│ TÜM KAMPANYALAR              │
│ [🔍 ara…………] [Sırala ▾]      │
│ ┌────────────┐ ┌───────────┐ │
│ │ [görsel]   │ │ [görsel]  │ │
│ │ %30 Son f. │ │ %20       │ │
│ │ Beymen     │ │ Network   │ │
│ │ Kodu Al →  │ │ Kodu Al → │ │
│ └────────────┘ └───────────┘ │
│ ┌──────────────────────────┐ │
│ │ Daha önce kod aldınız mı?│ │
│ │             Kodlarım →   │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```
### Masaüstü (öne çıkan yatay, ızgara 3'lü)
```
ÜYELERE ÖZEL
Ayrıcalıklarınız
────────────────────────────────────────────
ÖNE ÇIKAN
┌─────────────────────┬──────────────────────┐
│   [kapak görseli]   │ 🏷%25                 │
│                     │ Brooks Brothers       │
│                     │ Sonbahar koleksiyonu… │
│                     │ 31.12.26    Kodu Al → │
└─────────────────────┴──────────────────────┘
[Tümü][İndirim][Hediye]
TÜM KAMPANYALAR              [🔍 ara…] [Sırala ▾]
┌────────┐ ┌────────┐ ┌────────┐
│  kart  │ │  kart  │ │  kart  │
└────────┘ └────────┘ └────────┘
```
**Kart içeriği:** kapak (yoksa marka baş harfli placeholder) · indirim rozeti · stok rozeti (**Tükendi**/**Son fırsat**) · partner · başlık · 2 satır açıklama · bitiş tarihi · “Kodu Al →”.
**Sıralama:** Varsayılan / Yeni / Bitişe yakın.
**Durumlar:** Yükleniyor (iskelet kart) · normal · arama boş · hiç kampanya yok.
**Davranış:** Öne Çıkanlar yalnız “Tümü”de; tür seçilince gizlenir. Arama tüm türlerde arar.

---

## A2. Kampanya detay + kod alma — `/kampanya/:slug`
**Amaç:** TC gir → kod al. Dönüşümün kalbi; **mobilde alt-sabit CTA**.

### Form hali (mobil)
```
┌──────────────────────────────┐
│ ✈ TALPA        Arşiv  Kodlarım│
│ ← Kampanyalar                │
│ ┌──────────────────────────┐ │
│ │      [kapak görseli]     │ │
│ └──────────────────────────┘ │
│      ✈ TALPA  |  [partner]   │
│   Sonbahar koleksiyonunda…   │
│   Seçili takım elbiselerde…  │
│         🏷 %25 indirim        │
│                              │
│  T.C. Kimlik Numarası        │
│  ┌────────────────────┐  ✓   │
│  │ 12345678901      × │      │
│  └────────────────────┘      │
│  ┌──────────────────────────┐│
│  │ ℹ Kampanya Koşulları     ││
│  │ …                        ││
│  └──────────────────────────┘│
│ ════════════════════════════ │
│  [ 🎁 Kodumu Al ]   ← sticky  │
└──────────────────────────────┘
```
**TC alanı:** 11 hane, sadece rakam, anlık ✓/✗, temizle (×).

### Tüm durumlar (her biri çizilmeli)
```
BAŞARILI                         DAHA ÖNCE ALINMIŞ / LİMİT
┌──────────────────────────┐     ┌──────────────────────────┐
│ ✅ Üyeliğiniz doğrulandı. │     │ 🕘 Daha önce kod almışsınız│
│    Kodunuz hazır!        │     │ ┌──────────────────────┐ │
│ ┌──────────────────────┐ │     │ │ KODUNUZ  …  [Kopyala] │ │
│ │ KODUNUZ              │ │     │ └──────────────────────┘ │
│ │ TALPA25-XYZ [Kopyala]│ │     └──────────────────────────┘
│ └──────────────────────┘ │
│ [ Tüm kodlarım → ]       │     503 SERVİS YOK
│   Ana sayfaya dön        │     ┌──────────────────────────┐
└──────────────────────────┘     │ ⚠ Servise ulaşılamıyor… │
                                 │   [ ↻ Tekrar Dene ]      │
YAKINDA / SONA ERDİ / TÜKENDİ    └──────────────────────────┘
┌──────────────────────────┐
│ 🕐 Yakında başlayacak …  │  (form yok / kilitli; duruma göre amber/mavi/kırmızı)
└──────────────────────────┘
```
**Kopya toast:** “Kod panoya kopyalandı!” (alt-orta, 2 sn).
**Yönlendirme:** arşiv/pasif kampanyaya gelinirse → vitrine.

---

## A3. Kodlarım — `/kodlarim`
**Amaç:** alınan tüm kodlar tek yerde. TC her seferinde girilir, **saklanmaz**.
```
┌──────────────────────────────┐
│ ✈ TALPA        Arşiv  Kodlarım│
│ Kodlarım                     │
│ TC ile aldığınız kodları…    │
│  T.C. Kimlik Numarası        │
│  ┌────────────────────┐  ✓   │
│  │ 12345678901      × │      │
│  └────────────────────┘      │
│  [ 🔍 Sorgula ]              │
│ ──────────────────────────── │
│ ┌──────────────────────────┐ │
│ │ Brooks Brothers          │ │
│ │ TALPA25-XYZ    [Kopyala] │ │
│ │ 02.06.2026               │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Beymen …                 │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```
**Liste:** düz, **yeni önce**. **Sade kart:** başlık + kod + Kopyala + tarih (rozet/görsel/link yok).
**Durumlar:** form · sorgulanıyor · liste · boş (“daha önce kod almadınız”) · 503 Tekrar Dene · hata. Detaydan TC **ön-dolu** gelirse otomatik sorgular.

---

## A4. Arşiv — `/arsiv`
**Amaç:** süresi geçmiş + arşivlenmiş kampanyalar (salt-görüntüleme).
```
│ Arşiv                        │
│ Süresi geçmiş/arşiv…          │
│ ┌────────┐ ┌────────┐        │
│ │ görsel │ │ görsel │        │
│ │ 🏷%25  │ │ 🏷%30  │        │
│ │Sona erdi│ │Sona erdi│       │  (tıklanamaz, stok gizli)
│ └────────┘ └────────┘        │
```
**Liste:** düz, yeni biten önce. **Durumlar:** yükleniyor · ızgara · boş.

---

# B. ADMIN EKRANLARI

## B0. Giriş — `/admin` (oturum yoksa)
```
        ┌──────────────────────┐
        │         🛡           │
        │   Yönetici Girişi    │
        │ ┌──────────────────┐ │
        │ │ E-posta          │ │
        │ └──────────────────┘ │
        │ ┌──────────────────┐ │
        │ │ Şifre         👁 │ │
        │ └──────────────────┘ │
        │ [    Giriş Yap    ]  │
        └──────────────────────┘
```
**Durum:** hata (yanlış şifre / “yönetici yetkisi yok”).

## Admin kabuğu (sol menü; mobilde ☰ çekmece)
```
┌────────────┬───────────────────────────────┐
│ ✈ TALPA    │ Genel Bakış          e@mail ⎋ │
│ ─────────  │ ┌───────────────────────────┐ │
│ ▸Genel Bk. │ │   (aktif ekran içeriği)   │ │
│  Kampanyal.│ │                           │ │
│  Türler    │ │                           │ │
│  Duyurular │ │                           │ │
│  Ayarlar   │ └───────────────────────────┘ │
└────────────┴───────────────────────────────┘
```

## B1. Genel Bakış
```
Genel Bakış                          [↻ Yenile]
┌────────────────────────────────────────────┐
│ ● Her şey yolunda          [ Şimdi test et ]│
│ ┌─Servis───┐ ┌─Nabız────┐ ┌─Stok─────────┐ │
│ │ Çalışıyor │ │ 5 dk önce│ │ Brooks ▓▓▓░  │ │
│ │ 0 hata/30d│ │ bugün 12 │ │   120 kaldı  │ │
│ └──────────┘ └──────────┘ │ Beymen ▓░ 25 │ │
│                           └──────────────┘ │
└────────────────────────────────────────────┘
┌─────────┐┌─────────┐┌─────────┐┌─────────┐
│Kampanya ││  Kod    ││Dağıtılan││  Kalan  │
│   3     ││  5006   ││   12    ││  4994   │
└─────────┘└─────────┘└─────────┘└─────────┘
```
**Ana ışık:** 🟢 yolunda · 🟡 dikkat (servis aralıklı hata **veya** stok az/bitti) · 🔴 **yalnız** dış servis çökükse. Otomatik yenileme (veri 25sn / servis 60sn; sekme gizliyken durur).

## B2. Kampanyalar (liste)
```
Kampanyalar                       [ + Yeni Kampanya ]
[🔍 ara…]   [Tür: Tümü ▾]   [Durum: Tümü ▾]
┌──────────────────────────────────────────────┐
│ Brooks Brothers 2026        /brooks-brothers  │
│ İndirim Kodu · ● Canlı                        │
│ Top 5006 · Dağ 12 · Kalan 4994                │
│ [Aktif ✓] [Öne çıkan ✓]   Düzenle Klonla Sil  │
├──────────────────────────────────────────────┤
│ Beymen …   ○ Pasif …                          │
└──────────────────────────────────────────────┘
```
**Filtre:** tür + durum (Canlı/Zamanlanmış/Süresi geçti/Arşiv/Pasif) + arama.
**Durumlar:** boş · yükleniyor · liste.

### Yeni Kampanya (modal)
```
┌─ Yeni Kampanya ─────────────────────  × ┐
│ Başlık*    [............................]│
│ Slug*      [............................]│
│ Tür*       [ İndirim Kodu            ▾ ] │
│ İndirim*   [ %25 indirim ]               │
│ Partner    [ Brooks Brothers ]           │
│ Açıklama   [ ........................... ]│
│ Logo       [ url ........ ] [ Yükle ]    │
│ Kapak      [ url ........ ] [ Yükle ]    │
│ Başlangıç  [____-__-__]  Bitiş [____-__-__]│
│ Maks kod   [ 1 ]                         │
│ Koşullar   [ ........................... ]│
│              [ İptal ]     [ Oluştur ]   │
└──────────────────────────────────────────┘
```
**Klonla:** onay → pasif kopya (yeni slug, kodlar hariç). **Sil:** **yaz-onay** (kalıcı; kod+talep gider).

## B3. Kampanya detayı
```
← Kampanyalar
Brooks Brothers 2026   ● Canlı     [Klonla] [Arşivle] [Sil]
┌─ Düzenle ───────────────┐ ┌─ Kod Yükleme ────────────┐
│ Başlık  [.............] │ │ [ Excel/CSV seç ]        │
│ Tür     [ İndirim ▾ ]  │ │ 1500 kod tespit edildi   │
│ İndirim [...........]  │ │ [Kodları Yükle] [CSV ⬇]  │
│ Başl.[__] Bitiş[__]    │ │ Toplam 5006 ▓░ %0.2 kull.│
│ Aktif◉ Öne◉ Arşiv○     │ └──────────────────────────┘
│ Koşullar [..........]  │
│ [ Kaydet ]             │
└────────────────────────┘
┌─ Kod Havuzu ───────────────────────  [🔍 ara] ┐
│ ☐ KOD           DURUM       TC      TARİH      │
│ ☐ TALPA25-AAA   Kalan       —       —      [🗑]│
│   TALPA25-BBB   Dağıtıldı   123…    02.06  (🔒)│
│ ☐ TALPA25-CCC   Kalan       —       —    [✎][🗑]│
│ [ + Tek kod ekle ]        [ Seçili sil (toplu) ]│
│ ‹ 1 2 3 … ›   sayfalama                         │
└────────────────────────────────────────────────┘
┌─ TC Sorgu ───────┐  ┌─ DB Önizleme (son 20) ──┐
│ [ TC… ] Sorgula  │  │ Kodlar / Talepler …     │
└──────────────────┘  └─────────────────────────┘
```
**Kod havuzu:** arama + sayfalama. **Yalnız “Kalan” kodlarda:** tek sil · toplu seç&sil · tek ekle · değer düzelt. **Dağıtılmış kodlar 🔒 salt-okunur.**

## B4. Türler
```
Türler                              [ + Yeni Tür ]
┌──────────────────────────────────────────────┐
│ ⠿ İndirim Kodu        sıra 0      [ ✎ ] [ 🗑 ]│
│ ⠿ Hediye Çeki         sıra 1      [ ✎ ] [ 🗑 ]│
└──────────────────────────────────────────────┘
ⓘ Kullanımdaki tür silinemez → "önce kampanyaları taşıyın".
```
Alanlar: **ad + sıra** (ikon/renk yok). Sürükle (⠿) ile sırala. Tür **zorunlu**.

## B5. Duyurular
```
Duyurular                         [ + Yeni Duyuru ]
┌──────────────────────────────────────────────┐
│ ⠿ "Yeni kampanya yakında!"                    │
│   link: /kampanya/brooks…   [Aktif ✓][✎][🗑]  │
│ ⠿ "Bakım 22:00-23:00"       [Aktif ○][✎][🗑]  │
└──────────────────────────────────────────────┘
Düzenle: mesaj + (kampanya seç ▾ / URL) + aktif + sıra.
```

## B6. Ayarlar
```
Ayarlar
┌─ Tehlikeli Alan ──────────────────────────────┐
│ Sistemi Sıfırla                                │
│ Tüm kod ve talep kayıtları silinir             │
│ (kampanya & tür şablonları korunur).           │
│ Onaylamak için  SIFIRLA  yazın:                │
│ [____________]                 [ Sıfırla ]     │
└────────────────────────────────────────────────┘
Hesap: e@mail                          [ Çıkış ]
```

---

# C. Global durumlar & bileşenler (her ekranda lazım)
- **Yükleniyor** (iskelet/spinner) · **Boş** · **Hata** kalıpları.
- **Onay modali** (sil/sıfırla/arşivle) — **yaz-onay** varyantı dahil.
- **Toast/bildirim** (kaydedildi / kopyalandı / hata).
- **401/403** (oturum bitti / yetki yok) → girişe.
- **503** (doğrulama servisi yok) → nötr “Tekrar Dene”.

---

# D. Akış şemaları

### Üye akışı
```
E-posta ─▶ Vitrin ─▶ (tür seç / ara) ─▶ Kampanya kartı ─▶ Detay
                                                           │
                          ┌────────────── TC gir + Doğrula ─┤
                          ▼                                 │
            ┌─ Başarılı ─▶ Kod + Kopyala ─▶ (Tüm kodlarım)  │
            ├─ Daha önce / limit ─▶ mevcut kod              │
            ├─ Tükendi / Yakında / Sona erdi ─▶ bilgi       │
            └─ 503 ─▶ Tekrar Dene ──────────────────────────┘

Üst bar ─▶ Kodlarım ─▶ TC ─▶ kod listesi
Üst bar ─▶ Arşiv ─▶ geçmiş kampanyalar (tıklanamaz)
```

### Admin akışı
```
/admin ─▶ Giriş ─▶ Genel Bakış
   ├─ Kampanyalar ─▶ Yeni | Düzenle(Detay) | Klonla | Arşivle | Sil
   │     └─ Detay ─▶ kod yükle | kod havuzu yönet | TC sorgu | önizleme
   ├─ Türler ─▶ ekle | düzenle | sil(engel)
   ├─ Duyurular ─▶ ekle | düzenle | aktif/pasif
   └─ Ayarlar ─▶ Sistemi Sıfırla (yaz-onay)
```

---

# E. Ekran sayımı (tasarlanacaklar)
**Üye (4 ekran + 2 paylaşılan öğe):** Vitrin · Kampanya detay (≈8 durum) · Kodlarım · Arşiv · (duyuru şeridi, üst bar).
**Admin (7 ana + diyaloglar):** Giriş · Genel Bakış · Kampanyalar · Kampanya detayı · Türler · Duyurular · Ayarlar · (Yeni kampanya, Klonla/Sil onay, TC sorgu, kod ekle/düzelt, tür/duyuru ekle-düzenle).
**Global:** yükleniyor/boş/hata, onay modali, toast.

> Üye tarafının 4 ekranı kodda **çalışır durumda** (canlı referans). Admin tarafı henüz eski tasarımda.

# Sistem Mimarisi ve Kod Dağıtım Akışı

**Summary**: TALPA Kampanyaları uygulamasının üç katmanlı sistem mimarisi, kod dağıtım/talep iş akışı (claim flow) ve optimistik kilit tabanlı eşzamanlılık kontrolü.
**Tags**: #architecture #claim-flow #concurrency #cas #talpa
**Created**: 2026-05-26T12:35:00+03:00
**Last Updated**: 2026-05-26T12:35:00+03:00

---

## Content

Sistem, **React SPA** (Single Page Application) istemcisi, **Express** API katmanı ve **Supabase (PostgreSQL)** veri katmanından oluşan üç katmanlı bir yapıya sahiptir. Güvenlik kuralları gereği, tüm yazma ve veri güncelleme operasyonları sunucu tarafında (Express) korumalı olarak yürütülür.

---

## 🏗️ Genel Mimari Yapı

```mermaid
graph TD
    subgraph Frontend [React SPA - Vite]
        UI[Kullanıcı Arayüzü]
        Admin[Yönetici Paneli]
    end

    subgraph Backend [Express 5 - Vercel Serverless]
        API[API Router]
        Auth[Supabase Auth Middleware]
        Verify[Member Verify Servisi]
    end

    subgraph Database [Supabase PostgreSQL]
        DB[(PostgreSQL Tabloları)]
        Storage[Storage - Görseller]
    end

    subgraph External [Dış Servis]
        MemberAPI[TALPA Üye API]
    end

    UI -->|GET /api/campaigns| API
    UI -->|POST /api/claim-code| API
    Admin -->|Bearer Auth & API| API
    API -->|Üyelik Sorgula| Verify
    Verify -->|HTTPS POST| MemberAPI
    API -->|Sadece Okuma / Yazma| DB
    API -->|Görsel Yükleme| Storage
```

---

## 🔑 Kod Dağıtım ve Alma Akışı (Claim Flow)

Sistemdeki en kritik iş mantığı, bir üyenin bir kampanyadan indirim kodu talep etmesidir (`POST /api/claim-code`). Birden fazla kullanıcının aynı anda kod talep etmesi durumunda yarış durumlarını (race condition) önlemek ve dernek aidat kurallarını uygulamak için aşağıdaki adımlar takip edilir:

```mermaid
sequenceDiagram
    autonumber
    actor Uye as TALPA Üyesi
    participant Client as React İstemci
    participant Server as Express Sunucu
    participant MemberAPI as TALPA Üye API
    participant DB as Supabase DB

    Uye->>Client: TCKN girer ve "Kod Al" butonuna basar
    Client->>Server: POST /api/claim-code { tc_no, campaign_slug }
    
    rect rgb(20, 30, 50)
        Note over Server, DB: 1. Kampanya Kontrolü
        Server->>DB: Kampanyayı slug ile çek (is_active, valid_until, max_codes_per_user)
        DB-->>Server: Kampanya Detayları
        alt Kampanya Yok veya Aktif Değil veya Süresi Geçmiş
            Server-->>Client: 404 / 400 Hata Mesajı
        end
    end

    rect rgb(20, 50, 30)
        Note over Server, MemberAPI: 2. Üyelik & Borç Kontrolü
        Server->>MemberAPI: verifyMember(tcNo, campaignSlug)
        MemberAPI-->>Server: Durum ('uye' | 'borclu' | 'degil')
        alt Durum: 'borclu'
            Server-->>Client: 403 "Aidat borçları sebebiyle kampanya katılımınız sınırlandırılmıştır."
        else Durum: 'degil'
            Server-->>Client: 403 "TALPA üyelik kaydınıza ulaşılamamıştır."
        end
    end

    rect rgb(20, 30, 50)
        Note over Server, DB: 3. Limit Kontrolü
        Server->>DB: claimed_by_tc = TCKN olan kodları getir
        DB-->>Server: Alınan Kod Listesi
        alt Alınan Kod Sayısı >= max_codes_per_user
            Server-->>Client: 200 { alreadyClaimed: true, codes }
        end
    end

    rect rgb(50, 40, 20)
        Note over Server, DB: 4. Kod Tahsisi & Kilit
        Server->>DB: is_used = false olan ilk kodu seç
        DB-->>Server: Seçilen Kod Satırı (id, code)
        alt Dağıtılacak Kod Kalmadıysa
            Server-->>Client: 404 "Bu kampanyada dağıtılacak kod kalmamıştır."
        end
        Server->>DB: UPDATE campaign_codes SET is_used=true, claimed_by_tc=TCKN WHERE id=kod_id AND is_used=false
        DB-->>Server: Güncellenen Kod (Varsa)
        alt Optimistik Kilit Çakışması (Kod başkası tarafından alındıysa)
            Server-->>Client: 409 "Kod alınırken çakışma oluştu, lütfen tekrar deneyin."
        end
    end

    rect rgb(20, 30, 50)
        Note over Server, DB: 5. Talep Kaydı
        Server->>DB: campaign_claims tablosuna yeni satır insert et (campaign_id, tc_no)
        DB-->>Server: Insert Başarılı (Unique Constraint korumalı)
    end

    Server-->>Client: 200 { alreadyClaimed: false, code, limitReached }
    Client->>Uye: Başarı animasyonu ile kodu gösterir & kopyalama seçeneği sunar
```

---

## 🔒 Eşzamanlılık Kontrolü: Atomik Tahsis (Postgres RPC)

Aynı anda yüzlerce üyenin indirim kodu almaya çalıştığı pik zamanlarda iki risk vardır:
1. Aynı kodun **iki farklı üyeye** tahsis edilmesi.
2. **Aynı üyenin** eşzamanlı isteklerle `max_codes_per_user` limitini aşması (örn. çift tıklama).

Eski sürümde yalnızca uygulama katmanında Compare-And-Swap (CAS) kullanılıyordu; bu (1)'i çözüyor ama (2)'yi çözmüyordu — limit kontrolü ile tahsis arasındaki yarış nedeniyle bir üye birden fazla kod alabiliyordu. Bu yüzden tüm tahsis mantığı **tek bir PostgreSQL fonksiyonuna** (`public.claim_campaign_code`) taşınmıştır. Fonksiyon tek bir transaction içinde çalışır:

```sql
-- 1) Aynı (kampanya, üye) için eşzamanlı çağrıları serileştir
perform pg_advisory_xact_lock(hashtextextended(p_campaign_id::text || ':' || p_tc_no, 0));

-- 2) Üyenin mevcut kodlarını say; limit doluysa mevcut kodları döndür
-- 3) Boş bir kodu çekişmesiz kilitle (farklı üyeler farklı satır alır)
select id, code from campaign_codes
  where campaign_id = p_campaign_id and is_used = false
  order by id for update skip locked limit 1;

-- 4) Kodu işaretle ve claim kaydını yaz (on conflict do nothing)
```

### Neden Güvenli?
* **`pg_advisory_xact_lock`** aynı üye + kampanya için gelen istekleri **seri** hale getirir; böylece limit sayımı ile tahsis arasındaki yarış tamamen kapanır (bir üye limitten fazla kod alamaz).
* **`FOR UPDATE SKIP LOCKED`** farklı üyelerin aynı kod satırı için kilitlenmesini önler — her istek boştaki bir sonraki kodu alır, kimse beklemez ve aynı kod iki kez verilmez.
* Limit kontrolü, kod tahsisi ve `campaign_claims` kaydı **aynı transaction'da atomiktir**; ara bir hata olursa hepsi geri alınır (eski sürümdeki "sessizce yutulan claim insert" sorunu da ortadan kalkar).

Express tarafı (`claim.ts`) yalnızca kampanya/üyelik kontrollerini yapıp fonksiyonu çağırır ve dönen `status` değerine göre yanıt üretir:
```typescript
const { data: rpcData } = await supabaseAdmin.rpc('claim_campaign_code', {
  p_campaign_id: campaign.id,
  p_tc_no: tc_no,
  p_max_codes: maxCodes,
});
// status: 'claimed' | 'already_claimed' | 'no_codes'
```

> [!NOTE]
> Fonksiyon `SECURITY INVOKER` (varsayılan) çalışır ve `anon`/`authenticated` rollerinden `EXECUTE` yetkisi alınmıştır. Yalnızca backend `service_role` ile çağrılır.

---

## 🛡️ Hata ve Olağanüstü Durum Yönetimi

1. **TALPA API Ağ Hataları:** Üye doğrulama API'si çökerse veya ağ hatası alınırsa, sistem üyenin haklarını korumak için hata logu yazar ve `"degil"` yanıtı döndürerek güvenlik tarafında kalır. API geçici olarak aşırı yüklenirse (429 Rate Limit), arka planda üstel geri çekilme (exponential backoff) ile 3 defaya kadar yeniden deneme (retry) gerçekleştirir.
2. **Atomik Tutarlılık:** Kod tahsisi ve `campaign_claims` kaydı artık `claim_campaign_code` fonksiyonu içinde **aynı transaction'da** yapılır. Herhangi bir adım başarısız olursa transaction tamamen geri alınır; bu nedenle "kod işaretlendi ama claim yazılamadı" gibi yarım durumlar oluşmaz. Bir üye limitine ulaşmışsa fonksiyon yeni kod üretmeden mevcut kodlarını (`already_claimed`) döndürür.
3. **Hız Sınırı (Rate Limit):** `/api/claim-code` ve `/api/my-codes` uç noktaları IP başına dakikada 10 istekle sınırlıdır (`express-rate-limit`). Bu, T.C. enumerasyonunu ve dış üye API'sinin kötüye kullanılmasını zorlaştırır. Aşıldığında **429** döner.
4. **Sunucu Tarafı T.C. Doğrulaması:** İstemci doğrulamasına güvenilmez; `tc_no` sunucuda da algoritmik olarak doğrulanır (`server/lib/validateTc.ts`), geçersizse **400** döner.

## Related Notes

- [[README]]
- [[api]]
- [[database]]
- [[member-verification]]

import { useEffect, useState } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle, History, RefreshCw, Loader2 } from 'lucide-react';

// ─── Tipler ───────────────────────────────────────────────────────────────────

type HealthCampaign = {
  id: string;
  slug: string;
  title: string;
  is_active: boolean;
  total: number;
  used: number;
  remaining: number;
  status: 'no_codes' | 'out' | 'low' | 'ok';
};

type HealthData = {
  now: string;
  verifyFailures: { last30m: number; lastAt: string | null };
  pulse: { lastClaimAt: string | null; todayCount: number };
  campaigns: HealthCampaign[];
};

const REFRESH_MS = 25000;
const PROBE_REFRESH_MS = 60000; // dış servis yoklaması daha seyrek (talpa-uye'yi dövmemek için)

// Aktif servis yoklamasının (probe) sonucu.
type PingResult = {
  ok: boolean;
  status: number | null;
  ms: number;
  detail?: string;
};

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'kayıt yok';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'az önce';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  return `${Math.floor(hr / 24)} gün önce`;
}

const SEVERITY: Record<HealthCampaign['status'], number> = { out: 0, no_codes: 1, low: 2, ok: 3 };

const COLORS = {
  green: 'var(--accent)',
  yellow: '#f59e0b',
  red: 'var(--danger)',
  muted: 'var(--text-muted)',
};

// ─── Alt bileşenler ───────────────────────────────────────────────────────────

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}`,
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  );
}

function PanelBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(15,23,42,0.5)',
        border: '1px solid var(--border-color)',
        borderRadius: '0.75rem',
        padding: '1rem 1.1rem',
      }}
    >
      {children}
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function SystemHealth({
  getAuthHeaders,
}: {
  getAuthHeaders: () => Promise<Record<string, string>>;
}) {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [probe, setProbe] = useState<PingResult | null>(null);
  const [probing, setProbing] = useState(false);

  // getAuthHeaders her zaman canlı oturum token'ını okuduğundan, efektin mount'ta
  // yakaladığı kapanış güncel kalır; ekstra bir ref'e gerek yok.
  async function load() {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/health', { headers });
      if (!res.ok) {
        setError(true);
        return;
      }
      const d = (await res.json()) as HealthData;
      setData(d);
      setError(false);
      setLastUpdated(new Date());
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    // İlk yükleme dahil tüm çağrılar callback içinde (efekt gövdesinde senkron
    // setState yok) — setTimeout(0) ile mount'ta hemen bir kez çek.
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, REFRESH_MS);
    const onVis = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aktif servis yoklaması — dış üye doğrulama servisini /health üzerinden yoklar.
  async function runProbe() {
    setProbing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/health/probe', { headers });
      if (!res.ok) {
        setProbe({ ok: false, status: res.status, ms: 0 });
        return;
      }
      const d = (await res.json()) as PingResult;
      setProbe(d);
    } catch {
      setProbe({ ok: false, status: null, ms: 0, detail: 'network' });
    } finally {
      setProbing(false);
    }
  }

  useEffect(() => {
    // Yoklama veri yenilemesinden daha seyrek; tüm çağrılar callback içinde.
    const initial = window.setTimeout(() => void runProbe(), 0);
    const timer = window.setInterval(() => {
      if (!document.hidden) void runProbe();
    }, PROBE_REFRESH_MS);
    const onVis = () => {
      if (!document.hidden) void runProbe();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // İlk yükleme
  if (!data) {
    return (
      <div className="action-card" style={{ marginBottom: '1.5rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: COLORS.muted }}>
        {error ? (
          <>
            <AlertCircle size={18} /> Sağlık verisi alınamadı.
            <button className="btn" style={{ width: 'auto', marginLeft: 'auto', padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => void load()}>
              Tekrar Dene
            </button>
          </>
        ) : (
          <>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Sağlık verisi yükleniyor…
          </>
        )}
      </div>
    );
  }

  // Servis seviyesi: önce aktif yoklama (probe), yoksa/404 ise pasif hata sayısına düş.
  const failures = data.verifyFailures.last30m;
  let svc: 'ok' | 'warn' | 'down' | 'unknown';
  let svcMsg: string;
  if (probe?.ok) {
    svc = failures >= 1 ? 'warn' : 'ok';
    svcMsg = `Çalışıyor · ${probe.ms} ms`;
  } else if (probe && probe.status === 404) {
    // /health henüz yayında değil (talpa-uye deploy bekliyor) — yanlış kırmızı verme.
    svc = failures >= 10 ? 'down' : failures >= 1 ? 'warn' : 'unknown';
    svcMsg = 'Sağlık ucu yayında değil (talpa-uye deploy bekliyor)';
  } else if (probe) {
    svc = 'down';
    svcMsg = `Yanıt vermiyor${probe.detail ? ` (${probe.detail})` : ''}`;
  } else {
    svc = failures >= 10 ? 'down' : failures >= 1 ? 'warn' : 'unknown';
    svcMsg = 'Yoklanıyor…';
  }
  const activeCampaigns = data.campaigns.filter((c) => c.is_active);
  const stockIssues = activeCampaigns.filter((c) => c.status !== 'ok');
  const sortedStock = [...activeCampaigns].sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status]);

  // Ana ışık: kırmızı = SADECE servis çökük; stok sorunları sarı kalır.
  const master: 'green' | 'yellow' | 'red' =
    svc === 'down' ? 'red' : svc === 'warn' || stockIssues.length > 0 ? 'yellow' : 'green';

  const masterText = master === 'green' ? 'Her şey yolunda' : master === 'yellow' ? 'Dikkat gerekiyor' : 'Servis sorunu';
  const svcColor =
    svc === 'ok' ? COLORS.green : svc === 'warn' ? COLORS.yellow : svc === 'down' ? COLORS.red : COLORS.muted;

  return (
    <div
      style={{
        marginBottom: '1.5rem',
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${master === 'red' ? 'rgba(239,68,68,0.4)' : 'var(--border-color)'}`,
        borderRadius: '0.875rem',
        padding: '1.25rem',
      }}
    >
      {/* Başlık + ana ışık */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.1rem', flexWrap: 'wrap' }}>
        <Dot color={COLORS[master]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '1rem' }}>
          Sistem Sağlığı
          <span style={{ color: COLORS[master], fontWeight: 600 }}>· {masterText}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.72rem', color: COLORS.muted }}>
              Güncelleme: {lastUpdated.toLocaleTimeString('tr-TR')}
            </span>
          )}
          <button
            onClick={() => void load()}
            title="Yenile"
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: '0.4rem',
              color: COLORS.muted,
              padding: '0.35rem 0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {/* Panel 1 — Üye Doğrulama Servisi */}
        <PanelBox>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <ShieldCheck size={16} style={{ color: svcColor }} />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Üye Doğrulama Servisi</span>
            <Dot color={svcColor} />
          </div>
          <div style={{ fontSize: '0.8rem', color: svcColor, fontWeight: 600 }}>{svcMsg}</div>
          <div style={{ fontSize: '0.72rem', color: COLORS.muted, marginTop: '0.35rem' }}>
            {failures === 0
              ? 'Son 30 dk: servis hatası yok'
              : `Son 30 dk'da ${failures} servis hatası${data.verifyFailures.lastAt ? ` · ${timeAgo(data.verifyFailures.lastAt)}` : ''}`}
          </div>
          <button
            onClick={() => void runProbe()}
            disabled={probing}
            style={{
              marginTop: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: '0.4rem',
              color: 'var(--text-main)',
              padding: '0.35rem 0.7rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: probing ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {probing ? (
              <>
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Test ediliyor…
              </>
            ) : (
              <>
                <RefreshCw size={13} /> Şimdi test et
              </>
            )}
          </button>
        </PanelBox>

        {/* Panel 2 — Sistem Nabzı */}
        <PanelBox>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <History size={16} style={{ color: COLORS.muted }} />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sistem Nabzı</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
            Son kod: <strong>{timeAgo(data.pulse.lastClaimAt)}</strong>
          </div>
          <div style={{ fontSize: '0.8rem', color: COLORS.muted, marginTop: '0.35rem' }}>
            Bugün dağıtılan: <strong style={{ color: 'var(--text-main)' }}>{data.pulse.todayCount}</strong> kod
          </div>
        </PanelBox>

        {/* Panel 3 — Stok Durumu */}
        <PanelBox>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            {stockIssues.length === 0 ? (
              <CheckCircle size={16} style={{ color: COLORS.green }} />
            ) : (
              <AlertCircle size={16} style={{ color: COLORS.yellow }} />
            )}
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Stok Durumu</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: COLORS.muted }}>
              {activeCampaigns.length} aktif kampanya
            </span>
          </div>
          {sortedStock.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: COLORS.muted }}>Aktif kampanya yok.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
              {sortedStock.slice(0, 8).map((c) => {
                const pct = c.total > 0 ? Math.round((c.used / c.total) * 100) : 0;
                const color =
                  c.status === 'out' ? COLORS.red : c.status === 'low' ? COLORS.yellow : c.status === 'no_codes' ? COLORS.muted : COLORS.green;
                const label =
                  c.status === 'out' ? 'TÜKENDİ' : c.status === 'no_codes' ? 'KOD YOK' : `${c.remaining} kaldı`;
                return (
                  <div key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.74rem', marginBottom: '0.2rem' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                      <span style={{ color, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
                    </div>
                    <div style={{ backgroundColor: 'var(--border-color)', borderRadius: '999px', height: '5px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.total > 0 ? pct : 0}%`, backgroundColor: color, borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
              {sortedStock.length > 8 && (
                <div style={{ fontSize: '0.7rem', color: COLORS.muted, textAlign: 'center', marginTop: '0.2rem' }}>
                  +{sortedStock.length - 8} kampanya daha
                </div>
              )}
            </div>
          )}
        </PanelBox>
      </div>
    </div>
  );
}

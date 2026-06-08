import { useEffect, useState } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle, History, RefreshCw, Loader2 } from 'lucide-react';
import { useAdmin } from './ctx';

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

type PingResult = { ok: boolean; status: number | null; ms: number; detail?: string };

const REFRESH_MS = 25000;
const PROBE_REFRESH_MS = 60000;

const C = {
  green: 'var(--ds-success)',
  yellow: 'var(--ds-warning)',
  red: 'var(--ds-danger)',
  muted: 'var(--ds-ink-faint)',
};

const SEVERITY: Record<HealthCampaign['status'], number> = { out: 0, no_codes: 1, low: 2, ok: 3 };

const panelStyle: React.CSSProperties = {
  background: 'var(--ds-bg-subtle)',
  border: '1px solid var(--ds-border)',
  borderRadius: 'var(--ds-r)',
  padding: '0.9rem 1rem',
};

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

function Dot({ color }: { color: string }) {
  return <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

export default function SystemHealthDS() {
  const { getAuthHeaders } = useAdmin();
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [probe, setProbe] = useState<PingResult | null>(null);
  const [probing, setProbing] = useState(false);

  async function load() {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/health', { headers });
      if (!res.ok) {
        setError(true);
        return;
      }
      setData((await res.json()) as HealthData);
      setError(false);
      setLastUpdated(new Date());
    } catch {
      setError(true);
    }
  }

  async function runProbe() {
    setProbing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/health/probe', { headers });
      if (!res.ok) {
        setProbe({ ok: false, status: res.status, ms: 0 });
        return;
      }
      setProbe((await res.json()) as PingResult);
    } catch {
      setProbe({ ok: false, status: null, ms: 0, detail: 'network' });
    } finally {
      setProbing(false);
    }
  }

  useEffect(() => {
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

  useEffect(() => {
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

  if (!data) {
    return (
      <div className="ds-card2" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: C.muted }}>
        {error ? (
          <>
            <AlertCircle size={18} /> Sağlık verisi alınamadı.
            <button type="button" className="ds-btn ds-btn--ghost" style={{ marginLeft: 'auto' }} onClick={() => void load()}>Tekrar Dene</button>
          </>
        ) : (
          <>
            <Loader2 size={18} className="ds-spin" /> Sağlık verisi yükleniyor…
          </>
        )}
      </div>
    );
  }

  const failures = data.verifyFailures.last30m;
  let svc: 'ok' | 'warn' | 'down' | 'unknown';
  let svcMsg: string;
  if (probe?.ok) {
    svc = failures >= 1 ? 'warn' : 'ok';
    svcMsg = `Çalışıyor · ${probe.ms} ms`;
  } else if (probe && probe.status === 404) {
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

  const master: 'green' | 'yellow' | 'red' =
    svc === 'down' ? 'red' : svc === 'warn' || stockIssues.length > 0 ? 'yellow' : 'green';
  const masterText = master === 'green' ? 'Her şey yolunda' : master === 'yellow' ? 'Dikkat gerekiyor' : 'Servis sorunu';
  const svcColor = svc === 'ok' ? C.green : svc === 'warn' ? C.yellow : svc === 'down' ? C.red : C.muted;

  return (
    <div className="ds-card2" style={{ marginBottom: '1.25rem', borderColor: master === 'red' ? '#f0c8c4' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <Dot color={C[master]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '1rem' }}>
          Sistem Sağlığı
          <span style={{ color: C[master], fontWeight: 600 }}>· {masterText}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastUpdated && <span style={{ fontSize: '0.72rem', color: C.muted }}>Güncelleme: {lastUpdated.toLocaleTimeString('tr-TR')}</span>}
          <button type="button" className="ds-iconbtn" title="Yenile" onClick={() => void load()}><RefreshCw size={15} /></button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* Panel 1 — Üye Doğrulama Servisi */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <ShieldCheck size={16} style={{ color: svcColor }} />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Üye Doğrulama Servisi</span>
            <Dot color={svcColor} />
          </div>
          <div style={{ fontSize: '0.8rem', color: svcColor, fontWeight: 600 }}>{svcMsg}</div>
          <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: '0.35rem' }}>
            {failures === 0
              ? 'Son 30 dk: servis hatası yok'
              : `Son 30 dk'da ${failures} servis hatası${data.verifyFailures.lastAt ? ` · ${timeAgo(data.verifyFailures.lastAt)}` : ''}`}
          </div>
          <button type="button" className="ds-toggle" style={{ marginTop: '0.6rem' }} disabled={probing} onClick={() => void runProbe()}>
            {probing ? <><Loader2 size={13} className="ds-spin" /> Test ediliyor…</> : <><RefreshCw size={13} /> Şimdi test et</>}
          </button>
        </div>

        {/* Panel 2 — Sistem Nabzı */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <History size={16} style={{ color: C.muted }} />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sistem Nabzı</span>
          </div>
          <div style={{ fontSize: '0.8rem' }}>Son kod: <strong>{timeAgo(data.pulse.lastClaimAt)}</strong></div>
          <div style={{ fontSize: '0.8rem', color: C.muted, marginTop: '0.35rem' }}>
            Bugün dağıtılan: <strong style={{ color: 'var(--ds-ink)' }}>{data.pulse.todayCount}</strong> kod
          </div>
        </div>

        {/* Panel 3 — Stok Durumu */}
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            {stockIssues.length === 0 ? <CheckCircle size={16} style={{ color: C.green }} /> : <AlertCircle size={16} style={{ color: C.yellow }} />}
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Stok Durumu</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: C.muted }}>{activeCampaigns.length} aktif</span>
          </div>
          {sortedStock.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: C.muted }}>Aktif kampanya yok.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
              {sortedStock.slice(0, 8).map((c) => {
                const pct = c.total > 0 ? Math.round((c.used / c.total) * 100) : 0;
                const color = c.status === 'out' ? C.red : c.status === 'low' ? C.yellow : c.status === 'no_codes' ? C.muted : C.green;
                const label = c.status === 'out' ? 'TÜKENDİ' : c.status === 'no_codes' ? 'KOD YOK' : `${c.remaining} kaldı`;
                return (
                  <div key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.74rem', marginBottom: '0.2rem' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                      <span style={{ color, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
                    </div>
                    <div className="ds-progress" style={{ marginTop: 0 }}>
                      <div style={{ width: `${c.total > 0 ? pct : 0}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
              {sortedStock.length > 8 && (
                <div style={{ fontSize: '0.7rem', color: C.muted, textAlign: 'center', marginTop: '0.2rem' }}>
                  +{sortedStock.length - 8} kampanya daha
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

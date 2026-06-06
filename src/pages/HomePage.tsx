import { useState, useEffect } from 'react';
import { Search, Loader2, Copy, CheckCircle, AlertCircle, History, X } from 'lucide-react';
import FeaturedHero from '../components/FeaturedHero';
import CampaignCard from '../components/CampaignCard';
import type { Campaign } from '../lib/types';

function isValidTC(tc: string): boolean {
  if (tc.length !== 11 || !/^\d+$/.test(tc) || tc[0] === '0') return false;
  const d = tc.split('').map(Number);
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];
  if ((oddSum * 7 - evenSum) % 10 !== d[9]) return false;
  const total = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return total % 10 === d[10];
}

function SkeletonHero() {
  return (
    <div
      style={{
        height: '380px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '1.25rem',
        border: '1px solid var(--border-color)',
        marginBottom: '2rem',
      }}
    />
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '1rem',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
    >
      <div style={{ paddingBottom: '52%', backgroundColor: 'var(--border-color)' }} />
      <div style={{ padding: '1.25rem' }}>
        <div style={{ height: '14px', backgroundColor: 'var(--border-color)', borderRadius: '4px', width: '55%', marginBottom: '0.75rem' }} />
        <div style={{ height: '12px', backgroundColor: 'var(--border-color)', borderRadius: '4px', width: '80%' }} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showLookup, setShowLookup] = useState(false);
  const [lookupTc, setLookupTc] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResults, setLookupResults] = useState<any[] | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const handleLookupCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTC(lookupTc)) {
      setLookupError('Lütfen geçerli bir T.C. Kimlik Numarası giriniz.');
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setLookupResults(null);
    try {
      const res = await fetch('/api/my-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tc_no: lookupTc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Beklenmeyen bir hata oluştu.');
      setLookupResults(data);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Sorgulama başarısız.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCopyCode = (code: string, index: number) => {
    void navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setCopied(true);
    setTimeout(() => {
      setCopiedIndex(null);
      setCopied(false);
    }, 2000);
  };

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<Campaign[]>;
      })
      .then((data) => {
        setCampaigns(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container">
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
        <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
          <SkeletonHero />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {[1, 2].map((i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ color: 'var(--danger)', fontSize: '1rem' }}>Kampanyalar yüklenemedi.</p>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Şu an aktif kampanya bulunmamaktadır.</p>
      </div>
    );
  }

  const featured = campaigns
    .filter((c) => c.is_featured)
    .sort((a, b) => (b.featured_order ?? 0) - (a.featured_order ?? 0))[0];

  const rest = campaigns.filter((c) => c !== featured);

  return (
    <div className="container">
      {featured && <FeaturedHero campaign={featured} />}

      {/* Kodlarımı Sorgula Bölümü */}
      <div
        className="card"
        style={{
          marginBottom: '2rem',
          backgroundColor: 'rgba(30, 41, 59, 0.65)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-color)',
          borderRadius: '1.25rem',
          padding: '1.5rem',
        }}
      >
        <div
          onClick={() => setShowLookup(!showLookup)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <History size={22} style={{ color: 'var(--accent)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                Aldığım Kodları Sorgula
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                T.C. Kimlik numaranız ile daha önce aldığınız tüm indirim kodlarını listeleyin.
              </p>
            </div>
          </div>
          <button
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              color: 'var(--text-main)',
              padding: '0.4rem 0.8rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showLookup ? 'Gizle' : 'Sorgula'}
          </button>
        </div>

        {showLookup && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
            {lookupError && (
              <div className="alert error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={18} />
                <span>{lookupError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => void handleLookupCodes(e)}
              style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', maxWidth: '580px' }}
            >
              <div className="input-group" style={{ flex: 1, minWidth: '240px', marginBottom: 0 }}>
                <label htmlFor="lookupTc" style={{ color: '#cbd5e1', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                  T.C. Kimlik Numarası
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="lookupTc"
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="11 haneli TCKN giriniz"
                    value={lookupTc}
                    onChange={(e) => {
                      setLookupError(null);
                      setLookupTc(e.target.value.replace(/\D/g, '').slice(0, 11));
                    }}
                    disabled={lookupLoading}
                    autoComplete="off"
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      borderColor: lookupTc.length === 11
                        ? (isValidTC(lookupTc) ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)')
                        : 'rgba(255,255,255,0.1)',
                      fontSize: '0.875rem',
                      paddingRight: '2.5rem',
                    }}
                  />
                  {lookupTc.length > 0 && !lookupLoading && (
                    <button
                      type="button"
                      onClick={() => setLookupTc('')}
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="btn"
                disabled={lookupLoading || lookupTc.length !== 11}
                style={{ width: 'auto', padding: '0.7rem 1.5rem', fontSize: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
              >
                {lookupLoading ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Sorgulanıyor…
                  </>
                ) : (
                  <>
                    <Search size={16} /> Sorgula
                  </>
                )}
              </button>
            </form>

            {lookupResults && (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                  Aldığınız İndirim Kodları
                </h4>
                {lookupResults.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Daha önce herhangi bir kampanya kodu almadınız.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {lookupResults.map((claim: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.4)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '0.75rem',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {claim.campaign?.title ?? 'Kampanya'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                            {claim.campaign?.discount_label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.05em' }}>
                            {claim.code}
                          </span>
                          <button
                            onClick={() => handleCopyCode(claim.code, idx)}
                            title="Kopyala"
                            style={{
                              background: copiedIndex === idx ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent)',
                              color: copiedIndex === idx ? 'var(--accent)' : '#0f172a',
                              border: '1px solid var(--accent)',
                              borderRadius: '0.375rem',
                              padding: '0.4rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.15s',
                            }}
                          >
                            {copiedIndex === idx ? <CheckCircle size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        {claim.claimed_at && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                            Alım Tarihi: {new Date(claim.claimed_at).toLocaleDateString('tr-TR')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {copied && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--accent)',
            color: '#0f172a',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            fontWeight: 700,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <CheckCircle size={18} />
          <span>Kod panoya kopyalandı!</span>
        </div>
      )}

      {rest.length > 0 && (
        <>
          {featured && (
            <h2
              style={{
                margin: '0 0 1.25rem',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Diğer Kampanyalar
            </h2>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {rest.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

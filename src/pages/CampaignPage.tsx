import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gift, AlertCircle, CheckCircle, Loader2, Copy, Tag, Info } from 'lucide-react';
import type { Campaign } from '../lib/types';

type ClaimResponse = {
  alreadyClaimed: boolean;
  code: string | null;
  message: string;
  error?: string;
};

function isValidTC(tc: string) {
  return tc.length === 11 && /^\d+$/.test(tc);
}

function CodeBox({ code, copied, onCopy }: { code: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="code-display" style={{ marginBottom: '1.5rem' }}>
      <div className="label">İNDİRİM KODUNUZ</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          marginTop: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '2rem',
            fontWeight: 800,
            color: 'var(--accent)',
            letterSpacing: '0.12em',
            wordBreak: 'break-all',
          }}
        >
          {code}
        </div>
        <button
          onClick={onCopy}
          title="Kopyala"
          style={{
            background: copied ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent)',
            color: copied ? 'var(--accent)' : '#0f172a',
            border: '1px solid var(--accent)',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s',
          }}
        >
          {copied ? <CheckCircle size={22} /> : <Copy size={22} />}
        </button>
      </div>
    </div>
  );
}

export default function CampaignPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [tcNo, setTcNo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json() as Promise<Campaign[]>)
      .then((data) => {
        const found = data.find((c) => c.slug === slug);
        if (found) {
          setCampaign(found);
        } else {
          navigate('/');
        }
      })
      .catch(() => navigate('/'));
  }, [slug, navigate]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTC(tcNo) || !campaign) return;
    setSubmitting(true);
    setClaimError(null);
    try {
      const res = await fetch('/api/claim-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tc_no: tcNo, campaign_slug: campaign.slug }),
      });
      const data = (await res.json()) as ClaimResponse;
      if (!res.ok) throw new Error(data.error ?? 'Beklenmeyen bir hata oluştu.');
      setResult(data);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (result?.code) {
      void navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!campaign) return null;

  return (
    <div
      className="flex-center"
      style={{
        backgroundImage: campaign.cover_image_url
          ? `url(${campaign.cover_image_url})`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        padding: '2rem 1rem',
        minHeight: '100vh',
        alignItems: 'flex-start',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '680px',
          width: '100%',
          backgroundColor: 'rgba(30, 41, 59, 0.88)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.12)',
          marginTop: '2rem',
          marginBottom: '2rem',
        }}
      >
        {/* Logos */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '2rem',
            marginBottom: '1.75rem',
            flexWrap: 'wrap',
          }}
        >
          <img
            src="/talpa-logo.webp"
            alt="TALPA"
            style={{ height: '64px', objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          {campaign.partner_logo_url && (
            <>
              <div
                style={{ width: '1px', height: '44px', backgroundColor: 'rgba(255,255,255,0.18)' }}
              />
              <img
                src={campaign.partner_logo_url}
                alt={campaign.partner_name ?? ''}
                style={{ height: '64px', objectFit: 'contain' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </>
          )}
        </div>

        {/* Heading */}
        <h1
          className="title"
          style={{ fontSize: 'clamp(1.4rem, 4vw, 1.9rem)', marginBottom: '0.5rem' }}
        >
          {campaign.title}
        </h1>

        <div
          style={{
            textAlign: 'center',
            marginBottom: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          {campaign.description && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              {campaign.description}
            </span>
          )}
          <span
            style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
          >
            <Tag size={16} />
            {campaign.discount_label}
          </span>
        </div>

        {/* Error */}
        {claimError && (
          <div className="alert error">
            <AlertCircle size={20} style={{ minWidth: '20px' }} />
            <span>{claimError}</span>
          </div>
        )}

        {/* Result state */}
        {result ? (
          <div>
            <div className={`alert ${result.alreadyClaimed ? 'error' : 'success'}`}>
              <CheckCircle size={20} style={{ minWidth: '20px' }} />
              <span>{result.message}</span>
            </div>

            {result.code && (
              <CodeBox code={result.code} copied={copied} onCopy={handleCopy} />
            )}

            <button
              className="btn"
              onClick={() => {
                setResult(null);
                setTcNo('');
                setClaimError(null);
              }}
            >
              Geri Dön
            </button>
          </div>
        ) : (
          /* Claim form */
          <form onSubmit={(e) => void handleClaim(e)}>
            <div className="input-group">
              <label htmlFor="tcNo" style={{ color: '#cbd5e1' }}>
                T.C. Kimlik Numarası
              </label>
              <input
                id="tcNo"
                type="text"
                inputMode="numeric"
                maxLength={11}
                placeholder="11 haneli TCKN giriniz"
                value={tcNo}
                onChange={(e) => setTcNo(e.target.value.replace(/\D/g, '').slice(0, 11))}
                disabled={submitting}
                autoComplete="off"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn"
              disabled={submitting || !isValidTC(tcNo)}
            >
              {submitting ? (
                <>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  Doğrulanıyor…
                </>
              ) : (
                <>
                  <Gift size={20} /> İndirim Kodumu Al
                </>
              )}
            </button>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </form>
        )}

        {/* Terms */}
        {campaign.terms && (
          <div
            style={{
              marginTop: '2rem',
              padding: '1.5rem',
              backgroundColor: 'rgba(0,0,0,0.22)',
              borderRadius: '0.75rem',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.845rem',
              color: '#94a3b8',
              lineHeight: 1.7,
            }}
          >
            <h4
              style={{
                color: '#cbd5e1',
                marginBottom: '0.875rem',
                marginTop: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.95rem',
              }}
            >
              <Info size={16} /> Kampanya Koşulları
            </h4>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{campaign.terms}</p>
          </div>
        )}
      </div>
    </div>
  );
}

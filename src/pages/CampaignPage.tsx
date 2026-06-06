import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gift, AlertCircle, CheckCircle, Loader2, Copy, Tag, Info, History, X } from 'lucide-react';
import type { Campaign } from '../lib/types';

type ClaimResponse = {
  alreadyClaimed: boolean;
  limitReached?: boolean;
  code?: string;
  codes?: string[];
  message: string;
  error?: string;
};

function isValidTC(tc: string): boolean {
  if (tc.length !== 11 || !/^\d+$/.test(tc) || tc[0] === '0') return false;
  const d = tc.split('').map(Number);
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];
  if ((oddSum * 7 - evenSum) % 10 !== d[9]) return false;
  const total = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return total % 10 === d[10];
}

function CodeBox({
  code,
  label,
  copied,
  onCopy,
}: {
  code: string;
  label: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="code-display" style={{ marginBottom: '1.5rem' }}>
      <div className="label">{label}</div>
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showCopyToast, setShowCopyToast] = useState(false);

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
    if (!campaign) return;

    if (!isValidTC(tcNo)) {
      setClaimError('Lütfen geçerli bir T.C. Kimlik Numarası giriniz.');
      return;
    }

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

  const handleCopy = (code: string, index?: number) => {
    void navigator.clipboard.writeText(code);
    setShowCopyToast(true);
    setTimeout(() => setShowCopyToast(false), 2000);
    if (index !== undefined) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } else {
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
            style={{
              color: 'var(--accent)',
              fontWeight: 700,
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
            }}
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

        {/* Stock alerts */}
        {campaign.has_codes === false && !result && (
          <div className="alert error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={20} style={{ minWidth: '20px' }} />
            <span>Bu kampanyada dağıtılacak kod kalmamıştır. İlginiz için teşekkür ederiz.</span>
          </div>
        )}
        {campaign.has_codes !== false && campaign.is_low_stock && !result && (
          <div className="alert warning" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={20} style={{ minWidth: '20px' }} />
            <span>Sınırlı sayıda kod kalmıştır. Kodunuzu hemen alın!</span>
          </div>
        )}

        {/* Result state */}
        {result ? (
          <div>
            {/* alreadyClaimed */}
            {result.alreadyClaimed && (
              <>
                <div className="alert warning">
                  <History size={20} style={{ minWidth: '20px' }} />
                  <span>Bu kampanyadan daha önce kod almışsınız. Kodunuz aşağıda görüntülenmektedir.</span>
                </div>
                {result.codes && result.codes[0] && (
                  <CodeBox
                    code={result.codes[0]}
                    label="DAHA ÖNCE ALINAN KODUNUZ"
                    copied={copied}
                    onCopy={() => handleCopy(result.codes![0])}
                  />
                )}
              </>
            )}

            {/* limitReached */}
            {!result.alreadyClaimed && result.limitReached && (
              <>
                <div className="alert warning">
                  <History size={20} style={{ minWidth: '20px' }} />
                  <span>Kampanya katılım limitinize ulaştınız.</span>
                </div>
                {result.codes && result.codes.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.875rem',
                        color: '#cbd5e1',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                      }}
                    >
                      <History size={16} />
                      Daha Önce Aldığınız Kodlar
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {result.codes.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            padding: '0.75rem 1rem',
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(255,255,255,0.07)',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '1.1rem',
                              fontWeight: 700,
                              color: 'var(--accent)',
                              letterSpacing: '0.08em',
                            }}
                          >
                            {c}
                          </span>
                          <button
                            onClick={() => handleCopy(c, i)}
                            title="Kopyala"
                            style={{
                              background: copiedIndex === i ? 'rgba(16,185,129,0.15)' : 'var(--accent)',
                              color: copiedIndex === i ? 'var(--accent)' : '#0f172a',
                              border: '1px solid var(--accent)',
                              borderRadius: '0.375rem',
                              padding: '0.5rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.2s',
                            }}
                          >
                            {copiedIndex === i ? <CheckCircle size={16} /> : <Copy size={16} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Normal başarı */}
            {!result.alreadyClaimed && !result.limitReached && (
              <>
                <div className="alert success">
                  <CheckCircle size={20} style={{ minWidth: '20px' }} />
                  <span>Üye doğrulama başarılı! Kampanya kodunuz teslim edildi.</span>
                </div>
                {result.code && (
                  <CodeBox
                    code={result.code}
                    label="İNDİRİM KODUNUZ"
                    copied={copied}
                    onCopy={() => handleCopy(result.code!)}
                  />
                )}
              </>
            )}

            <button className="btn" onClick={() => navigate('/')}>
              Ana Ekrana Dön
            </button>
          </div>
        ) : (
          /* Claim form */
          <form onSubmit={(e) => void handleClaim(e)}>
            <div className="input-group">
              <label htmlFor="tcNo" style={{ color: '#cbd5e1' }}>
                T.C. Kimlik Numarası
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="tcNo"
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  autoFocus
                  placeholder="11 haneli TCKN giriniz"
                  value={tcNo}
                  onChange={(e) => {
                    setClaimError(null);
                    setTcNo(e.target.value.replace(/\D/g, '').slice(0, 11));
                  }}
                  disabled={submitting || campaign.has_codes === false}
                  autoComplete="off"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    borderColor: tcNo.length === 11
                      ? (isValidTC(tcNo) ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)')
                      : 'rgba(255,255,255,0.1)',
                    paddingRight: '3.5rem',
                    width: '100%',
                  }}
                />
                <div style={{ position: 'absolute', right: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {tcNo.length > 0 && !submitting && campaign.has_codes !== false && (
                    <button
                      type="button"
                      onClick={() => setTcNo('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Temizle"
                    >
                      <X size={15} />
                    </button>
                  )}
                  {tcNo.length === 11 && (
                    isValidTC(tcNo) ? (
                      <CheckCircle size={17} color="var(--accent)" />
                    ) : (
                      <AlertCircle size={17} color="var(--danger)" />
                    )
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn"
              disabled={submitting || tcNo.length !== 11 || campaign.has_codes === false}
              style={{
                backgroundColor: campaign.has_codes === false ? '#334155' : undefined,
                color: campaign.has_codes === false ? 'var(--text-muted)' : undefined,
                cursor: campaign.has_codes === false ? 'not-allowed' : undefined,
              }}
            >
              {campaign.has_codes === false ? (
                'Tükendi'
              ) : submitting ? (
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
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
              @keyframes fadeIn {
                from { opacity: 0; transform: translate(-50%, 10px); }
                to { opacity: 1; transform: translate(-50%, 0); }
              }
            `}</style>
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

      {showCopyToast && (
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
    </div>
  );
}

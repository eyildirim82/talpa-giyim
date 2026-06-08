import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Gift, AlertCircle, CheckCircle, Loader2, Copy, Tag, Info, History,
  X, RefreshCw, ArrowLeft, ArrowRight, Clock,
} from 'lucide-react';
import type { Campaign } from '../lib/types';
import { isValidTC } from '../lib/tc';
import DsNav from '../components/ds/DsNav';

type ClaimResponse = {
  alreadyClaimed: boolean;
  limitReached?: boolean;
  code?: string;
  codes?: string[];
  message: string;
  error?: string;
};

function ResultView({
  result,
  copiedKey,
  onCopy,
  onHome,
  tc,
}: {
  result: ClaimResponse;
  copiedKey: string | null;
  onCopy: (code: string, key: string) => void;
  onHome: () => void;
  tc: string;
}) {
  const codes = result.code ? [result.code] : result.codes ?? [];
  return (
    <div>
      {result.alreadyClaimed ? (
        <div className="ds-alert ds-alert--info">
          <History size={18} />
          <span>Bu kampanyadan daha önce kod almışsınız. Kodunuz aşağıda.</span>
        </div>
      ) : result.limitReached ? (
        <div className="ds-alert ds-alert--warning">
          <History size={18} />
          <span>Kampanya katılım limitinize ulaştınız. Aldığınız kod(lar) aşağıda.</span>
        </div>
      ) : (
        <div className="ds-alert ds-alert--success">
          <CheckCircle size={18} />
          <span>Üyeliğiniz doğrulandı. Kodunuz hazır!</span>
        </div>
      )}

      {codes.map((c, i) => {
        const key = `r${i}`;
        return (
          <div className="ds-codebox" key={key}>
            <div className="ds-codebox__label">Kodunuz</div>
            <div className="ds-codebox__row">
              <span className="ds-codebox__code">{c}</span>
              <button className={`ds-copy${copiedKey === key ? ' copied' : ''}`} onClick={() => onCopy(c, key)}>
                {copiedKey === key ? (
                  <>
                    <CheckCircle size={15} /> Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy size={15} /> Kopyala
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}

      <Link
        to="/kodlarim"
        state={{ tc }}
        className="ds-btn ds-btn--ghost ds-btn--block"
        style={{ marginTop: '0.25rem' }}
      >
        Tüm kodlarım <ArrowRight size={15} />
      </Link>
      <button
        type="button"
        className="ds-btn ds-btn--block"
        style={{ marginTop: '0.6rem', background: 'transparent', color: 'var(--ds-ink-soft)', border: 'none', minHeight: 'auto' }}
        onClick={onHome}
      >
        Ana sayfaya dön
      </button>
    </div>
  );
}

export default function CampaignDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [tcNo, setTcNo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [serviceDown, setServiceDown] = useState(false);
  const [result, setResult] = useState<ClaimResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/campaigns/${slug}`)
      .then((r) => (r.ok ? (r.json() as Promise<Campaign>) : Promise.reject(new Error('not-found'))))
      .then((c) => {
        if (!alive) return;
        // Arşiv/pasif → herkese açık değil, vitrine yönlendir.
        if (c.status === 'archived' || c.status === 'inactive') {
          navigate('/');
          return;
        }
        setCampaign(c);
        setLoading(false);
      })
      .catch(() => {
        if (alive) navigate('/');
      });
    return () => {
      alive = false;
    };
  }, [slug, navigate]);

  const handleCopy = (code: string, key: string) => {
    void navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setToast(true);
    setTimeout(() => {
      setCopiedKey(null);
      setToast(false);
    }, 2000);
  };

  const handleClaim = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!campaign) return;
    if (!isValidTC(tcNo)) {
      setClaimError('Lütfen geçerli bir T.C. Kimlik Numarası giriniz.');
      return;
    }
    setSubmitting(true);
    setClaimError(null);
    setServiceDown(false);
    try {
      const res = await fetch('/api/claim-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tc_no: tcNo, campaign_slug: campaign.slug }),
      });
      const data = (await res.json()) as ClaimResponse;
      // 503 = doğrulama servisine ulaşılamadı; üyeyle ilgili değil.
      if (res.status === 503) {
        setServiceDown(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? 'Beklenmeyen bir hata oluştu.');
      setResult(data);
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !campaign) {
    return (
      <div className="ds">
        <DsNav />
        <div className="ds-container">
          <div className="ds-skel" style={{ height: '380px', maxWidth: '600px', margin: '1.5rem auto' }} />
        </div>
      </div>
    );
  }

  const soldOut = campaign.status === 'sold_out' || campaign.has_codes === false;
  const scheduled = campaign.status === 'scheduled';
  const expired = campaign.status === 'expired';
  const lowStock = !soldOut && campaign.is_low_stock;
  const tcOk = tcNo.length === 11 && isValidTC(tcNo);
  const tcBad = tcNo.length === 11 && !isValidTC(tcNo);
  const formClosed = scheduled || expired;

  return (
    <div className="ds">
      <DsNav />
      <div className="ds-container">
        <Link to="/" className="ds-back">
          <ArrowLeft size={16} /> Kampanyalar
        </Link>

        <div className="ds-claim">
          {campaign.cover_image_url && (
            <div className="ds-cover">
              <img src={campaign.cover_image_url} alt={campaign.title} />
            </div>
          )}

          <div className="ds-logos">
            <img
              src="/talpa-logo.webp"
              alt="TALPA"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            {campaign.partner_logo_url && (
              <>
                <span className="sep" />
                <img
                  src={campaign.partner_logo_url}
                  alt={campaign.partner_name ?? ''}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </>
            )}
          </div>

          <h1 className="ds-claim__title">{campaign.title}</h1>
          {campaign.description && <p className="ds-claim__sub">{campaign.description}</p>}
          <div className="ds-claim__discount">
            <Tag size={16} /> {campaign.discount_label}
          </div>

          {claimError && (
            <div className="ds-alert ds-alert--danger">
              <AlertCircle size={18} />
              <span>{claimError}</span>
            </div>
          )}

          {serviceDown && !result && (
            <div className="ds-alert ds-alert--info" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <span style={{ display: 'flex', gap: '0.5rem' }}>
                <AlertCircle size={18} />
                Üyelik doğrulama servisine şu an ulaşılamıyor. Üyeliğinizle ilgili bir sorun değildir; lütfen
                birkaç dakika sonra tekrar deneyin.
              </span>
              <button
                type="button"
                className="ds-btn ds-btn--primary"
                style={{ marginTop: '0.75rem', alignSelf: 'flex-start' }}
                onClick={() => void handleClaim()}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="ds-spin" /> Deneniyor…
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} /> Tekrar Dene
                  </>
                )}
              </button>
            </div>
          )}

          {scheduled && !result && (
            <div className="ds-alert ds-alert--info">
              <Clock size={18} />
              <span>
                Bu kampanya yakında başlayacak
                {campaign.starts_at ? ` (${new Date(campaign.starts_at).toLocaleDateString('tr-TR')})` : ''}. Kod
                alımı henüz açılmadı.
              </span>
            </div>
          )}
          {expired && !result && (
            <div className="ds-alert ds-alert--warning">
              <AlertCircle size={18} />
              <span>Bu kampanya sona erdi.</span>
            </div>
          )}

          {!formClosed && soldOut && !result && (
            <div className="ds-alert ds-alert--danger">
              <AlertCircle size={18} />
              <span>Bu kampanyada dağıtılacak kod kalmamıştır. İlginiz için teşekkür ederiz.</span>
            </div>
          )}
          {!formClosed && !soldOut && lowStock && !result && (
            <div className="ds-alert ds-alert--warning">
              <AlertCircle size={18} />
              <span>Sınırlı sayıda kod kaldı. Kodunuzu hemen alın!</span>
            </div>
          )}

          {result ? (
            <ResultView
              result={result}
              copiedKey={copiedKey}
              onCopy={handleCopy}
              onHome={() => navigate('/')}
              tc={tcNo}
            />
          ) : formClosed ? (
            <Link to="/" className="ds-btn ds-btn--ghost ds-btn--block">
              Diğer kampanyalara dön
            </Link>
          ) : (
            <form onSubmit={(e) => void handleClaim(e)}>
              <div className="ds-field">
                <label htmlFor="tc">T.C. Kimlik Numarası</label>
                <div className="ds-field__wrap">
                  <input
                    id="tc"
                    className="ds-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={11}
                    autoComplete="off"
                    autoFocus
                    placeholder="11 haneli TCKN"
                    value={tcNo}
                    disabled={submitting || soldOut}
                    onChange={(e) => {
                      setClaimError(null);
                      setTcNo(e.target.value.replace(/\D/g, '').slice(0, 11));
                    }}
                    style={{
                      borderColor:
                        tcNo.length === 11
                          ? isValidTC(tcNo)
                            ? 'var(--ds-success)'
                            : 'var(--ds-danger)'
                          : undefined,
                    }}
                  />
                  <div className="ds-field__icons">
                    {tcNo.length > 0 && !submitting && !soldOut && (
                      <button type="button" className="ds-iconbtn" onClick={() => setTcNo('')} title="Temizle">
                        <X size={15} />
                      </button>
                    )}
                    {tcOk && <CheckCircle size={17} color="var(--ds-success)" />}
                    {tcBad && <AlertCircle size={17} color="var(--ds-danger)" />}
                  </div>
                </div>
              </div>

              <div className="ds-sticky">
                <button
                  type="submit"
                  className="ds-btn ds-btn--primary ds-btn--block"
                  disabled={submitting || tcNo.length !== 11 || soldOut}
                >
                  {soldOut ? (
                    'Tükendi'
                  ) : submitting ? (
                    <>
                      <Loader2 size={18} className="ds-spin" /> Doğrulanıyor…
                    </>
                  ) : (
                    <>
                      <Gift size={18} /> Kodumu Al
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {campaign.terms && (
            <div className="ds-terms">
              <h4>
                <Info size={16} /> Kampanya Koşulları
              </h4>
              <p>{campaign.terms}</p>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="ds-toast">
          <CheckCircle size={16} /> Kod panoya kopyalandı!
        </div>
      )}
    </div>
  );
}

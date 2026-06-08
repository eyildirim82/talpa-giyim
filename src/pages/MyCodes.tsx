import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Loader2, AlertCircle, RefreshCw, Copy, CheckCircle, X } from 'lucide-react';
import { isValidTC } from '../lib/tc';
import DsNav from '../components/ds/DsNav';
import { usePageTitle } from '../lib/usePageTitle';

type MyCode = {
  code: string;
  claimed_at: string | null;
  campaign: {
    id: string;
    slug: string;
    title: string;
    discount_label: string;
    partner_name: string | null;
    partner_logo_url: string | null;
  } | null;
};

export default function MyCodes() {
  const location = useLocation();
  const presetTc = (location.state as { tc?: string } | null)?.tc ?? '';

  usePageTitle('Kodlarım');
  const [tcNo, setTcNo] = useState(presetTc);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceDown, setServiceDown] = useState(false);
  const [results, setResults] = useState<MyCode[] | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const autoRan = useRef(false);

  const lookup = async (tc: string) => {
    if (!isValidTC(tc)) {
      setError('Lütfen geçerli bir T.C. Kimlik Numarası giriniz.');
      return;
    }
    setLoading(true);
    setError(null);
    setServiceDown(false);
    setResults(null);
    try {
      const res = await fetch('/api/my-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tc_no: tc }),
      });
      if (res.status === 503) {
        setServiceDown(true);
        return;
      }
      const data = (await res.json()) as MyCode[] | { error?: string };
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Sorgulama başarısız.');
      setResults(data as MyCode[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sorgulama başarısız.');
    } finally {
      setLoading(false);
    }
  };

  // Detaydan TC ön-dolu geldiyse otomatik sorgula (bir kez).
  useEffect(() => {
    if (!autoRan.current && presetTc && isValidTC(presetTc)) {
      autoRan.current = true;
      void lookup(presetTc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void lookup(tcNo);
  };

  const copy = (code: string, key: string) => {
    void navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setToast(true);
    setTimeout(() => {
      setCopiedKey(null);
      setToast(false);
    }, 2000);
  };

  const tcOk = tcNo.length === 11 && isValidTC(tcNo);
  const tcBad = tcNo.length === 11 && !isValidTC(tcNo);

  return (
    <div className="ds">
      <DsNav />
      <div className="ds-container" style={{ maxWidth: '620px' }}>
        <header className="ds-hero">
          <span className="ds-eyebrow">Üyelere Özel</span>
          <h1 className="ds-h1">Kodlarım</h1>
          <p className="ds-sub">
            T.C. kimlik numaranızla daha önce aldığınız tüm indirim kodlarını listeleyin.
          </p>
        </header>

        {error && (
          <div className="ds-alert ds-alert--danger">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {serviceDown && (
          <div className="ds-alert ds-alert--info" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <span style={{ display: 'flex', gap: '0.5rem' }}>
              <AlertCircle size={18} />
              Doğrulama servisine şu an ulaşılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.
            </span>
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              style={{ marginTop: '0.75rem', alignSelf: 'flex-start' }}
              onClick={() => void lookup(tcNo)}
              disabled={loading}
            >
              {loading ? (
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

        <form onSubmit={handleSubmit}>
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
                placeholder="11 haneli TCKN"
                value={tcNo}
                disabled={loading}
                onChange={(e) => {
                  setError(null);
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
                {tcNo.length > 0 && !loading && (
                  <button type="button" className="ds-iconbtn" onClick={() => setTcNo('')} title="Temizle">
                    <X size={15} />
                  </button>
                )}
                {tcOk && <CheckCircle size={17} color="var(--ds-success)" />}
                {tcBad && <AlertCircle size={17} color="var(--ds-danger)" />}
              </div>
            </div>
          </div>
          <button type="submit" className="ds-btn ds-btn--primary ds-btn--block" disabled={loading || tcNo.length !== 11}>
            {loading ? (
              <>
                <Loader2 size={18} className="ds-spin" /> Sorgulanıyor…
              </>
            ) : (
              <>
                <Search size={18} /> Sorgula
              </>
            )}
          </button>
        </form>

        {results && (
          <div style={{ marginTop: '1.75rem' }}>
            {results.length === 0 ? (
              <div className="ds-empty">Daha önce herhangi bir kampanya kodu almadınız.</div>
            ) : (
              <div className="ds-codelist">
                {results.map((r, i) => {
                  const key = `c${i}`;
                  return (
                    <div className="ds-codecard" key={key}>
                      <div className="ds-codecard__main">
                        <p className="ds-codecard__title">{r.campaign?.title ?? 'Kampanya'}</p>
                        <span className="ds-codecard__code">{r.code}</span>
                        {r.claimed_at && (
                          <div className="ds-codecard__date">
                            {new Date(r.claimed_at).toLocaleDateString('tr-TR')}
                          </div>
                        )}
                      </div>
                      <button
                        className={`ds-copy ds-codecard__copy${copiedKey === key ? ' copied' : ''}`}
                        onClick={() => copy(r.code, key)}
                      >
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
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className="ds-toast">
          <CheckCircle size={16} /> Kod panoya kopyalandı!
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Eye, EyeOff, Plane, ArrowRight } from 'lucide-react';

type SignIn = (email: string, password: string) => Promise<{ error: unknown }>;

export default function Login({ signIn }: { signIn: SignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) setError('E-posta veya şifre hatalı. Lütfen tekrar deneyin.');
    setLoading(false);
  };

  return (
    <div className="ds">
      <div className="ds-login">
        {/* Marka tarafı (navy) */}
        <div className="ds-login__brandside ds-cover-ph ds-cover-ph--navy">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plane size={19} color="#fff" />
            </span>
            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>TALPA Kampanyaları</span>
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 800 }}>Yönetim Paneli</h2>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.82)', maxWidth: 300, lineHeight: 1.55 }}>
              Kampanyaları, kod havuzlarını ve duyuruları tek yerden yönetin.
            </p>
          </div>
          <span style={{ position: 'relative', fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>
            © TALPA — Türkiye Havayolu Pilotları Derneği
          </span>
        </div>

        {/* Form tarafı */}
        <div className="ds-login__formside">
          <form onSubmit={(e) => void submit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', width: 340, maxWidth: '100%' }}>
            <div>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.6rem', fontWeight: 800 }}>Giriş yapın</h2>
              <span style={{ color: 'var(--ds-ink-faint)', fontSize: '0.85rem' }}>Yönetici hesabınızla devam edin.</span>
            </div>

            {error && (
              <div className="ds-alert ds-alert--danger" style={{ marginBottom: 0 }}>
                {error}
              </div>
            )}

            <div className="ds-field" style={{ marginBottom: 0 }}>
              <label htmlFor="email">E-posta</label>
              <input id="email" className="ds-input" type="email" placeholder="ornek@talpa.org" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>

            <div className="ds-field" style={{ marginBottom: 0 }}>
              <label htmlFor="pw">Şifre</label>
              <div className="ds-field__wrap">
                <input
                  id="pw"
                  className="ds-input"
                  type={show ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  style={{ paddingRight: '2.6rem' }}
                />
                <div className="ds-field__icons">
                  <button type="button" className="ds-iconbtn" onClick={() => setShow((s) => !s)} title={show ? 'Gizle' : 'Göster'}>
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" className="ds-btn ds-btn--primary ds-btn--block" disabled={loading}>
              {loading ? 'Giriş yapılıyor…' : <>Giriş Yap <ArrowRight size={16} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

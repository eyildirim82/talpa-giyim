import { useState } from 'react';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

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
    if (err) setError('E-posta veya şifre hatalı.');
    setLoading(false);
  };

  return (
    <div className="ds" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="ds-modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
        <ShieldCheck size={40} color="var(--ds-accent)" style={{ margin: '0 auto 0.75rem' }} />
        <h1 className="ds-admin__title" style={{ textAlign: 'center' }}>Yönetici Girişi</h1>
        <p className="ds-sub" style={{ margin: '0.25rem auto 1.25rem', maxWidth: 'none' }}>
          Supabase hesabınızla giriş yapın
        </p>

        {error && <div className="ds-alert ds-alert--danger" style={{ textAlign: 'left' }}>{error}</div>}

        <form onSubmit={(e) => void submit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
          <input
            className="ds-input"
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <div style={{ position: 'relative' }}>
            <input
              className="ds-input"
              type={show ? 'text' : 'password'}
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{ paddingRight: '2.5rem', width: '100%' }}
            />
            <button
              type="button"
              className="ds-iconbtn"
              style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)' }}
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button type="submit" className="ds-btn ds-btn--primary ds-btn--block" disabled={loading}>
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}

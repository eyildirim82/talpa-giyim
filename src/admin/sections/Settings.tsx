import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAdmin } from '../ctx';
import { usePageTitle, ADMIN_BRAND } from '../../lib/usePageTitle';

const CONFIRM_WORD = 'SIFIRLA';

export default function Settings() {
  usePageTitle('Ayarlar', ADMIN_BRAND);
  const { getAuthHeaders, notify } = useAdmin();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    if (confirm !== CONFIRM_WORD) return;
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      const r = await fetch('/api/admin/reset', { method: 'DELETE', headers });
      if (!r.ok) throw new Error();
      notify('success', 'Tüm kodlar ve talepler silindi.');
      setConfirm('');
    } catch {
      notify('error', 'Sıfırlama başarısız.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 className="ds-admin__title" style={{ marginBottom: '1rem' }}>Ayarlar</h1>

      <div className="ds-danger-zone">
        <h3 style={{ margin: '0 0 0.4rem', color: 'var(--ds-danger)' }}>Sistemi Sıfırla</h3>
        <p style={{ margin: '0 0 0.9rem', color: 'var(--ds-ink-soft)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Tüm kod ve talep kayıtları <strong>kalıcı olarak</strong> silinir. Kampanya ve tür şablonları korunur.
          Onaylamak için <strong>{CONFIRM_WORD}</strong> yazın.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input
            className="ds-input"
            style={{ maxWidth: '220px' }}
            placeholder={CONFIRM_WORD}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            type="button"
            className="ds-btn"
            style={{ background: 'var(--ds-danger)', color: '#fff' }}
            disabled={confirm !== CONFIRM_WORD || busy}
            onClick={() => void reset()}
          >
            <Trash2 size={16} /> {busy ? 'Siliniyor…' : 'Sıfırla'}
          </button>
        </div>
      </div>
    </div>
  );
}

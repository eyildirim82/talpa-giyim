import { useEffect, useState } from 'react';
import { useAdmin } from '../ctx';

type Stats = {
  totalCampaigns: number;
  totalCodes: number;
  usedCodes: number;
  remainingCodes: number;
};

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="ds-stat">
      <div className="ds-stat__label">{label}</div>
      <div className="ds-stat__value">{value ?? '—'}</div>
    </div>
  );
}

export default function Overview() {
  const { getAuthHeaders } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const r = await fetch('/api/admin/stats', { headers });
        if (r.ok && alive) setStats((await r.json()) as Stats);
      } catch {
        /* sessiz */
      }
    })();
    return () => {
      alive = false;
    };
  }, [getAuthHeaders]);

  return (
    <div>
      <h1 className="ds-admin__title" style={{ marginBottom: '1rem' }}>Genel Bakış</h1>

      <div className="ds-alert ds-alert--info" style={{ marginBottom: '1.25rem' }}>
        Sistem Sağlığı paneli (servis durumu · sistem nabzı · stok) buraya eklenecek — mevcut SystemHealth
        bileşeni açık temaya uyarlanacak.
      </div>

      <div className="ds-stats">
        <Stat label="Toplam Kampanya" value={stats?.totalCampaigns} />
        <Stat label="Toplam Kod" value={stats?.totalCodes} />
        <Stat label="Dağıtılan" value={stats?.usedCodes} />
        <Stat label="Kalan" value={stats?.remainingCodes} />
      </div>
    </div>
  );
}

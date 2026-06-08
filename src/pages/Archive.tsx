import { useEffect, useState } from 'react';
import type { Campaign } from '../lib/types';
import DsNav from '../components/ds/DsNav';
import CampaignCardDS from '../components/ds/CampaignCardDS';
import { usePageTitle } from '../lib/usePageTitle';

export default function Archive() {
  usePageTitle('Arşiv');
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/campaigns/archive')
      .then((r) => (r.ok ? (r.json() as Promise<Campaign[]>) : []))
      .then((d) => {
        if (!alive) return;
        setItems(d as Campaign[]);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setItems([]);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="ds">
      <DsNav />
      <div className="ds-container">
        <header className="ds-hero">
          <span className="ds-eyebrow">Geçmiş</span>
          <h1 className="ds-h1">Arşiv</h1>
          <p className="ds-sub">
            Süresi geçmiş ve arşivlenmiş kampanyalar. Bu kampanyalardan artık kod alınamaz.
          </p>
        </header>

        {loading ? (
          <div className="ds-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="ds-skel" style={{ height: '300px' }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="ds-empty">Arşivde kampanya yok.</div>
        ) : (
          <div className="ds-grid">
            {items.map((c) => (
              <CampaignCardDS key={c.id} campaign={c} ended />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import FeaturedHero from '../components/FeaturedHero';
import CampaignCard from '../components/CampaignCard';
import type { Campaign } from '../lib/types';

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

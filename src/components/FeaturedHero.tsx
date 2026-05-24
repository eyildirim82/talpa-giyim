import { useNavigate } from 'react-router-dom';
import { Tag, Calendar, ArrowRight } from 'lucide-react';
import type { Campaign } from '../lib/types';

export default function FeaturedHero({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/kampanya/${campaign.slug}`)}
      style={{
        position: 'relative',
        borderRadius: '1.25rem',
        overflow: 'hidden',
        cursor: 'pointer',
        marginBottom: '2rem',
        minHeight: '380px',
        display: 'flex',
        alignItems: 'flex-end',
        border: '1px solid var(--border-color)',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 24px 60px rgba(0,0,0,0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* Background */}
      {campaign.cover_image_url ? (
        <img
          src={campaign.cover_image_url}
          alt={campaign.title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'var(--primary)' }} />
      )}

      {/* Gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(15,23,42,0.97) 0%, rgba(15,23,42,0.55) 50%, rgba(15,23,42,0.15) 100%)',
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', padding: '2rem', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {campaign.partner_logo_url && (
            <img
              src={campaign.partner_logo_url}
              alt={campaign.partner_name ?? ''}
              style={{ height: 'var(--partner-logo-hero)', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <span
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.18)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: '999px',
              padding: '0.25rem 0.875rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Tag size={13} /> {campaign.discount_label}
          </span>
          <span
            style={{
              backgroundColor: 'rgba(96, 165, 250, 0.15)',
              color: '#93c5fd',
              border: '1px solid rgba(96, 165, 250, 0.3)',
              borderRadius: '999px',
              padding: '0.2rem 0.75rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            ÖNE ÇIKAN
          </span>
        </div>

        <h2
          style={{
            margin: '0 0 0.6rem',
            fontSize: 'clamp(1.4rem, 3vw, 2rem)',
            fontWeight: 800,
            lineHeight: 1.2,
            maxWidth: '640px',
          }}
        >
          {campaign.title}
        </h2>

        {campaign.description && (
          <p style={{ margin: '0 0 1.25rem', color: '#cbd5e1', maxWidth: '560px', lineHeight: 1.6, fontSize: '0.95rem' }}>
            {campaign.description}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          {campaign.valid_until && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Calendar size={14} />
              {new Date(campaign.valid_until).toLocaleDateString('tr-TR')} tarihine kadar
            </span>
          )}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'var(--accent)',
              color: '#0f172a',
              fontWeight: 700,
              padding: '0.65rem 1.375rem',
              borderRadius: '0.625rem',
              fontSize: '0.9rem',
            }}
          >
            Kodu Al <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </div>
  );
}

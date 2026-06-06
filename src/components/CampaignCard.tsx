import { useNavigate } from 'react-router-dom';
import { Tag, Calendar } from 'lucide-react';
import type { Campaign } from '../lib/types';

export default function CampaignCard({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/kampanya/${campaign.slug}`)}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '1rem',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.4)';
        e.currentTarget.style.borderColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.borderColor = 'var(--border-color)';
      }}
    >
      {campaign.cover_image_url && (
        <div style={{ position: 'relative', paddingBottom: '52%', overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={campaign.cover_image_url}
            alt={campaign.title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          {campaign.partner_logo_url ? (
            <img
              src={campaign.partner_logo_url}
              alt={campaign.partner_name ?? ''}
              style={{ height: 'var(--partner-logo-card)', objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
              {campaign.partner_name}
            </span>
          )}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--accent)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '999px',
                padding: '0.2rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                whiteSpace: 'nowrap',
              }}
            >
              <Tag size={11} /> {campaign.discount_label}
            </span>
            {campaign.has_codes === false && (
              <span
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--danger)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '999px',
                  padding: '0.2rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                TÜKENDİ
              </span>
            )}
            {campaign.has_codes !== false && campaign.is_low_stock && (
              <span
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '999px',
                  padding: '0.2rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                TÜKENMEK ÜZERE
              </span>
            )}
          </div>
        </div>

        <h3 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 700, lineHeight: 1.3 }}>
          {campaign.title}
        </h3>

        {campaign.description && (
          <p
            style={{
              margin: '0 0 0.875rem',
              color: 'var(--text-muted)',
              fontSize: '0.845rem',
              lineHeight: 1.55,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {campaign.description}
          </p>
        )}

        <div style={{ marginTop: 'auto' }}>
          {campaign.valid_until && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                marginBottom: '0.875rem',
              }}
            >
              <Calendar size={12} />
              {new Date(campaign.valid_until).toLocaleDateString('tr-TR')} tarihine kadar
            </div>
          )}
          <div
            style={{
              padding: '0.6rem 1rem',
              backgroundColor: campaign.has_codes === false ? '#334155' : 'var(--primary)',
              borderRadius: '0.5rem',
              textAlign: 'center',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: campaign.has_codes === false ? 'var(--text-muted)' : 'white',
              cursor: campaign.has_codes === false ? 'not-allowed' : 'default',
            }}
          >
            {campaign.has_codes === false ? 'Tükendi' : 'Kodu Al →'}
          </div>
        </div>
      </div>
    </div>
  );
}

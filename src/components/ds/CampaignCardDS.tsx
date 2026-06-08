import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, Calendar } from 'lucide-react';
import type { Campaign } from '../../lib/types';
import { coverTone } from '../../lib/cover';
import Badge from './Badge';

/**
 * Hi-fi kampanya kartı — gradient kapak (görsel yoksa) + navy "Kodu Al" bar.
 * `ended` → arşiv: tıklanamaz, "Sona erdi", CTA yok.
 */
export default function CampaignCardDS({
  campaign,
  ended = false,
}: {
  campaign: Campaign;
  ended?: boolean;
}) {
  const isEnded = ended || campaign.status === 'expired' || campaign.status === 'archived';
  const soldOut = !isEnded && (campaign.status === 'sold_out' || campaign.has_codes === false);
  const lowStock = !isEnded && !soldOut && campaign.is_low_stock;
  const clickable = !isEnded;
  const partner = campaign.partner_name ?? campaign.title;
  const tone = coverTone(campaign.slug || partner);
  const [logoOk, setLogoOk] = useState(true);

  const inner = (
    <>
      <div className="ds-camp__media">
        {campaign.cover_image_url ? (
          <img src={campaign.cover_image_url} alt={campaign.title} loading="lazy" />
        ) : (
          <div className={`ds-cover-ph ds-cover-ph--${tone}`} style={{ position: 'absolute', inset: 0 }}>
            <div className="ds-camp__wm">{partner}</div>
          </div>
        )}
        <div className="ds-camp__badges">
          <Badge tone="accent">
            <Tag size={11} /> {campaign.discount_label}
          </Badge>
          {isEnded && <Badge tone="neutral">Sona erdi</Badge>}
          {soldOut && <Badge tone="danger">Tükendi</Badge>}
          {lowStock && <Badge tone="warning">Son fırsat</Badge>}
        </div>
      </div>

      <div className="ds-camp__body">
        <div className="ds-camp__brand">
          {campaign.partner_logo_url && logoOk ? (
            <img
              className="ds-brandmark"
              src={campaign.partner_logo_url}
              alt={partner}
              loading="lazy"
              onError={() => setLogoOk(false)}
            />
          ) : (
            partner
          )}
        </div>
        <h3 className="ds-camp__title">{campaign.title}</h3>
        {campaign.description && <p className="ds-camp__desc">{campaign.description}</p>}

        <div style={{ marginTop: 'auto' }}>
          {campaign.valid_until && (
            <div className="ds-camp__meta" style={{ marginBottom: '0.75rem' }}>
              <Calendar size={12} />
              {new Date(campaign.valid_until).toLocaleDateString('tr-TR')} tarihine kadar
            </div>
          )}
          {!isEnded && (
            <div className={`ds-camp__btn${soldOut ? ' ds-camp__btn--out' : ''}`}>
              {soldOut ? 'Tükendi' : 'Kodu Al →'}
            </div>
          )}
        </div>
      </div>
    </>
  );

  const cls = `ds-camp${clickable ? '' : ' ds-camp--static'}`;
  if (!clickable) {
    return <div className={cls}>{inner}</div>;
  }
  return (
    <Link to={`/kampanya/${campaign.slug}`} className={cls}>
      {inner}
    </Link>
  );
}

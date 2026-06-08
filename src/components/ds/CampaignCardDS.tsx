import { Link } from 'react-router-dom';
import { Tag, Calendar, ArrowRight } from 'lucide-react';
import type { Campaign } from '../../lib/types';
import Badge from './Badge';

/**
 * Modern Minimal kampanya kartı.
 * `featured` → masaüstünde geniş yatay düzen (vitrin bayrak gemisi).
 * `ended` → arşiv: tıklanamaz, "Sona erdi" rozeti, stok gizli, CTA yok.
 */
export default function CampaignCardDS({
  campaign,
  featured = false,
  ended = false,
}: {
  campaign: Campaign;
  featured?: boolean;
  ended?: boolean;
}) {
  const isEnded = ended || campaign.status === 'expired' || campaign.status === 'archived';
  const soldOut = !isEnded && (campaign.status === 'sold_out' || campaign.has_codes === false);
  const lowStock = !isEnded && !soldOut && campaign.is_low_stock;
  const clickable = !isEnded;
  const initial = (campaign.partner_name ?? campaign.title ?? 'T').charAt(0).toUpperCase();

  const inner = (
    <>
      <div className="ds-camp__media">
        {campaign.cover_image_url ? (
          <img src={campaign.cover_image_url} alt={campaign.title} loading="lazy" />
        ) : (
          <div className="ds-camp__placeholder">{initial}</div>
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
          {campaign.partner_logo_url ? (
            <img
              src={campaign.partner_logo_url}
              alt={campaign.partner_name ?? ''}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            campaign.partner_name
          )}
        </div>

        <h3 className="ds-camp__title">{campaign.title}</h3>
        {campaign.description && <p className="ds-camp__desc">{campaign.description}</p>}

        <div className="ds-camp__foot">
          {campaign.valid_until ? (
            <span className="ds-camp__meta">
              <Calendar size={13} />
              {new Date(campaign.valid_until).toLocaleDateString('tr-TR')}
            </span>
          ) : (
            <span />
          )}
          {clickable && (
            <span className={`ds-camp__cta${soldOut ? ' ds-camp__cta--muted' : ''}`}>
              {soldOut ? (
                'Tükendi'
              ) : (
                <>
                  Kodu Al <ArrowRight size={15} />
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </>
  );

  const cls = `ds-camp${featured ? ' ds-camp--featured' : ''}${clickable ? '' : ' ds-camp--static'}`;

  if (!clickable) {
    return <div className={cls}>{inner}</div>;
  }
  return (
    <Link to={`/kampanya/${campaign.slug}`} className={cls}>
      {inner}
    </Link>
  );
}

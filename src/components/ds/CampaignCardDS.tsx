import { Link } from 'react-router-dom';
import { Tag, Calendar, ArrowRight } from 'lucide-react';
import type { Campaign } from '../../lib/types';
import Badge from './Badge';

/**
 * Modern Minimal kampanya kartı.
 * `featured` → masaüstünde geniş yatay düzen (vitrin bayrak gemisi).
 * `to` verilmezse kart tıklanamaz (arşiv) — <div> olarak render edilir.
 */
export default function CampaignCardDS({
  campaign,
  featured = false,
  linkTo = true,
}: {
  campaign: Campaign;
  featured?: boolean;
  linkTo?: boolean;
}) {
  const soldOut = campaign.has_codes === false;
  const lowStock = !soldOut && campaign.is_low_stock;
  const initial = (campaign.partner_name ?? campaign.title ?? 'T').charAt(0).toUpperCase();
  const ended = campaign.status === 'expired' || campaign.status === 'archived';

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
          {ended && <Badge tone="neutral">Sona erdi</Badge>}
          {!ended && soldOut && <Badge tone="danger">Tükendi</Badge>}
          {!ended && lowStock && <Badge tone="warning">Son fırsat</Badge>}
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
          {linkTo && !ended && (
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

  const cls = `ds-camp${featured ? ' ds-camp--featured' : ''}${linkTo ? '' : ' ds-camp--static'}`;

  if (!linkTo) {
    return <div className={cls}>{inner}</div>;
  }
  return (
    <Link to={`/kampanya/${campaign.slug}`} className={cls}>
      {inner}
    </Link>
  );
}

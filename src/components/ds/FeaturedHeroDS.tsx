import { Link } from 'react-router-dom';
import { Tag, Calendar, ArrowRight } from 'lucide-react';
import type { Campaign } from '../../lib/types';
import { coverTone } from '../../lib/cover';
import Badge from './Badge';

/** Hi-fi öne çıkan hero — koyu kapak + scrim + beyaz içerik + emerald CTA. */
export default function FeaturedHeroDS({ campaign }: { campaign: Campaign }) {
  const soldOut = campaign.status === 'sold_out' || campaign.has_codes === false;
  const lowStock = !soldOut && campaign.is_low_stock;
  const partner = campaign.partner_name ?? campaign.title;
  const tone = coverTone(campaign.slug || partner);

  return (
    <Link
      to={`/kampanya/${campaign.slug}`}
      className={`ds-fhero${campaign.cover_image_url ? '' : ` ds-cover-ph ds-cover-ph--${tone}`}`}
    >
      {campaign.cover_image_url && <img src={campaign.cover_image_url} alt={campaign.title} />}
      <div className="ds-fhero__scrim" />
      <div className="ds-fhero__body">
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '1rem' }}>
            {partner}
          </span>
          <Badge tone="accent">
            <Tag size={11} /> {campaign.discount_label}
          </Badge>
          <Badge tone="info">ÖNE ÇIKAN</Badge>
          {soldOut && <Badge tone="danger">Tükendi</Badge>}
          {lowStock && <Badge tone="warning">Son fırsat</Badge>}
        </div>

        <h2 className="ds-fhero__title">{campaign.title}</h2>
        {campaign.description && <p className="ds-fhero__desc">{campaign.description}</p>}

        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {campaign.valid_until && (
            <span className="ds-fhero__meta">
              <Calendar size={14} />
              {new Date(campaign.valid_until).toLocaleDateString('tr-TR')} tarihine kadar
            </span>
          )}
          <span className="ds-fhero__cta">
            Kodu Al <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}

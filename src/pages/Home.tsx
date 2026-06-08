import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import type { Campaign, CampaignType, Announcement } from '../lib/types';
import DsNav from '../components/ds/DsNav';
import AnnouncementBar from '../components/ds/AnnouncementBar';
import CampaignCardDS from '../components/ds/CampaignCardDS';

type Sort = 'default' | 'new' | 'ending';

/** Backend kapalıyken hissi görebilmek için örnek veri. */
const MOCK: Campaign[] = [
  {
    id: 'm1', slug: 'ornek-1', title: 'Sonbahar koleksiyonunda üyelere özel',
    description: 'Seçili takım elbise ve gömleklerde TALPA üyelerine özel indirim. Mağaza ve online geçerli.',
    partner_name: 'Brooks Brothers', partner_logo_url: null, cover_image_url: null,
    discount_label: '%25 indirim', is_featured: true, featured_order: 1,
    valid_until: '2026-12-31', starts_at: null, created_at: '2026-06-01', max_codes_per_user: 1,
    terms: null, type: { id: 't1', name: 'İndirim Kodu', slug: 'indirim-kodu' }, has_codes: true, is_low_stock: false,
  },
  {
    id: 'm2', slug: 'ornek-2', title: 'Klasik ayakkabıda özel fiyat',
    description: 'Deri klasik modellerde geçerli üyelik avantajı.',
    partner_name: 'Beymen', partner_logo_url: null, cover_image_url: null,
    discount_label: '%30 indirim', is_featured: false, featured_order: 0,
    valid_until: '2026-09-15', starts_at: null, created_at: '2026-05-20', max_codes_per_user: 1,
    terms: null, type: { id: 't1', name: 'İndirim Kodu', slug: 'indirim-kodu' }, has_codes: true, is_low_stock: true,
  },
  {
    id: 'm3', slug: 'ornek-3', title: 'Dış giyimde sezon avantajı',
    description: 'Mont ve trençkotlarda üyelere özel kod.',
    partner_name: 'Network', partner_logo_url: null, cover_image_url: null,
    discount_label: '%20 indirim', is_featured: false, featured_order: 0,
    valid_until: '2026-07-31', starts_at: null, created_at: '2026-05-10', max_codes_per_user: 1,
    terms: null, type: { id: 't1', name: 'İndirim Kodu', slug: 'indirim-kodu' }, has_codes: true, is_low_stock: false,
  },
];

export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [types, setTypes] = useState<CampaignType[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  const [activeType, setActiveType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('default');

  useEffect(() => {
    let alive = true;
    const okJson = (r: Response) => (r.ok ? r.json() : Promise.reject(new Error()));
    const soft = (r: Response) => (r.ok ? r.json() : []);
    Promise.all([
      fetch('/api/campaigns').then(okJson),
      fetch('/api/campaign-types').then(soft).catch(() => []),
      fetch('/api/announcements').then(soft).catch(() => []),
    ])
      .then(([c, t, a]) => {
        if (!alive) return;
        const list = c as Campaign[];
        if (list.length === 0) {
          setCampaigns(MOCK);
          setUsingMock(true);
        } else {
          setCampaigns(list);
        }
        setTypes(t as CampaignType[]);
        setAnnouncements(a as Announcement[]);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setCampaigns(MOCK);
        setUsingMock(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const searching = search.trim().length > 0;
  const featured = useMemo(() => campaigns.filter((c) => c.is_featured), [campaigns]);

  const grid = useMemo(() => {
    let list: Campaign[];
    if (searching) {
      const q = search.trim().toLocaleLowerCase('tr');
      list = campaigns.filter((c) =>
        [c.title, c.partner_name, c.discount_label]
          .filter(Boolean)
          .some((s) => (s as string).toLocaleLowerCase('tr').includes(q))
      );
    } else if (activeType !== 'all') {
      list = campaigns.filter((c) => c.type?.slug === activeType);
    } else {
      list = campaigns.filter((c) => !c.is_featured);
    }
    return [...list].sort((a, b) => {
      if (sort === 'new') {
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      }
      if (sort === 'ending') {
        const av = a.valid_until ? new Date(a.valid_until).getTime() : Infinity;
        const bv = b.valid_until ? new Date(b.valid_until).getTime() : Infinity;
        return av - bv;
      }
      return 0;
    });
  }, [campaigns, searching, search, activeType, sort]);

  const showHero = !searching && activeType === 'all' && featured.length > 0;
  const showTabs = types.length >= 2;

  const gridLabel = searching
    ? 'Sonuçlar'
    : activeType !== 'all'
      ? (types.find((t) => t.slug === activeType)?.name ?? 'Kampanyalar')
      : 'Tüm Kampanyalar';

  return (
    <div className="ds">
      <AnnouncementBar items={announcements} />
      <DsNav />

      <div className="ds-container">
        <header className="ds-hero">
          <span className="ds-eyebrow">Üyelere Özel</span>
          <h1 className="ds-h1">Ayrıcalıklarınız</h1>
          <p className="ds-sub">
            TALPA üyeliğinize özel, anlaşmalı markalarda geçerli indirim kodları. Kampanyayı seçin,
            T.C. kimlik numaranızla doğrulayın, kodunuz anında sizin olsun.
          </p>
        </header>

        {loading ? (
          <div className="ds-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="ds-skel" style={{ height: '320px' }} />
            ))}
          </div>
        ) : (
          <>
            {showHero && (
              <>
                <h2 className="ds-section-label" style={{ marginTop: '0.5rem' }}>
                  Öne Çıkan
                </h2>
                <div style={{ display: 'grid', gap: '1.25rem', marginBottom: '0.5rem' }}>
                  {featured.map((c) => (
                    <CampaignCardDS key={c.id} campaign={c} featured />
                  ))}
                </div>
              </>
            )}

            {showTabs && (
              <div className="ds-tabs" role="tablist">
                <button
                  type="button"
                  className={`ds-tab${activeType === 'all' ? ' active' : ''}`}
                  onClick={() => setActiveType('all')}
                >
                  Tümü
                </button>
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`ds-tab${activeType === t.slug ? ' active' : ''}`}
                    onClick={() => setActiveType(t.slug)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            <h2 className="ds-section-label">{gridLabel}</h2>

            <div className="ds-toolbar">
              <div className="ds-search">
                <Search size={16} />
                <input
                  className="ds-input"
                  type="search"
                  placeholder="Kampanya veya marka ara…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="ds-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Sıralama"
              >
                <option value="default">Varsayılan sıra</option>
                <option value="new">Yeni</option>
                <option value="ending">Bitişe yakın</option>
              </select>
            </div>

            {grid.length === 0 ? (
              <div className="ds-empty">
                {searching ? 'Aramanızla eşleşen kampanya yok.' : 'Bu türde aktif kampanya yok.'}
              </div>
            ) : (
              <div className="ds-grid">
                {grid.map((c) => (
                  <CampaignCardDS key={c.id} campaign={c} />
                ))}
              </div>
            )}

            <div className="ds-strip">
              <span className="ds-strip__text">
                <strong>Daha önce kod aldınız mı?</strong> Tüm indirim kodlarınızı tek yerde görün.
              </span>
              <Link to="/kodlarim" className="ds-camp__cta">
                Kodlarım <ArrowRight size={15} />
              </Link>
            </div>

            {usingMock && (
              <p style={{ marginTop: '2rem', color: 'var(--ds-ink-faint)', fontSize: '0.8rem' }}>
                Önizleme: API kapalı (veya boş) olduğundan örnek veri gösteriliyor.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

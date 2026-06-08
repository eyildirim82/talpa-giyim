import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Copy, Archive, ArchiveRestore, Trash2, Pencil, X } from 'lucide-react';
import type { CampaignType } from '../../lib/types';
import { useAdmin } from '../ctx';
import { usePageTitle, ADMIN_BRAND } from '../../lib/usePageTitle';

type AdminCampaign = {
  id: string;
  slug: string;
  title: string;
  discount_label: string;
  is_active: boolean;
  is_featured: boolean;
  is_archived: boolean;
  starts_at: string | null;
  valid_until: string | null;
  type_id: string | null;
  type: { id: string; name: string; slug: string } | null;
  totalCodes: number;
  usedCodes: number;
  remainingCodes: number;
};

type Status = 'live' | 'scheduled' | 'expired' | 'archived' | 'inactive';
const STATUS_LABEL: Record<Status, string> = {
  live: 'Canlı',
  scheduled: 'Zamanlanmış',
  expired: 'Süresi geçti',
  archived: 'Arşiv',
  inactive: 'Pasif',
};

function statusOf(c: AdminCampaign): Status {
  const today = new Date().toISOString().slice(0, 10);
  if (c.is_archived) return 'archived';
  if (!c.is_active) return 'inactive';
  if (c.starts_at && new Date(c.starts_at).getTime() > Date.now()) return 'scheduled';
  if (c.valid_until && c.valid_until < today) return 'expired';
  return 'live';
}

function slugify(text: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  let s = text;
  for (const k in map) s = s.replace(new RegExp(k, 'g'), map[k]);
  return s.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

const EMPTY_NEW = {
  title: '', slug: '', type_id: '', discount_label: '', partner_name: '', description: '',
  partner_logo_url: '', cover_image_url: '', starts_at: '', valid_until: '', max_codes_per_user: '1', terms: '',
};

export default function Campaigns() {
  usePageTitle('Kampanyalar', ADMIN_BRAND);
  const { getAuthHeaders, notify, signOut } = useAdmin();
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [types, setTypes] = useState<CampaignType[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_NEW });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const [cRes, tRes] = await Promise.all([
        fetch('/api/admin/campaigns', { headers }),
        fetch('/api/admin/campaign-types', { headers }),
      ]);
      if (cRes.status === 401) {
        await signOut();
        return;
      }
      if (cRes.status === 403) {
        notify('error', 'Bu hesabın yönetici yetkisi bulunmuyor.');
        await signOut();
        return;
      }
      setCampaigns((await cRes.json()) as AdminCampaign[]);
      if (tRes.ok) setTypes((await tRes.json()) as CampaignType[]);
    } catch {
      notify('error', 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, notify, signOut]);

  useEffect(() => {
    // load() async'tir (ilk satırı await); setState'ler await sonrası çalışır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return campaigns.filter((c) => {
      if (q && !`${c.title} ${c.slug}`.toLocaleLowerCase('tr').includes(q)) return false;
      if (typeFilter !== 'all' && c.type_id !== typeFilter) return false;
      if (statusFilter !== 'all' && statusOf(c) !== statusFilter) return false;
      return true;
    });
  }, [campaigns, search, typeFilter, statusFilter]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error();
  };

  const toggle = async (c: AdminCampaign, field: 'is_active' | 'is_featured' | 'is_archived') => {
    try {
      await patch(c.id, { [field]: !c[field] });
      await load();
    } catch {
      notify('error', 'Güncelleme başarısız.');
    }
  };

  const clone = async (c: AdminCampaign) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaigns/${c.id}/clone`, { method: 'POST', headers });
      if (!res.ok) throw new Error();
      notify('success', 'Kampanya kopyalandı (pasif).');
      await load();
    } catch {
      notify('error', 'Kopyalama başarısız.');
    }
  };

  const remove = async (c: AdminCampaign) => {
    if (!window.confirm(`"${c.title}" kampanyası, tüm kodları ve talepleriyle KALICI olarak silinecek. Emin misiniz?`)) {
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaigns/${c.id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error();
      notify('success', 'Kampanya silindi.');
      await load();
    } catch {
      notify('error', 'Silme başarısız.');
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const headers = await getAuthHeaders();
      const body = {
        title: form.title,
        slug: form.slug,
        type_id: form.type_id || null,
        discount_label: form.discount_label,
        partner_name: form.partner_name || null,
        description: form.description || null,
        partner_logo_url: form.partner_logo_url || null,
        cover_image_url: form.cover_image_url || null,
        starts_at: form.starts_at || null,
        valid_until: form.valid_until || null,
        max_codes_per_user: parseInt(form.max_codes_per_user, 10) || 1,
        terms: form.terms || null,
        is_active: false,
        is_featured: false,
      };
      const res = await fetch('/api/admin/campaigns', { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Hata');
      }
      notify('success', 'Kampanya oluşturuldu (pasif).');
      setShowNew(false);
      setForm({ ...EMPTY_NEW });
      await load();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Kampanya oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  };

  const setF = (k: keyof typeof EMPTY_NEW, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className="ds-admin__title">Kampanyalar</h1>
        <button type="button" className="ds-btn ds-btn--primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> Yeni Kampanya
        </button>
      </div>

      <div className="ds-toolbar2">
        <div className="ds-search" style={{ flex: 1, minWidth: '200px' }}>
          <Search size={16} />
          <input className="ds-input" type="search" placeholder="Başlık veya slug ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="ds-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Tür filtresi">
          <option value="all">Tür: Tümü</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select className="ds-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | Status)} aria-label="Durum filtresi">
          <option value="all">Durum: Tümü</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="ds-empty">Yükleniyor…</div>
      ) : filtered.length === 0 ? (
        <div className="ds-empty">{campaigns.length === 0 ? 'Henüz kampanya yok.' : 'Filtreyle eşleşen kampanya yok.'}</div>
      ) : (
        filtered.map((c) => {
          const st = statusOf(c);
          return (
            <div className="ds-rowcard" key={c.id}>
              <div className="ds-rowcard__top">
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.98rem' }}>{c.title}</strong>
                    <span className="ds-pill"><span className={`ds-dot ds-dot--${st}`} /> {STATUS_LABEL[st]}</span>
                    {c.type && <span className="ds-pill">{c.type.name}</span>}
                  </div>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', color: 'var(--ds-ink-faint)', marginTop: '0.2rem' }}>
                    /{c.slug} · Toplam {c.totalCodes} · Dağ {c.usedCodes} · Kalan {c.remainingCodes}
                  </div>
                </div>
                <div className="ds-rowcard__actions">
                  <button type="button" className={`ds-toggle${c.is_active ? ' on' : ''}`} onClick={() => void toggle(c, 'is_active')}>Aktif</button>
                  <button type="button" className={`ds-toggle${c.is_featured ? ' on' : ''}`} onClick={() => void toggle(c, 'is_featured')}>Öne çıkan</button>
                  <Link to={`/admin/kampanyalar/${c.id}`} className="ds-toggle" title="Düzenle"><Pencil size={14} /></Link>
                  <button type="button" className="ds-toggle" title="Klonla" onClick={() => void clone(c)}><Copy size={14} /></button>
                  <button type="button" className="ds-toggle" title={c.is_archived ? 'Arşivden çıkar' : 'Arşivle'} onClick={() => void toggle(c, 'is_archived')}>
                    {c.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  </button>
                  <button type="button" className="ds-toggle" title="Sil" style={{ color: 'var(--ds-danger)', borderColor: '#f0c8c4' }} onClick={() => void remove(c)}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {showNew && (
        <div className="ds-modal__overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div className="ds-modal">
            <div className="ds-modal__head">
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Yeni Kampanya</h2>
              <button type="button" className="ds-iconbtn" onClick={() => setShowNew(false)}><X size={20} /></button>
            </div>
            <form onSubmit={(e) => void create(e)}>
              <div className="ds-formrow">
                <label>Başlık *</label>
                <input className="ds-input" value={form.title} required onChange={(e) => setForm((p) => ({ ...p, title: e.target.value, slug: slugify(e.target.value) }))} />
              </div>
              <div className="ds-grid2">
                <div className="ds-formrow">
                  <label>Slug *</label>
                  <input className="ds-input" value={form.slug} required onChange={(e) => setF('slug', e.target.value)} />
                </div>
                <div className="ds-formrow">
                  <label>Tür</label>
                  <select className="ds-select" style={{ width: '100%' }} value={form.type_id} onChange={(e) => setF('type_id', e.target.value)}>
                    <option value="">(varsayılan)</option>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="ds-grid2">
                <div className="ds-formrow">
                  <label>İndirim Etiketi *</label>
                  <input className="ds-input" value={form.discount_label} required placeholder="%25 indirim" onChange={(e) => setF('discount_label', e.target.value)} />
                </div>
                <div className="ds-formrow">
                  <label>Partner Adı</label>
                  <input className="ds-input" value={form.partner_name} onChange={(e) => setF('partner_name', e.target.value)} />
                </div>
              </div>
              <div className="ds-formrow">
                <label>Açıklama</label>
                <textarea className="ds-input" value={form.description} onChange={(e) => setF('description', e.target.value)} />
              </div>
              <div className="ds-grid2">
                <div className="ds-formrow">
                  <label>Partner Logo URL</label>
                  <input className="ds-input" value={form.partner_logo_url} placeholder="https://…" onChange={(e) => setF('partner_logo_url', e.target.value)} />
                </div>
                <div className="ds-formrow">
                  <label>Kapak Görseli URL</label>
                  <input className="ds-input" value={form.cover_image_url} placeholder="https://…" onChange={(e) => setF('cover_image_url', e.target.value)} />
                </div>
              </div>
              <div className="ds-grid2">
                <div className="ds-formrow">
                  <label>Başlangıç Tarihi</label>
                  <input className="ds-input" type="date" value={form.starts_at} onChange={(e) => setF('starts_at', e.target.value)} />
                </div>
                <div className="ds-formrow">
                  <label>Bitiş Tarihi</label>
                  <input className="ds-input" type="date" value={form.valid_until} onChange={(e) => setF('valid_until', e.target.value)} />
                </div>
              </div>
              <div className="ds-grid2">
                <div className="ds-formrow">
                  <label>Üye Başına Maks. Kod</label>
                  <input className="ds-input" type="number" min={1} value={form.max_codes_per_user} onChange={(e) => setF('max_codes_per_user', e.target.value)} />
                </div>
                <div />
              </div>
              <div className="ds-formrow">
                <label>Kampanya Koşulları</label>
                <textarea className="ds-input" value={form.terms} onChange={(e) => setF('terms', e.target.value)} />
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--ds-ink-faint)', margin: '0 0 0.9rem' }}>
                Görsel yükleme (dosya seçerek) sonraki turda eklenecek; şimdilik URL girilebilir.
              </p>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button type="button" className="ds-btn ds-btn--ghost ds-btn--block" onClick={() => setShowNew(false)}>İptal</button>
                <button type="submit" className="ds-btn ds-btn--primary ds-btn--block" disabled={creating}>
                  {creating ? 'Oluşturuluyor…' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

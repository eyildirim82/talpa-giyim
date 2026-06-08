import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Link as LinkIcon } from 'lucide-react';
import { useAdmin } from '../ctx';
import { usePageTitle, ADMIN_BRAND } from '../../lib/usePageTitle';

type Announcement = {
  id: string;
  message: string;
  link_url: string | null;
  link_campaign_id: string | null;
  is_active: boolean;
  sort_order: number;
};

type CampaignOpt = { id: string; title: string };

type Draft = {
  id: string | null;
  message: string;
  link_campaign_id: string;
  link_url: string;
  is_active: boolean;
};

const EMPTY: Draft = { id: null, message: '', link_campaign_id: '', link_url: '', is_active: false };

export default function Announcements() {
  usePageTitle('Duyurular', ADMIN_BRAND);
  const { getAuthHeaders, notify } = useAdmin();
  const [items, setItems] = useState<Announcement[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const [aRes, cRes] = await Promise.all([
        fetch('/api/admin/announcements', { headers }),
        fetch('/api/admin/campaigns', { headers }),
      ]);
      if (aRes.ok) setItems((await aRes.json()) as Announcement[]);
      if (cRes.ok) {
        const cs = (await cRes.json()) as { id: string; title: string }[];
        setCampaigns(cs.map((c) => ({ id: c.id, title: c.title })));
      }
    } catch {
      notify('error', 'Duyurular yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const message = draft.message.trim();
    if (!message) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const body = {
        message,
        link_campaign_id: draft.link_campaign_id || null,
        link_url: draft.link_campaign_id ? null : draft.link_url || null,
        is_active: draft.is_active,
      };
      const res = draft.id
        ? await fetch(`/api/admin/announcements/${draft.id}`, { method: 'PUT', headers, body: JSON.stringify(body) })
        : await fetch('/api/admin/announcements', { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      notify('success', draft.id ? 'Duyuru güncellendi.' : 'Duyuru eklendi.');
      setDraft(null);
      await load();
    } catch {
      notify('error', 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: Announcement) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/announcements/${a.id}`, { method: 'PUT', headers, body: JSON.stringify({ is_active: !a.is_active }) });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      notify('error', 'Güncellenemedi.');
    }
  };

  const del = async (a: Announcement) => {
    if (!window.confirm('Bu duyuru silinecek. Emin misiniz?')) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/announcements/${a.id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error();
      notify('success', 'Duyuru silindi.');
      await load();
    } catch {
      notify('error', 'Silinemedi.');
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const other = index + dir;
    if (other < 0 || other >= items.length) return;
    const a = items[index];
    const b = items[other];
    try {
      const headers = await getAuthHeaders();
      await Promise.all([
        fetch(`/api/admin/announcements/${a.id}`, { method: 'PUT', headers, body: JSON.stringify({ sort_order: b.sort_order }) }),
        fetch(`/api/admin/announcements/${b.id}`, { method: 'PUT', headers, body: JSON.stringify({ sort_order: a.sort_order }) }),
      ]);
      await load();
    } catch {
      notify('error', 'Sıralama değiştirilemedi.');
    }
  };

  const openEdit = (a: Announcement) =>
    setDraft({
      id: a.id,
      message: a.message,
      link_campaign_id: a.link_campaign_id ?? '',
      link_url: a.link_url ?? '',
      is_active: a.is_active,
    });

  const campaignTitle = (id: string | null) => campaigns.find((c) => c.id === id)?.title;

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className="ds-admin__title">Duyurular</h1>
        <button type="button" className="ds-btn ds-btn--primary" onClick={() => setDraft({ ...EMPTY })}><Plus size={16} /> Yeni Duyuru</button>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        {loading ? (
          <div className="ds-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="ds-empty">Henüz duyuru yok.</div>
        ) : (
          items.map((a, i) => (
            <div className="ds-rowcard" key={a.id}>
              <div className="ds-rowcard__top">
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '0.95rem' }}>{a.message}</strong>
                  {(a.link_campaign_id || a.link_url) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--ds-ink-faint)', marginTop: '0.25rem' }}>
                      <LinkIcon size={12} />
                      {a.link_campaign_id ? (campaignTitle(a.link_campaign_id) ?? 'Kampanya') : a.link_url}
                    </div>
                  )}
                </div>
                <div className="ds-rowcard__actions">
                  <button type="button" className={`ds-toggle${a.is_active ? ' on' : ''}`} onClick={() => void toggleActive(a)}>
                    {a.is_active ? 'Aktif' : 'Pasif'}
                  </button>
                  <button type="button" className="ds-iconbtn" disabled={i === 0} onClick={() => void move(i, -1)}><ChevronUp size={16} /></button>
                  <button type="button" className="ds-iconbtn" disabled={i === items.length - 1} onClick={() => void move(i, 1)}><ChevronDown size={16} /></button>
                  <button type="button" className="ds-iconbtn" onClick={() => openEdit(a)}><Pencil size={15} /></button>
                  <button type="button" className="ds-iconbtn" onClick={() => void del(a)}><Trash2 size={15} color="var(--ds-danger)" /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {draft && (
        <div className="ds-modal__overlay" onClick={(e) => { if (e.target === e.currentTarget) setDraft(null); }}>
          <div className="ds-modal">
            <div className="ds-modal__head">
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{draft.id ? 'Duyuruyu Düzenle' : 'Yeni Duyuru'}</h2>
              <button type="button" className="ds-iconbtn" onClick={() => setDraft(null)}><X size={20} /></button>
            </div>
            <form onSubmit={(e) => void save(e)}>
              <div className="ds-formrow">
                <label>Mesaj *</label>
                <textarea className="ds-input" value={draft.message} required onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
              </div>
              <div className="ds-formrow">
                <label>Bağlantı — Kampanya (opsiyonel)</label>
                <select className="ds-select" style={{ width: '100%' }} value={draft.link_campaign_id} onChange={(e) => setDraft({ ...draft, link_campaign_id: e.target.value })}>
                  <option value="">(yok)</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div className="ds-formrow">
                <label>Bağlantı — Dış URL (kampanya seçiliyse yok sayılır)</label>
                <input className="ds-input" placeholder="https://…" value={draft.link_url} disabled={!!draft.link_campaign_id} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', margin: '0.25rem 0 1rem' }}>
                <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
                Hemen yayında (aktif)
              </label>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button type="button" className="ds-btn ds-btn--ghost ds-btn--block" onClick={() => setDraft(null)}>İptal</button>
                <button type="submit" className="ds-btn ds-btn--primary ds-btn--block" disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { CampaignType } from '../../lib/types';
import { useAdmin } from '../ctx';

export default function Types() {
  const { getAuthHeaders, notify } = useAdmin();
  const [items, setItems] = useState<CampaignType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/campaign-types', { headers });
      if (res.ok) setItems((await res.json()) as CampaignType[]);
    } catch {
      notify('error', 'Türler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/campaign-types', { method: 'POST', headers, body: JSON.stringify({ name }) });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Hata');
      }
      setNewName('');
      notify('success', 'Tür eklendi.');
      await load();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Tür eklenemedi.');
    }
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaign-types/${id}`, { method: 'PUT', headers, body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error();
      setEditId(null);
      await load();
    } catch {
      notify('error', 'Güncellenemedi.');
    }
  };

  const del = async (item: CampaignType) => {
    if (!window.confirm(`"${item.name}" türü silinecek. Emin misiniz?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaign-types/${item.id}`, { method: 'DELETE', headers });
      if (res.status === 409) {
        const d = (await res.json()) as { error?: string };
        notify('error', d.error ?? 'Bu tür kullanımda.');
        return;
      }
      if (!res.ok) throw new Error();
      notify('success', 'Tür silindi.');
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
        fetch(`/api/admin/campaign-types/${a.id}`, { method: 'PUT', headers, body: JSON.stringify({ sort_order: b.sort_order }) }),
        fetch(`/api/admin/campaign-types/${b.id}`, { method: 'PUT', headers, body: JSON.stringify({ sort_order: a.sort_order }) }),
      ]);
      await load();
    } catch {
      notify('error', 'Sıralama değiştirilemedi.');
    }
  };

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 className="ds-admin__title" style={{ marginBottom: '1rem' }}>Türler</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <input
          className="ds-input"
          placeholder="Yeni tür adı…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
        />
        <button type="button" className="ds-btn ds-btn--primary" onClick={() => void add()}><Plus size={16} /> Ekle</button>
      </div>

      {loading ? (
        <div className="ds-empty">Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div className="ds-empty">Henüz tür yok.</div>
      ) : (
        items.map((item, i) => (
          <div className="ds-rowcard" key={item.id}>
            <div className="ds-rowcard__top">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                {editId === item.id ? (
                  <input className="ds-input" style={{ maxWidth: '240px' }} value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                ) : (
                  <strong>{item.name}</strong>
                )}
                <span className="ds-pill">/{item.slug}</span>
              </div>
              <div className="ds-rowcard__actions">
                <button type="button" className="ds-iconbtn" disabled={i === 0} onClick={() => void move(i, -1)}><ChevronUp size={16} /></button>
                <button type="button" className="ds-iconbtn" disabled={i === items.length - 1} onClick={() => void move(i, 1)}><ChevronDown size={16} /></button>
                {editId === item.id ? (
                  <>
                    <button type="button" className="ds-iconbtn" onClick={() => void saveEdit(item.id)}><Check size={16} color="var(--ds-success)" /></button>
                    <button type="button" className="ds-iconbtn" onClick={() => setEditId(null)}><X size={16} /></button>
                  </>
                ) : (
                  <button type="button" className="ds-iconbtn" onClick={() => { setEditId(item.id); setEditName(item.name); }}><Pencil size={15} /></button>
                )}
                <button type="button" className="ds-iconbtn" onClick={() => void del(item)}><Trash2 size={15} color="var(--ds-danger)" /></button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

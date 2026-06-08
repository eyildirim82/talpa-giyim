import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  ArrowLeft, Save, Upload, FileSpreadsheet, Download, Search, Trash2, Plus,
  Pencil, Check, X, Loader2, Image as ImageIcon,
} from 'lucide-react';
import type { CampaignType } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { compressImage } from '../../lib/imageCompress';
import { useAdmin } from '../ctx';

type FullCampaign = {
  id: string; slug: string; title: string; description: string | null;
  partner_name: string | null; partner_logo_url: string | null; cover_image_url: string | null;
  discount_label: string; is_active: boolean; is_featured: boolean; is_archived: boolean;
  featured_order: number | null; max_codes_per_user: number;
  starts_at: string | null; valid_until: string | null; terms: string | null;
  type_id: string | null; type: { id: string; name: string; slug: string } | null;
  totalCodes: number; usedCodes: number; remainingCodes: number;
};

type Form = {
  title: string; slug: string; type_id: string; discount_label: string; partner_name: string;
  description: string; partner_logo_url: string; cover_image_url: string;
  starts_at: string; valid_until: string; max_codes_per_user: string; featured_order: string;
  terms: string; is_active: boolean; is_featured: boolean; is_archived: boolean;
};

function toForm(c: FullCampaign): Form {
  return {
    title: c.title, slug: c.slug, type_id: c.type_id ?? '', discount_label: c.discount_label,
    partner_name: c.partner_name ?? '', description: c.description ?? '',
    partner_logo_url: c.partner_logo_url ?? '', cover_image_url: c.cover_image_url ?? '',
    starts_at: c.starts_at ? c.starts_at.slice(0, 10) : '', valid_until: c.valid_until ?? '',
    max_codes_per_user: String(c.max_codes_per_user), featured_order: c.featured_order != null ? String(c.featured_order) : '',
    terms: c.terms ?? '', is_active: c.is_active, is_featured: c.is_featured, is_archived: c.is_archived,
  };
}

function readFirstColumn(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        resolve(
          json
            .map((row) => (Array.isArray(row) ? row[0] : undefined))
            .filter((v): v is string | number => v !== undefined && v !== null && v !== '')
            .map((v) => String(v).trim())
            .filter((v) => v.length > 0)
        );
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

// ───────────────────────── Kod havuzu ─────────────────────────
type CodeRow = { id: string; code: string; is_used: boolean; claimed_by_tc: string | null; claimed_at: string | null };
const PAGE_SIZE = 50;

function CodePool({ campaignId, onChanged }: { campaignId: string; onChanged: () => void }) {
  const { getAuthHeaders, notify } = useAdmin();
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newCode, setNewCode] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/admin/campaigns/${campaignId}/codes?search=${encodeURIComponent(query)}&page=${page}&pageSize=${PAGE_SIZE}`,
        { headers }
      );
      if (res.ok) {
        const d = (await res.json()) as { codes: CodeRow[]; total: number };
        setRows(d.codes);
        setTotal(d.total);
        setSelected(new Set());
      }
    } catch {
      notify('error', 'Kod havuzu alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [campaignId, query, page, getAuthHeaders, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const refreshAll = async () => {
    await load();
    onChanged();
  };

  const addOne = async () => {
    const code = newCode.trim();
    if (!code) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaigns/${campaignId}/codes/one`, {
        method: 'POST', headers, body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Hata');
      }
      setNewCode('');
      notify('success', 'Kod eklendi.');
      await refreshAll();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Kod eklenemedi.');
    }
  };

  const delOne = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/codes/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error();
      await refreshAll();
    } catch {
      notify('error', 'Silinemedi (dağıtılmış olabilir).');
    }
  };

  const bulkDel = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size} kod silinecek (dağıtılmışlar atlanır). Emin misiniz?`)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/codes/bulk-delete', {
        method: 'POST', headers, body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as { deleted: number };
      notify('success', `${d.deleted} kod silindi.`);
      await refreshAll();
    } catch {
      notify('error', 'Toplu silme başarısız.');
    }
  };

  const saveEdit = async (id: string) => {
    const code = editVal.trim();
    if (!code) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/codes/${id}`, {
        method: 'PUT', headers, body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Hata');
      }
      setEditId(null);
      await refreshAll();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Güncellenemedi.');
    }
  };

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const unusedIds = rows.filter((r) => !r.is_used).map((r) => r.id);
  const allSel = unusedIds.length > 0 && unusedIds.every((id) => selected.has(id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="ds-card2" style={{ marginTop: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.9rem' }}>
        <h3 style={{ margin: 0 }}>Kod Havuzu ({total})</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(searchInput); }}
          className="ds-search"
          style={{ flex: '0 0 auto', minWidth: '180px' }}
        >
          <Search size={16} />
          <input className="ds-input" type="search" placeholder="Kod ara…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </form>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
        <input className="ds-input" style={{ maxWidth: '220px' }} placeholder="Tek kod ekle…" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
        <button type="button" className="ds-btn ds-btn--ghost" onClick={() => void addOne()}><Plus size={15} /> Ekle</button>
        {selected.size > 0 && (
          <button type="button" className="ds-btn" style={{ background: 'var(--ds-danger)', color: '#fff' }} onClick={() => void bulkDel()}>
            <Trash2 size={15} /> Seçili sil ({selected.size})
          </button>
        )}
      </div>

      {loading ? (
        <div className="ds-empty">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="ds-empty">Kod yok.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="ds-tbl">
            <thead>
              <tr>
                <th style={{ width: '28px' }}>
                  <input
                    type="checkbox"
                    checked={allSel}
                    onChange={(e) => setSelected(e.target.checked ? new Set(unusedIds) : new Set())}
                  />
                </th>
                <th>Kod</th>
                <th>Durum</th>
                <th>TC</th>
                <th>Tarih</th>
                <th style={{ width: '70px' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {!r.is_used && (
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} />
                    )}
                  </td>
                  <td className="ds-tbl__mono">
                    {editId === r.id ? (
                      <input className="ds-input" style={{ padding: '0.3rem 0.5rem', maxWidth: '160px' }} value={editVal} onChange={(e) => setEditVal(e.target.value)} autoFocus />
                    ) : (
                      r.code
                    )}
                  </td>
                  <td style={{ color: r.is_used ? 'var(--ds-danger)' : 'var(--ds-success)', fontWeight: 600 }}>
                    {r.is_used ? 'Dağıtıldı' : 'Kalan'}
                  </td>
                  <td className="ds-tbl__mono">{r.claimed_by_tc ?? '—'}</td>
                  <td style={{ color: 'var(--ds-ink-faint)' }}>{r.claimed_at ? new Date(r.claimed_at).toLocaleDateString('tr-TR') : '—'}</td>
                  <td>
                    {!r.is_used && (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {editId === r.id ? (
                          <>
                            <button type="button" className="ds-iconbtn" onClick={() => void saveEdit(r.id)}><Check size={15} color="var(--ds-success)" /></button>
                            <button type="button" className="ds-iconbtn" onClick={() => setEditId(null)}><X size={15} /></button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="ds-iconbtn" onClick={() => { setEditId(r.id); setEditVal(r.code); }}><Pencil size={14} /></button>
                            <button type="button" className="ds-iconbtn" onClick={() => void delOne(r.id)}><Trash2 size={14} color="var(--ds-danger)" /></button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="ds-pager">
          <button type="button" className="ds-toggle" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Önceki</button>
          Sayfa {page} / {pages}
          <button type="button" className="ds-toggle" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Sonraki ›</button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Ana ekran ─────────────────────────
export default function CampaignDetail() {
  const { id = '' } = useParams();
  const { getAuthHeaders, notify } = useAdmin();

  const [campaign, setCampaign] = useState<FullCampaign | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [types, setTypes] = useState<CampaignType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [codeFile, setCodeFile] = useState<File | null>(null);
  const [codeFileCount, setCodeFileCount] = useState<number | null>(null);
  const [uploadingCodes, setUploadingCodes] = useState(false);

  // TC sorgu
  const [lookupTc, setLookupTc] = useState('');
  const [lookupRes, setLookupRes] = useState<{ found: boolean; codes?: { code: string; claimed_at: string | null }[] } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const [cRes, tRes] = await Promise.all([
        fetch(`/api/admin/campaigns/${id}`, { headers }),
        fetch('/api/admin/campaign-types', { headers }),
      ]);
      if (cRes.ok) {
        const c = (await cRes.json()) as FullCampaign;
        setCampaign(c);
        setForm(toForm(c));
      }
      if (tRes.ok) setTypes((await tRes.json()) as CampaignType[]);
    } catch {
      notify('error', 'Kampanya yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [id, getAuthHeaders, notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const setF = (k: keyof Form, v: string | boolean) =>
    setForm((p) => (p ? ({ ...p, [k]: v } as Form) : p));

  const uploadImage = async (file: File, key: 'logo' | 'cover') => {
    setUploading((p) => ({ ...p, [key]: true }));
    try {
      const optimized = await compressImage(file);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/upload', {
        method: 'POST', headers, body: JSON.stringify({ filename: optimized.name, contentType: optimized.type }),
      });
      if (!res.ok) throw new Error('Yükleme başlatılamadı');
      const { path, token, publicUrl } = (await res.json()) as { path: string; token: string; publicUrl: string };
      const { error } = await supabase.storage.from('campaign-images').uploadToSignedUrl(path, token, optimized, { contentType: optimized.type });
      if (error) throw error;
      setF(key === 'logo' ? 'partner_logo_url' : 'cover_image_url', publicUrl);
      notify('success', 'Görsel yüklendi.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Görsel yüklenemedi.');
    } finally {
      setUploading((p) => ({ ...p, [key]: false }));
    }
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const body = {
        title: form.title, slug: form.slug, type_id: form.type_id || null,
        discount_label: form.discount_label, partner_name: form.partner_name || null,
        description: form.description || null, partner_logo_url: form.partner_logo_url || null,
        cover_image_url: form.cover_image_url || null, starts_at: form.starts_at || null,
        valid_until: form.valid_until || null, max_codes_per_user: parseInt(form.max_codes_per_user, 10) || 1,
        featured_order: form.featured_order !== '' ? parseInt(form.featured_order, 10) : null,
        terms: form.terms || null, is_active: form.is_active, is_featured: form.is_featured, is_archived: form.is_archived,
      };
      const res = await fetch(`/api/admin/campaigns/${id}`, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      notify('success', 'Kampanya kaydedildi.');
      await load();
    } catch {
      notify('error', 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const pickCodeFile = async (file: File | null) => {
    setCodeFile(file);
    setCodeFileCount(null);
    if (file) {
      try {
        const codes = await readFirstColumn(file);
        setCodeFileCount(codes.length);
      } catch {
        /* yoksay */
      }
    }
  };

  const uploadCodes = async () => {
    if (!codeFile) return;
    setUploadingCodes(true);
    try {
      const codes = await readFirstColumn(codeFile);
      if (codes.length === 0) throw new Error('Geçerli kod bulunamadı.');
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaigns/${id}/codes`, { method: 'POST', headers, body: JSON.stringify({ codes }) });
      const d = (await res.json()) as { inserted?: number; error?: string };
      if (!res.ok) throw new Error(d.error);
      notify('success', `${d.inserted ?? 0} kod yüklendi.`);
      setCodeFile(null);
      setCodeFileCount(null);
      await load();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Kodlar yüklenemedi.');
    } finally {
      setUploadingCodes(false);
    }
  };

  const exportCsv = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaigns/${id}/export`, { headers });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form?.slug ?? 'kampanya'}-kod-raporu.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify('error', 'Rapor indirilemedi.');
    }
  };

  const lookup = async () => {
    if (lookupTc.length !== 11) return;
    setLookupLoading(true);
    setLookupRes(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaigns/${id}/lookup?tc_no=${lookupTc}`, { headers });
      setLookupRes((await res.json()) as { found: boolean; codes?: { code: string; claimed_at: string | null }[] });
    } catch {
      setLookupRes({ found: false });
    } finally {
      setLookupLoading(false);
    }
  };

  if (loading || !form || !campaign) {
    return (
      <div>
        <Link to="/admin/kampanyalar" className="ds-back" style={{ marginTop: 0 }}><ArrowLeft size={16} /> Kampanyalar</Link>
        <div className="ds-skel" style={{ height: '300px', marginTop: '1rem' }} />
      </div>
    );
  }

  const usagePct = campaign.totalCodes > 0 ? Math.round((campaign.usedCodes / campaign.totalCodes) * 100) : 0;

  return (
    <div>
      <Link to="/admin/kampanyalar" className="ds-back" style={{ marginTop: 0 }}><ArrowLeft size={16} /> Kampanyalar</Link>
      <h1 className="ds-admin__title" style={{ margin: '0.4rem 0 1.25rem' }}>{campaign.title}</h1>

      <div className="ds-cols">
        {/* Düzenle */}
        <div className="ds-card2">
          <h3>Düzenle</h3>
          <div className="ds-formrow"><label>Başlık</label><input className="ds-input" value={form.title} onChange={(e) => setF('title', e.target.value)} /></div>
          <div className="ds-grid2">
            <div className="ds-formrow"><label>Slug</label><input className="ds-input" value={form.slug} onChange={(e) => setF('slug', e.target.value)} /></div>
            <div className="ds-formrow">
              <label>Tür</label>
              <select className="ds-select" style={{ width: '100%' }} value={form.type_id} onChange={(e) => setF('type_id', e.target.value)}>
                <option value="">(varsayılan)</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="ds-grid2">
            <div className="ds-formrow"><label>İndirim Etiketi</label><input className="ds-input" value={form.discount_label} onChange={(e) => setF('discount_label', e.target.value)} /></div>
            <div className="ds-formrow"><label>Partner Adı</label><input className="ds-input" value={form.partner_name} onChange={(e) => setF('partner_name', e.target.value)} /></div>
          </div>
          <div className="ds-formrow"><label>Açıklama</label><textarea className="ds-input" value={form.description} onChange={(e) => setF('description', e.target.value)} /></div>

          <ImageField label="Partner Logo" value={form.partner_logo_url} uploading={!!uploading.logo}
            onChange={(v) => setF('partner_logo_url', v)} onUpload={(f) => void uploadImage(f, 'logo')} />
          <ImageField label="Kapak Görseli" value={form.cover_image_url} uploading={!!uploading.cover}
            onChange={(v) => setF('cover_image_url', v)} onUpload={(f) => void uploadImage(f, 'cover')} />

          <div className="ds-grid2">
            <div className="ds-formrow"><label>Başlangıç</label><input className="ds-input" type="date" value={form.starts_at} onChange={(e) => setF('starts_at', e.target.value)} /></div>
            <div className="ds-formrow"><label>Bitiş</label><input className="ds-input" type="date" value={form.valid_until} onChange={(e) => setF('valid_until', e.target.value)} /></div>
          </div>
          <div className="ds-grid2">
            <div className="ds-formrow"><label>Üye Başına Maks. Kod</label><input className="ds-input" type="number" min={1} value={form.max_codes_per_user} onChange={(e) => setF('max_codes_per_user', e.target.value)} /></div>
            <div className="ds-formrow"><label>Öne Çıkma Sırası</label><input className="ds-input" type="number" value={form.featured_order} onChange={(e) => setF('featured_order', e.target.value)} /></div>
          </div>
          <div className="ds-formrow"><label>Koşullar</label><textarea className="ds-input" value={form.terms} onChange={(e) => setF('terms', e.target.value)} /></div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.5rem 0 1rem' }}>
            <button type="button" className={`ds-toggle${form.is_active ? ' on' : ''}`} onClick={() => setF('is_active', !form.is_active)}>Aktif</button>
            <button type="button" className={`ds-toggle${form.is_featured ? ' on' : ''}`} onClick={() => setF('is_featured', !form.is_featured)}>Öne çıkan</button>
            <button type="button" className={`ds-toggle${form.is_archived ? ' on' : ''}`} onClick={() => setF('is_archived', !form.is_archived)}>Arşiv</button>
          </div>
          <button type="button" className="ds-btn ds-btn--primary ds-btn--block" onClick={() => void save()} disabled={saving}>
            <Save size={16} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>

        {/* Kod yükleme + özet */}
        <div className="ds-card2">
          <h3>Kod Yükleme</h3>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void pickCodeFile(e.target.files?.[0] ?? null)} />
          {codeFileCount != null && (
            <div className="ds-alert ds-alert--info" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              <strong>{codeFileCount}</strong> kod tespit edildi.
            </div>
          )}
          <p style={{ fontSize: '0.78rem', color: 'var(--ds-ink-faint)', margin: '0.6rem 0 0.9rem' }}>
            Kodları tek sütun (A) halinde içeren Excel/CSV yükleyin. Mükerrerler elenir.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="ds-btn ds-btn--primary" disabled={!codeFile || uploadingCodes} onClick={() => void uploadCodes()}>
              <FileSpreadsheet size={16} /> {uploadingCodes ? 'Yükleniyor…' : 'Kodları Yükle'}
            </button>
            <button type="button" className="ds-btn ds-btn--ghost" onClick={() => void exportCsv()}>
              <Download size={16} /> CSV İndir
            </button>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h3>Kullanım</h3>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div><div className="ds-stat__label">Toplam</div><strong>{campaign.totalCodes}</strong></div>
              <div><div className="ds-stat__label">Dağıtılan</div><strong style={{ color: 'var(--ds-danger)' }}>{campaign.usedCodes}</strong></div>
              <div><div className="ds-stat__label">Kalan</div><strong style={{ color: 'var(--ds-success)' }}>{campaign.remainingCodes}</strong></div>
            </div>
            <div className="ds-progress"><div style={{ width: `${usagePct}%` }} /></div>
            <div style={{ fontSize: '0.78rem', color: 'var(--ds-ink-faint)', marginTop: '0.3rem' }}>%{usagePct} kullanıldı</div>
          </div>
        </div>
      </div>

      {/* Kod havuzu */}
      <CodePool campaignId={id} onChanged={() => void load()} />

      {/* TC sorgu */}
      <div className="ds-card2" style={{ marginTop: '1.25rem', maxWidth: '520px' }}>
        <h3>TC Sorgu</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="ds-input" inputMode="numeric" maxLength={11} placeholder="11 haneli TCKN" value={lookupTc}
            onChange={(e) => { setLookupTc(e.target.value.replace(/\D/g, '').slice(0, 11)); setLookupRes(null); }} />
          <button type="button" className="ds-btn ds-btn--primary" disabled={lookupTc.length !== 11 || lookupLoading} onClick={() => void lookup()}>
            {lookupLoading ? <Loader2 size={16} className="ds-spin" /> : <Search size={16} />} Sorgula
          </button>
        </div>
        {lookupRes && (
          <div style={{ marginTop: '0.9rem', fontSize: '0.88rem' }}>
            {!lookupRes.found ? (
              <span style={{ color: 'var(--ds-ink-soft)' }}>Bu üye bu kampanyadan kod almamış.</span>
            ) : (
              (lookupRes.codes ?? []).map((c, i) => (
                <div key={i} className="ds-tbl__mono" style={{ color: 'var(--ds-accent)', fontWeight: 700 }}>
                  {c.code}
                  {c.claimed_at && <span style={{ color: 'var(--ds-ink-faint)', fontWeight: 400, marginLeft: '0.5rem' }}>{new Date(c.claimed_at).toLocaleString('tr-TR')}</span>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Görsel alanı ─────────────────────────
function ImageField({
  label, value, uploading, onChange, onUpload,
}: {
  label: string; value: string; uploading: boolean;
  onChange: (v: string) => void; onUpload: (file: File) => void;
}) {
  return (
    <div className="ds-formrow">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input className="ds-input" style={{ flex: 1, minWidth: 0 }} value={value} placeholder="https://… veya yükle →" onChange={(e) => onChange(e.target.value)} />
        <label className="ds-btn ds-btn--ghost" style={{ cursor: uploading ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
          <Upload size={15} /> {uploading ? '…' : 'Yükle'}
          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); e.target.value = ''; } }} />
        </label>
      </div>
      {value && (
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ds-ink-faint)', fontSize: '0.78rem' }}>
          <ImageIcon size={14} />
          <img src={value} alt="" style={{ height: '36px', maxWidth: '110px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--ds-border)' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
      )}
    </div>
  );
}

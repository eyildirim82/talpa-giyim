import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ShieldCheck,
  Plus,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  X,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Upload,
  ImageIcon,
  Search,
  Trash2,
  History,
  Eye,
  EyeOff,
} from 'lucide-react';

function slugify(text: string): string {
  const trMap: Record<string, string> = {
    'ç': 'c', 'Ç': 'c',
    'ğ': 'g', 'Ğ': 'g',
    'ı': 'i', 'I': 'i',
    'İ': 'i',
    'ö': 'o', 'Ö': 'o',
    'ş': 's', 'Ş': 's',
    'ü': 'u', 'Ü': 'u',
  };
  let slug = text;
  for (const key in trMap) {
    slug = slug.replace(new RegExp(key, 'g'), trMap[key]);
  }
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

type Campaign = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  partner_name: string | null;
  partner_logo_url: string | null;
  cover_image_url: string | null;
  discount_label: string;
  is_active: boolean;
  is_featured: boolean;
  featured_order: number | null;
  max_codes_per_user: number;
  valid_until: string | null;
  terms: string | null;
  created_at: string;
  totalCodes: number;
  usedCodes: number;
  remainingCodes: number;
};

type Stats = {
  totalCampaigns: number;
  totalCodes: number;
  usedCodes: number;
  remainingCodes: number;
};

type LookupResult =
  | { found: false }
  | { found: true; tc_no: string; codes: { code: string; claimed_at: string | null }[] };

type PreviewCode = { code: string; is_used: boolean; claimed_by_tc: string | null; claimed_at: string | null };
type PreviewClaim = { tc_no: string; claimed_at: string | null };
type PreviewData = { codes: PreviewCode[]; claims: PreviewClaim[] };

type EditForm = {
  title: string;
  description: string;
  partner_name: string;
  partner_logo_url: string;
  cover_image_url: string;
  discount_label: string;
  is_active: boolean;
  is_featured: boolean;
  featured_order: string;
  max_codes_per_user: string;
  valid_until: string;
  terms: string;
};

type NewForm = {
  slug: string;
  title: string;
  description: string;
  partner_name: string;
  partner_logo_url: string;
  cover_image_url: string;
  discount_label: string;
  valid_until: string;
  max_codes_per_user: string;
  terms: string;
};

const EMPTY_NEW: NewForm = {
  slug: '',
  title: '',
  description: '',
  partner_name: '',
  partner_logo_url: '',
  cover_image_url: '',
  discount_label: '',
  valid_until: '',
  max_codes_per_user: '1',
  terms: '',
};

function campaignToEditForm(c: Campaign): EditForm {
  return {
    title: c.title,
    description: c.description ?? '',
    partner_name: c.partner_name ?? '',
    partner_logo_url: c.partner_logo_url ?? '',
    cover_image_url: c.cover_image_url ?? '',
    discount_label: c.discount_label,
    is_active: c.is_active,
    is_featured: c.is_featured,
    featured_order: c.featured_order !== null ? String(c.featured_order) : '',
    max_codes_per_user: String(c.max_codes_per_user),
    valid_until: c.valid_until ?? '',
    terms: c.terms ?? '',
  };
}

// ─── Helper components ────────────────────────────────────────────────────────

function Toggle({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: boolean;
  color: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        background: 'none',
        border: `1px solid ${value ? color : 'var(--border-color)'}`,
        borderRadius: '0.375rem',
        padding: '0.35rem 0.6rem',
        cursor: 'pointer',
        color: value ? color : 'var(--text-muted)',
        fontSize: '0.75rem',
        fontWeight: 600,
        transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {value ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
      {label}
    </button>
  );
}

function FormField({
  label,
  value,
  onChange,
  textarea,
  type,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const sharedStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--border-color)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: 'var(--text-main)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <label
        style={{
          display: 'block',
          color: 'var(--text-muted)',
          fontSize: '0.775rem',
          fontWeight: 500,
          marginBottom: '0.35rem',
        }}
      >
        {label}
      </label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          rows={3}
          style={{ ...sharedStyle, resize: 'vertical' }}
        />
      ) : (
        <input
          type={type ?? 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={sharedStyle}
        />
      )}
    </div>
  );
}

function ImageField({
  label,
  value,
  onChange,
  onUpload,
  uploading,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
}) {
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.775rem', fontWeight: 500, marginBottom: '0.35rem' }}>
        {label}
      </label>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... veya yükle →"
          style={{
            flex: 1,
            padding: '0.625rem 0.875rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color)',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            color: 'var(--text-main)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            minWidth: 0,
          }}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0 0.875rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color)',
            backgroundColor: uploading ? 'rgba(15,23,42,0.3)' : 'rgba(15,23,42,0.6)',
            color: uploading ? 'var(--text-muted)' : 'var(--text-main)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: uploading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          <Upload size={14} />
          {uploading ? 'Yükleniyor…' : 'Yükle'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            disabled={uploading}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file).then(() => { e.target.value = ''; });
            }}
          />
        </label>
      </div>

      {value && (
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img
            src={value}
            alt=""
            style={{ height: '48px', maxWidth: '120px', objectFit: 'contain', borderRadius: '0.375rem', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
            {value.split('/').pop()}
          </span>
        </div>
      )}

      {!value && (
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          <ImageIcon size={13} /> Görsel seçilmedi
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  // ── Auth (Supabase) ──
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    };
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError('E-posta veya şifre hatalı.');
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // ── Data ──
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── UI ──
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editForms, setEditForms] = useState<Record<string, EditForm>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [codeFiles, setCodeFiles] = useState<Record<string, File | undefined>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadPreviews, setUploadPreviews] = useState<Record<string, { count: number; firstCodes: string[] } | undefined>>({});
  const [exporting, setExporting] = useState<Record<string, boolean>>({});

  async function handleExportCSV(campaignId: string, slug: string) {
    setExporting((prev) => ({ ...prev, [campaignId]: true }));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaigns/${campaignId}/export`, { headers });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}-kod-raporu.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notify('success', 'Rapor indirildi.');
    } catch {
      notify('error', 'Rapor oluşturulamadı.');
    } finally {
      setExporting((prev) => ({ ...prev, [campaignId]: false }));
    }
  }

  // Per-field image upload state: `${campaignId}-logo` | `${campaignId}-cover` | `new-logo` | `new-cover`
  const [imgUploading, setImgUploading] = useState<Record<string, boolean>>({});
  const [newForm, setNewForm] = useState<NewForm>(EMPTY_NEW);
  const [creating, setCreating] = useState(false);

  // TC Sorgulama
  const [lookupModal, setLookupModal] = useState<{ campaignId: string; title: string } | null>(null);
  const [lookupTc, setLookupTc] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Veritabanı Önizleme
  const [previewData, setPreviewData] = useState<Record<string, PreviewData>>({});

  async function handleReset() {
    if (!window.confirm('Tüm kodlar ve talepler silinecek. Kampanyalar korunacak. Emin misiniz?')) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/reset', { method: 'DELETE', headers });
      if (res.ok) {
        notify('success', 'Tüm kodlar ve talepler silindi.');
        setPreviewData({});
        void fetchData();
      } else {
        notify('error', 'Sıfırlama başarısız.');
      }
    } catch {
      notify('error', 'Sıfırlama başarısız.');
    }
  }

  async function fetchPreview(campaignId: string) {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaigns/${campaignId}/preview`, { headers });
      if (!res.ok) return;
      const data = (await res.json()) as PreviewData;
      setPreviewData((prev) => ({ ...prev, [campaignId]: data }));
    } catch {
      // önizleme hatası sessizce geçilir
    }
  }

  async function handleLookup() {
    if (!lookupModal || lookupTc.length !== 11) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/admin/campaigns/${lookupModal.campaignId}/lookup?tc_no=${lookupTc}`,
        { headers }
      );
      const data = (await res.json()) as LookupResult;
      setLookupResult(data);
    } catch {
      setLookupResult({ found: false });
    } finally {
      setLookupLoading(false);
    }
  }

  function notify(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  async function fetchData() {
    setFetching(true);
    try {
      const headers = await getAuthHeaders();
      const [cRes, sRes] = await Promise.all([
        fetch('/api/admin/campaigns', { headers }),
        fetch('/api/admin/stats', { headers }),
      ]);

      if (cRes.status === 401 || sRes.status === 401) {
        await supabase.auth.signOut();
        return;
      }

      if (cRes.status === 403 || sRes.status === 403) {
        setAuthError('Bu hesabın yönetici yetkisi bulunmuyor.');
        await supabase.auth.signOut();
        return;
      }

      const campaignData = (await cRes.json()) as Campaign[];
      const statsData = (await sRes.json()) as Stats;

      setCampaigns(campaignData);
      setStats(statsData);

      const forms: Record<string, EditForm> = {};
      campaignData.forEach((c) => { forms[c.id] = campaignToEditForm(c); });
      setEditForms(forms);
    } catch {
      notify('error', 'Veriler yüklenemedi.');
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (session) void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ── Toggle is_active / is_featured ──
  async function handleToggle(campaign: Campaign, field: 'is_active' | 'is_featured') {
    const newValue = !campaign[field];
    setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? { ...c, [field]: newValue } : c)));
    setEditForms((prev) => ({ ...prev, [campaign.id]: { ...prev[campaign.id], [field]: newValue } }));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ [field]: newValue }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? { ...c, [field]: !newValue } : c)));
      setEditForms((prev) => ({ ...prev, [campaign.id]: { ...prev[campaign.id], [field]: !newValue } }));
      notify('error', 'Güncelleme başarısız.');
    }
  }

  function setEditField<K extends keyof EditForm>(id: string, key: K, value: EditForm[K]) {
    setEditForms((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }

  async function handleSave(id: string) {
    const form = editForms[id];
    if (!form) return;
    setSaving((prev) => ({ ...prev, [id]: true }));
    try {
      const headers = await getAuthHeaders();
      const body = {
        title: form.title,
        description: form.description || null,
        partner_name: form.partner_name || null,
        partner_logo_url: form.partner_logo_url || null,
        cover_image_url: form.cover_image_url || null,
        discount_label: form.discount_label,
        is_active: form.is_active,
        is_featured: form.is_featured,
        featured_order: form.featured_order !== '' ? parseInt(form.featured_order, 10) : null,
        max_codes_per_user: parseInt(form.max_codes_per_user, 10) || 1,
        valid_until: form.valid_until || null,
        terms: form.terms || null,
      };
      const res = await fetch(`/api/admin/campaigns/${id}`, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      notify('success', 'Kampanya güncellendi.');
      void fetchData();
    } catch {
      notify('error', 'Kampanya güncellenemedi.');
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const headers = await getAuthHeaders();
      const body = {
        slug: newForm.slug,
        title: newForm.title,
        discount_label: newForm.discount_label,
        description: newForm.description || null,
        partner_name: newForm.partner_name || null,
        partner_logo_url: newForm.partner_logo_url || null,
        cover_image_url: newForm.cover_image_url || null,
        valid_until: newForm.valid_until || null,
        terms: newForm.terms || null,
        max_codes_per_user: parseInt(newForm.max_codes_per_user, 10) || 1,
        is_active: false,
        is_featured: false,
      };
      const res = await fetch('/api/admin/campaigns', { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Hata');
      }
      notify('success', 'Kampanya oluşturuldu.');
      setShowNewModal(false);
      setNewForm(EMPTY_NEW);
      void fetchData();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Kampanya oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  }

  // ── Image upload ──
  async function uploadImage(file: File, fieldKey: string): Promise<string> {
    setImgUploading((prev) => ({ ...prev, [fieldKey]: true }));
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers,
        body: JSON.stringify({ filename: file.name, contentType: file.type, data: base64 }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? 'Yükleme başarısız');
      }
      const { url } = (await res.json()) as { url: string };
      return url;
    } finally {
      setImgUploading((prev) => ({ ...prev, [fieldKey]: false }));
    }
  }

  function readFirstColumn(file: File): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
          const columnData = json
            .map((row) => (Array.isArray(row) ? row[0] : undefined))
            .filter((v): v is string | number => v !== undefined && v !== null && v !== '')
            .map(String)
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
          resolve(columnData);
        } catch (err) { reject(err); }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  }

  async function handleUploadCodes(campaignId: string) {
    const file = codeFiles[campaignId];
    if (!file) return;
    setUploading((prev) => ({ ...prev, [campaignId]: true }));
    try {
      const codes = await readFirstColumn(file);
      if (codes.length === 0) throw new Error('Excel dosyasında geçerli kod bulunamadı.');
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/campaigns/${campaignId}/codes`, {
        method: 'POST', headers, body: JSON.stringify({ codes }),
      });
      const d = (await res.json()) as { inserted?: number; error?: string };
      if (!res.ok) throw new Error(d.error);
      notify('success', `${d.inserted ?? codes.length} kod yüklendi.`);
      setCodeFiles((prev) => ({ ...prev, [campaignId]: undefined }));
      void fetchData();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Kodlar yüklenemedi.');
    } finally {
      setUploading((prev) => ({ ...prev, [campaignId]: false }));
    }
  }

  const thStyle: React.CSSProperties = {
    padding: '0.375rem 0.5rem',
    textAlign: 'left',
    fontWeight: 600,
    borderBottom: '1px solid var(--border-color)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '0.35rem 0.5rem',
    borderBottom: '1px solid rgba(51,65,85,0.5)',
  };

  // ─── Render: Loading ──────────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="flex-center" style={{ minHeight: '80vh' }}>
        <div style={{ color: 'var(--text-muted)' }}>Yükleniyor…</div>
      </div>
    );
  }

  // ─── Render: Login ────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="flex-center" style={{ minHeight: '80vh', flexDirection: 'column' }}>
        <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <ShieldCheck
            size={48}
            style={{ margin: '0 auto 1.5rem', display: 'block', color: 'var(--primary)' }}
          />
          <h2 style={{ marginBottom: '0.5rem', marginTop: 0 }}>Yönetici Girişi</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Supabase hesabınızla giriş yapın
          </p>

          {authError && <div className="alert error" style={{ marginBottom: '1rem' }}>{authError}</div>}

          <form onSubmit={(e) => void handleLogin(e)} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <input
              type="email"
              placeholder="E-posta adresi"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{ padding: '0.875rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'rgba(15,23,42,0.5)', color: 'white', width: '100%' }}
            />
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ padding: '0.875rem 2.5rem 0.875rem 0.875rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'rgba(15,23,42,0.5)', color: 'white', width: '100%', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" className="btn" disabled={authLoading}>
              {authLoading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Render: Dashboard ────────────────────────────────────────────────────

  return (
    <div className="container" style={{ maxWidth: '1400px', paddingBottom: '4rem' }}>
      {/* Header */}
      <div className="admin-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.2rem' }}>
            <ShieldCheck size={26} /> Yönetim Paneli
          </h1>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{session.user.email}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn" style={{ width: 'auto' }} onClick={() => void fetchData()} disabled={fetching}>
            <RefreshCw size={15} /> Yenile
          </button>
          <button
            className="btn"
            style={{ width: 'auto', backgroundColor: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}
            onClick={() => void handleReset()}
          >
            <Trash2 size={15} /> Sistemi Sıfırla
          </button>
          <button className="btn" style={{ width: 'auto', backgroundColor: 'var(--border-color)' }} onClick={() => void handleLogout()}>
            Çıkış
          </button>
        </div>
      </div>

      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      {/* Stats */}
      {stats && (
        <div className="admin-grid">
          <div className="stat-box"><h3>Toplam Kampanya</h3><div className="value">{stats.totalCampaigns}</div></div>
          <div className="stat-box"><h3>Toplam Kod</h3><div className="value">{stats.totalCodes}</div></div>
          <div className="stat-box"><h3>Dağıtılan Kod</h3><div className="value" style={{ color: 'var(--danger)' }}>{stats.usedCodes}</div></div>
          <div className="stat-box"><h3>Kalan Kod</h3><div className="value" style={{ color: 'var(--accent)' }}>{stats.remainingCodes}</div></div>
        </div>
      )}

      {/* Campaigns header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Kampanyalar</h2>
        <button className="btn" style={{ width: 'auto' }} onClick={() => setShowNewModal(true)}>
          <Plus size={16} /> Yeni Kampanya
        </button>
      </div>

      {/* Arama çubuğu */}
      {campaigns.length > 0 && (
        <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Kampanya ara (Başlık veya Slug)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem 0.875rem 0.625rem 2.5rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-color)',
              backgroundColor: 'rgba(30, 41, 59, 0.6)',
              color: 'white',
              fontSize: '0.875rem',
              boxSizing: 'border-box'
            }}
          />
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
      )}

      {/* Campaign list */}
      {fetching && campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Yükleniyor…</div>
      ) : campaigns.length === 0 ? (
        <div className="action-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
          Henüz kampanya oluşturulmamış.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {campaigns
            .filter((c) =>
              c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.slug.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((campaign) => {
            const expanded = expandedId === campaign.id;
            const form = editForms[campaign.id];
            const usagePct = campaign.totalCodes > 0 ? Math.round((campaign.usedCodes / campaign.totalCodes) * 100) : 0;

            return (
              <div key={campaign.id} style={{ backgroundColor: 'var(--bg-card)', borderRadius: '0.875rem', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                {/* Card header */}
                <div
                  onClick={() => {
                    const newId = expanded ? null : campaign.id;
                    setExpandedId(newId);
                    if (newId) void fetchPreview(newId);
                  }}
                  style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', flexWrap: 'wrap' }}
                >
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.975rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.775rem', fontFamily: 'monospace', marginTop: '0.1rem' }}>/{campaign.slug}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Toggle label="Aktif" value={campaign.is_active} color="var(--accent)" onClick={(e) => { e.stopPropagation(); void handleToggle(campaign, 'is_active'); }} />
                    <Toggle label="Öne Çıkan" value={campaign.is_featured} color="#60a5fa" onClick={(e) => { e.stopPropagation(); void handleToggle(campaign, 'is_featured'); }} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLookupModal({ campaignId: campaign.id, title: campaign.title });
                        setLookupTc('');
                        setLookupResult(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: 'none',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.375rem',
                        padding: '0.35rem 0.6rem',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        fontFamily: 'inherit',
                      }}
                    >
                      <Search size={13} /> TC Sorgula
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.825rem' }}>
                    <StatPill label="Toplam" value={campaign.totalCodes} />
                    <StatPill label="Dağıtılan" value={campaign.usedCodes} color="var(--danger)" />
                    <StatPill label="Kalan" value={campaign.remainingCodes} color="var(--accent)" />
                  </div>

                  <div style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Expanded panel */}
                {expanded && form && (
                  <div style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem 1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                      {/* Edit form */}
                      <div>
                        <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kampanya Düzenle</h3>
                        <FormField label="Başlık" value={form.title} onChange={(v) => setEditField(campaign.id, 'title', v)} />
                        <FormField label="İndirim Etiketi" value={form.discount_label} onChange={(v) => setEditField(campaign.id, 'discount_label', v)} placeholder="%15 İndirim" />
                        <FormField label="Partner Adı" value={form.partner_name} onChange={(v) => setEditField(campaign.id, 'partner_name', v)} />
                        <FormField label="Açıklama" value={form.description} onChange={(v) => setEditField(campaign.id, 'description', v)} textarea />
                        <ImageField
                          label="Partner Logo"
                          value={form.partner_logo_url}
                          onChange={(v) => setEditField(campaign.id, 'partner_logo_url', v)}
                          uploading={!!imgUploading[`${campaign.id}-logo`]}
                          onUpload={async (file) => {
                            const url = await uploadImage(file, `${campaign.id}-logo`);
                            setEditField(campaign.id, 'partner_logo_url', url);
                          }}
                        />
                        <ImageField
                          label="Kapak Görseli"
                          value={form.cover_image_url}
                          onChange={(v) => setEditField(campaign.id, 'cover_image_url', v)}
                          uploading={!!imgUploading[`${campaign.id}-cover`]}
                          onUpload={async (file) => {
                            const url = await uploadImage(file, `${campaign.id}-cover`);
                            setEditField(campaign.id, 'cover_image_url', url);
                          }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <FormField label="Bitiş Tarihi" value={form.valid_until} onChange={(v) => setEditField(campaign.id, 'valid_until', v)} type="date" />
                          <FormField label="Üye Başına Maks. Kod" value={form.max_codes_per_user} onChange={(v) => setEditField(campaign.id, 'max_codes_per_user', v)} type="number" />
                        </div>
                        <FormField label="Öne Çıkma Sırası" value={form.featured_order} onChange={(v) => setEditField(campaign.id, 'featured_order', v)} type="number" placeholder="Yüksek = önce gösterilir" />
                        <FormField label="Kampanya Koşulları" value={form.terms} onChange={(v) => setEditField(campaign.id, 'terms', v)} textarea />
                        <button className="btn" onClick={() => void handleSave(campaign.id)} disabled={!!saving[campaign.id]}>
                          {saving[campaign.id] ? 'Kaydediliyor…' : 'Kaydet'}
                        </button>
                      </div>

                      {/* Code upload */}
                      <div>
                        <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kod Yükleme</h3>
                        
                        <div className="input-group" style={{ marginBottom: '0.875rem' }}>
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              setCodeFiles((prev) => ({ ...prev, [campaign.id]: file }));
                              if (file) {
                                try {
                                  const codes = await readFirstColumn(file);
                                  setUploadPreviews((prev) => ({
                                    ...prev,
                                    [campaign.id]: { count: codes.length, firstCodes: codes.slice(0, 3) }
                                  }));
                                } catch {
                                  // ignore
                                }
                              } else {
                                setUploadPreviews((prev) => ({ ...prev, [campaign.id]: undefined }));
                              }
                            }}
                          />
                          {codeFiles[campaign.id] && <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.35rem' }}>{codeFiles[campaign.id]!.name}</div>}
                        </div>

                        {uploadPreviews[campaign.id] && (
                          <div style={{ marginBottom: '0.875rem', fontSize: '0.8rem', color: 'var(--accent)', backgroundColor: 'rgba(16,185,129,0.06)', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <strong>{uploadPreviews[campaign.id]!.count}</strong> kod tespit edildi.
                            {uploadPreviews[campaign.id]!.firstCodes.length > 0 && (
                              <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                                (Örn: {uploadPreviews[campaign.id]!.firstCodes.join(', ')}...)
                              </span>
                            )}
                          </div>
                        )}

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.25rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                          * Kodları tek sütun (A sütunu) halinde içeren Excel (.xlsx, .xls) veya CSV dosyası yükleyin.
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button className="btn" style={{ flex: 1, minWidth: '130px' }} onClick={() => void handleUploadCodes(campaign.id)} disabled={!codeFiles[campaign.id] || !!uploading[campaign.id]}>
                            <FileSpreadsheet size={16} />
                            {uploading[campaign.id] ? 'Yükleniyor…' : 'Kodları Yükle'}
                          </button>
                          <button
                            className="btn"
                            style={{ flex: 1, minWidth: '180px', backgroundColor: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}
                            onClick={() => void handleExportCSV(campaign.id, campaign.slug)}
                            disabled={!!exporting[campaign.id]}
                          >
                            <Upload size={16} style={{ transform: 'rotate(180deg)' }} />
                            {exporting[campaign.id] ? 'İndiriliyor…' : 'Raporu CSV Olarak İndir'}
                          </button>
                        </div>

                        <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: '0.625rem', border: '1px solid var(--border-color)' }}>
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kod Kullanım Özeti</div>
                          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.875rem' }}>
                            <StatPill label="Toplam" value={campaign.totalCodes} size="lg" />
                            <StatPill label="Dağıtılan" value={campaign.usedCodes} color="var(--danger)" size="lg" />
                            <StatPill label="Kalan" value={campaign.remainingCodes} color="var(--accent)" size="lg" />
                          </div>
                          {campaign.totalCodes > 0 && (
                            <>
                              <div style={{ backgroundColor: 'var(--border-color)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${usagePct}%`, backgroundColor: 'var(--danger)', borderRadius: '999px', transition: 'width 0.4s' }} />
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>%{usagePct} kullanıldı</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Veritabanı Önizleme */}
                    {previewData[campaign.id] && (
                      <div style={{ marginTop: '2rem', gridColumn: '1 / -1' }}>
                        <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <History size={14} /> Veritabanı Önizleme
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Kodlar (Son 20)</div>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
                                <thead>
                                  <tr style={{ color: 'var(--text-muted)' }}>
                                    <th style={thStyle}>Kod</th>
                                    <th style={thStyle}>Durum</th>
                                    <th style={thStyle}>TC</th>
                                    <th style={thStyle}>Tarih</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {previewData[campaign.id].codes.length === 0 ? (
                                    <tr><td colSpan={4} style={{ ...tdStyle, color: 'var(--text-muted)', textAlign: 'center' }}>Kayıt yok</td></tr>
                                  ) : previewData[campaign.id].codes.map((c, i) => (
                                    <tr key={i}>
                                      <td style={{ ...tdStyle, fontFamily: 'monospace', color: 'var(--accent)' }}>{c.code}</td>
                                      <td style={{ ...tdStyle, color: c.is_used ? 'var(--danger)' : 'var(--accent)' }}>{c.is_used ? 'Kullanıldı' : 'Kalan'}</td>
                                      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{c.claimed_by_tc ?? '—'}</td>
                                      <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{c.claimed_at ? new Date(c.claimed_at).toLocaleString('tr-TR') : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Talepler (Son 20)</div>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
                                <thead>
                                  <tr style={{ color: 'var(--text-muted)' }}>
                                    <th style={thStyle}>TC</th>
                                    <th style={thStyle}>Tarih</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {previewData[campaign.id].claims.length === 0 ? (
                                    <tr><td colSpan={2} style={{ ...tdStyle, color: 'var(--text-muted)', textAlign: 'center' }}>Kayıt yok</td></tr>
                                  ) : previewData[campaign.id].claims.map((cl, i) => (
                                    <tr key={i}>
                                      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{cl.tc_no}</td>
                                      <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{cl.claimed_at ? new Date(cl.claimed_at).toLocaleString('tr-TR') : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Campaign Modal */}
      {showNewModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false); }}
        >
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border-color)', width: '100%', maxWidth: '660px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Yeni Kampanya</h2>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}>
                <X size={22} />
              </button>
            </div>
            <form onSubmit={(e) => void handleCreate(e)}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                <div style={{ gridColumn: '1 / -1' }}><FormField label="Başlık *" value={newForm.title} onChange={(v) => setNewForm((p) => ({ ...p, title: v, slug: slugify(v) }))} placeholder="Brooks Brothers 2026" required /></div>
                <div style={{ gridColumn: '1 / -1' }}><FormField label="Slug *" value={newForm.slug} onChange={(v) => setNewForm((p) => ({ ...p, slug: v }))} placeholder="brooks-brothers-2026" required /></div>
                <FormField label="İndirim Etiketi *" value={newForm.discount_label} onChange={(v) => setNewForm((p) => ({ ...p, discount_label: v }))} placeholder="%15 İndirim" required />
                <FormField label="Partner Adı" value={newForm.partner_name} onChange={(v) => setNewForm((p) => ({ ...p, partner_name: v }))} placeholder="Brooks Brothers" />
                <div style={{ gridColumn: '1 / -1' }}><FormField label="Açıklama" value={newForm.description} onChange={(v) => setNewForm((p) => ({ ...p, description: v }))} textarea /></div>
                <ImageField
                  label="Partner Logo"
                  value={newForm.partner_logo_url}
                  onChange={(v) => setNewForm((p) => ({ ...p, partner_logo_url: v }))}
                  uploading={!!imgUploading['new-logo']}
                  onUpload={async (file) => {
                    const url = await uploadImage(file, 'new-logo');
                    setNewForm((p) => ({ ...p, partner_logo_url: url }));
                  }}
                />
                <ImageField
                  label="Kapak Görseli"
                  value={newForm.cover_image_url}
                  onChange={(v) => setNewForm((p) => ({ ...p, cover_image_url: v }))}
                  uploading={!!imgUploading['new-cover']}
                  onUpload={async (file) => {
                    const url = await uploadImage(file, 'new-cover');
                    setNewForm((p) => ({ ...p, cover_image_url: url }));
                  }}
                />
                <FormField label="Bitiş Tarihi" value={newForm.valid_until} onChange={(v) => setNewForm((p) => ({ ...p, valid_until: v }))} type="date" />
                <FormField label="Üye Başına Maks. Kod" value={newForm.max_codes_per_user} onChange={(v) => setNewForm((p) => ({ ...p, max_codes_per_user: v }))} type="number" />
                <div style={{ gridColumn: '1 / -1' }}><FormField label="Kampanya Koşulları" value={newForm.terms} onChange={(v) => setNewForm((p) => ({ ...p, terms: v }))} textarea /></div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn" style={{ flex: 1, backgroundColor: 'var(--border-color)' }} onClick={() => setShowNewModal(false)}>İptal</button>
                <button type="submit" className="btn" style={{ flex: 1 }} disabled={creating}><Plus size={16} />{creating ? 'Oluşturuluyor…' : 'Oluştur'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TC Sorgulama Modal */}
      {lookupModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={(e) => { if (e.target === e.currentTarget) setLookupModal(null); }}
        >
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '1rem', border: '1px solid var(--border-color)', width: '100%', maxWidth: '480px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{lookupModal.title} — </span>Üye Sorgusu
              </h2>
              <button onClick={() => setLookupModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={11}
                placeholder="11 haneli TCKN giriniz"
                value={lookupTc}
                onChange={(e) => {
                  setLookupTc(e.target.value.replace(/\D/g, '').slice(0, 11));
                  setLookupResult(null);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleLookup(); }}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(15,23,42,0.6)',
                  color: 'var(--text-main)',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                }}
              />
              <button
                className="btn"
                style={{ width: 'auto' }}
                onClick={() => void handleLookup()}
                disabled={lookupTc.length !== 11 || lookupLoading}
              >
                <Search size={15} /> {lookupLoading ? 'Sorgulanıyor…' : 'Sorgula'}
              </button>
            </div>

            {lookupResult && (
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(15,23,42,0.5)',
                  border: `1px solid ${lookupResult.found ? 'rgba(16,185,129,0.3)' : 'var(--border-color)'}`,
                }}
              >
                {!lookupResult.found ? (
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Bu üye bu kampanyadan kod almamıştır.
                  </p>
                ) : (
                  <div style={{ fontSize: '0.875rem' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      TCKN: <span style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{lookupResult.tc_no}</span>
                    </div>
                    {lookupResult.codes.map((c, i) => (
                      <div key={i} style={{ marginBottom: i < lookupResult.codes.length - 1 ? '0.5rem' : 0 }}>
                        <div>
                          Kampanyadan aldığı kod:{' '}
                          <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 700 }}>{c.code}</span>
                        </div>
                        {c.claimed_at && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                            Alım tarihi: {new Date(c.claimed_at).toLocaleString('tr-TR')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, color, size = 'sm' }: { label: string; value: number; color?: string; size?: 'sm' | 'lg' }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: size === 'lg' ? '0.75rem' : '0.7rem' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: size === 'lg' ? '1.2rem' : '0.9rem', color: color ?? 'var(--text-main)' }}>{value}</div>
    </div>
  );
}

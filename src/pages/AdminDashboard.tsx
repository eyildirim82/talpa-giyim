import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import * as XLSX from 'xlsx';

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('admin_password')
  );
  const [passwordInput, setPasswordInput] = useState('');
  const storedPassword = useRef(localStorage.getItem('admin_password') ?? '');

  // Data
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [fetching, setFetching] = useState(false);

  // Notifications
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // UI
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // Per-campaign edit forms
  const [editForms, setEditForms] = useState<Record<string, EditForm>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Per-campaign code upload
  const [codeFiles, setCodeFiles] = useState<Record<string, File | undefined>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  // New campaign form
  const [newForm, setNewForm] = useState<NewForm>(EMPTY_NEW);
  const [creating, setCreating] = useState(false);

  // ── Auth helpers ──

  const authHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${storedPassword.current}`,
  });

  function notify(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  // ── Data fetching ──

  async function fetchData() {
    setFetching(true);
    try {
      const [cRes, sRes] = await Promise.all([
        fetch('/api/admin/campaigns', { headers: authHeaders() }),
        fetch('/api/admin/stats', { headers: authHeaders() }),
      ]);

      if (cRes.status === 401 || sRes.status === 401) {
        localStorage.removeItem('admin_password');
        storedPassword.current = '';
        setIsAuthenticated(false);
        return;
      }

      const campaignData = (await cRes.json()) as Campaign[];
      const statsData = (await sRes.json()) as Stats;

      setCampaigns(campaignData);
      setStats(statsData);

      const forms: Record<string, EditForm> = {};
      campaignData.forEach((c) => {
        forms[c.id] = campaignToEditForm(c);
      });
      setEditForms(forms);
    } catch {
      notify('error', 'Veriler yüklenemedi.');
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) void fetchData();
  }, [isAuthenticated]);

  // ── Auth ──

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    localStorage.setItem('admin_password', passwordInput);
    storedPassword.current = passwordInput;
    setIsAuthenticated(true);
  }

  function handleLogout() {
    localStorage.removeItem('admin_password');
    storedPassword.current = '';
    setIsAuthenticated(false);
  }

  // ── Toggle is_active / is_featured (immediate PUT) ──

  async function handleToggle(campaign: Campaign, field: 'is_active' | 'is_featured') {
    const newValue = !campaign[field];
    setCampaigns((prev) =>
      prev.map((c) => (c.id === campaign.id ? { ...c, [field]: newValue } : c))
    );
    setEditForms((prev) => ({
      ...prev,
      [campaign.id]: { ...prev[campaign.id], [field]: newValue },
    }));
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ [field]: newValue }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaign.id ? { ...c, [field]: !newValue } : c))
      );
      setEditForms((prev) => ({
        ...prev,
        [campaign.id]: { ...prev[campaign.id], [field]: !newValue },
      }));
      notify('error', 'Güncelleme başarısız.');
    }
  }

  // ── Edit form change ──

  function setEditField<K extends keyof EditForm>(id: string, key: K, value: EditForm[K]) {
    setEditForms((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }

  // ── Save campaign (PUT) ──

  async function handleSave(id: string) {
    const form = editForms[id];
    if (!form) return;
    setSaving((prev) => ({ ...prev, [id]: true }));
    try {
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
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      notify('success', 'Kampanya güncellendi.');
      void fetchData();
    } catch {
      notify('error', 'Kampanya güncellenemedi.');
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  }

  // ── Create campaign (POST) ──

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
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
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
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

  // ── Excel → code upload ──

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
        } catch (err) {
          reject(err);
        }
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
      const res = await fetch(`/api/admin/campaigns/${campaignId}/codes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ codes }),
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

  // ─── Render: Login ────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="flex-center" style={{ minHeight: '80vh', flexDirection: 'column' }}>
        <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <ShieldCheck
            size={48}
            style={{ margin: '0 auto 1.5rem', display: 'block', color: 'var(--primary)' }}
          />
          <h2 style={{ marginBottom: '1.5rem', marginTop: 0 }}>Yönetici Girişi</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="password"
              placeholder="Yönetici Şifresi"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{
                padding: '0.875rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color)',
                backgroundColor: 'rgba(15, 23, 42, 0.5)',
                color: 'white',
                width: '100%',
              }}
            />
            <button type="submit" className="btn">
              Giriş Yap
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
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <ShieldCheck size={26} /> Yönetim Paneli
        </h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn"
            style={{ width: 'auto' }}
            onClick={() => void fetchData()}
            disabled={fetching}
          >
            <RefreshCw size={15} />
            Yenile
          </button>
          <button
            className="btn"
            style={{ width: 'auto', backgroundColor: 'var(--border-color)' }}
            onClick={handleLogout}
          >
            Çıkış
          </button>
        </div>
      </div>

      {/* Notification */}
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      {/* Stats */}
      {stats && (
        <div className="admin-grid">
          <div className="stat-box">
            <h3>Toplam Kampanya</h3>
            <div className="value">{stats.totalCampaigns}</div>
          </div>
          <div className="stat-box">
            <h3>Toplam Kod</h3>
            <div className="value">{stats.totalCodes}</div>
          </div>
          <div className="stat-box">
            <h3>Dağıtılan Kod</h3>
            <div className="value" style={{ color: 'var(--danger)' }}>
              {stats.usedCodes}
            </div>
          </div>
          <div className="stat-box">
            <h3>Kalan Kod</h3>
            <div className="value" style={{ color: 'var(--accent)' }}>
              {stats.remainingCodes}
            </div>
          </div>
        </div>
      )}

      {/* Campaigns section header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Kampanyalar</h2>
        <button
          className="btn"
          style={{ width: 'auto' }}
          onClick={() => setShowNewModal(true)}
        >
          <Plus size={16} /> Yeni Kampanya
        </button>
      </div>

      {/* Campaign list */}
      {fetching && campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
          Yükleniyor…
        </div>
      ) : campaigns.length === 0 ? (
        <div
          className="action-card"
          style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}
        >
          Henüz kampanya oluşturulmamış.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {campaigns.map((campaign) => {
            const expanded = expandedId === campaign.id;
            const form = editForms[campaign.id];
            const usagePct =
              campaign.totalCodes > 0
                ? Math.round((campaign.usedCodes / campaign.totalCodes) * 100)
                : 0;

            return (
              <div
                key={campaign.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '0.875rem',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                }}
              >
                {/* ── Card header (clickable) ── */}
                <div
                  onClick={() => setExpandedId(expanded ? null : campaign.id)}
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    cursor: 'pointer',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Title + slug */}
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.975rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {campaign.title}
                    </div>
                    <div
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.775rem',
                        fontFamily: 'monospace',
                        marginTop: '0.1rem',
                      }}
                    >
                      /{campaign.slug}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Toggle
                      label="Aktif"
                      value={campaign.is_active}
                      color="var(--accent)"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleToggle(campaign, 'is_active');
                      }}
                    />
                    <Toggle
                      label="Öne Çıkan"
                      value={campaign.is_featured}
                      color="#60a5fa"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleToggle(campaign, 'is_featured');
                      }}
                    />
                  </div>

                  {/* Code stats */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '1.25rem',
                      fontSize: '0.825rem',
                    }}
                  >
                    <StatPill label="Toplam" value={campaign.totalCodes} />
                    <StatPill label="Dağıtılan" value={campaign.usedCodes} color="var(--danger)" />
                    <StatPill label="Kalan" value={campaign.remainingCodes} color="var(--accent)" />
                  </div>

                  {/* Expand chevron */}
                  <div style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* ── Expanded detail panel ── */}
                {expanded && form && (
                  <div
                    style={{
                      borderTop: '1px solid var(--border-color)',
                      padding: '1.5rem 1.25rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '2rem',
                      }}
                    >
                      {/* ── Edit form ── */}
                      <div>
                        <h3
                          style={{
                            margin: '0 0 1.25rem',
                            fontSize: '0.9rem',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          Kampanya Düzenle
                        </h3>

                        <FormField
                          label="Başlık"
                          value={form.title}
                          onChange={(v) => setEditField(campaign.id, 'title', v)}
                        />
                        <FormField
                          label="İndirim Etiketi"
                          value={form.discount_label}
                          onChange={(v) => setEditField(campaign.id, 'discount_label', v)}
                          placeholder="%15 İndirim"
                        />
                        <FormField
                          label="Partner Adı"
                          value={form.partner_name}
                          onChange={(v) => setEditField(campaign.id, 'partner_name', v)}
                        />
                        <FormField
                          label="Açıklama"
                          value={form.description}
                          onChange={(v) => setEditField(campaign.id, 'description', v)}
                          textarea
                        />
                        <FormField
                          label="Partner Logo URL"
                          value={form.partner_logo_url}
                          onChange={(v) => setEditField(campaign.id, 'partner_logo_url', v)}
                          placeholder="https://..."
                        />
                        <FormField
                          label="Kapak Görseli URL"
                          value={form.cover_image_url}
                          onChange={(v) => setEditField(campaign.id, 'cover_image_url', v)}
                          placeholder="https://..."
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <FormField
                            label="Bitiş Tarihi"
                            value={form.valid_until}
                            onChange={(v) => setEditField(campaign.id, 'valid_until', v)}
                            type="date"
                          />
                          <FormField
                            label="Üye Başına Maks. Kod"
                            value={form.max_codes_per_user}
                            onChange={(v) => setEditField(campaign.id, 'max_codes_per_user', v)}
                            type="number"
                          />
                        </div>
                        <FormField
                          label="Öne Çıkma Sırası"
                          value={form.featured_order}
                          onChange={(v) => setEditField(campaign.id, 'featured_order', v)}
                          type="number"
                          placeholder="Yüksek = önce gösterilir"
                        />
                        <FormField
                          label="Kampanya Koşulları"
                          value={form.terms}
                          onChange={(v) => setEditField(campaign.id, 'terms', v)}
                          textarea
                        />

                        <button
                          className="btn"
                          onClick={() => void handleSave(campaign.id)}
                          disabled={!!saving[campaign.id]}
                        >
                          {saving[campaign.id] ? 'Kaydediliyor…' : 'Kaydet'}
                        </button>
                      </div>

                      {/* ── Code upload ── */}
                      <div>
                        <h3
                          style={{
                            margin: '0 0 1.25rem',
                            fontSize: '0.9rem',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          Kod Yükleme
                        </h3>

                        <p
                          style={{
                            color: 'var(--text-muted)',
                            fontSize: '0.85rem',
                            marginTop: 0,
                            marginBottom: '1rem',
                            lineHeight: 1.6,
                          }}
                        >
                          İndirim kodlarının bulunduğu Excel dosyasını seçin. İlk sütundaki değerler
                          okunur, boşluklar temizlenir.
                        </p>

                        <div className="input-group">
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) =>
                              setCodeFiles((prev) => ({
                                ...prev,
                                [campaign.id]: e.target.files?.[0],
                              }))
                            }
                          />
                          {codeFiles[campaign.id] && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
                              {codeFiles[campaign.id]!.name}
                            </span>
                          )}
                        </div>

                        <button
                          className="btn"
                          onClick={() => void handleUploadCodes(campaign.id)}
                          disabled={!codeFiles[campaign.id] || !!uploading[campaign.id]}
                        >
                          <FileSpreadsheet size={16} />
                          {uploading[campaign.id] ? 'Yükleniyor…' : 'Kodları Yükle'}
                        </button>

                        {/* Usage summary */}
                        <div
                          style={{
                            marginTop: '1.5rem',
                            padding: '1.25rem',
                            backgroundColor: 'rgba(15, 23, 42, 0.6)',
                            borderRadius: '0.625rem',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.775rem',
                              color: 'var(--text-muted)',
                              marginBottom: '0.875rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            Kod Kullanım Özeti
                          </div>
                          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.875rem' }}>
                            <StatPill label="Toplam" value={campaign.totalCodes} size="lg" />
                            <StatPill
                              label="Dağıtılan"
                              value={campaign.usedCodes}
                              color="var(--danger)"
                              size="lg"
                            />
                            <StatPill
                              label="Kalan"
                              value={campaign.remainingCodes}
                              color="var(--accent)"
                              size="lg"
                            />
                          </div>
                          {campaign.totalCodes > 0 && (
                            <>
                              <div
                                style={{
                                  backgroundColor: 'var(--border-color)',
                                  borderRadius: '999px',
                                  height: '6px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${usagePct}%`,
                                    backgroundColor: 'var(--danger)',
                                    borderRadius: '999px',
                                    transition: 'width 0.4s',
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  marginTop: '0.4rem',
                                }}
                              >
                                %{usagePct} kullanıldı
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── New Campaign Modal ─────────────────────────────────────────────── */}
      {showNewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '1rem',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '660px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Yeni Kampanya</h2>
              <button
                onClick={() => setShowNewModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreate(e)}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0 1rem',
                }}
              >
                <div style={{ gridColumn: '1 / -1' }}>
                  <FormField
                    label="Slug *"
                    value={newForm.slug}
                    onChange={(v) => setNewForm((p) => ({ ...p, slug: v }))}
                    placeholder="brooks-brothers-2026"
                    required
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FormField
                    label="Başlık *"
                    value={newForm.title}
                    onChange={(v) => setNewForm((p) => ({ ...p, title: v }))}
                    placeholder="Brooks Brothers 2026 Koleksiyonu"
                    required
                  />
                </div>
                <FormField
                  label="İndirim Etiketi *"
                  value={newForm.discount_label}
                  onChange={(v) => setNewForm((p) => ({ ...p, discount_label: v }))}
                  placeholder="%15 İndirim"
                  required
                />
                <FormField
                  label="Partner Adı"
                  value={newForm.partner_name}
                  onChange={(v) => setNewForm((p) => ({ ...p, partner_name: v }))}
                  placeholder="Brooks Brothers"
                />
                <div style={{ gridColumn: '1 / -1' }}>
                  <FormField
                    label="Açıklama"
                    value={newForm.description}
                    onChange={(v) => setNewForm((p) => ({ ...p, description: v }))}
                    placeholder="Kampanya hakkında kısa açıklama"
                    textarea
                  />
                </div>
                <FormField
                  label="Partner Logo URL"
                  value={newForm.partner_logo_url}
                  onChange={(v) => setNewForm((p) => ({ ...p, partner_logo_url: v }))}
                  placeholder="https://..."
                />
                <FormField
                  label="Kapak Görseli URL"
                  value={newForm.cover_image_url}
                  onChange={(v) => setNewForm((p) => ({ ...p, cover_image_url: v }))}
                  placeholder="https://..."
                />
                <FormField
                  label="Bitiş Tarihi"
                  value={newForm.valid_until}
                  onChange={(v) => setNewForm((p) => ({ ...p, valid_until: v }))}
                  type="date"
                />
                <FormField
                  label="Üye Başına Maks. Kod"
                  value={newForm.max_codes_per_user}
                  onChange={(v) => setNewForm((p) => ({ ...p, max_codes_per_user: v }))}
                  type="number"
                />
                <div style={{ gridColumn: '1 / -1' }}>
                  <FormField
                    label="Kampanya Koşulları"
                    value={newForm.terms}
                    onChange={(v) => setNewForm((p) => ({ ...p, terms: v }))}
                    placeholder="Kampanya koşulları metni…"
                    textarea
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1, backgroundColor: 'var(--border-color)' }}
                  onClick={() => setShowNewModal(false)}
                >
                  İptal
                </button>
                <button type="submit" className="btn" style={{ flex: 1 }} disabled={creating}>
                  <Plus size={16} />
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

// ─── Tiny display helpers ─────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
  size = 'sm',
}: {
  label: string;
  value: number;
  color?: string;
  size?: 'sm' | 'lg';
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: size === 'lg' ? '0.75rem' : '0.7rem' }}>
        {label}
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: size === 'lg' ? '1.2rem' : '0.9rem',
          color: color ?? 'var(--text-main)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

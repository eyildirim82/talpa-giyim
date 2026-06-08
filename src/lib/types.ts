export type CampaignType = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

/** Sunucunun tekil kampanya için türettiği durum. */
export type CampaignStatus =
  | 'live'       // yayında, kod alınabilir
  | 'scheduled'  // başlangıç tarihi gelecekte ("Yakında")
  | 'expired'    // bitiş tarihi geçti ("Sona erdi")
  | 'archived'   // admin arşivledi
  | 'inactive'   // pasif/taslak
  | 'sold_out';  // aktif ama kod kalmadı

export type Campaign = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  partner_name: string | null;
  partner_logo_url: string | null;
  cover_image_url: string | null;
  discount_label: string;
  is_featured: boolean;
  featured_order: number | null;
  valid_until: string | null;
  starts_at?: string | null;
  created_at?: string;
  max_codes_per_user: number;
  terms: string | null;
  // Tür (yeni) — public uçlarda gömülü gelir.
  type_id?: string | null;
  type?: { id: string; name: string; slug: string } | null;
  is_active?: boolean;
  is_archived?: boolean;
  has_codes?: boolean;
  is_low_stock?: boolean;
  // Yalnızca tekil kampanya (/api/campaigns/:slug) yanıtında bulunur.
  status?: CampaignStatus;
};

export type Announcement = {
  id: string;
  message: string;
  link_url: string | null;
  /** İç kampanya linki — varsa /kampanya/:slug'a gider. */
  link_slug?: string | null;
  sort_order: number;
};

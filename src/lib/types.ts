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
  max_codes_per_user: number;
  terms: string | null;
  is_active?: boolean;
  has_codes?: boolean;
  is_low_stock?: boolean;
};


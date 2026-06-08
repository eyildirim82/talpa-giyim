import { useEffect } from 'react';

/** Üye tarafı sekme başlığı markası. */
export const MEMBER_BRAND = 'TALPA Ayrıcalıklar';
/** Admin tarafı sekme başlığı markası. */
export const ADMIN_BRAND = 'TALPA Yönetim';

/**
 * Sayfanın tarayıcı sekme başlığını (`document.title`) ayarlar.
 * `title` verilmezse yalnız marka adı görünür; verilirse "Başlık · Marka" olur.
 */
export function usePageTitle(title?: string | null, brand: string = MEMBER_BRAND) {
  useEffect(() => {
    document.title = title ? `${title} · ${brand}` : brand;
  }, [title, brand]);
}

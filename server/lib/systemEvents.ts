import { supabaseAdmin } from './supabaseAdmin.js';

export type VerifyFailureSource = 'claim' | 'my-codes';

/**
 * Üye doğrulama servisi 'hata' döndürdüğünde sağlık ekranının geçmiş verisi için
 * tek bir satır yazar. Best-effort: kayıt yazılamazsa istek akışı ASLA bozulmaz,
 * yalnızca sunucu loguna düşülür. Sadece hata oluşunca çağrıldığı için normal
 * trafikte neredeyse hiç yazma yapılmaz.
 */
export async function recordVerifyFailure(
  source: VerifyFailureSource,
  reason?: string
): Promise<void> {
  try {
    await supabaseAdmin
      .from('system_verify_failures')
      .insert({ source, reason: reason ?? null });
  } catch (err) {
    console.error('system_verify_failures kaydı yazılamadı:', err);
  }
}

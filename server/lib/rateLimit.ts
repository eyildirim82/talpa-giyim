import rateLimit from 'express-rate-limit';

/**
 * Public uç noktalar (claim-code, my-codes) için IP bazlı hız sınırı.
 *
 * Not: Vercel serverless ortamında in-memory store her örnekte sıfırlanır,
 * dolayısıyla bu best-effort bir korumadır; yine de TC enumerasyonu ve dış
 * TALPA Üye API'sinin kötüye kullanılmasını ciddi ölçüde zorlaştırır.
 * Gerçek IP'nin alınabilmesi için server.ts'te `trust proxy` ayarlanmıştır.
 */
export const claimLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 10, // IP başına dakikada 10 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek gönderdiniz. Lütfen biraz sonra tekrar deneyin.' },
});

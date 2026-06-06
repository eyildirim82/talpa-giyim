import express from 'express';
import cors from 'cors';
import campaignsRouter from './server/routes/campaigns.js';
import claimRouter from './server/routes/claim.js';
import adminRouter from './server/routes/admin.js';
import uploadRouter from './server/routes/upload.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Vercel/proxy arkasında gerçek istemci IP'sini (X-Forwarded-For) almak için.
// Rate limit'in IP başına doğru çalışması buna bağlıdır.
app.set('trust proxy', 1);

// CORS: CORS_ORIGINS tanımlıysa yalnızca o origin'lere izin ver; aksi halde
// (yerel geliştirme) tüm origin'lere açık kalır.
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(corsOrigins && corsOrigins.length > 0 ? { origin: corsOrigins } : undefined));

app.use(express.json({ limit: '10mb' }));

app.use('/api', campaignsRouter);
app.use('/api', claimRouter);
app.use('/api', adminRouter);
app.use('/api', uploadRouter);

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`API Sunucusu http://localhost:${PORT} adresinde çalışıyor. (DEV)`);
  });
}

export default app;

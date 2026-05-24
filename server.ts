import express from 'express';
import cors from 'cors';
import campaignsRouter from './server/routes/campaigns.js';
import claimRouter from './server/routes/claim.js';
import adminRouter from './server/routes/admin.js';
import uploadRouter from './server/routes/upload.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
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

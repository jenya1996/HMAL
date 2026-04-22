import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth';
import dataRouter from './routes/data';
import { logger } from './lib/logger';

const app = express();

const corsOptions = {
  origin:      process.env.CLIENT_URL ?? 'http://localhost:5173',
  credentials: true,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Log every incoming request
app.use((req, _res, next) => {
  const hasCookie = !!req.cookies?.session;
  const bodyPreview = req.body && Object.keys(req.body).length
    ? JSON.stringify(req.body).slice(0, 120)
    : '(no body)';
  logger.log(`\n→ [${req.method}] ${req.path}`);
  logger.log(`   cookie: ${hasCookie ? 'present ✓' : 'MISSING ✗'}`);
  if (req.method !== 'GET') logger.log(`   body: ${bodyPreview}`);
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => logger.log(`Server running on http://localhost:${PORT}`));

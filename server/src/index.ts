import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import authRouter from './routes/auth';
import dataRouter from './routes/data';
import logsRouter from './routes/logs';
import { logger } from './lib/logger';

const app = express();

const corsOptions = {
  origin:      process.env.CLIENT_URL ?? 'http://localhost:5173',
  credentials: true,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      objectSrc:  ["'none'"],
      baseUri:    ["'self'"],
    },
  },
}));
app.set('trust proxy', 1);
app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());

// Log every incoming request — password field is redacted
app.use((req, _res, next) => {
  const hasCookie = !!req.cookies?.__session;
  if (req.method !== 'GET') {
    const safe = req.body && typeof req.body === 'object'
      ? JSON.stringify({ ...req.body, password: req.body.password ? '[REDACTED]' : undefined }).slice(0, 200)
      : '(no body)';
    logger.log(`\n→ [${req.method}] ${req.path}  cookie:${hasCookie ? '✓' : '✗'}  body:${safe}`);
  } else {
    logger.log(`\n→ [${req.method}] ${req.path}  cookie:${hasCookie ? '✓' : '✗'}`);
  }
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);
app.use('/api/logs', logsRouter);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => logger.log(`Server running on http://localhost:${PORT}`));

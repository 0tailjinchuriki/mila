import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import applicationRoutes from './routes/application.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3002', 'https://milafront.onrender.com', 'https://usmarinelas.onrender.com', 'https://adminlas.onrender.com'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many attempts, try again later' } });
const generalLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 60, message: { error: 'Rate limit exceeded' } });

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/application', generalLimiter, applicationRoutes);
app.use('/api/admin', generalLimiter, adminRoutes);

app.get('/api/health', (_req, res) => { res.json({ status: 'ok' }); });

app.use((_err, _req, res, _next) => { res.status(500).json({ error: 'Internal server error' }); });

app.listen(PORT, () => {});

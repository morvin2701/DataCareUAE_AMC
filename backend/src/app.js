import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import maintenanceRoutes from './routes/maintenance.js';
import settingsRoutes from './routes/settings.js';
import linkRoutes from './routes/link.js';
import serversRoutes from './routes/servers.js';
import customersRoutes from './routes/customers.js';
import contractsRoutes from './routes/contracts.js';
import invoicesRoutes from './routes/invoices.js';
import ticketsRoutes from './routes/tickets.js';
import remindersRoutes from './routes/reminders.js';
import reportsRoutes from './routes/reports.js';
import dashboardRoutes from './routes/dashboard.js';
import backupRoutes from './routes/backup.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;
const isPrivateOrigin = (origin) => { try { return PRIVATE_HOST.test(new URL(origin).hostname); } catch { return false; } };
export const ROUTES = [healthRoutes, linkRoutes, authRoutes, usersRoutes, maintenanceRoutes, settingsRoutes, serversRoutes, customersRoutes, contractsRoutes, invoicesRoutes, ticketsRoutes, remindersRoutes, reportsRoutes, dashboardRoutes, backupRoutes];

export function createApp(extraRoutes = []) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, _res, next) => { const x = req.headers['x-forwarded-for']; if (x) req.headers['x-forwarded-for'] = String(x).split(',').map((s) => s.trim().replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1')).join(', '); next(); });
  app.use(cors({ origin(origin, cb) { if (!origin || env.corsOrigins.includes(origin) || (!env.isProd && isPrivateOrigin(origin))) return cb(null, true); return cb(new Error(`Not allowed by CORS: ${origin}`)); } }));
  app.use(express.json({ limit: '5mb' }));
  app.get('/', (_req, res) => res.type('text').send('DataCare Softech FZCO — DcAMC backend'));
  for (const r of [...ROUTES, ...extraRoutes]) app.use('/api', r);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

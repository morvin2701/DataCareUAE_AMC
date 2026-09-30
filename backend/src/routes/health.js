import { Router } from 'express';
import { dbStatus } from '../config/db.js';
import { wrap } from '../utils/httpError.js';
const r = Router();
r.get('/health', wrap(async (_req, res) => { const db = await dbStatus(); res.status(db.ok ? 200 : 503).json({ success: true, service: 'dcamc-backend', time: new Date().toISOString(), db }); }));
export default r;

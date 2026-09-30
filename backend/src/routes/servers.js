import { Router } from 'express';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { wrap, notFound } from '../utils/httpError.js';
import { listServers, getServer, createServer, updateServer, rotateKey, listQueue, processQueue, testServer } from '../services/linkService.js';
import { audit } from '../services/audit.js';

/** The customers' ERP servers and their link keys. Reading is for everyone (the customer screens show the server); changing is the owner's. */
const r = Router();
r.get('/servers', requireAuth, wrap(async (_req, res) => res.json({ success: true, rows: await listServers() })));
r.post('/servers', requireAuth, requireOwner, wrap(async (req, res) => res.status(201).json({ success: true, ...(await createServer(req.ctx, req.body || {})) })));
r.put('/servers/:id', requireAuth, requireOwner, wrap(async (req, res) => res.json({ success: true, server: await updateServer(req.ctx, Number(req.params.id), req.body || {}) })));
r.post('/servers/:id/rotate-key', requireAuth, requireOwner, wrap(async (req, res) => res.json({ success: true, ...(await rotateKey(req.ctx, Number(req.params.id))) })));
r.get('/servers/:id/queue', requireAuth, wrap(async (req, res) => { const s = await getServer(Number(req.params.id)); if (!s) throw notFound('Server not found'); res.json({ success: true, server: s, rows: await listQueue(s.SERVER_ID) }); }));
r.post('/servers/:id/retry', requireAuth, requireOwner, wrap(async (req, res) => { const done = await processQueue(Number(req.params.id)); await audit(req.ctx, 'AMC_PUSH_QUEUE', req.params.id, 'RETRY', { done }); res.json({ success: true, done }); }));
r.post('/servers/:id/test', requireAuth, requireOwner, wrap(async (req, res) => res.json({ success: true, ...(await testServer(Number(req.params.id))) })));
export default r;

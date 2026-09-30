import { Router } from 'express';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { wrap, notFound } from '../utils/httpError.js';
import { listServers, createServer, updateServer, rotateKey, testServer } from '../services/linkService.js';

/** The customers' ERP servers and their link keys. Reading is for everyone (the customer screens show the server); changing is the owner's. */
const r = Router();
r.get('/servers', requireAuth, wrap(async (_req, res) => res.json({ success: true, rows: await listServers() })));
r.post('/servers', requireAuth, requireOwner, wrap(async (req, res) => res.status(201).json({ success: true, ...(await createServer(req.ctx, req.body || {})) })));
r.put('/servers/:id', requireAuth, requireOwner, wrap(async (req, res) => res.json({ success: true, server: await updateServer(req.ctx, Number(req.params.id), req.body || {}) })));
r.post('/servers/:id/rotate-key', requireAuth, requireOwner, wrap(async (req, res) => res.json({ success: true, ...(await rotateKey(req.ctx, Number(req.params.id))) })));
r.post('/servers/:id/test', requireAuth, requireOwner, wrap(async (req, res) => res.json({ success: true, ...(await testServer(Number(req.params.id))) })));
export default r;

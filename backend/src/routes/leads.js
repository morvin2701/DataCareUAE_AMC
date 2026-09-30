import { Router } from 'express';
import { requireAuth, requireRole, noMoney } from '../middleware/auth.js';
import { wrap, notFound } from '../utils/httpError.js';
import { listLeads, getLead, createLead, updateLead, addFollowUp, convertLead, deleteLead, STAGES } from '../services/leadService.js';
/** Leads / follow-ups: OWNER and SUPPORT work them; ACCOUNTS reads. */
const r = Router(); const write = requireRole('SUPPORT');
r.get('/leads', requireAuth, wrap(async (req, res) => res.json({ success: true, rows: noMoney(req.ctx, await listLeads(req.query)), stages: STAGES })));
r.get('/leads/:id', requireAuth, wrap(async (req, res) => { const l = await getLead(Number(req.params.id)); if (!l) throw notFound('Lead not found'); res.json({ success: true, lead: noMoney(req.ctx, l) }); }));
r.post('/leads', requireAuth, write, wrap(async (req, res) => res.status(201).json({ success: true, lead: await createLead(req.ctx, req.body || {}) })));
r.put('/leads/:id', requireAuth, write, wrap(async (req, res) => res.json({ success: true, lead: await updateLead(req.ctx, Number(req.params.id), req.body || {}) })));
r.post('/leads/:id/followup', requireAuth, write, wrap(async (req, res) => res.json({ success: true, lead: await addFollowUp(req.ctx, Number(req.params.id), req.body || {}) })));
r.post('/leads/:id/convert', requireAuth, write, wrap(async (req, res) => res.json({ success: true, ...(await convertLead(req.ctx, Number(req.params.id), req.body || {})) })));
r.delete('/leads/:id', requireAuth, write, wrap(async (req, res) => { await deleteLead(req.ctx, Number(req.params.id)); res.json({ success: true }); }));
export default r;

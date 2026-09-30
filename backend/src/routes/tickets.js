import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { wrap, notFound } from '../utils/httpError.js';
import { listTickets, getTicket, createTicket, updateTicket, addNote, closeTicket, reopenTicket, listVisits, getVisit, createVisit, updateVisit, deleteVisit } from '../services/ticketService.js';
/** Tickets and visits: OWNER / SUPPORT write; ACCOUNTS reads. */
const r = Router(); const write = requireRole('SUPPORT');
r.get('/tickets', requireAuth, wrap(async (req, res) => res.json({ success: true, rows: await listTickets(req.query) })));
r.get('/tickets/:id', requireAuth, wrap(async (req, res) => { const t = await getTicket(Number(req.params.id)); if (!t) throw notFound('Ticket not found'); res.json({ success: true, ticket: t }); }));
r.post('/tickets', requireAuth, write, wrap(async (req, res) => res.status(201).json({ success: true, ticket: await createTicket(req.ctx, req.body || {}) })));
r.put('/tickets/:id', requireAuth, write, wrap(async (req, res) => res.json({ success: true, ticket: await updateTicket(req.ctx, Number(req.params.id), req.body || {}) })));
r.post('/tickets/:id/notes', requireAuth, write, wrap(async (req, res) => res.json({ success: true, ticket: await addNote(req.ctx, Number(req.params.id), req.body || {}) })));
r.post('/tickets/:id/close', requireAuth, write, wrap(async (req, res) => res.json({ success: true, ticket: await closeTicket(req.ctx, Number(req.params.id), req.body || {}) })));
r.post('/tickets/:id/reopen', requireAuth, write, wrap(async (req, res) => res.json({ success: true, ticket: await reopenTicket(req.ctx, Number(req.params.id)) })));
r.get('/visits', requireAuth, wrap(async (req, res) => res.json({ success: true, rows: await listVisits(req.query) })));
r.get('/visits/:id', requireAuth, wrap(async (req, res) => { const v = await getVisit(Number(req.params.id)); if (!v) throw notFound('Visit not found'); res.json({ success: true, visit: v }); }));
r.post('/visits', requireAuth, write, wrap(async (req, res) => res.status(201).json({ success: true, visit: await createVisit(req.ctx, req.body || {}) })));
r.put('/visits/:id', requireAuth, write, wrap(async (req, res) => res.json({ success: true, visit: await updateVisit(req.ctx, Number(req.params.id), req.body || {}) })));
r.delete('/visits/:id', requireAuth, write, wrap(async (req, res) => { await deleteVisit(req.ctx, Number(req.params.id)); res.json({ success: true }); }));
export default r;

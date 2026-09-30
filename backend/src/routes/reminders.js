import { Router } from 'express';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { wrap, badRequest } from '../utils/httpError.js';
import { listRules, saveRule, deleteRule, computeDue, runReminders, listLog, sendTest } from '../services/reminderService.js';
import { getSetting } from '../services/settingsService.js';
import { waReady } from '../services/whatsappService.js';
import { mailReady } from '../services/emailService.js';
/** Reminders: rules, what is due, run now, the log, a test message. Owner only. */
const r = Router();
r.get('/reminders/rules', requireAuth, requireOwner, wrap(async (_req, res) => res.json({ success: true, rows: await listRules(), lastRun: await getSetting('REMINDER_LAST_RUN'), settings: await getSetting('REMINDERS'), wa: await waReady(), mail: await mailReady() })));
r.post('/reminders/rules', requireAuth, requireOwner, wrap(async (req, res) => res.status(201).json({ success: true, RULE_ID: await saveRule(req.ctx, null, req.body || {}) })));
r.put('/reminders/rules/:id', requireAuth, requireOwner, wrap(async (req, res) => { await saveRule(req.ctx, Number(req.params.id), req.body || {}); res.json({ success: true }); }));
r.delete('/reminders/rules/:id', requireAuth, requireOwner, wrap(async (req, res) => { await deleteRule(req.ctx, Number(req.params.id)); res.json({ success: true }); }));
r.get('/reminders/due', requireAuth, requireOwner, wrap(async (_req, res) => res.json({ success: true, rows: await computeDue() })));
r.post('/reminders/run', requireAuth, requireOwner, wrap(async (req, res) => res.json({ success: true, ...(await runReminders({ userId: req.ctx.userId, ruleId: req.body?.ruleId || null })) })));
r.get('/reminders/log', requireAuth, wrap(async (req, res) => res.json({ success: true, ...(await listLog({ page: Number(req.query.page) || 1, pageSize: 50, kind: req.query.kind || '', ok: req.query.ok || '' })) })));
r.post('/reminders/test', requireAuth, requireOwner, wrap(async (req, res) => { const ch = String(req.body?.channel || '').toUpperCase(); if (!['WA', 'EMAIL'].includes(ch) || !req.body?.to) throw badRequest('Give the channel and the number / address.'); res.json({ success: true, ...(await sendTest({ channel: ch, to: String(req.body.to), userId: req.ctx.userId })) }); }));
export default r;

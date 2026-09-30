import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { wrap, HttpError } from '../utils/httpError.js';
import { serverForKey, applyHeartbeat } from '../services/linkService.js';

/**
 * Part A of the integration contract: every customer ERP server posts here.
 *   POST /api/link/heartbeat  (X-Link-Key)  { server: { id, appVersion, hostname, ip, pendingScripts }, shops: [ … ] }
 * Rate-limited per address; a wrong key is refused before anything is read.
 */
const r = Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, code: 'RATE_LIMITED', message: 'Too many heartbeats from this address.' } });
r.post('/link/heartbeat', limiter, wrap(async (req, res) => {
  const server = await serverForKey(req.get('X-Link-Key'));
  if (!req.body || typeof req.body !== 'object') throw new HttpError(400, 'Send the heartbeat as JSON.', 'BAD_BODY');
  const out = await applyHeartbeat(server, req.body, req.ip);
  res.json({ success: true, server: server.SERVER_CODE, ...out, serverTime: new Date().toISOString() });
}));
export default r;

import { Router } from 'express';
import { requireAuth, requireRole, noMoney } from '../middleware/auth.js';
import { wrap, notFound } from '../utils/httpError.js';
import { listContracts, getContract, contractDefaults, createContract, updateContract, setStatus, pushContract, contractPrint } from '../services/contractService.js';
/** Contracts: OWNER / ACCOUNTS write; SUPPORT reads without amounts. */
const r = Router(); const write = requireRole('ACCOUNTS');
r.get('/contracts', requireAuth, wrap(async (req, res) => res.json({ success: true, rows: noMoney(req.ctx, await listContracts(req.query)) })));
r.get('/contracts/defaults/:custId', requireAuth, write, wrap(async (req, res) => res.json({ success: true, ...(await contractDefaults(Number(req.params.custId))) })));
r.get('/contracts/:id', requireAuth, wrap(async (req, res) => { const k = await getContract(Number(req.params.id)); if (!k) throw notFound('Contract not found'); res.json({ success: true, contract: noMoney(req.ctx, k) }); }));
r.get('/contracts/:id/print', requireAuth, wrap(async (req, res) => { const p = await contractPrint(Number(req.params.id)); res.json({ success: true, ...p, contract: noMoney(req.ctx, p.contract) }); }));
r.post('/contracts', requireAuth, write, wrap(async (req, res) => res.status(201).json({ success: true, ...(await createContract(req.ctx, req.body || {})) })));
r.put('/contracts/:id', requireAuth, write, wrap(async (req, res) => res.json({ success: true, ...(await updateContract(req.ctx, Number(req.params.id), req.body || {})) })));
r.post('/contracts/:id/status', requireAuth, write, wrap(async (req, res) => res.json({ success: true, ...(await setStatus(req.ctx, Number(req.params.id), req.body?.status)) })));
r.post('/contracts/:id/push', requireAuth, write, wrap(async (req, res) => res.json({ success: true, push: await pushContract(req.ctx, Number(req.params.id)), contract: await getContract(Number(req.params.id)) })));
export default r;

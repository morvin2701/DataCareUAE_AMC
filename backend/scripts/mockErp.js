/**
 * A stand-in for a customer's ERP: answers the licence push and the ping the way the real backend does, verifying the key
 * and the HMAC signature. node scripts/mockErp.js <port> <AMC_KEY>   (default port 4199)
 */
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
const [port = '4199', key = process.env.AMC_KEY] = process.argv.slice(2);
if (!key) { console.error('usage: node scripts/mockErp.js <port> <AMC_KEY>'); process.exit(1); }
const secret = key.split('.').slice(1).join('.');
const eq = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && timingSafeEqual(x, y); };
createServer((req, res) => {
  let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.url === '/wa' && req.method === 'POST') { const p = JSON.parse(body || '{}'); console.log('whatsapp', p.TYPE, p.CUST_MO, p.DEFULT_MESS.slice(0, 60)); res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('{"status":"Message Sent Successfully"}'); }   // stands in for DataCare Chat
    if (!eq(req.headers['x-link-key'], key)) return send(401, { success: false, message: 'bad key' });
    if (req.url === '/api/link/ping') return send(200, { success: true, message: 'mock ERP answered', appVersion: 'mock-1' });
    if (req.url === '/api/link/licence' && req.method === 'POST') {
      const ts = req.headers['x-link-ts']; const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
      if (!eq(sig, req.headers['x-link-sign'])) return send(401, { success: false, message: 'bad signature' });
      const p = JSON.parse(body); console.log('licence push', p);
      return send(200, { success: true, message: `licence of ${p.shopCode} set to ${p.endDate}`, licence: { SHOP_CODE: p.shopCode, END_DATE: p.endDate, MAX_LOGIN: p.tills, PLAN_CODE: p.plan, STATUS: p.status } });
    }
    send(404, { success: false, message: 'not found' });
  });
}).listen(Number(port), () => console.log(`mock ERP on :${port}`));

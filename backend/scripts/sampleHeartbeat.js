/**
 * Post a sample heartbeat — what a customer's ERP server sends every 24 h.
 *   node scripts/sampleHeartbeat.js <AMC_URL> <AMC_KEY>      e.g. node scripts/sampleHeartbeat.js http://localhost:4100 SRV0001.xxxx
 */
const [url = process.env.AMC_URL, key = process.env.AMC_KEY] = process.argv.slice(2);
if (!url || !key) { console.error('usage: node scripts/sampleHeartbeat.js <AMC_URL> <AMC_KEY>'); process.exit(1); }
const payload = {
  server: { id: key.split('.')[0], appVersion: '20260930-1158-e5253a5', hostname: 'WIN-SAMPLE', ip: '103.49.124.50', pendingScripts: 0 },
  shops: [
    { shopCode: 'BULLIONSOUQ', shopName: 'Bullion Souq', hdd: 'DC0001WBST', plan: 'BASIC', status: 'ACTIVE', tills: 5, startDate: '2026-09-22', endDate: '2027-09-21', contact: 'Rakesh', mobile: '971501234567', email: 'rakesh@bullionsouq.ae', emirate: 'AJM', lastLogin: '2026-09-30T08:10:00Z', users: 3, entriesToday: 12, entries30d: 240 },
    { shopCode: 'DEMO', shopName: 'Demo Jewellery LLC', hdd: 'DC0002WPST', plan: 'PRO', status: 'ACTIVE', tills: 3, startDate: '2025-10-15', endDate: '2026-10-14', contact: 'Morvin', mobile: '971500000000', email: 'demo@datacare.ae', emirate: 'DXB', lastLogin: '2026-09-29T14:00:00Z', users: 2, entriesToday: 0, entries30d: 31 },
  ],
};
const res = await fetch(`${url.replace(/\/$/, '')}/api/link/heartbeat`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Link-Key': key }, body: JSON.stringify(payload) });
console.log(res.status, await res.text());

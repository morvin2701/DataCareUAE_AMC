import { createCipheriv, createDecipheriv, randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';

const key = () => { const k = Buffer.from(env.encryptionKey, 'base64'); if (k.length !== 32) throw new Error('AMC_ENCRYPTION_KEY must be 32 bytes base64'); return k; };
/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export function encrypt(plain) {
  const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
export function decrypt(b64) {
  const buf = Buffer.from(String(b64), 'base64'); const d = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12)); d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}
export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');
/** HMAC-SHA256 over `ts.body` — how a licence push proves it came from DcAMC and was not altered. */
export const sign = (secret, ts, body) => createHmac('sha256', String(secret)).update(`${ts}.${body}`).digest('hex');
export const safeEqual = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && timingSafeEqual(x, y); };
export const newSecret = (bytes = 24) => randomBytes(bytes).toString('base64url');

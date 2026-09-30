import fs from 'node:fs';
import { env } from '../config/env.js';
/** Google Drive copy of backups — OAuth 2.0 (offline, scope drive.file). One OAuth client in .env: GDRIVE_OAUTH_CLIENT_ID + GDRIVE_OAUTH_CLIENT_SECRET; redirect = APP_BASE_URL/api/backup/drive/callback. */
const G = { auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', files: 'https://www.googleapis.com/drive/v3/files', upload: 'https://www.googleapis.com/upload/drive/v3/files' };
const cfg = () => ({ id: process.env.GDRIVE_OAUTH_CLIENT_ID || '', secret: process.env.GDRIVE_OAUTH_CLIENT_SECRET || '', redirect: env.baseUrl ? `${env.baseUrl}/api/backup/drive/callback` : '' });
export const driveConfigured = () => { const c = cfg(); return !!(c.id && c.secret && c.redirect); };
export function driveAuthUrl(state) { const c = cfg(); return `${G.auth}?${new URLSearchParams({ client_id: c.id, redirect_uri: c.redirect, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/drive.file openid email', state })}`; }
async function tokenCall(body) { const c = cfg(); const r = await fetch(G.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, ...body }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error_description || j.error || `Google token error ${r.status}`); return j; }
export async function exchangeCode(code) { const j = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: cfg().redirect }); if (!j.refresh_token) throw new Error('Google did not return a refresh token — remove the app from your Google account permissions and connect again.'); let email = null; try { email = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString()).email || null; } catch { /* no id token */ } return { refreshToken: j.refresh_token, email }; }
const accessToken = async (refreshToken) => (await tokenCall({ refresh_token: refreshToken, grant_type: 'refresh_token' })).access_token;
async function gfetch(token, url, opts = {}) { const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } }); if (!r.ok) throw new Error(`Google Drive ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`); return r; }
const FOLDER = 'DcAMC Backups';
async function ensureFolder(token, knownId) {
  if (knownId) { const r = await fetch(`${G.files}/${knownId}?fields=id,trashed`, { headers: { Authorization: `Bearer ${token}` } }); if (r.ok && !(await r.json()).trashed) return knownId; }
  const found = (await (await gfetch(token, `${G.files}?${new URLSearchParams({ q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER}' and trashed=false`, fields: 'files(id)' })}`)).json()).files?.[0]?.id; if (found) return found;
  return (await (await gfetch(token, G.files, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }) })).json()).id;
}
export async function uploadFile({ refreshToken, folderId, filePath, name, onFolder }) {
  const token = await accessToken(refreshToken); const fid = await ensureFolder(token, folderId); if (fid !== folderId) await onFolder?.(fid);
  const length = fs.statSync(filePath).size;
  const init = await gfetch(token, `${G.upload}?uploadType=resumable&fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': String(length) }, body: JSON.stringify({ name, parents: [fid] }) });
  const put = await gfetch(token, init.headers.get('location'), { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(length) }, body: fs.createReadStream(filePath), duplex: 'half' });
  return { fileId: (await put.json()).id, folderId: fid, bytes: length };
}
export async function pruneDrive({ refreshToken, folderId, keep }) {
  if (!folderId) return 0; const token = await accessToken(refreshToken);
  const all = ((await (await gfetch(token, `${G.files}?${new URLSearchParams({ q: `'${folderId}' in parents and trashed=false and name contains 'AUTO_DcAmc_'`, fields: 'files(id,name,createdTime)', orderBy: 'createdTime desc', pageSize: '200' })}`)).json()).files || []);
  const old = all.slice(Math.max(1, Number(keep) || 1)); for (const f of old) await gfetch(token, `${G.files}/${f.id}`, { method: 'DELETE' }); return old.length;
}
export async function revokeDrive(refreshToken) { if (refreshToken) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' }).catch(() => {}); }

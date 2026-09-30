# DcAMC — DataCare's AMC book

Annual maintenance contracts, renewals, tax invoices and payments, support tickets, site visits and reminders for every
jeweller running the DataCare DXB ERP. A standalone app: its own repo, its own database (`DcAmc`), its own logins.
It talks to each customer's ERP only through a small HTTP link (heartbeat in, licence push out).

```
browser ── Vercel (React screens) ──/api──▶ DcAMC API (Node, Windows service on DataCare's server) ──▶ SQL Server DcAmc
                                                   ▲ heartbeat (every 24 h)              │ licence push (signed)
                                            customer ERP servers ◀───────────────────────┘
```

## Layout
| Folder | What |
|---|---|
| `backend/` | Node 20 + Express (ES modules) + `mssql`. `src/routes` per screen, `src/services` the rules, `scripts/` helpers. |
| `frontend/` | React 18 + Vite + Tailwind, the ERP's look (dense tables, grouped sidebar, Enter-key navigation, dark / light + accent). |
| `database/` | Numbered idempotent T-SQL scripts (`001_core.sql` …). Applied once each; `SCHEMA_VER` remembers. |
| `deploy/windows/` | Backend on the server: `setup-server.ps1` (once), `deploy-backend.ps1` (every release), `web.config`, `env.production.example`. |
| `tools/deploy/` | `make-deploy-folders.sh` builds the `DcAMC-Backend-Deploy` folder on the Desktop. |

## Run it locally
```bash
npm run install:all
cp backend/.env.example backend/.env      # fill AMC_DB_*, AMC_ENCRYPTION_KEY, SESSION_SECRET, OWNER_PASSWORD
npm run dev:backend                       # :4100 — creates DcAmc, applies the scripts, seeds the owner login on first start
npm run dev:frontend                      # :5180, /api proxied to :4100
```
Sign in with `OWNER_LOGIN` / `OWNER_PASSWORD`. Generate the two keys with `openssl rand -base64 32`.

### backend/.env keys
| Key | Meaning |
|---|---|
| `PORT` | API port (4100). |
| `CORS_ORIGIN` | The Vercel site (comma-separated if several). Private LAN origins are allowed outside production. |
| `APP_BASE_URL` | Where the API is reachable from outside — used for the Google Drive redirect. |
| `AMC_DB_SERVER / PORT / NAME / USER / PASSWORD / AUTH` | SQL Server and the one database. `AUTH` = `sql` or `ntlm`. |
| `AMC_ENCRYPTION_KEY` | 32 bytes base64. Encrypts link keys, SMTP and WhatsApp secrets. Never change it once set. |
| `SESSION_SECRET` | 32 bytes base64. Signs the JWT sessions. |
| `OWNER_LOGIN / OWNER_NAME / OWNER_PASSWORD` | The first owner login, created once when `AMC_USER` is empty. |
| `BACKUP_PATH` | Folder SQL Server writes backups into (on the SQL Server machine). |
| `GDRIVE_OAUTH_CLIENT_ID / SECRET` | Optional Google Drive copy of backups. |
| `REMINDER_SCHEDULER=0`, `BACKUP_SCHEDULER=0` | Switch the daily jobs off for a second instance or a test run. |

## Roles
| Role | Opens |
|---|---|
| OWNER | Everything: users, settings, servers & link keys, reminders, backup, Field update, audit log. |
| ACCOUNTS | Contracts, invoices, payments, outstanding, money reports; customers, tickets and visits read-only. |
| SUPPORT | Customers (notes, installer, active), tickets, visits, non-money reports; contracts read-only with no amounts. |

## The link with a customer's ERP
1. DcAMC → **Settings → Servers & link keys → Add server**: name it and give the ERP's address (`https://erp.customer.ae`).
   The link key (`SRV0001.<secret>`) is shown **once**; DcAMC keeps a hash for heartbeats and an encrypted copy to sign pushes.
2. On that customer's ERP server, add to `C:\DataCare\app\backend\.env` and restart the `DataCareApi` service:
   ```
   AMC_URL=https://amc-api.datacarewebuae.com
   AMC_KEY=SRV0001.xxxxxxxx
   ```
3. The ERP posts a heartbeat on start, every 24 h and after any licence change; the shops appear under **Customers**.
   A server silent for 48 h shows as offline. Renewing a contract in DcAMC pushes `{ shopCode, endDate, tills?, plan?, status }`
   to `POST /api/link/licence` on that ERP, signed with the key; an unreachable server queues the push and the next heartbeat
   delivers it (Settings → Servers → queue).
4. `Test` on the server row pings the ERP with the key. `backend/scripts/sampleHeartbeat.js <AMC_URL> <AMC_KEY>` posts a sample;
   `backend/scripts/mockErp.js <port> <AMC_KEY>` stands in for a customer's ERP while developing.

## Business rules
* A contract year is exactly 365 days from its start (as the ERP licences). A renewal starts on the current expiry while it is
  live, else today; amount and cover default from the last contract. Currency AED, VAT 5 % (Settings), dates dd/mm/yyyy, Asia/Dubai.
* Making a contract **live** raises its one tax invoice (INV-…) and pushes the licence. Cancel puts the invoice back if unpaid.
* Receipts (cash / bank / cheque / card) never exceed the invoice balance; cancelling one restores the balance.
* Tickets get an SLA deadline from Settings → SLA hours by priority; notes carry minutes; close with a resolution.
* Reminders: each rule fires once per customer and reference, so a missed day still goes out the next day. WhatsApp goes
  through DataCare Chat (TYPE is case-sensitive and sent exactly as typed); e-mail through the SMTP mailbox in Settings.
* Every write lands in `AUDIT_LOG` (Other → Audit log). Nothing can switch it off.

## Deploy
**Frontend — Vercel.** Import the repo, root directory `frontend`, framework Vite. Set `VITE_API_URL` to the API address
(`https://amc-api.datacarewebuae.com/api`). Every push to `main` deploys.

**Backend — DataCare's server (once).** Build the folder on the Mac and copy it to `C:\` on the server:
```bash
tools/deploy/make-deploy-folders.sh
```
```powershell
cd C:\DcAMC-Backend-Deploy
powershell -ExecutionPolicy Bypass -File .\setup-server.ps1 -HostName amc-api.datacarewebuae.com   # or -Port 4190 until DNS is ready
powershell -ExecutionPolicy Bypass -File .\deploy-backend.ps1
notepad C:\DcAMC\app\backend\.env          # from env.production.example, then:
C:\DcAMC\tools\nssm.exe start DcAmcApi
powershell -ExecutionPolicy Bypass -File .\setup-server.ps1 -HostName amc-api.datacarewebuae.com -Certificate -Email you@datacare.ae
```
`setup-server.ps1` registers the `DcAmcApi` Windows service (NSSM, port 4100) and an IIS site `DcAmcApi` that passes every
request to it, so the API has a host name and HTTPS. It reuses Node, URL Rewrite, ARR and NSSM from the ERP set-up.

**Every backend release:** `tools/deploy/make-deploy-folders.sh`, copy `DcAMC-Backend-Deploy` to `C:\`, run `deploy-backend.ps1`.
It keeps `.env` and `node_modules`, runs `npm ci`, restarts the service and checks `/api/health`. New database scripts are
applied from **Settings → Field update** (a fresh server applies them all on first start).

**Backups.** Other → Data backup: SQL backup of `DcAmc` into `BACKUP_PATH`, daily at a time, keep N, optional Google Drive copy.

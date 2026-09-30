# DcAMC — what each screen does and how to use it

DcAMC is DataCare's own book of every jeweller on the DXB ERP: their licence, their annual maintenance contract (AMC),
what they were invoiced and paid, every support call, every site visit, and the reminders sent to them.

Open it at the Vercel address. Sign in with your first name and your mobile number without the country code.
Keyboard: `⌘K` / `Ctrl+K` search and jump anywhere · `Alt+C` customers · `Alt+T` tickets · `Alt+V` visits · `Alt+N` new record on most lists ·
`Enter` moves to the next field in every form · `Esc` closes a pop-up · `⌘P` / `Ctrl+P` prints a print page.

## Who sees what
| Role | Can do | Cannot do |
|---|---|---|
| **Owner** (Morvin) | Everything below. | — |
| **Accounts** | Contracts, invoices, payments, outstanding, money reports. Reads customers, tickets and visits. | Edit tickets or visits, users, settings. |
| **Support** (the team) | Customers (notes, installer, active), tickets, visits, non-money reports. Reads contracts. | See any amount. Invoices, payments and money reports are hidden. |

---

## Workspace

### Dashboard
The morning view. Six tiles: licences ending in 30 days, licences expired, AMCs ending in 30 days (with how many shops have no AMC),
outstanding money (owner / accounts only), open tickets by priority and how many are past their response time, servers offline.
Below: the shops whose licence ends soonest with the contact's number, the open tickets with their SLA timer, today's visits,
overdue invoices, offline servers and the last actions taken in DcAMC. Every tile and row opens the screen behind it.

### My profile
Your name, mobile and e-mail (reminders marked "also tell the team" use these), change your password, switch on an
authenticator app for a 6-digit code at sign-in, choose light / dark theme and the accent colour, and see the devices you are
signed in on ("Sign out other devices").

---

## Customers

### Customers
Every shop the ERP servers report. **Nobody types a customer in** — a shop appears when its ERP server sends its first heartbeat,
and its licence facts (code, version, status, tills, start and end date, contact) are refreshed every 24 hours from the ERP.
Use it to:
- search by shop, code, HDD, contact or mobile; filter by version, status, server, expiry ("licence ends in 30 d", "expired",
  "AMC ends in 30 d", "no AMC", "server offline") and current / left us;
- read the tiles: shops, licence live, ending in 30 days, expired, without AMC, server offline — click a tile to filter;
- click a row to open the customer.

The green / red dot before the name is the server: red means its ERP has not reported for 48 hours.

### Customer page (click a row)
Head: licence end with days left, AMC with its number and end, outstanding (money roles), open tickets, and three buttons:
**New ticket**, **New visit**, **New / Renew AMC**. Tabs:
- **Overview** — everything the heartbeat said: licence, contact, server and link status, users, last sign-in, entries today and in 30 days.
- **Contracts** — its AMCs, newest first (see Contracts below).
- **Payments** — its tax invoices with balances, its receipts, a **Statement** print. Money roles only.
- **Tickets** and **Visits** — its own lists, with new / open.
- **Notes** — the only things typed by us: free notes, who installed it (initials), and **Current customer** off when they stop
  using the ERP (hides them from the default list and from reminders).
- **History** — one timeline of contracts, invoices, receipts, tickets, visits and reminders sent.

### Servers
One row per customer ERP server (Settings → Servers & link keys is the same screen). Shows online / offline, last heartbeat,
ERP version, pending database scripts on that server, number of shops, and queued licence pushes.
- **Add server** creates the row and shows its **link key once**. Put `AMC_URL` and `AMC_KEY` in that ERP's `.env` and restart
  its service; the shops arrive with the first heartbeat.
- **Test** (radio icon) pings the ERP with the key. **Queue** (list icon) shows licence pushes waiting for that server and lets
  the owner **Retry now**. **New key** (key icon) replaces the key; the old one stops working at once.

---

## Contracts

### Contracts
All AMCs across every shop with status **Draft / Live / Expired / Cancelled**, period, days left, total and balance (money roles),
and the licence push status: **Pushed** (the ERP took the new end date), **Queued** (server unreachable, goes with its next
heartbeat), **Failed** (the ERP refused; hover for the reason). Tiles filter by live, ending in 30 days, drafts, expired.
**New / renew** opens the editor; pick the shop first.

**How a contract works**
1. Start defaults to the current expiry (the previous AMC's end, or the licence end from the ERP) while it is still live, else today.
   End is start + 365 days. Amount and cover default from the last contract; VAT from Settings.
2. **Save as draft** keeps it without touching anything.
3. **Make live & push licence** does three things at once: marks it live, raises its one **tax invoice** (INV-…), and pushes
   `{ shopCode, endDate, tills, plan, status }` to the shop's ERP, signed with that server's key. That is the only thing DcAMC ever
   changes in the ERP.
4. **Edit** on a live contract changes cover, remark, visits, tills, version; dates are fixed, and the amount only while the
   invoice is unpaid. **Push again** (send icon) repeats the licence push. **Cancel** marks the contract and its unpaid invoice cancelled;
   the ERP licence is not touched.
5. **Print** gives the A4 contract: parties, period, software covered, cover, fee, terms and signature lines.

### Invoices
Every tax invoice (DataCare TRN, taxable, VAT, total, amount in words, payments so far, bank details on the print).
Tiles: open, outstanding, overdue, paid. **Receive** on a row records a payment; **Print** opens the A4 tax invoice.
An invoice with no money against it can be cancelled from the customer's Payments tab.

### Payments
Every receipt: date, shop, invoice, mode (cash / bank / cheque / card), reference, amount, who took it. Filter by period and mode.
Cancelling a receipt puts the money back on the invoice balance. **Print** gives the A4 receipt.

**Receiving money:** from Invoices, Outstanding or the customer's Payments tab press **Receive** → date, mode, reference,
amount (defaults to the full balance; more than the balance is refused) → **Record receipt**. The invoice turns **Paid** when
the balance reaches zero.

### Outstanding
Every open invoice with money due, oldest due date first, with days overdue and the contact for the call. **Receive** and
**Statement** on each row.

---

## Support

### Tickets
Every call, WhatsApp, e-mail or visit request. Two views (icons top right): **list** and **kanban** by status
(Open · In progress · Waiting · Closed). Tiles: open, urgent / high, past SLA, unassigned. Filters: status, priority, assignee,
open only.

- **New ticket** (`Alt+N`, or from a customer): shop, channel, title, priority, detail, assignee. The **SLA timer** starts from
  the priority (Settings → SLA & reminders: low 72 h, normal 24 h, high 8 h, urgent 2 h by default) and shows time left or over on
  every row and card.
- **Open a ticket** (click): change title, status, priority, channel, assignee; the **thread** below keeps every note.
  **Add note** with minutes spent, optionally moving the status (`Ctrl+Enter` sends). **Plan a visit** opens Visits with this
  ticket pre-selected. **Close ticket** asks for the resolution and minutes; **Reopen** brings a closed one back.
  Status and assignee changes are written into the thread automatically.

### Visits
Site visits on a **month calendar** (arrows or `Alt+←` / `Alt+→`, click a day's `+` to plan) or a **list**. Filter by engineer and status.
**Plan a visit**: shop, the ticket it belongs to (or standalone), date, time, engineer, purpose. Afterwards open it and set
**Done** with minutes on site, travel km and who signed at the shop. Done visits count against the contract's included visits.

---

## Reports
Every report has filters, a **CSV** download and **Print** (A4, with the DataCare caption). Click a row to open the customer.

| Report | Use |
|---|---|
| Expiring licences | ERP licences ending in the next 7 / 15 / 30 / 60 / 90 days or already expired, with AMC status and contact. The renewal call list. |
| Expiring AMCs | Live contracts ending soon and whether a renewal exists. |
| Outstanding | Money due per customer, with how much is overdue. Money roles. |
| Collections | Receipts in a period, totals by mode and by month, against what was invoiced. Money roles. |
| Tickets by engineer / customer | Tickets opened in the period: closed, open, closed late, minutes, average hours to close. |
| Visits by engineer | Visits in the period with minutes and kilometres, plus every visit listed. |
| Customer history | One shop's whole record: contracts, invoices, receipts, tickets, visits, reminders. |

---

## Other (owner)

### Reminders
Rules for what goes out and when, by **WhatsApp** (DataCare Chat) and **e-mail** (SMTP):
licence expiry 30 / 15 / 7 / 0 days before, AMC expiry, payment overdue (days after due), ticket past SLA (to the team only).
Each rule has a message with placeholders (`{shop} {contact} {date} {days} {no} {amount}`), can also copy the DataCare team,
and can be switched off. A rule fires **once per customer and reference** — a day the scheduler missed still goes out the next day.
- **What is due** previews everything that would be sent right now. **Run now** sends it. The scheduler runs daily at the time
  in Settings → SLA & reminders.
- **Sent log** shows every message, sent or refused, with the reason. **Test message** sends one to a number or address.
WhatsApp and e-mail must be set up in Settings first; until then the log shows them as refused.

### Users & roles
DcAMC's own logins. Add a user (login name, display name, role, mobile, e-mail, first password, "must change at next sign-in"),
reset a password, unlock after too many wrong passwords, remove a lost authenticator app, sign someone out everywhere,
switch a login off. You cannot demote or deactivate yourself.

### Settings
| Tab | What it holds |
|---|---|
| Company | Name, TRN, address, phone, e-mail, website, bank details and logo — printed on the contract, tax invoice and receipt. |
| Numbering & VAT | Prefixes for contract / invoice / receipt / ticket numbers (5 digits, never reused) and the VAT %. |
| Security | Lock after N wrong passwords for M minutes, minimum password length, idle sign-out minutes. |
| SLA & reminders | Response hours per priority; the daily reminder time (Dubai); the team's WhatsApp number and e-mail. |
| E-mail (SMTP) | The mailbox reminders and invoices go from (Gmail needs an App password). |
| WhatsApp | DataCare Chat endpoint, the licence (HDD), and the **TYPE** — sent exactly as typed, it is case-sensitive. |
| Servers & link keys | Same as Customers → Servers. |
| Field update | Applies any new database script after a backend update. Safe to press again; shows what is pending. |

### Audit log
Every write in DcAMC: who, when, which table and record, what changed; and the sign-in log. Nothing can switch this off.

### Data backup
**Back up now** writes a `.bak` of the DcAmc database into the backup folder on the server. Automatic daily backup at a
time, keeping the newest N; optional copy of every backup to Google Drive once the DataCare Google account is connected.
The list shows every run with its file, size and result.

---

## Day-to-day
- **Renewal call list:** Reports → Expiring licences (30 days). Reminders have already gone to the shop at 30 / 15 / 7 / 0 days.
- **Renewing:** open the customer → **Renew AMC** → check amount → **Make live & push licence** → print the tax invoice from
  the Payments tab and send it. The ERP licence is extended at once (or as soon as that server is next online).
- **Money in:** Outstanding → **Receive** → print the receipt.
- **A shop calls:** `Alt+T`, `Alt+N`, type the title, set the priority, assign. Notes as you work; close with the resolution.
- **Going out:** plan the visit from the ticket; mark it done with minutes and km when back.
- **After a DcAMC update on the server:** Settings → Field update once.

# DcAMC — what each screen does and how to use it

DcAMC is DataCare's own book of every jeweller on the DXB ERP: who they are, what they bought and when, their annual maintenance
contract (AMC), what they were invoiced and paid, every lead and follow-up, every support call and site visit, and the reminders
and notifications around them. Data only comes in from the ERP; DcAMC never changes anything there.

Open it at the Vercel address. Sign in with your first name and your mobile number without the country code.
Keyboard: `⌘K` / `Ctrl+K` search and jump anywhere · `Alt+C` party master · `Alt+T` tickets · `Alt+V` visits · `Alt+N` new record on most lists ·
`Enter` moves to the next field in every form · `Esc` closes a pop-up · `⌘P` / `Ctrl+P` prints a print page.

## Who sees what
| Role | Can do | Cannot do |
|---|---|---|
| **Owner** (Morvin) | Everything below. | — |
| **Accounts** | AMC issue, invoices, AMC received, outstanding, collection, money reports. Reads parties, leads, tickets and visits. | Edit parties, leads, tickets or visits; users, settings. |
| **Support** (the team) | Party master, leads & follow-up, tickets, visits, non-money reports. Reads contracts. | See any amount. Invoices, payments, installation amounts and money reports are hidden. |

---

## Home

### Dashboard
The morning view. Six tiles: licences ending in 30 days, licences expired, AMCs ending in 30 days (with how many shops have no AMC),
outstanding money (owner / accounts only), open tickets by priority and how many are past their response time, servers offline.
Below: the shops whose licence ends soonest with the contact's number, the open tickets with their SLA timer, today's visits,
overdue invoices, offline servers and the last actions taken in DcAMC. Every tile and row opens the screen behind it.

### Notifications
The bell at the top right shows the unread count and the latest few; the Notifications page lists them all.
They are made by themselves every 5 minutes, once each: a lead's **follow-up or demo** when its time comes (to whoever follows
it up), a **ticket past its response time** (to its assignee), a **licence or AMC ending within 7 days** (to everyone). The
owner can also **Send a note** to one person or everyone, now or at a set time. Click one to open what it is about.

### My profile
Your name, mobile and e-mail (reminders marked "also tell the team" use these), change your password, switch on an
authenticator app for a 6-digit code at sign-in, choose light / dark theme and the accent colour, and see the devices you are
signed in on ("Sign out other devices").

---

## Party

### Party master
The customers, the way the India AMC software keeps them: **every party on the left, its details on the right**. Click a party
to see and edit it; **New party** (`Alt+N`) opens a blank form. Search (`/`) by name, code, contact, mobile or city; filter by
ending in 30 days, expired, no AMC, money due, server offline, and current / left us.

Fields, top to bottom:
| Field | Notes |
|---|---|
| AC name | The shop / jeweller name. |
| Install by | Who installed it — the team's initials. |
| Software type | Basic, Pro, Advance or Enterprise. Changing it on an existing party shows the **convert amount** (see below). |
| Contact person, customer type | Type is New, Existing or Converted. |
| Address 1, Address 2, area, city, emirate, state / country, pin code | |
| Mobile, phone, e-mail, TRN | Mobile with country code (971…); the TRN goes on the tax invoice. |
| Installation date | Pick a date — **AMC start takes the same date** and **AMC end is set 365 days later** by itself. |
| Birth date, tills | |
| Installation amount | Owner / accounts only. On save, one **installation invoice** is raised for it (plus VAT). |
| Recognition code (HDD), Shop ID | Leave blank: the code is made as DC + serial + W + type letter + installer (DC0002WPMV), the Shop ID from the name. |
| Ref by, old HDD, old install date, PC serials, status, remark | |

**Convert amount.** Prices per software type are in Settings → Software prices (Basic 4,000, Pro 6,000, Advance 8,000,
Enterprise 10,000 AED by default). When a party moves up, say Basic → Pro, it pays only the difference: 2,000 + VAT. Saving the
new type raises an **upgrade invoice** for that difference, records the change (shown under Money → Convert amounts), and moves
the type letter in the code. Moving down raises nothing.

**Money** (owner / accounts): billed, received and outstanding for the party across every invoice.

**Delete** removes a party with nothing on record; one with contracts, invoices, tickets or visits is switched off instead.
**Open** goes to the full party page with its tabs (Overview, Contracts, Payments, Tickets, Visits, Notes, History).

**Parties from the ERP.** A party can also arrive from an ERP server's heartbeat (marked *from ERP*). If you typed it here first
with the same HDD or Shop ID, the heartbeat attaches to it instead of making a second one. For those parties the ERP owns the
name, code, type, status, tills and licence dates; they are read-only here and refreshed every 24 hours. **Nothing is ever sent
to the ERP.**

### Leads & follow-up
A small CRM for every enquiry before it becomes a party. List or board view by stage:
**New → Contacted → Demo → Proposal → Won / Lost.** Each lead has a contact, mobile, city, source (reference, call,
exhibition…), the software type they want, an expected amount, who follows it up, and the **next follow-up or demo time**.
Open a lead to see every follow-up, newest first. **Note follow-up** records what happened, the stage now and the next time
(`Ctrl+Enter` saves). Leads whose time has passed turn red and appear in the owner's notifications.
**Won → party** makes the party in Party master with what the lead knew, installation date today.

### ERP servers
One row per customer ERP server (owner only; the same as Settings → Servers & link keys). **Add server** shows its link key
**once**; put `AMC_URL` and `AMC_KEY` in that ERP's `.env` and restart its service, and its shops arrive with the first heartbeat.
Shows online / offline (no heartbeat for 48 h), last heartbeat, ERP version, pending database scripts and number of shops.
**Test** pings the ERP with the key; **New key** replaces it.

---

## AMC

### AMC issue
All AMC contracts across every party with status **Draft / Live / Expired / Cancelled**, period, days left, total and balance
(money roles). Tiles filter by live, ending in 30 days, drafts, expired. **New / renew** opens the editor; pick the party first.

**How a contract works**
1. Start defaults to the current expiry (the previous AMC's end, or the licence end from the ERP) while it is still live, else today.
   End is start + 365 days. Amount and cover default from the last contract; VAT from Settings.
2. **Save as draft** keeps it without touching anything.
3. **Make live** marks it live and raises its one **tax invoice** (INV-…). Nothing is sent to the ERP.
4. **Edit** on a live contract changes cover, remark, visits, tills, software type; dates are fixed, and the amount only while
   the invoice is unpaid. **Cancel** marks the contract and its unpaid invoice cancelled.
5. **Print** gives the A4 contract: parties, period, software covered, cover, fee, terms and signature lines.

### Invoices
Every tax invoice — AMC contracts, installations and upgrades (the kind shows under the shop) (DataCare TRN, taxable, VAT, total, amount in words, payments so far, bank details on the print).
Tiles: open, outstanding, overdue, paid. **Receive** on a row records a payment; **Print** opens the A4 tax invoice.
An invoice with no money against it can be cancelled from the customer's Payments tab.

### AMC received
Every receipt against any invoice: date, shop, invoice, mode (cash / bank / cheque / card), reference, amount, who took it. Filter by period and mode.
Cancelling a receipt puts the money back on the invoice balance. **Print** gives the A4 receipt.

**Receiving money:** from Invoices, Outstanding or the customer's Payments tab press **Receive** → date, mode, reference,
amount (defaults to the full balance; more than the balance is refused) → **Record receipt**. The invoice turns **Paid** when
the balance reaches zero.

### Outstanding
Every open invoice with money due, oldest due date first, with days overdue and the contact for the call. **Receive** and
**Statement** on each row. A party's total bill is its installation, upgrades and AMCs; what it paid is every receipt; the
difference is outstanding.

### Collection
Receipts in a period (this month / this year or any dates), totals by mode and by month, against what was invoiced. CSV and print.

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
| Software prices | Price of Basic, Pro, Advance and Enterprise — the convert amount is the difference between two of them. |
| Security | Lock after N wrong passwords for M minutes, minimum password length, idle sign-out minutes. |
| SLA & reminders | Response hours per priority; the daily reminder time (Dubai); the team's WhatsApp number and e-mail. |
| E-mail (SMTP) | The mailbox reminders and invoices go from (Gmail needs an App password). |
| WhatsApp | DataCare Chat endpoint, the licence (HDD), and the **TYPE** — sent exactly as typed, it is case-sensitive. |
| Servers & link keys | Same as Party → ERP servers. |
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
- **New customer:** Party master → **New party** → fill it, pick the installation date, type the installation amount → **Save**.
  The AMC dates and the installation invoice are made for you.
- **Enquiry:** Leads & follow-up → **New lead** with the next call time → note each follow-up → **Won → party**.
- **Upgrade:** open the party, change the software type, **Save** — the convert amount is billed.
- **Renewing:** open the party → **Renew AMC** → check amount → **Make live** → print the tax invoice from the Payments tab
  and send it.
- **Money in:** Outstanding → **Receive** → print the receipt.
- **A shop calls:** `Alt+T`, `Alt+N`, type the title, set the priority, assign. Notes as you work; close with the resolution.
- **Going out:** plan the visit from the ticket; mark it done with minutes and km when back.
- **After a DcAMC update on the server:** Settings → Field update once.

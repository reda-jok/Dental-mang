# 🦷 Rebuild Plan — Dental Clinic Management (v2)

> Status: draft for review · Date: 2026-09-29 · Author: reda-jok (with Claude)
>
> This replaces the refactor roadmap in `01-project-audit.md`. Corrections to the audits are in section 13.

---

## 1. Product decisions (from Q&A)

| Question | Decision |
|---|---|
| Who uses it | **Sold to many dental clinics** (licensed product) |
| Where it runs | **On a server inside each clinic** (works with no internet) + **automatic encrypted backups to our cloud** |
| Devices | Any device with a **browser** on the clinic Wi‑Fi (PC, tablet, phone) |
| Language / market | **Arabic (RTL)**, **Iraq** first (IQD, +964 phones) |
| Old data | None worth keeping → **clean start, new repo** |
| Business model | **Monthly / yearly license key** |
| Backups | **Our cloud** (Cloudflare R2), encrypted before upload |
| Must-have workflows | WhatsApp reminders · Printing (A4 + thermal) · Doctor commission · Lab work tracking |
| Dental chart | **Interactive tooth chart** (FDI, per surface, adult + child) |
| Modules | Patients + chart · Appointments · Billing · Accounting · HR · Inventory |
| Team | **One developer, part-time** |

### The key consequence
Because every clinic runs its **own server and its own database**, the clinic app is **single-tenant**. We do **not** need multi-tenant rows (`clinicId` on every table), which is the hardest part of normal SaaS. The "SaaS" part becomes a separate small **cloud control plane** (licenses, backups, updates, monitoring).

```
┌──────────────── Clinic (offline OK) ────────────────┐        ┌──────── Our cloud ────────┐
│  Mini PC "appliance" (Ubuntu + Docker)               │        │                            │
│   ├─ caddy     (HTTPS, https://clinic.local)         │  ───►  │  control-plane app         │
│   ├─ app       (Next.js: UI + server actions)        │ license│   ├─ licenses & check-in   │
│   ├─ worker    (jobs: reminders, backups, check-in)  │ backup │   ├─ release channel       │
│   ├─ postgres  (all clinic data)                     │ status │   ├─ health dashboard      │
│   └─ updater   (safe upgrades + rollback)            │        │   └─ admin (me)            │
│                                                      │        │  Cloudflare R2 (backups)   │
│  PCs / tablets / phones → browser on clinic Wi‑Fi    │        │  GHCR (Docker images)      │
└──────────────────────────────────────────────────────┘        └────────────────────────────┘
```

---

## 2. Guiding principles

1. **Never lose data, never lock a doctor out.** Backups are a core feature. An expired license means **read-only mode**, never locked or deleted data.
2. **Correct money.** Use `Decimal` (never float), wrap every multi-step write in a DB transaction, keep an append-only double-entry ledger, and fix mistakes with reversing entries instead of edits.
3. **Offline by default.** No CDN fonts or scripts at runtime and no required internet calls. Anything that needs internet (WhatsApp API, backup upload, license check-in) goes into a **queue** and retries.
4. **One way to do each thing.** One DB layer (Prisma), one validation library (Zod, shared by forms and server), one mutation style (Server Actions), and authorization in one place (the data access layer).
5. **Arabic-first UI.** RTL from day 1, Tailwind logical properties (`ms-*`, `pe-*`), and every string goes through i18n so English and Kurdish can be added later without a rewrite.
6. **Ship to a real clinic early.** A pilot clinic at the end of Phase 5 decides priorities after that.
7. **Small and boring.** Part-time solo dev → few moving parts, no microservices, no Redis, no Kubernetes.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Node.js 24 LTS** | Current Active LTS |
| Framework | **Next.js 16** (App Router, `output: "standalone"`) | RSC + Server Actions; standalone build runs well in Docker |
| Language | **TypeScript 5.9, strict**, build fails on errors | `create-next-app` still ships TS 5; move to TS 7 when the Next/ESLint tooling does |
| UI | **Tailwind CSS 4 + shadcn/ui** (+ `tw-animate-css`) | Supports RTL; we own the components |
| Font | Arabic font self-hosted via `next/font` (e.g. IBM Plex Sans Arabic / Cairo) | Works offline |
| i18n | **next-intl** (ar default; en/ku later) | RTL `dir`, number/date formatting |
| Forms | **react-hook-form + Zod 4** | Same schema validates on client and server |
| DB | **PostgreSQL 18** | Transactions, sequences, exclusion constraints, `pg_dump` |
| ORM | **Prisma 7** (+ `@prisma/adapter-pg`), migrations **committed** | Stay on 7.x until 8 is stable |
| Auth | **Better Auth** (username + password, DB sessions, roles) | Works fully offline; Auth.js is in maintenance |
| Background jobs | **pg-boss** (queue stored in Postgres) | No Redis; cron + retries |
| Client data | Server Components by default; **TanStack Query only** for the live calendar | Less client state |
| Backups | **restic** → Cloudflare R2 (encrypted, deduplicated, incremental) | Handles DB dumps and X-ray files efficiently |
| Reverse proxy | **Caddy** | Automatic HTTPS (see decision D4) |
| Phones | `libphonenumber-js` | Normalize to `+9647XXXXXXXXX` |
| Logging | **pino** (JSON) → local files, summary sent to cloud | Support without remote access |
| Tests | **Vitest** (+ Testcontainers Postgres) · **Playwright** | Real DB in tests; E2E for key flows |
| Monorepo | **pnpm workspaces** (Turborepo optional later) | `clinic`, `cloud`, `shared` |
| CI/CD | **GitHub Actions** → Docker images to **GHCR** | Typecheck, lint, test, build, release |

**Not used:** `uuid` (use `crypto.randomUUID()`), `@vercel/analytics`, raw `pg` Pool, `pg-native`, Redis, Google Fonts CDN at runtime.

---

## 4. Repository layout

```
dental/                       # new repo (archive the old one)
├─ apps/
│  ├─ clinic/                 # the product installed at each clinic
│  │  ├─ src/app/             # routes only (thin); language is a setting, not in the URL
│  │  │  ├─ (auth)/{login,setup}
│  │  │  └─ (app)/{dashboard,patients,appointments,billing,lab,
│  │  │            accounting,hr,inventory,settings}
│  │  ├─ src/features/        # ← all real code lives here, one folder per module
│  │  │  └─ patients/
│  │  │     ├─ schemas.ts     # Zod: input/output shapes (shared client+server)
│  │  │     ├─ data.ts        # "server-only": queries + permission checks (DAL)
│  │  │     ├─ service.ts     # business rules, transactions
│  │  │     ├─ actions.ts     # "use server": thin wrappers → service
│  │  │     ├─ components/    # UI for this feature
│  │  │     └─ *.test.ts
│  │  ├─ src/server/          # db client, auth, audit log, ledger, jobs, license
│  │  ├─ src/components/ui/   # shadcn
│  │  ├─ messages/ar.json     # translations
│  │  └─ prisma/              # schema.prisma + migrations (COMMITTED)
│  └─ cloud/                  # control plane: licenses, releases, backup status, admin
├─ packages/
│  └─ shared/                 # license format + types, API contracts between clinic↔cloud
├─ deploy/
│  ├─ appliance/              # docker-compose.yml, Caddyfile, install.sh, updater
│  └─ docs/                   # install guide, restore guide (runbooks)
├─ docs/                      # ADRs, this plan
└─ .github/workflows/
```

**Rule:** pages never call Prisma directly. Page → `data.ts` (read) or `actions.ts` → `service.ts` (write). Every function in `data.ts`/`service.ts` starts with a permission check, e.g. `await authorize("billing:write")`.

---

## 5. Roles & permissions

| Permission area | Owner | Admin | Dentist | Assistant | Reception | Accountant |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Patients (view/edit demographics) | ✅ | ✅ | ✅ | ✅ | ✅ | view |
| Medical history, chart, clinical notes | ✅ | view | ✅ | ✅ | ❌ | ❌ |
| Appointments | ✅ | ✅ | own + view | view | ✅ | ❌ |
| Invoices & payments | ✅ | ✅ | view own | ❌ | ✅ | ✅ |
| Discounts / refunds / voids | ✅ | ✅ | ❌ | ❌ | request | ✅ |
| Lab cases | ✅ | ✅ | ✅ | ✅ | view | view |
| Accounting & reports | ✅ | view | ❌ | ❌ | ❌ | ✅ |
| HR & payroll | ✅ | ✅ | own payslip | own | own | ✅ |
| Inventory | ✅ | ✅ | view | ✅ | view | view |
| Settings, users, backups, license | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

Permissions are stored as code (`permissions.ts`) mapped to roles. Clinics can't create custom roles in v1.

---

## 6. Data model (core)

Conventions: `id` = UUID (`crypto.randomUUID`), `createdAt/updatedAt`, `createdById`, **soft delete** (`deletedAt`) for clinical and financial records, money = `Decimal(14,2)` + `currency`, timestamps stored in UTC and shown in `Asia/Baghdad`.

### Clinic & staff
- **ClinicSettings** (single row): name, logo, address, phones, currency, receipt footer, working hours, WhatsApp templates, number format.
- **User** (Better Auth) → role, active, linked **Employee** (optional).
- **Chair/Room**, **Holiday**, **WorkingHours** (per dentist).

### Patients & clinical
- **Patient**: `code` (from a **Postgres sequence** → `P-000123`, no race condition), first/last name (Arabic), phone(s), gender, DOB, address, referral source, notes, `deletedAt`.
- **MedicalHistory** (versioned; new row on each change): allergies, conditions, medications, pregnancy, smoker, **alert flags** shown as a red banner.
- **ToothRecord**: patient, tooth (FDI `11–48`, child `51–85`), surfaces (`M,O,D,B,L` / `I,F,P` depending on the tooth), condition (caries, filling, crown, missing, implant, RCT, bridge…), status (`existing` / `planned` / `done`), date, dentist.
- **Attachment**: patient, type (x-ray, photo, document), file path on disk, sha256, size, taken at. Files live on the appliance disk and are included in backups.
- **ClinicalNote**: appointment/visit, dentist, text, signed at (locked 24h after signing; later changes create a new version).

### Treatment
- **Procedure** (catalog): code, Arabic name, category, default price, currency, default duration, lab required?, commission rate override.
- **TreatmentPlan** → **TreatmentPlanItem**: procedure, tooth, surfaces, price, discount, dentist, status (`proposed → accepted → in_progress → done / cancelled`), phase.
- Completing an item creates an **invoice line** (see billing).

### Appointments
- **Appointment**: patient, dentist, chair, `startsAt`, `endsAt`, status (`booked → confirmed → arrived → in_chair → completed / no_show / cancelled`), reason, linked plan items, created via (phone / walk-in / WhatsApp).
- **No double-booking, enforced by the database**: a Postgres **exclusion constraint** (`btree_gist`) on `(dentistId, tstzrange)` and `(chairId, tstzrange)` for active statuses, added as custom SQL in a Prisma migration.

### Billing
- **Invoice**: number (sequence, `INV-2026-000123`), patient, kind (`visit | plan`), status (`issued | void`; no drafts), currency, totals, due date. Issued invoices can't be edited (database trigger); they can only be voided, which reverses the journal entry. Paid / partly paid / overdue are calculated from payments, never stored.
- **InvoiceLine**: from plan item or manual, qty, unit price, discount, dentist (for commission).
- **Payment** (receipt `RC-2026-000123`): patient, amount, method (`cash | card | wallet`, wallet = ZainCash / FIB / Qi / transfer, with a reference), received by, date, **idempotency key** (stops double-click duplicates). A mistaken payment is voided (journal reversed), never edited.
- **PaymentAllocation**: payment → invoice, append-only. Money goes to the chosen invoice, then the oldest due; the rest is patient credit and pays the next invoice automatically. Allocations to void invoices or from void payments stop counting.
- **Refund** (`RF-2026-000123`): money given back out of the patient's credit only (adjustable permission `billing:refund`). No credit notes: voiding an invoice returns what was paid on it to credit.
- **Patient balance is calculated** (a SQL view: invoiced − allocated − credits), **never stored** as a field that can drift.
- **CashClose** (one per clinic day): expected cash (cash in − refunds − voided cash payments since the last close), counted, difference (booked to "cash over/short"), card and wallet totals for checking against the machine. **CashCloseItem** links every payment, voided payment and refund to exactly one close, so money taken after closing goes into the next close.

### Ledger (accounting core, built in Phase 4 even though reports come later)
- **Account** (seeded chart of accounts: Cash, Bank, AR, AP, Revenue, Lab Expense, Salaries, Supplies…).
- **JournalEntry** (date, description, source type + id, reversed by) → **JournalLine** (account, debit, credit).
- **A deferred DB trigger enforces debits = credits** per entry. Entries are append-only.
- **Automatic postings** (inside the same transaction as the business action):

| Event | Debit | Credit |
|---|---|---|
| Invoice issued | Accounts Receivable | Treatment Revenue |
| Payment received | Cash / Bank | Accounts Receivable |
| Refund | Accounts Receivable | Cash / Bank |
| Lab invoice received | Lab Expense | Accounts Payable (lab) |
| Lab paid | Accounts Payable (lab) | Cash |
| Expense | Expense account | Cash / Bank |
| Payroll posted | Salaries / Commission Expense | Salaries Payable |

> This fixes the current bug where each payment is credited to Revenue (revenue counted at the wrong time or twice).

### Lab work
- **Lab** (name, phone, price list).
- **LabCase**: patient, plan item, tooth/teeth, type (crown, bridge, denture, aligner…), shade, material, sent at, due at, received at, fitted at, status, cost, lab invoice ref, notes, photos.

### Commission
- Configured per dentist: rate %, **basis = billed or collected** (decision D2), **deduct lab cost?** (yes/no).
- **CommissionEntry** created by events (line invoiced / payment allocated), then summed into payroll.

### HR
- **Employee**: name, role, phone, salary type (monthly / daily / commission only / mixed), base salary, hire date.
- **Attendance** (check-in/out, manual in v1), **LeaveRequest** (type, dates, approval).
- **PayrollRun** (month) → **Payslip** (base + commission + allowances − deductions − advances), posted to the ledger when finalized.

### Inventory
- **Item** (name, unit, SKU, min stock, cost), **Supplier**.
- **StockMovement** (in / out / adjust / expired, qty, unit cost, reason, by). **Stock on hand = sum of movements** (never a mutable counter).
- Optional later: default consumption per procedure (e.g. each filling uses X).

### Cross-cutting
- **AuditLog**: user, action, entity, entity id, before/after JSON, IP, time. Written explicitly by each service with `recordAudit(tx, …)` inside the same transaction as the change (an automatic extension can't join the caller's transaction).
- **OutboxMessage**: WhatsApp and other outbound messages (status, attempts, last error).
- **Job** tables (pg-boss).

---

## 7. Key workflows

**Patient visit (the main flow):**
Reception books → WhatsApp reminder the day before → patient arrives (status `arrived`) → dentist opens patient: alerts banner, chart, plan → marks items done + writes note → items go to a draft invoice → reception issues invoice, takes payment, prints receipt (thermal) → ledger + commission entries written in the **same transaction**.

**WhatsApp (decision D3):**
- **v1:** "Send via WhatsApp" opens `wa.me/964…?text=…` with the Arabic template filled in. Free, no ban risk, works from any phone or PC. The worker builds a daily reminder list for reception.
- **Later:** WhatsApp Cloud API (official) through our cloud as a relay. Messages queue in the Outbox while offline. Needs Meta business verification and approved templates, and costs money per conversation.
- Avoid unofficial libraries (whatsapp-web.js / Baileys) because they risk getting the clinic's number banned.

**Printing:** print CSS for **A4** (invoice, treatment plan, prescription, patient report) and **80 mm thermal** (receipt), using the browser print dialog, embedded Arabic fonts, and clinic logo/footer from settings. No PDF server needed in v1.

**Requirements carried over from the v1 Notion notes:**
- Patient form: no city/state/zip/insurance/email · **duplicate patient check** (name + phone)
- Click a patient anywhere → patient profile with full history (visits, chart, plans, invoices, balance)
- Procedures: categories, selling price/cost, working edit/delete/search
- Treatment plans built from several procedures (multi-select + tooth numbers); **packages / full plans** with sub-procedures (`PlanTemplate`)
- New appointment flow shows the tooth chart → select teeth → procedure
- Calendar: edit/reschedule from the day view · **no-show → reschedule** · **completed → book next visit**
- Dashboard: today's appointments, patient search, monthly revenue, recent procedures, real stats only
- Billing: patients with total / paid / due · pay against patient + plan · print invoice/receipt after paying · overdue accounts · **no insurance, no payment plans**

---

## 8. Appliance, backups, updates, licensing

### 8.1 Hardware & install (decision D1)
- **Recommended:** we supply a **pre-configured mini PC** (Ubuntu Server LTS + Docker, full-disk encryption) plus a **small UPS**. Frequent power cuts and generator switching can corrupt a database that isn't shut down cleanly. The UPS triggers a clean shutdown.
- Every clinic gets the same setup. We control the OS and updates, and support is simple.
- Install = plug in + run `install.sh` (sets clinic ID, license, backup keys, local hostname).
- Devices open `https://clinic.local` (or a fixed IP), with a QR code on the setup screen.

### 8.2 Backups
- **Nightly** (and before every update): `pg_dump` (custom format) + attachments folder → **restic** → Cloudflare R2.
  - One R2 bucket per clinic with a **bucket-scoped token**, so one clinic's credentials can't reach another clinic's data.
  - Encrypted **on the appliance** before upload. The restic password is generated per clinic, kept in escrow (encrypted) in our cloud, and **also printed on a recovery sheet for the clinic owner**.
  - Retention: 14 daily, 8 weekly, 12 monthly.
- **Second local copy** on a USB drive or second disk (optional, recommended).
- **Monitoring:** the appliance reports "last successful backup" to the cloud. If there is no success for 48 h, alert me (and show a banner in the app).
- **Restore is tested monthly**, automatically, in CI or on a spare machine: restore → run migrations → smoke test. An untested backup isn't reliable.
- **Owner self-export:** a full data export (CSV/JSON + files) from settings. The data belongs to the clinic, and this builds trust.

### 8.3 Updates
- Images published to **GHCR**, version pinned per clinic by the cloud (staged rollout: me → pilot → everyone).
- Updater: backup → pull new image → `prisma migrate deploy` → health check → **roll back the image if the health check fails**.
- Migrations follow **expand → migrate → contract** so the old version still runs on the new schema.
- Updates run only after clinic hours (configurable).

### 8.4 Licensing
- License = a **signed payload (Ed25519)**: clinic ID, plan, max users, modules, `validUntil`. The app ships with the public key and **verifies it offline**.
- Daily **check-in** when online returns a renewed license (valid ~35 days for monthly plans) and sends health (version, disk space, last backup).
- After expiry: **14-day grace period** with a banner → **read-only mode** (view, print, export still work; no new records). Never delete or hide data.
- Basic clock-tamper protection: store the latest time seen and ignore clocks that go backwards.
- Clinics pay me directly at first (cash / FIB / ZainCash / transfer). I issue licenses from the cloud admin. Online self-serve payment comes later.

### 8.5 Security
- HTTPS on the LAN (D4), Better Auth sessions (httpOnly, secure), password rules, **auto-lock after inactivity** (shared reception PCs).
- Rate limiting on login, and an owner-only "reset user password" action.
- Full-disk encryption on the appliance (a stolen box exposes no patient data).
- Remote support **only on request** (Tailscale or Cloudflare Tunnel opened by the owner), logged in the audit log.

---

## 9. Quality bar (Definition of Done for every feature)

- [ ] Zod schema for every input; server validates even if the client already did
- [ ] Permission check in the DAL/service
- [ ] Multi-step writes in `prisma.$transaction`
- [ ] Audit log entry
- [ ] All strings in `messages/ar.json`; checked in RTL at phone and desktop widths
- [ ] Loading, empty and error states (no `alert()`; toasts via Sonner)
- [ ] Unit tests for business rules (billing, ledger, commission = 100% of rules covered)
- [ ] Playwright test for the happy path of the flow
- [ ] CI green: `tsc --noEmit`, ESLint, Vitest, Playwright, `next build`

**Error handling:** services throw typed `AppError`s (`NotFound`, `Forbidden`, `Validation`, `Conflict`). Actions return `{ ok: true, data } | { ok: false, code, message }`. Unknown errors are logged with a request ID, and the user sees a generic Arabic message with that ID. Raw `error.message` is never sent to the browser.

---

## 10. Roadmap (solo, part-time ≈ 10–15 h/week)

Estimates are honest ranges. **Pilot at a real clinic ≈ month 5–6. Full scope ≈ 10–13 months.**

| Phase | Scope | Est. | Exit criteria |
|---|---|---|---|
| **0. Foundations** | New monorepo, CI, Docker dev env (Postgres), Next 16 + Tailwind 4 + shadcn, RTL shell + Arabic font + next-intl, Better Auth + roles, audit log, settings, error handling, **walking skeleton deployed on a real mini PC** | 3 wk | Log in on a phone over clinic Wi‑Fi; CI green |
| **1. Patients** | Patient CRUD, search (Arabic-aware), medical history + alert banner, attachments (X-ray upload/view), patient code sequence | 3 wk | Reception can register and find 1000 seeded patients quickly |
| **2. Chart & treatment** | Procedure catalog, **interactive SVG tooth chart** (FDI, surfaces, adult/child), treatment plans + phases, clinical notes, print treatment plan | 4–5 wk | Dentist charts a patient and builds a priced plan on a tablet |
| **3. Appointments** | Day view with a column per dentist/chair, week view, drag to reschedule, statuses, working hours/holidays, DB no-double-booking, WhatsApp `wa.me` reminders + daily reminder list | 4 wk | A full clinic day can be run from the calendar |
| **4. Billing + ledger core** | Invoices from plan items, payments/allocations/advances/refunds, calculated balances, receipts (thermal) + invoice (A4), **automatic journal postings**, daily cash report | 4 wk | Money flow tested; debits = credits enforced; receipts print |
| **5. Appliance & ops** | docker-compose, Caddy, install script, restic → R2 backups, restore test, updater + rollback, cloud control plane v1 (licenses, check-in, backup monitor) | 3–4 wk | **Pilot clinic live**; backup restored successfully on a spare machine |
| — | **Pilot: 4+ weeks of real use**, fix what hurts | ongoing | Clinic uses it daily without paper |
| **6. Lab + commission** | Labs, lab cases + due-date alerts, commission rules + monthly commission report | 3 wk | Owner sees what each dentist earned |
| **7. Accounting** | Expenses, AP for labs/suppliers, reports: P&L, cash book, AR aging, revenue by dentist/procedure, owner dashboard | 3–4 wk | Monthly close possible without Excel |
| **8. HR & payroll** | Employees, attendance, leave, payroll run → payslips (base + commission + allowances − advances) → ledger | 3–4 wk | Monthly payroll generated and printed |
| **9. Inventory** | Items, suppliers, stock movements, low-stock alerts, purchase entries → ledger | 2–3 wk | Low-stock alert works |
| **10. Product / SaaS** | Onboarding wizard, cloud admin (clinics, licenses, releases, health), staged rollouts, WhatsApp Cloud API relay, remote owner view (read-only, via tunnel), English/Kurdish | ongoing | Second and third clinic onboarded without me on site |

> **Why accounting/HR/inventory come after the pilot:** they're still in scope, and the ledger is written from Phase 4, so no financial history is lost. Real clinic feedback on the core flow is worth more than building everything before anyone uses it.

---

## 11. Open decisions (need your answer)

| # | Decision | Options | My recommendation |
|---|---|---|---|
| **D1** | Clinic hardware | ✅ **Decided 2026-10-01: we supply a mini PC + UPS** | Docker Desktop on reception PCs is fragile (updates, sleep, antivirus) |
| **D2** | Commission basis | ✅ **Decided 2026-10-01: mixed, set per dentist** (salary / commission / both) | Commission on *collected* money, lab cost deductible, both configurable per clinic |
| **D3** | WhatsApp | `wa.me` links (free) · official Cloud API (paid) | `wa.me` in v1, Cloud API in Phase 10 |
| **D4** | HTTPS on LAN | Caddy local CA (install a cert on each device) · real domain `clinic-123.ourdomain.app` → LAN IP with a cert issued via DNS (renews when online) · plain HTTP on the LAN | **Real domain + DNS cert**: no warnings on phones. Plain HTTP only for the very first dev builds |
| **D5** | Currencies | ✅ **Changed 2026-10-01: IQD only.** USD pricing is removed from the catalog UI (the money code keeps multi-currency support dormant) | Simpler cash handling; clinics quote implants in dinars at their own rate |
| **D6** | Digits | Western (123) · Arabic-Indic (١٢٣) | Setting, default Western in inputs |
| **D7** | Pilot clinic | **Not found yet (2026-10-01).** Needed before Phase 5 (appliance) | Start asking now: a clinic that will use it daily and tolerate rough edges |

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Scope too big for one part-time dev | Never ships | Pilot after Phase 5; cut features, never quality |
| Power cuts corrupt the DB | Data loss | UPS + clean shutdown, Postgres WAL, nightly off-site backup, monthly restore tests |
| Appliance disk dies | Downtime | Restore from R2 to a new box in < 2 h (documented runbook) |
| Backups silently failing | Data loss discovered too late | Cloud monitor + alert + in-app banner |
| Bad update | Clinic can't work | Backup before update, health check, auto-rollback, staged rollout, after-hours only |
| License system blocks a clinic | Lost trust | Offline verification, long grace period, read-only instead of lockout |
| WhatsApp number bans | Clinic angry | Only `wa.me` links or the official API |
| Arabic search quality | Can't find patients | Normalize Arabic (أ/إ/آ→ا, ة/ه, ى/ي, strip diacritics) in a search column + `pg_trgm` index |

---

## 13. Corrections to `01-project-audit.md` / `02-version-audit.md`

- The audit missed the accounting, HR, inventory and holidays APIs. They contain the worst bugs: no transactions, floats for money, payments credited to Revenue, unbalanced journal entries allowed.
- `strict: true` is already on. The real problem is `ignoreBuildErrors`.
- Keep `dotenv` for `prisma.config.ts` (Prisma 7 doesn't load `.env` itself). Keep what `@prisma/adapter-pg` needs. Drop `pg-native`, `@types/pg` and the raw Pool.
- Keep `class-variance-authority` (shadcn uses it). Replace `tailwindcss-animate` with `tw-animate-css`.
- Node **24** LTS, not 22. Better Auth, not NextAuth v5. Prisma 7.x (8 is still a release candidate).
- Async `params` became required in Next 15 (not 16), and the current routes already break this rule.

---

## 14. What to keep from the old project

Very little code. Keep: the Arabic WhatsApp message texts (after fixing them), the list of modules and screens as a feature checklist, and the lessons in the audits. Archive the old repo read-only.

## 15. Next steps

1. Answer decisions **D1–D7**.
2. Write ADRs for D1, D4 and the ledger design in `docs/adr/`.
3. Create the new repo and start **Phase 0**.
4. Draft the full `schema.prisma` for Phases 1–4 and review it together before writing UI.

---

## 16. Interview decisions (2026-10-01)

Phases 0–3 were built between 2026-09-29 and 2026-10-01 (foundations, patients, chart & plans, appointments), far faster than the roadmap assumed. A second interview settled the remaining modules.

| Topic | Decision | What it means for the build |
|---|---|---|
| **When patients are charged** | **Both:** per visit (that day's done items on one invoice) *and* per plan (big plans like ortho/implants invoiced up front, paid in installments) | `Invoice` links to either an appointment/visit or a treatment plan; items come from plan items marked done |
| **Payment features** | Partial payments / debt, advance deposits, discounts, refunds | `Payment` + `PaymentAllocation`; a payment with no invoice is patient credit; `Refund`; balance is always calculated |
| **Payment methods** | Cash (IQD), card/POS, mobile wallet (ZainCash, FIB, Qi, transfer) | `PaymentMethod` enum; daily totals per method |
| **Discounts & voids** | **Editable permissions.** The owner decides which roles may discount and which may void | New **role-permission overrides** in settings (defaults from code, stored in DB); first used for `billing:discount` and `billing:void` |
| **Currency** | **IQD only** (changes D5) | Hide USD in the procedure form; all prices, invoices and reports in dinars |
| **Printing** | Wanted: 80 mm thermal receipt + printable treatment-plan quote. **Deferred** to after the pilot starts | Build Phase 4 without printing; add it as the first post-pilot item |
| **Overdue debt** | Due date per balance, overdue list aged 30/60/90 days, WhatsApp payment reminder from a template | `Invoice.dueDate` (default from settings), `paymentReminderMessage()` template |
| **Daily cash** | **Reception closes the day with a drawer count**; the system compares it with recorded cash and flags a difference; the owner sees the report | `CashClose` (date, expected, counted, difference, closed by, notes); one close per day |
| **Commission** | **Mixed, per dentist:** salary only, commission only, or both. Basis: collected money, lab cost deductible (both configurable) | `Employee.salaryType`, `commissionRate`; `CommissionEntry` created on payment allocation |
| **Lab work** | Track status + due date (with late alerts), lab cost and the clinic's monthly bill per lab, and the slip details (shade, material, teeth) | `Lab`, `LabCase`, lab statement per month → accounts payable |
| **Inventory** | **Stock list + low-stock alerts** only (items, units, suppliers, in/out/adjust). Per-procedure auto-consumption is a later option | Simple `Item` / `Supplier` / `StockMovement`; stock = sum of movements |
| **HR** | **Payroll only:** employees, salary type, commission, allowances/deductions, monthly payslips posted to the ledger. Attendance and leave dropped from v1 | Smaller Phase 8 |
| **Pilot clinic** | None yet. The product serves all clinic sizes (solo to large), as decided at the start | Find a pilot before Phase 5 |
| **Pilot hardware (D1)** | **Mini PC we supply + UPS** | Appliance work starts right after billing |
| **Order of work** | **Billing → appliance & pilot → everything else**, shaped by pilot feedback | Lab, inventory, accounting and HR come after the clinic is live |

### Revised roadmap (from 2026-10-01)

| Phase | Scope | Estimate* | Status |
|---|---|---|---|
| 0–3 | Foundations, patients, chart & plans, appointments | — | ✅ Built (settings page, user management, calendar, scheduler, WhatsApp templates included) |
| **4. Billing** | Invoices per visit / per plan (IQD), discounts & voids behind editable permissions, payments (cash/card/wallet, partial, deposits, refunds), calculated balances, due dates + overdue list + WhatsApp payment reminder, daily cash close with drawer count, automatic journal entries (ledger core, debits = credits) | ≈ 1–2 weeks | ✅ Built 2026-10-01 in 5 parts: ledger core with database guards; editable discount/void/refund permissions; IQD only; invoices per visit / per plan with discounts, due dates and void; payments cash/card/wallet, partial, deposits as credit, refunds, voided payments, calculated balances; overdue debts aged 1–30 / 31–60 / 61–90 / 90+ with logged WhatsApp reminders; daily cash close (drawer count vs expected, difference booked to cash over/short). Demo clinic data: `pnpm --filter clinic db:demo` |
| **5. Appliance → pilot** | Docker Compose on a mini PC + UPS, Caddy, install script, restic → R2 backups, restore test, updater with rollback, cloud control plane v1 (licenses, check-in, backup monitor) | ≈ 2–3 weeks (hardware permitting) | needs a pilot clinic (D7) |
| — | **Pilot clinic live 4+ weeks**; fix what hurts | ongoing | |
| **5b. Printing** | 80 mm thermal receipt, treatment-plan quote (A4), later A4 invoice | ≈ 3–4 days | ✅ Receipt (80 mm), invoice slip (80 mm), treatment-plan quote and **prescriptions** (medicines list, allergy warnings) on A5 or A4 (clinic setting, A5 default) built 2026-10-01, moved ahead of the appliance at the owner's request; A4 invoice still to do |
| **6. Lab + commission** | Labs, lab cases (status, due-date alerts, shade/material/teeth, cost), monthly lab statement; commission rules per dentist, monthly commission report | ≈ 1 week | Started 2026-10-01 (after the owner chose lab → inventory → accounting → small leftovers, appliance on hold) in 3 parts. ✅ Part 1: labs (turnaround days), lab cases sent from the plan or free (teeth, Vita shade, material, cost, instructions), sent → received → fitted with remakes and cancel reasons, late / due-today alerts on the dashboard, lab tab on the patient. Next: part 2 lab money (cost posted to the lab's payable when received, lab payments counted in the cash close, monthly statement per lab); part 3 commission (salary / commission / both per dentist, monthly report) |
| **7. Inventory** | Items, suppliers, stock in/out/adjust, low-stock alerts | ≈ 3–4 days | moved before accounting: small and often requested |
| **8. Accounting** | Expenses, payables (labs/suppliers), P&L, cash book, AR aging, revenue by dentist/procedure, owner dashboard | ≈ 1–2 weeks | |
| **9. HR (payroll only)** | Employees, salary type, commission, allowances/deductions, payslips → ledger | ≈ 1 week | |
| **10. Product / SaaS** | Onboarding wizard, cloud admin, staged rollouts, WhatsApp Cloud API, remote owner view, English/Kurdish | ongoing | |
| Left over from 2–3 | Clinical notes, plan packages/templates, drag-to-reschedule, daily reminder list | small items | slot in when the pilot asks |

\* Estimates assume the same working pattern as Phases 0–3 (building with Claude Code in focused sessions). Appliance work depends on buying and testing real hardware.

---

## 17. Company context (2026-10-01)

The clinic system is **product #1 of a multi-product company** (the user's goal: several products under one brand, starting with the clinic). Company-level records live in the Notion page "🏢 Company" under "💼 Projects & Work" (https://app.notion.com/p/3ecde7e66f4b814f806ac6b23d31a333); this plan stays the product's own record.

| Topic | Decision | What it means for the build |
|---|---|---|
| Product order | Clinic billing → appliance → pilot clinic; Propira beta (Dec 2026); product #2 decided in 2027 | No work on a second product before the pilot is live |
| Architecture across products | Each product keeps its own stack; share conventions, design language, the cloud control plane and the sales process, not code | Do not extract a shared package now; keep core features (users, audit, ledger, billing, inventory, HR, licensing) free of dental-only assumptions where it costs nothing |
| Brand | Company = **Al-Tamkeen (التمكين)**, decided 2026-10-01; products branded "Tamkeen Dental" etc. The distinctive public form/suffix and handles are still open (C1 on the Company page) | `app.name` in `messages/ar.json` stays generic until the public form is fixed; logo must work monochrome on 80 mm thermal paper |
| House style | The April design (blue-600, slate, rounded-2xl, IBM Plex Sans Arabic) is the design system for all own products | Document tokens and taste rules so the next product inherits them |

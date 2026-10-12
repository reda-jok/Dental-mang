# Project rules

Dental clinic management system, sold to many clinics in Iraq. Each clinic runs its own server and database (single-tenant, offline-first) with cloud backups. Plan: `docs/03-rebuild-plan.md`.

Next.js 16 has breaking changes: before writing Next.js code, read the relevant guide in `apps/clinic/node_modules/next/dist/docs/` (see `apps/clinic/AGENTS.md`).

## Architecture

- Pages in `src/app/` stay thin. All real code lives in `src/features/<feature>/`:
  - `schemas.ts`: Zod schemas shared by the form and the server. Error messages are keys under `validation` in `messages/ar.json`.
  - `data.ts`: `server-only` reads. Start with `await authorize("<resource>:<action>")` (or `connection()` for public reads). Return only the fields the UI needs.
  - `service.ts`: `server-only` writes and business rules. Multi-step writes go in `db.$transaction`, and each writes `recordAudit(tx, …)` in the same transaction. The owner reads the audit log in Settings → سجل النشاط: a new audit `entity` needs a name under `activity.entities` in `ar.json` and an area in `ACTIVITY_AREAS` (`features/activity/rules.ts`), or the unit test fails.
  - `actions.ts`: `"use server"`. Every action is `defineAction({ schema, permission, handler })`, with `permission: "public"` only when deliberate.
- Pages never import `db` directly. Client components never import from `src/server/`.
- Permissions are defined in `src/lib/permissions.ts`. Ownership rules ("dentist sees own…") go in the feature's data layer.
- `proxy.ts` is only an optimistic redirect. Real checks happen in the data layer.

## Rules

- **Money:** `Decimal(14,2)` + currency, never float or `parseFloat`. Balances are calculated, never stored. So is dentist commission: read it from payment allocations, never store commission rows (`features/hr/commission.ts`: a month = the base at its end − the base at its start, so voids land in their own month and paid months never change). Allocations carry the operation's time (`settle(tx, …, at)`), not the insert time; pay settings are versioned from a month on (`dentist_pay`, append-only).
- **Ledger:** every money event (invoice issued, payment, refund…) posts a balanced journal entry with `postJournal(tx, …)` (`features/ledger/service.ts`) in the same transaction. Fix mistakes with `reverseJournal`; the database refuses edits, deletes and unbalanced entries. The clinic works in IQD only.
- **Patient money:** billing writes that change what a patient owes (invoice, payment, refund, void) lock the patient row (`lockPatient`) and re-apply credit (`settle`) in the same transaction (`features/billing/service.ts`). Paid amounts and balances come from allocations at read time.
- **Cash drawer:** each daily close takes in every money movement not yet closed (`unclosedMovements` in `features/billing/service.ts`; today: patient payments, voids, refunds, and cash paid to labs). A new kind of cash movement (e.g. an expense paid from the drawer) must be added there and to `CashMovement`, or the close won't count it.
- **Money owed to others** (labs now; suppliers later): the bill posts Dr expense / Cr payables when it's incurred, payments post Dr payables / Cr cash, and corrections are append-only adjustments. What's owed per lab is calculated from bills − payments ± adjustments and must equal the payables in the ledger.
- **Dates:** `@db.Timestamptz(3)`, stored in UTC and shown in the clinic time zone (`Asia/Baghdad`).
- **IDs:** UUID. Human-readable numbers (patient code, invoice number) come from Postgres sequences, never `count() + 1`.
- **Clinical and financial rows** get `deletedAt` (soft delete). Issued invoices and journal entries are never edited, only reversed.
- **UI text:** every string goes in `messages/ar.json`. Use logical Tailwind classes (`ms-*`, `pe-*`, `start-*`, `text-start`), never `ml-*`, `pr-*`, `left-*` or `text-left`. Set `dir="ltr"` on inputs for usernames, phones and numbers.
- **Errors:** throw `AppError(code)` from services. Never send raw error messages to the client. Use toasts (Sonner), never `alert()`.
- **Offline:** no runtime CDN or external calls. Anything that needs internet goes through a queue. At the clinic the app and database sit on a Docker network with no internet route (`deploy/appliance/compose.yml`), so a call out fails there.
- **Schema changes:** edit `schema.prisma`, then `pnpm --filter clinic db:migrate`. Commit the migration. Exclusion constraints, sequences and triggers go in custom SQL in the migration.
- **Transactions:** a transaction is one connection, and pg warns about overlapping queries (and will refuse them in v9). Inside `db.$transaction(async (tx) => …)`: await queries one at a time (never `Promise.all` on `tx`), and select at most one relation per query, because Prisma loads several relations in parallel. Don't wrap a list page's count + rows in a transaction; use `Promise.all` on `db`.
- **Demo data:** every feature adds realistic demo data to `prisma/demo/seed.ts`: as a step in `topUps()` (checks whether its data exists), so databases seeded earlier catch up. `pnpm --filter clinic db:seed` adds/tops up the demo data in the development database (keeps its settings, owner and patients); `pnpm --filter clinic db:demo` rebuilds the separate `dental_demo` database and `dev:demo` serves it at http://localhost:3300 (dev mode, compiles pages on first visit); `start:demo` serves it as a production build (standalone server, no compiling; use it to show the app or judge its speed). Money goes through the real services (with a past `Clock`), never raw inserts.
- **Standalone server:** the production build runs `server.js` from inside the build folder, so paths it reads (`UPLOAD_DIR`, anything on disk) must be absolute, and `.next/static` (+ `public`) must be copied next to it (`scripts/dev-demo.mjs` and `apps/clinic/Dockerfile` do both).
- **Clinic server:** `deploy/appliance/` (Compose, Caddy with its own certificate authority, `install.sh` / `update.sh` / `check.sh`); runbooks in `deploy/docs/`. A new setting goes in `compose.yml` (a new secret is generated by `install.sh`); a new volume with clinic data must be added to the backups. CI installs and updates the image the way a clinic does.

## Validation

- Build schemas from `src/lib/validation.ts` (`text`, `optionalText`, `multiline`, `optionalMultiline`, `optionalPhone`, `username`, `password`, `uuid`), never bare `z.string()` for user text. They trim, strip invisible and bidi characters, convert Arabic-Indic digits, and normalize Iraqi phones to `+9647…`.
- Use `z.strictObject` for action inputs (unknown fields are rejected). Forms use `mode: "onTouched"`.
- Forms with transforming schemas: `useForm<Input, unknown, Output>` and submit `form.getValues()`. The server validates again.
- Never put invisible or bidi characters in source; write `\u200B`-style escapes. `pnpm lint` enforces this (`scripts/check-unicode.mjs`).

## Security

- The browser can only reach the auth endpoints in `BROWSER_ALLOWED_PATHS` (`src/server/auth.ts`). Anything else (`/admin/*`) is server-only, behind our own policy.
- Rules about who may change what (like `features/users/policy.ts`) are pure functions with unit tests. The UI uses the same function to explain disabled actions.
- An employee may have no sign-in (added without "يدخل إلى النظام"): a `user` row with no username and no credential account. Never assume a staff member has a `username` or a session. Staff are managed in الموظفون (`/hr`), not Settings.
- Pages use `requirePagePermission()` (redirects to login, or returns 404 without the permission). Data and services use `authorize()`.
- The CSP is set per request in `proxy.ts` (nonce). No inline scripts and no external origins.
- Sensitive actions (role change, disable, password reset) sign the user out everywhere.
- Money amounts on invoices come from the server (plan item or catalog price), never from the browser; the browser sends only ids, quantities and discounts.
- Every permission except user management and `settings:permissions` is _adjustable_: the owner sets it per role in Settings → Permissions. A new one goes in `ADJUSTABLE_PERMISSIONS` with its prerequisites (`requires`) and a title and description under `permissions.items`. The signed-in user's permissions are resolved once per request (`CurrentUser.permissions`): check them with `authorize()` or `hasPermission(user, …)` (also in client components, given `user.permissions`), never against a role's defaults.

## UI

- **Design = "Tamkeen Clear"**, from the company design system (https://claude.ai/artifact/6T3XZWg16ihhaGixFom9zN; read its `project/README.md` before new screens): flat and calm like Apple and Notion. Tamkeen blue `primary` (`#0077c0`) for actions, Apple greys (`slate-*`), soft rounded corners, a glass header and menus, Readex Pro for every word. Colours come from the tokens in `globals.css`, not ad-hoc palettes.
  - Shared components are restyled globally through their `data-slot` by the design-system block in `globals.css`: use them as they are, without extra `rounded-*`, shadow or colour classes. When the design system changes, copy its `bundle.css` theme blocks into `globals.css` (its `lastChange` says what changed).
  - Use semantic tokens so light and dark both work (dark = `html.dark`, chosen per device in the user menu and rendered by the server from the `theme` cookie, `src/lib/theme.ts`; printouts under `/print` always stay light): `bg-primary` / `text-primary` for actions, links and checked states; selected option `border-primary bg-accent ring-1 ring-primary`; soft highlight `bg-accent`; text `text-foreground` / `text-muted-foreground`; surfaces `bg-card` / `bg-background`. No gradients or bevels on UI surfaces, and the logo colours (`brand-*`) are not UI colours. Blue meaning a status (tooth conditions, planned work, status chips, credit amounts) stays as it is.
  - Logo: `<Logo>` / `<LoadingLogo>` (`src/components/logo.tsx`); `(app)/loading.tsx` shows the loader while pages load.
  - Page sections: `<Panel icon title description actions>` (`src/components/panel.tsx`). Tabs: `<PillNav>`. Dashboard numbers: `<StatCard>` (`href` makes the card a link to its details). List search + status filter (URL params): `<FilterBar>` (`src/components/filter-bar.tsx`).
  - Charts: one series = one colour (`bg-primary`); magnitude = one ramp of `primary` (`/15` → full), light → dark, with a less/more scale (never a rainbow); exact numbers as text beside the mark or in a tooltip that also opens on tap (`HeatCell` in `features/dashboard/components/busy-hours.tsx`).
  - Dashboard widgets: add an entry to `WIDGETS` (`features/dashboard/widgets.ts`: key, the permission it needs, `stat` card or `wide` panel), its title under `dashboard.widgets`, and its render in the dashboard page; fetch its data only when it's visible. Users' saved layouts pick up new widgets by themselves.
  - The page title lives in the header (`AppHeader`, an `h1` from the nav). Pages start at `h2`.
  - Tooth chart: tile odontogram (`features/chart/components/tooth-chart.tsx`); each tooth is drawn from the side by kind (`tooth-shapes.ts`) with a biting-surface view; choose a condition or treatment in the bar, then tap a surface or tooth (each tap records, with undo); it fits the chart's own width (container query), never scrolling sideways. Conditions live in `tooth_condition` (Settings → Tooth conditions: the clinic adds its own and renames, recolours or hides the built-in ones; never deleted): load them with `getToothConditions()` and pass the map to the pure helpers in `chart/state.ts`, never a hard-coded list. A `problem` is cleared by treatment done on the same surfaces or tooth.
  - Review visual changes with screenshots: `VISUAL_TOUR_DIR=/tmp/tour pnpm --filter clinic test:e2e`.
- WhatsApp messages open in the shared `WhatsAppDialog` (`openWhatsApp` from `useBooking()`), never a raw `wa.me` link; a send that must be logged (reminders) passes `onSent` on the draft.
- Appointments: a booking starts from a patient (`openBooking({ patient })` on the patient page or the plan) and is for plan treatments (`appointment_item`) or a `reason`; show what a visit is for with `visitPurpose()`. Start and Finish happen only on the patient page. Finishing goes through `finishVisit`, which records each treatment's outcome and marks it done with `changeItemStatus(tx, …)` (`features/plans/service.ts`) in the same transaction, never by setting the status alone.
- Icon-only buttons are always `<IconButton label="…">` (tooltip plus accessible name). Pass `disabledReason` so a disabled action explains why.
- Explain non-obvious fields with `<InfoHint>` (it opens on tap too). Anything essential goes in an always-visible `description`, because hover doesn't exist on tablets.
- Every `form.handleSubmit(onValid, onInvalid)` passes `useInvalidHandler()`, so validation never fails silently. Values the schema checks but the user doesn't type (such as `id` on edit forms) must be in `defaultValues`.
- LTR text inside Arabic (codes, receipt numbers, references): wrap it in `<bdi>` and put spacing (`ms-*`) on an outer RTL `<span>`. On a `dir="ltr"` or `<bdi>` element, `ms-*` lands on the wrong side.
- Wide content (the tooth chart, tables) scrolls inside its own box. Grid and flex children that contain it need `min-w-0`.
- Money: amounts are strings, handled with `src/lib/money.ts` (exact minor units, totals per currency, `formatMoney`). Never use `Number` for arithmetic.
- Destructive actions need an `AlertDialog` that says what happens and whether it can be undone.
- **Printing:** printable pages live under `src/app/print/` (no app shell), wrap their content in `PaperSheet` (A5 or A4: `letterhead.paper` for prescriptions and quotes, receipts A5) or `ThermalSheet` (when `letterhead.receiptPaper` is the 80 mm printer; `features/printing/components/sheets.tsx`). The clinic logo is `letterhead.logoUrl` (Settings → Clinic, served by `/api/clinic-logo`); a dentist's printed name and speciality in both languages come from their employee record, start with `PrintToolbar`, and are opened with `PrintLink` (new tab, print dialog opens by itself, except where options are chosen first, like the plan quote). Each copy must print on one page (the e2e tests check the PDF); content that can grow goes in `FitPage` (`printing/components/fit-page.tsx`), which hides `data-optional` parts and then scales down to fit.

## Keeping records in sync

After every finished part of work (not only whole phases), or after product decisions, run the `project-sync` skill (`.claude/skills/project-sync/`): it updates CLAUDE.md, Claude's memory, `docs/03-rebuild-plan.md` and the Notion project page together.

Company-level decisions (brand, product order, go-to-market) live in the Notion page "🏢 Company" under "💼 Projects & Work", not on the clinic page or in this plan (see `docs/03-rebuild-plan.md` §17).

## Done means

Zod validation on the server, a permission check, a transaction and audit entry for writes, Arabic strings, loading/empty/error states, and tests for business rules. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` and `pnpm --filter clinic test:e2e` must pass. User-facing flows get a Playwright test (desktop and phone).

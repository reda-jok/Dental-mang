# Project rules

Dental clinic management system, sold to many clinics in Iraq. Each clinic runs its own server and database (single-tenant, offline-first) with cloud backups. Plan: `docs/03-rebuild-plan.md`.

Next.js 16 has breaking changes: before writing Next.js code, read the relevant guide in `apps/clinic/node_modules/next/dist/docs/` (see `apps/clinic/AGENTS.md`).

## Architecture

- Pages in `src/app/` stay thin. All real code lives in `src/features/<feature>/`:
  - `schemas.ts`: Zod schemas shared by the form and the server. Error messages are keys under `validation` in `messages/ar.json`.
  - `data.ts`: `server-only` reads. Start with `await authorize("<resource>:<action>")` (or `connection()` for public reads). Return only the fields the UI needs.
  - `service.ts`: `server-only` writes and business rules. Multi-step writes go in `db.$transaction`, and each writes `recordAudit(tx, …)` in the same transaction.
  - `actions.ts`: `"use server"`. Every action is `defineAction({ schema, permission, handler })`, with `permission: "public"` only when deliberate.
- Pages never import `db` directly. Client components never import from `src/server/`.
- Permissions are defined in `src/lib/permissions.ts`. Ownership rules ("dentist sees own…") go in the feature's data layer.
- `proxy.ts` is only an optimistic redirect. Real checks happen in the data layer.

## Rules

- **Money:** `Decimal(14,2)` + currency, never float or `parseFloat`. Balances are calculated, never stored.
- **Ledger:** every money event (invoice issued, payment, refund…) posts a balanced journal entry with `postJournal(tx, …)` (`features/ledger/service.ts`) in the same transaction. Fix mistakes with `reverseJournal`; the database refuses edits, deletes and unbalanced entries. The clinic works in IQD only.
- **Dates:** `@db.Timestamptz(3)`, stored in UTC and shown in the clinic time zone (`Asia/Baghdad`).
- **IDs:** UUID. Human-readable numbers (patient code, invoice number) come from Postgres sequences, never `count() + 1`.
- **Clinical and financial rows** get `deletedAt` (soft delete). Issued invoices and journal entries are never edited, only reversed.
- **UI text:** every string goes in `messages/ar.json`. Use logical Tailwind classes (`ms-*`, `pe-*`, `start-*`, `text-start`), never `ml-*`, `pr-*`, `left-*` or `text-left`. Set `dir="ltr"` on inputs for usernames, phones and numbers.
- **Errors:** throw `AppError(code)` from services. Never send raw error messages to the client. Use toasts (Sonner), never `alert()`.
- **Offline:** no runtime CDN or external calls. Anything that needs internet goes through a queue.
- **Schema changes:** edit `schema.prisma`, then `pnpm --filter clinic db:migrate`. Commit the migration. Exclusion constraints, sequences and triggers go in custom SQL in the migration.

## Validation

- Build schemas from `src/lib/validation.ts` (`text`, `optionalText`, `optionalMultiline`, `optionalPhone`, `username`, `password`, `uuid`), never bare `z.string()` for user text. They trim, strip invisible and bidi characters, convert Arabic-Indic digits, and normalize Iraqi phones to `+9647…`.
- Use `z.strictObject` for action inputs (unknown fields are rejected). Forms use `mode: "onTouched"`.
- Forms with transforming schemas: `useForm<Input, unknown, Output>` and submit `form.getValues()`. The server validates again.
- Never put invisible or bidi characters in source; write `\u200B`-style escapes. `pnpm lint` enforces this (`scripts/check-unicode.mjs`).

## Security

- The browser can only reach the auth endpoints in `BROWSER_ALLOWED_PATHS` (`src/server/auth.ts`). Anything else (`/admin/*`) is server-only, behind our own policy.
- Rules about who may change what (like `features/users/policy.ts`) are pure functions with unit tests. The UI uses the same function to explain disabled actions.
- Pages use `requirePagePermission()` (redirects to login, or returns 404 without the permission). Data and services use `authorize()`.
- The CSP is set per request in `proxy.ts` (nonce). No inline scripts and no external origins.
- Sensitive actions (role change, disable, password reset) sign the user out everywhere.
- Money amounts on invoices come from the server (plan item or catalog price), never from the browser; the browser sends only ids, quantities and discounts.
- Discount and void are *adjustable* (`ADJUSTABLE_PERMISSIONS`): the owner sets them per role in Settings → Permissions. Check them on the server with `authorize()` or `await can(user, …)` (`src/server/permissions.ts`). The synchronous `hasPermission` only accepts fixed permissions, so TypeScript catches misuse.

## UI

- **Design = the clinic's April design** (blue-600 primary, slate neutrals, soft shadows, rounded-2xl). Colours come from the tokens in `globals.css`, not ad-hoc palettes.
  - Page sections: `<Panel icon title description actions>` (`src/components/panel.tsx`). Tabs: `<PillNav>`. Dashboard numbers: `<StatCard>`.
  - The page title lives in the header (`AppHeader`, an `h1` from the nav). Pages start at `h2`.
  - Tooth chart: tile odontogram (`features/chart/components/tooth-chart.tsx`) with condition colours from `TILE_STYLES`.
  - Review visual changes with screenshots: `VISUAL_TOUR_DIR=/tmp/tour pnpm --filter clinic test:e2e`.
- Icon-only buttons are always `<IconButton label="…">` (tooltip plus accessible name). Pass `disabledReason` so a disabled action explains why.
- Explain non-obvious fields with `<InfoHint>` (it opens on tap too). Anything essential goes in an always-visible `description`, because hover doesn't exist on tablets.
- Every `form.handleSubmit(onValid, onInvalid)` passes `useInvalidHandler()`, so validation never fails silently. Values the schema checks but the user doesn't type (such as `id` on edit forms) must be in `defaultValues`.
- Wide content (the tooth chart, tables) scrolls inside its own box. Grid and flex children that contain it need `min-w-0`.
- Money: amounts are strings, handled with `src/lib/money.ts` (exact minor units, totals per currency, `formatMoney`). Never use `Number` for arithmetic.
- Destructive actions need an `AlertDialog` that says what happens and whether it can be undone.

## Keeping records in sync

After every finished part of work (not only whole phases), or after product decisions, run the `project-sync` skill (`.claude/skills/project-sync/`): it updates CLAUDE.md, Claude's memory, `docs/03-rebuild-plan.md` and the Notion project page together.

## Done means

Zod validation on the server, a permission check, a transaction and audit entry for writes, Arabic strings, loading/empty/error states, and tests for business rules. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` and `pnpm --filter clinic test:e2e` must pass. User-facing flows get a Playwright test (desktop and phone).

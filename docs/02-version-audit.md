# 📦 Dependency & Version Audit — DentalCare Pro

Your project is significantly behind on almost every dependency. Here's the full picture.

---

## 🖥 Runtime Environment

| Component | Your Version | Latest | Status | Action |
|---|---|---|---|---|
| **Node.js** | **v18.19.1** | v22.x LTS | ⚠️ Behind | Upgrade to v22 LTS (v18 EOL was April 2025) |
| **npm** | 9.2.0 | 10.x | ⚠️ Behind | Comes with Node v22 |

> ⚠️ **Warning:** Node.js 18 reached End-of-Life in **April 2025**. You're running on an unsupported runtime — no more security patches.

---

## 🔴 Major Version Upgrades (Breaking Changes)

These require code changes to migrate. Ordered by **impact to your project**:

### Tier 1 — Framework & Language (High Impact)

| Package | Current | Latest | Risk | Effort |
|---|---|---|---|---|
| **Next.js** | `^15.2.4` | `^16.3.6` | 🔴 High | ~2 hours |
| **TypeScript** | `^5` | `^7` | 🔴 High | ~2 hours |
| **Tailwind CSS** | `^3.4.17` | `^4.3.3` | 🔴 High | ~3 hours |
| **tailwind-merge** | `^2.5.5` | `^3.7.0` | 🟡 Medium | ~30 min |

#### Next.js 15 → 16 Key Changes:
- `middleware.ts` replaced by `proxy.ts`
- Async access for `params`, `cookies()`, `headers()`
- Turbopack is now the default bundler
- New Cache Components API
- Codemod available: `npx @next/codemod@canary next-16-upgrade`

#### TypeScript 5 → 7 Key Changes:
- **Must upgrade through v6 first** (bridge release)
- TS 7 is a full rewrite in Go — 8–12x faster compilation
- `moduleResolution: "node"` deprecated → use `"bundler"`
- Many old defaults are now errors
- Some tooling (eslint plugins, etc.) may need TS6 sidecar

#### Tailwind CSS 3 → 4 Key Changes:
- **No more `tailwind.config.ts`** — CSS-first with `@theme` directive
- `@tailwind base/components/utilities` → `@import "tailwindcss"`
- PostCSS plugin moved to `@tailwindcss/postcss`
- `tailwindcss-animate` may need replacement
- **Requires Node.js 20+**
- Migration tool: `npx @tailwindcss/upgrade`

---

### Tier 2 — UI & Form Libraries (Medium Impact)

| Package | Current | Latest | Risk | Key Breaking Changes |
|---|---|---|---|---|
| **lucide-react** | `^0.454.0` | `^1.48.0` | 🟡 Medium | Brand icons removed; `aria-hidden` default; new `LucideProvider` |
| **recharts** | `2.15.0` | `3.10.1` | 🟡 Medium | `CategoricalChartState` removed; `<Customized/>` API changed; hooks-based |
| **react-day-picker** | `9.8.0` | `10.0.1` | 🟡 Medium | API surface changes |
| **react-hook-form** | `^7.54.1` | `^7.89.0` | 🟢 Low | Minor only (stays on v7) |
| **@hookform/resolvers** | `^3.9.1` | `^5.9.1` | 🟡 Medium | Resolver API changes |
| **zod** | `^3.24.1` | `^4.6.5` | 🟡 Medium | Unified `error` param; `z.email()` top-level; `z.strictObject()` |
| **sonner** | `^1.7.1` | `^2.0.8` | 🟢 Low | Minor API changes |
| **vaul** | `^0.9.6` | `^1.1.2` | 🟢 Low | Stable release |

---

### Tier 3 — Utilities (Low Impact)

| Package | Current | Latest | Risk | Notes |
|---|---|---|---|---|
| **dotenv** | `^17.3.1` | `^18.0.4` | 🟢 Low | Config API changes |
| **uuid** | `^13.0.0` | `^14.0.2` | 🟢 Low | Consider removing — use `crypto.randomUUID()` |
| **react-resizable-panels** | `^2.1.7` | `^4.14.1` | 🟡 Medium | Major API redesign |
| **@vercel/analytics** | `1.3.1` | `2.0.1` | 🟢 Low | Consider removing if not on Vercel |
| **@types/node** | `^22` | `^26` | 🟢 Low | Types only, follows Node version |

---

## 🟡 Minor Version Updates (Non-Breaking)

These are safe to update immediately — backwards compatible:

| Package | Current | Latest |
|---|---|---|
| `@prisma/adapter-pg` | `^7.5.0` | `^7.10.0` |
| `@prisma/client` | `^7.5.0` | `^7.10.0` |
| `@prisma/config` | `^7.4.2` | `^7.10.0` |
| `@tanstack/react-query` | `^5.100.1` | `^5.104.0` |
| `@tanstack/react-query-devtools` | `^5.100.1` | `^5.104.0` |
| `@types/pg` | `^8.15.5` | `^8.23.1` |
| `autoprefixer` | `^10.4.20` | `^10.6.1` |
| `cmdk` | `1.0.4` | `1.1.1` |
| `date-fns` | `4.1.0` | `4.4.0` |
| `embla-carousel-react` | `8.5.1` | `8.6.0` |
| `geist` | `^1.3.1` | `^1.7.2` |
| `input-otp` | `1.4.1` | `1.5.0` |
| `pg` | `^8.20.0` | `^8.23.0` |
| `react` | `^19.1.1` | `^19.3.0` |
| `react-dom` | `^19.1.1` | `^19.3.0` |
| `react-hook-form` | `^7.54.1` | `^7.89.0` |
| ~14 Radix UI packages | various | various |

---

## 🟢 Patch Updates (Bug Fixes Only)

18 Radix UI packages have patch updates available — fully safe to update:

```
@radix-ui/react-accordion, alert-dialog, aspect-ratio, collapsible,
dialog, dropdown-menu, hover-card, label, menubar, navigation-menu,
popover, progress, scroll-area, separator, tabs, toast, toggle, toggle-group
```

---

## 📋 Recommended Upgrade Strategy

Since you're planning a **rebuild from scratch**, here's what I recommend:

### If Rebuilding Fresh (Recommended):

Start the new project with the latest everything:

```bash
# Start fresh with latest Next.js
npx -y create-next-app@latest ./dental-pro --typescript --tailwind --app --src-dir --eslint

# Then install latest deps
npm install @prisma/client@latest @tanstack/react-query@latest \
  zod@latest react-hook-form@latest @hookform/resolvers@latest \
  lucide-react@latest recharts@latest sonner@latest date-fns@latest \
  react-day-picker@latest
```

This avoids all migration pain — you get:
- ✅ Next.js 16 with Turbopack
- ✅ TypeScript 7 (via create-next-app)
- ✅ Tailwind CSS 4 (CSS-first config)
- ✅ Node.js 22 compatibility
- ✅ All latest APIs from day one

### If Upgrading Incrementally:

Do it in this order to avoid cascading breakage:

| Phase | What | Why First |
|---|---|---|
| **1** | Node.js → v22 LTS | Everything depends on it |
| **2** | All patch + minor updates | Zero-risk wins |
| **3** | TypeScript 5 → 6 → 7 | Catches type errors before framework changes |
| **4** | Tailwind 3 → 4 | Affects every component's styling |
| **5** | Next.js 15 → 16 | Framework-level changes |
| **6** | lucide-react, recharts, zod | Can be done per-component |

---

## 🗑 Packages to Remove

| Package | Reason |
|---|---|
| `uuid` | Use built-in `crypto.randomUUID()` |
| `@vercel/analytics` | Not deployed on Vercel |
| `dotenv` | Next.js handles `.env` files natively |
| `pg` + `pg-native` + `@types/pg` | Use Prisma exclusively (drop raw SQL) |
| `autoprefixer` | Tailwind v4 handles this internally |
| `tailwindcss-animate` | Replaced by Tailwind v4's built-in animation utilities |
| `class-variance-authority` | Consider shadcn's latest approach |

---

> **Recommendation**: Since you want to rebuild from scratch, **don't waste time upgrading the old project**. Start fresh with `create-next-app@latest` and port features over to the new codebase. You'll save days of migration debugging.

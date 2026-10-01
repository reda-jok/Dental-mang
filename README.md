# Dental Clinic Management (v2)

Arabic-first (RTL) dental clinic management system. Each clinic runs it on its own local server (works offline) with encrypted backups to the cloud.

- Plan: [docs/03-rebuild-plan.md](docs/03-rebuild-plan.md)
- Project conventions: [CLAUDE.md](CLAUDE.md)

## Requirements

- Node.js 24 (`.node-version`; with fnm: `fnm use`)
- pnpm (`npm i -g pnpm`)
- Docker (for the local Postgres)

## Getting started

```bash
pnpm install                       # also generates the Prisma client
cp apps/clinic/.env.example apps/clinic/.env
# set BETTER_AUTH_SECRET in apps/clinic/.env:  openssl rand -base64 32

pnpm db:up                         # start Postgres 18 in Docker
pnpm --filter clinic db:deploy     # apply migrations
pnpm dev                           # http://localhost:3100 → first run opens /setup
```

## Scripts (from the repo root)

| Command                                                   | What it does                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                                                | Run the clinic app in development                               |
| `pnpm build`                                              | Production build (standalone output)                            |
| `pnpm lint` / `pnpm typecheck` / `pnpm test`              | Checks run in CI                                                |
| `pnpm --filter clinic test:e2e`                           | Browser tests (desktop + phone) on a throwaway DB               |
| `VISUAL_TOUR_DIR=/tmp/tour pnpm --filter clinic test:e2e` | Screenshots of every screen (desktop + phone) for design review |
| `pnpm format`                                             | Format with Prettier                                            |
| `pnpm db:up` / `pnpm db:down`                             | Start / stop the dev database                                   |
| `pnpm --filter clinic db:migrate`                         | Create a migration after editing `schema.prisma`                |
| `pnpm --filter clinic db:studio`                          | Browse the database                                             |

## Layout

```
apps/clinic/          the app installed at each clinic (Next.js 16)
  prisma/             schema + committed migrations
  messages/ar.json    all UI text
  src/app/            routes only (thin)
  src/features/<x>/   schemas · data (reads) · service (writes) · actions · components
  src/server/         db, auth, session/authorize, audit, action wrapper, env, logger
  src/lib/            code shared by client and server (permissions, auth client, form helpers)
docs/                 plans and audits
```

# syntax=docker/dockerfile:1
# The clinic app as one image: the Next.js standalone server, plus the Prisma CLI that
# applies migrations (the `migrate` service in deploy/appliance/compose.yml).
# Build from the repo root: docker build -f apps/clinic/Dockerfile -t dental-clinic .

FROM node:24-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/clinic/package.json apps/clinic/prisma.config.ts apps/clinic/
COPY apps/clinic/prisma apps/clinic/prisma
# Placeholders for the build only; the clinic's own values come from its .env at run time.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-build-time-placeholder \
    BETTER_AUTH_URL=https://localhost \
    NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1
RUN pnpm install --frozen-lockfile --filter clinic
COPY apps/clinic apps/clinic
RUN pnpm --filter clinic build

# Prisma's CLI on its own (the app itself only needs the generated client).
# ponytail: versions pinned here but not their dependencies; commit a lockfile for this
# folder if images must be byte-for-byte reproducible.
FROM node:24-slim AS migrate
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /migrate
RUN npm install --omit=dev --no-fund --no-audit --no-package-lock prisma@7.10.0 dotenv@18.0.4

FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
# No calls home: the clinic works offline.
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data/uploads \
    NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1
WORKDIR /app
COPY --from=build /repo/apps/clinic/.next/standalone ./
# The standalone server serves these once they sit next to it.
COPY --from=build /repo/apps/clinic/.next/static ./apps/clinic/.next/static
COPY --from=migrate /migrate /migrate
COPY apps/clinic/prisma.config.ts /migrate/
COPY apps/clinic/prisma/schema.prisma /migrate/prisma/
COPY apps/clinic/prisma/migrations /migrate/prisma/migrations
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health?ready=1').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/clinic/server.js"]

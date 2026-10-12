#!/usr/bin/env bash
# Waits (up to 3 minutes) until devices could use the app: HTTPS with the clinic's
# certificate, the app up and its database reachable. Exits 1 if not.
set -euo pipefail
cd "$(dirname "$0")"
host=$(sed -n 's/^CLINIC_HOST=//p' .env)

for _ in $(seq 90); do
  if docker compose exec -T caddy cat /data/caddy/pki/authorities/local/root.crt \
    >clinic-ca.crt 2>/dev/null &&
    curl -fsS --cacert clinic-ca.crt "https://$host/api/health?ready=1" >/dev/null 2>&1; then
    echo "OK: https://$host is up ($(sed -n 's/^APP_VERSION=//p' .env))."
    exit 0
  fi
  sleep 2
done
echo "Not up after 3 minutes. Look at: docker compose ps; docker compose logs --tail 50" >&2
exit 1

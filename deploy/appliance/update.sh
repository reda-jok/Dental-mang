#!/usr/bin/env bash
# Moves this server to another version, after hours (see deploy/docs/install.md):
#   ./update.sh <version>
# Downloads it while the clinic keeps working, saves a database copy, then switches;
# migrations run before the new app starts.
set -euo pipefail
umask 077 # database copies hold patient data
cd "$(dirname "$0")"

version=${1:?usage: ./update.sh <version>}
current=$(sed -n 's/^APP_VERSION=//p' .env)

docker image inspect "ghcr.io/reda-jok/dental-clinic:$version" >/dev/null 2>&1 ||
  APP_VERSION=$version docker compose pull app

mkdir -p backups
dump="backups/before-$version-$(date +%Y%m%d-%H%M).dump"
docker compose exec -T db pg_dump -U dental -d dental -Fc >"$dump"
echo "Database saved to $dump"

sed -i "s/^APP_VERSION=.*/APP_VERSION=$version/" .env
if ! { docker compose up -d && ./check.sh; }; then
  cat >&2 <<EOF

The update to $version failed. To go back to $current:
  sed -i 's/^APP_VERSION=.*/APP_VERSION=$current/' .env && docker compose up -d
If $version's migrations changed the database in a way $current can't run on, restore
$dump first (deploy/docs/restore.md).
EOF
  exit 1
fi

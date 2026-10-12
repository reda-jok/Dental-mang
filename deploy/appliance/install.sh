#!/usr/bin/env bash
# First install on a clinic server (see deploy/docs/install.md).
#   ./install.sh <address devices will use, e.g. 192.168.1.10> <version, e.g. 0.1.0>
# Writes .env with new secrets, starts everything and waits until the app answers.
set -euo pipefail
cd "$(dirname "$0")"

host=${1:?usage: ./install.sh <fixed LAN address of this machine> <version>}
version=${2:?usage: ./install.sh <fixed LAN address of this machine> <version>}

if [[ -e .env ]]; then
  echo "This server is already installed (.env exists). To change version: ./update.sh <version>" >&2
  exit 1
fi
command -v docker >/dev/null || { echo "Docker is not installed (see install.md)." >&2; exit 1; }

# Secrets only this server knows. Keep a copy of .env with the recovery sheet.
umask 077
cat > .env <<EOF
CLINIC_HOST=$host
APP_VERSION=$version
DB_PASSWORD=$(openssl rand -hex 24)
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
EOF

docker compose up -d
./check.sh
cat <<EOF

Installed. Next:
  1. On every device, trust the clinic certificate: http://$host/clinic.crt
  2. Open https://$host/setup and create the owner's account.
EOF

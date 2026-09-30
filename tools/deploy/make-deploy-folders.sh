#!/usr/bin/env bash
# Build the backend deploy folder on the Desktop (replacing the old one):
#   DcAMC-Backend-Deploy   backend code + database scripts + deploy-backend.ps1 + setup-server + web.config + env.production.example
# Copy it to C:\ on the server and run deploy-backend.ps1 (see README.md). The frontend is built and served by Vercel from git.
set -euo pipefail
cd "$(dirname "$0")/../.."
out="${DEPLOY_OUT:-$HOME/Desktop}"
stamp="$(date +%Y%m%d-%H%M)-$(git rev-parse --short HEAD)"
[ -n "$(git status --porcelain -- backend database deploy)" ] && stamp="$stamp-dirty" && echo "! uncommitted changes are included ($stamp)"
B="$out/DcAMC-Backend-Deploy"; rm -rf "$B"; mkdir -p "$B/backend"
cp -R backend/src backend/scripts backend/package.json backend/package-lock.json "$B/backend/"
cp -R database "$B/database"
cp deploy/windows/deploy-backend.ps1 deploy/windows/setup-server.ps1 deploy/windows/setup-server.cmd deploy/windows/web.config deploy/windows/web-http.config deploy/windows/env.production.example "$B/"
echo "$stamp" > "$B/VERSION"
echo "▸ $B  ($(du -sh "$B" | cut -f1))"
echo "version $stamp"

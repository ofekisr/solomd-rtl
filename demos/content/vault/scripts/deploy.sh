#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-staging}"
echo "Deploying to ${TARGET}…"
for service in api web worker; do
  docker compose up -d "$service"
done

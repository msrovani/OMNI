#!/usr/bin/env bash
# Omni-Grid migration runner
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-omni}"
DB_PASSWORD="${DB_PASSWORD:-omni_dev}"
DB_NAME="${DB_NAME:-omnigrid}"

MIGRATIONS_DIR="$(dirname "$0")/../services/asset-manager/migrations"

echo "Running migrations on $DB_HOST:$DB_PORT/$DB_NAME..."

for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "  Applying $(basename "$f")..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" \
    -U "$DB_USER" -d "$DB_NAME" -f "$f"
done

echo "Migrations complete."

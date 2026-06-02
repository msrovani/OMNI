#!/usr/bin/env bash
# Omni-Grid seed script — populate initial data
set -euo pipefail

echo "Seeding Omni-Grid database..."

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-omni}"
DB_PASSWORD="${DB_PASSWORD:-omni_dev}"
DB_NAME="${DB_NAME:-omnigrid}"

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<SQL
INSERT INTO clients (client_id, name, email) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Indústria ABC Ltda', 'contato@abcindustria.com.br'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Siderurgia Beta S.A.',  'admin@betasiderurgica.com');

INSERT INTO assets (asset_id, client_id, manufacturer, model, capacity_kwh, nominal_power_kw, cycle_life)
VALUES
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'Tesla', 'Megapack 100', 100, 50, 6000),
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
   'BYD',  'BYD Container 200', 200, 100, 5000);

INSERT INTO contracts (client_id, asset_id, omni_revenue_share_percent, start_date, status)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'c3d4e5f6-a7b8-9012-cdef-123456789012',
   30.00, CURRENT_DATE, 'active'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'd4e5f6a7-b8c9-0123-defa-234567890123',
   30.00, CURRENT_DATE, 'active');
SQL

echo "Seed complete."

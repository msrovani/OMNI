-- Omni-Grid Asset Manager: Initial Schema
-- Database: omnigrid

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Clients
CREATE TABLE IF NOT EXISTS clients (
    client_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    phone       VARCHAR(50),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assets (batteries)
CREATE TABLE IF NOT EXISTS assets (
    asset_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(client_id),
    manufacturer    VARCHAR(100) NOT NULL,
    model           VARCHAR(100) NOT NULL,
    capacity_kwh    NUMERIC(8,2) NOT NULL,
    nominal_power_kw NUMERIC(8,2) NOT NULL,
    cycle_life      INTEGER NOT NULL,
    min_soc_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    max_soc_percent NUMERIC(5,2) NOT NULL DEFAULT 95.00,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    installed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    address         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assets_client ON assets(client_id);

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
    contract_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                   UUID NOT NULL REFERENCES clients(client_id),
    asset_id                    UUID NOT NULL REFERENCES assets(asset_id),
    omni_revenue_share_percent  NUMERIC(5,2) NOT NULL,
    min_backup_soc              NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    start_date                  DATE NOT NULL,
    end_date                    DATE,
    auto_renew                  BOOLEAN NOT NULL DEFAULT TRUE,
    status                      VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Telemetry (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS telemetry (
    time              TIMESTAMPTZ NOT NULL,
    device_id         UUID NOT NULL,
    voltage_v         NUMERIC(6,2),
    current_a         NUMERIC(6,2),
    frequency_hz      NUMERIC(5,3),
    soc_percent       NUMERIC(5,2),
    soh_percent       NUMERIC(5,2),
    temperature_c     NUMERIC(5,2),
    power_w           NUMERIC(10,2),
    is_grid_connected BOOLEAN,
    tags              JSONB
);

SELECT create_hypertable('telemetry', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry(device_id, time DESC);

-- Dispatch Plans
CREATE TABLE IF NOT EXISTS dispatch_plans (
    plan_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
);

-- Dispatch Log
CREATE TABLE IF NOT EXISTS dispatch_log (
    log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         UUID NOT NULL REFERENCES dispatch_plans(plan_id),
    asset_id        UUID NOT NULL REFERENCES assets(asset_id),
    power_kw        NUMERIC(8,2) NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    duration_sec    INTEGER NOT NULL,
    reason          VARCHAR(50) NOT NULL,
    blockchain_tx   VARCHAR(128),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispatch_asset_time ON dispatch_log(asset_id, start_time DESC);

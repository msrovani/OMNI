# Omni-Grid Dashboard

Single-page HTML dashboard for the Omni-Grid Brazilian energy market system. Opens in any browser — no build step.

## Usage

Open `index.html` directly:

```
start index.html
```

The dashboard polls `http://127.0.0.1:3000` every 5s. If the API is offline, it shows explicit "API offline" status (no mock fallback).

## Sections

| Section | Data Source | Description |
|---------|-------------|-------------|
| Status Bar | `GET /health` | API health, uptime, market status, submercado counters |
| PDE Engine | `POST /api/v1/pde/forecast`, `POST /api/v1/pde/optimize`, `GET /api/v1/pde/dispatch/history` | Load forecast, stochastic optimization, dispatch log |
| Telemetry | `GET /api/v1/telemetry/latest` | SoC gauge (SVG), power, voltage, temperature, frequency |
| Market Prices | `GET /api/v1/market/prices?submercado=` | PLD prices (R$/MWh) per submercado with sparklines |
| PLD Brasil | `GET /api/v1/market/submercados` | 4 submercados grid with zone map |
| RBAC Auth | `POST /api/v1/auth/login`, `GET /auth/me` | JWT login, role/permissions matrix |
| Event Log | WebSocket `ws://127.0.0.1:3000/ws?token=` | Streaming telemetry events |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health + BR market info |
| GET | `/auth/me` | Yes | Current user + permissions |
| POST | `/auth/login` | No | JWT login (see seed users below) |
| POST | `/api/v1/pde/forecast` | Yes | Load/solar forecast |
| POST | `/api/v1/pde/optimize` | Yes | Stochastic optimization (accepts `submercado`) |
| GET | `/api/v1/pde/dispatch/history` | Yes | Dispatch log |
| GET | `/api/v1/market/prices?submercado=` | Yes | PLD prices per submercado |
| GET | `/api/v1/market/submercados` | Yes | List 4 submercados ONS |
| GET | `/api/v1/market/regulatory` | Yes | BR regulatory info |
| POST | `/api/v1/edge/telemetry` | Yes | Ingest telemetry |
| GET | `/api/v1/telemetry/latest` | Yes | All latest telemetry |
| WS | `/ws?token=` | Yes | WebSocket telemetry stream |

## Seed Users

| Username | Password | Role |
|----------|----------|------|
| admin | omni-admin-2026 | admin |
| operator | omni-operator-2026 | operator |
| viewer | omni-viewer-2026 | viewer |

## Brazilian Market Features

- **PLD Horário**: Hourly settlement prices from CCEE (R$/MWh)
- **4 Submercados**: SE_CO (60%), S (15%), NE (15%), N (10%)
- **Bandeiras Tarifárias**: Verde/Amarela/Vermelha surcharge overlay
- **Auto-poll**: Refreshes prices every 15min from CCEE live API (or falls back to simulation)

## Design

- Dark theme (`#0A0E1A` background, `#1A73E8` accent)
- JetBrains Mono monospace
- Responsive CSS grid
- 5s polling interval
- CSS animations for status transitions

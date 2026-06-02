# OMNI Grid — Complete Project Reference

## Directory Map

```
C:\Users\Public\OMNI\
├── packages/              ← TypeScript/JS — npm workspaces
│   ├── api-gateway/       Fastify 5 REST+WS gateway (port 3000)
│   ├── asset-manager/     Battery asset lifecycle + SIGA integration
│   ├── integration-tests/ Pipeline + bus-edge integration tests
│   ├── market-connect/    PLD price simulation, utility/trader registry
│   ├── omni-auth/         JWT auth + RBAC (library)
│   ├── omni-bus/          Message bus abstraction, in-memory/NATS (library)
│   ├── omni-cli/          CLI tool
│   └── omni-cloud/        Edge gateway, device management
├── services/              ← Go + Python microservices
│   ├── market-connect/    (Go) NATS publisher PLD per submercado
│   └── pde-engine/        (Python) Submercado enum, BR endpoints
├── edge/                  ← Edge device + dashboard
│   ├── dashboard/         index.html — web dashboard (static), polls :3000
│   ├── omni-box-simulator/
│   ├── esp-co-proc/
│   └── android-app/
├── crates/                ← Rust crates
│   ├── omni-box-fw/        State machine, shadow engine, JNI bridge
│   └── pde-kernel/
├── scripts/               orchestrator.mjs, deploy helpers
├── deploy/                Terraform, Kong config, Docker
├── proto/                 Protobuf definitions
├── docs/                  Research docs (see §9)
├── tls/                   Dev TLS certificates
├── AGENTS.md              ← THIS FILE — full project knowledge base
└── OMNI_GRID_CONSPEC.md   Consolidated specification (Part VI = BR adaptation)
```

## Service Catalog

| # | Service | Lang | Port | Purpose | Key File |
|---|---------|------|------|---------|----------|
| 1 | **api-gateway** | TS (Fastify 5) | 3000 | REST+WS gateway, auth, PDE, telemetry | `packages/api-gateway/src/index.ts` |
| 2 | **pde-engine** | TS | — | Forecast, optimize, dispatch, compliance, ONS ancillary, battery tariff | `packages/pde-engine/src/index.ts` |
| 3 | **market-connect** | TS | — | PLD simulation, utility/trader registry | `packages/market-connect/src/index.ts` |
| 4 | **omni-auth** | TS (lib) | — | JWT + RBAC library | `packages/omni-auth/src/index.ts` |
| 5 | **omni-bus** | TS (lib) | — | Message bus (in-memory/NATS) | `packages/omni-bus/src/index.ts` |
| 6 | **omni-cloud** | TS | 4000 | Edge gateway, device mgmt | `packages/omni-cloud/src/index.ts` |
| 7 | **asset-manager** | TS | — | Battery lifecycle, SIGA client | `packages/asset-manager/src/index.ts` |
| 8 | **omni-cli** | TS | — | CLI tool | `packages/omni-cli/src/index.ts` |
| 9 | **edge/dashboard** | HTML/JS | — | Web UI, polls :3000, WS real-time, 3 profiles | `edge/dashboard/index.html` |
| 10 | **edge/simulator** | TS | — | Edge device sim, bus + REST telemetry | `edge/omni-box-simulator/src/index.ts` |
| 11 | **edge/esp32** | C++ (PIO) | — | Modbus RTU/TCP, CAN, BLE GATT, BLE BMS, WiFi AP, Safety, Shadow, HW WDT, IEC 61850 SV, OTA | `edge/esp-co-proc/src/main.cpp` |
| 12 | **edge/android** | Kotlin | — | DPC/Kiosk, PIN, bridges CDC/BLE/WiFi/USB, SQLite queue, PowerManager, TimeFallback, MDM, CameraX OCR, ViewModel | `edge/android-app/app/src/main/java/com/omnigrid/omnibox/` |
| 13 | **crates/omni-box-fw** | Rust | — | State machine, shadow engine, modbus CRC, JNI bridge for Android | `crates/omni-box-fw/src/lib.rs` |

## Architecture Flows

### A. Request Flow (api-gateway)
```
Client → Fastify :3000 → CORS → AuthPlugin (JWT verify) → Route Handler → Service
                                                                                      ↓
                              ← JSON response          ←  MarketDataClient / PDE / Bus
```

### B. Auth Flow
```
POST /auth/login {user,pass} → AuthService.authenticate() → HMAC-SHA256 JWT → token
                                                                                      ↓
Every request (excl. /health, /auth/login) → onRequest hook → verifyToken() → req.user
                                                                                      ↓
Roles: admin | operator | viewer | device | api_client
Permissions: resource:action (ex: assets:read, dispatch:execute)
```

### C. PDE Engine Flow
```
MarketDataClient.fetchPldPrices(start, end, simulate, submercado)
  ├─ simulate=true  → simulatePldPrice() (random R$/MWh by hour)
  └─ simulate=false → CceeCollector.fetchPldPrices() → CCEE JSON API (live data)

ForecastEngine.predict(assetId, features, horizon)
  → Holt-Winters + Kalman filter + seasonal naive fallback
  → ForecastResult { predictions, timestamps, maePercent }

StochasticOptimizer.optimize(assets, prices, currentSoc, objective, submercado)
  → Monte Carlo scenarios → best arbitrage trade
  → OptimizationResult { commands, expectedProfitBrl, scenarioCount }

DispatchOrchestrator.execute(cmd)
  → HMAC-signs command, records history, publishes to message bus
  → supports reason: "arbitrage" | "peak_shave" | "ancillary" | "v2g" | "ons_command"

OnsDispatchHandler.processOnsCommand(cmd)
  → Receives ONS command (frequency regulation / reserve power / reactive support)
  → Signs with ONS HMAC key, estimates revenue, routes to DispatchOrchestrator
  → Tracks FrequencyRegulationStatus per asset (primaryMw, secondaryMw, tertiaryMw, reservePowerMw)

Compliance Module (compliance.ts)
  → getBatteryTariffRules() — TUST/TUSD rules per CP 39/2023 (autonomous vs ons_dispatched)
  → calculateBatteryTariff(mode, energyMwh, pldRevenueRsPerMwh)
  → recommendTariffMode(dispatchCountPerDay, onsDispatchSharePct)
  → getFullComplianceReport() — ANEEL/ONS/CCEE status including battery regulation
```

### D. Brazilian Live Data Collection
```
CceeCollector (packages/pde-engine/src/ccee-collector.ts)
  URL: https://dadosabertos.ccee.org.br/datastore/dump/{resource_id}?format=json
  Years: 2021-2026
  Columns: MES_REFERENCIA (AAAAMM), SUBMERCADO (SUDESTE|SUL|NORDESTE|NORTE),
           DIA, HORA, PLD_HORA (R$/MWh)
  Mapping: SUDESTE→SE_CO, SUL→S, NORDESTE→NE, NORTE→N
  Output: PricePoint[] with pricePerKwh = PLD_HORA/1000 (BRL)

OnsCollector (packages/pde-engine/src/ons-collector.ts)
  URL: https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/curva-carga-ho/CURVA_CARGA_2026.csv
  Columns: id_subsistema (1→SE_CO,2→S,3→NE,4→N), din_instante, val_cargaenergiahomwmed (MWmed)
  Output: LoadRecord[] { timestamp, loadMw, submercado }

SigaClient (packages/asset-manager/src/siga-client.ts)
  URL: https://dadosabertos.aneel.gov.br/dataset/{...}/siga-empreendimentos-geracao.csv
  Columns: ~14+ columns — name, state, city, capacityMw, source, phase, status, ANEEL reg, owner, CNPJ, lat/lon, submercado
  Output: SigaGenerationAsset[]
  Methods: findByState(), findBySource(), findByRegistration(), getTotalCapacityMw()
```

### E. Market Connect Flow
```
MarketConnectBrazilService
  ├─ simulatePrice(submercado) → random PLD based on hour + submercado factor
  ├─ fetchLivePrices(submercado?) → HTTP fetch from CCEE JSON API → PriceQuoteBr[]
  ├─ simulateAllSubmarkets() → all 4 submercados
  ├─ subscribe(callback) → pub/sub for price updates
  └─ Auto-publish every 15min (tries live first, falls back to simulation)

Utilities (11): Enel SP, CEMIG, CPFL, Light, EDP, Copel, Celesc,
               Neoenergia Coelba, Neoenergia PE, Equatorial PA, Energisa MT
Traders (5): Tradener, Comerc, Ecom Energia, Safira, Delta Energia
```

### F. Dashboard Flow (edge/dashboard)
```
Open edge/dashboard/index.html in browser
  → Polls http://127.0.0.1:3000 every 5s
  → WebSocket ws://127.0.0.1:3000/ws?token= for real-time telemetry
  → Endpoints: /health, /auth/login, /api/v1/telemetry/latest,
               /api/v1/pde/dispatch/history, /api/v1/market/prices,
               /api/v1/market/submercados
  → Perfis: Industrial, Residencial, Solar (seletor no header, localStorage)
  → If API offline → graceful degradation with mock data
  → Sections: status bar, PDE engine, telemetry (SoC gauge SVG),
              market prices, PLD Brasil, submercados grid, RBAC auth, event log
```

### G. Orchestrator (scripts/orchestrator.mjs)
```
Manages 4 services: api-gateway, omni-cloud, market-connect, simulator
  start | stop | restart | status | logs [service]
  Auto-restart (3 attempts), health checks, log tailing
```

## Brazilian Energy Market Reference

### Submercados PLD
| Code | Name | States | Weight |
|------|------|--------|--------|
| SE_CO | Sudeste/Centro-Oeste | SP,RJ,MG,ES,DF,GO,MT,MS | ~60% |
| S | Sul | PR,SC,RS | ~15% |
| NE | Nordeste | BA,PE,CE,RN,PB,AL,SE,PI,MA | ~15% |
| N | Norte | PA,AM,RO,AC,RR,AP,TO | ~10% |

### PLD Parameters
- **Piso:** R$ 69,07/MWh
- **Teto:** R$ 599,31/MWh
- **Calculation:** CCEE via NEWAVE model, hourly since 2021 (Portaria 50/2021)
- **Time zone:** BRT = UTC-3

### Price Simulation Bands (BRT)
- Madrugada (23h-5h): R$ 69-149/MWh
- Entre-ponta (6h-9h/21h-22h): R$ 100-200/MWh
- Comercial (10h-17h): R$ 200-349/MWh
- Ponta (18h-20h): R$ 300-549/MWh

### Bandeira Tarifária
- **Verde:** sem acréscimo (dry season May-Oct)
- **Amarela:** +R$ 18,85/MWh
- **Vermelha-1:** +R$ 44,63/MWh
- **Vermelha-2:** +R$ 78,77/MWh

### Currency Conversion
- R$/MWh → R$/kWh: ÷ 1000
- PLD_HORA from CCEE API is in R$/MWh
- pricePerKwh in PricePoint is in R$/kWh (already ÷1000)

## Key Data Sources (APIs Externas)

| Source | URL | Data | Package |
|--------|-----|------|---------|
| **CCEE** | `dadosabertos.ccee.org.br` | PLD prices (JSON/CSV) | pde-engine |
| **ONS** | `ons-aws-prod-opendata.s3.amazonaws.com` | Load curve (CSV) | pde-engine |
| **ANEEL SIGA** | `dadosabertos.aneel.gov.br` | Generation assets (CSV) | asset-manager |
| **brapi.dev** | `brapi.dev` | Brazilian financial data | — |

### CCEE Resource IDs (PLD Horário)
| Year | Resource ID |
|------|-------------|
| 2021 | `51922462-16b4-4c64-8327-4e14d6ee8c6c` |
| 2022 | `723cf7e6-6c29-4da6-aa39-e4c8804baf65` |
| 2023 | `5fc317af-7191-4f8a-94e7-f77c56c747b3` |
| 2024 | `1b5b6946-8036-4622-a7a3-b21f33fc52b7` |
| 2025 | `2a180a6b-f092-43eb-9f82-a48798b803dc` |
| 2026 | `3f279d6b-1069-42f7-9b0a-217b084729c4` |

### ONS Dataset URLs
- **Curva de Carga:** `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/curva-carga-ho/CURVA_CARGA_{year}.csv`
- **Dictionary:** `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/curva-carga-ho/DicionarioDados_CurvaCarga.json`

### ANEEL SIGA URLs
- **CSV:** `https://dadosabertos.aneel.gov.br/dataset/6d90b77c-c5f5-4d81-bdec-7bc619494bb9/resource/11ec447d-698d-4ab8-977f-b424d5deee6a/download/siga-empreendimentos-geracao.csv`
- **Dictionary:** resource `25722a60-194d-4234-ab3b-b71354078402/download/dm-siga-...`

## API Gateway Routes (Fastify :3000)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | System health + BR market info |
| GET | `/auth/me` | Yes | Current user + permissions |
| POST | `/auth/login` | No | JWT authentication |
| WS | `/ws?token=` | Yes | WebSocket telemetry stream |
| POST | `/api/v1/pde/forecast` | Yes | Load/solar forecast |
| POST | `/api/v1/pde/optimize` | Yes | Stochastic optimization (accepts `submercado`) |
| POST | `/api/v1/pde/dispatch/execute` | No* | Execute dispatch command |
| GET | `/api/v1/pde/dispatch/history` | Yes | Dispatch log |
| POST | `/api/v1/pde/dispatch/ons-command` | Yes | ONS-commanded ancillary dispatch |
| GET | `/api/v1/pde/dispatch/ancillary-status` | Yes | Frequency regulation status per asset |
| GET | `/api/v1/market/prices` | Yes | PLD prices (query: `?submercado=`) |
| GET | `/api/v1/market/submercados` | Yes | List 4 submercados ONS |
| GET | `/api/v1/market/regulatory` | Yes | BR regulatory info (incl. battery tariffs) |
| POST | `/api/v1/edge/telemetry` | Yes | Ingest telemetry |
| GET | `/api/v1/telemetry/latest` | Yes | All latest telemetry |

\* `/dispatch/execute` excluded from auth hook (authenticated manually inside handler)

## Key Commands

```bash
npm run build           # Build all workspaces
npm test                # Test all workspaces
npm run lint            # TypeScript check all workspaces
npm run start           # Start orchestrator (4 services)
npm run status          # Service status via orchestrator
npm run dev             # Dev mode: api-gateway only (tsx watch)
npm run pde:test        # Test only pde-engine
npm run pde:dev         # Dev mode: pde-engine only
```

### Individual Package Commands
```bash
npm run dev --workspace packages/api-gateway    # API gateway (port 3000)
npm run dev --workspace packages/omni-cloud     # Edge gateway (port 4000)
npm run dev --workspace packages/market-connect # Price publisher
npm test --workspace packages/pde-engine        # PDE tests only
npm test --workspace edge/omni-box-simulator    # Simulator tests (vitest)
```

## TypeScript Conventions

- **Coding style:** No comments in code (unless critical); clean functional style
- **Exports:** Barrel export via `src/index.ts` with `export type *`
- **File naming:** `src/name.ts`, `test/name.test.ts`, `dist/name.js`
- **Types:** Defined in `types.ts`, imported via `type` keyword
- **Async:** Always `async/await`; `Promise<void>` for fire-and-forget
- **Zod:** For runtime validation schemas
- **Constructor:** Optional config objects, sensible defaults
- **Errors:** Custom error classes (`AuthError`), typed error codes

## Test Patterns (Vitest)

- **Describe:** Service name → feature group
- **Factories:** `makeAsset()`, `makePrices()` for test data
- **Placement:** `test/*.test.ts` alongside `src/`
- **Mocking:** `vi.spyOn(globalThis, "fetch")` — always mock with `mockImplementation` (not `mockResolvedValue`) to return fresh Response per call
- **Edge cases:** Empty CSV, network errors, cache hits/misses, date range filters

## Documentation Reference

| File | Content |
|------|---------|
| `AGENTS.md` | **This file** — complete project reference |
| `docs/BRAZILIAN_ENERGY_MARKET_RESEARCH.md` | Full BR regulatory study |
| `OMNI_GRID_CONSPEC.md` | Consolidated spec (Part VI = BR adaptation) |
| `edge/dashboard/README.md` | Dashboard usage guide |

## Regulatory Compliance (implemented)

- **ANEEL:** REN 1.000/2022, REN 1.059/2023, Lei 14.300/2022, REN 482/2012
- **ANEEL (baterias):** CP 39/2023 (aprovada 02/06/2026) — TUST/TUSD para armazenamento
- **Lei 15.269/2025:** Leilão de baterias previsto para dezembro/2026
- **CCEE:** Regras de Comercialização, PLD horário
- **ONS:** Submódulo 14.1 (RED), Submódulo 26 (serviços ancilares), Procedimentos de Rede
- **GD Model:** SCEE (net metering) + ACL (free market)
- **Taxes:** ICMS 12-25% (varia por estado), PIS/COFINS 9,25%

## Seed Users

| Username | Password | Role |
|----------|----------|------|
| admin | omni-admin-2026 | admin |
| operator | omni-operator-2026 | operator |
| viewer | omni-viewer-2026 | viewer |
| device-sim-001 | device-token-001 | device |

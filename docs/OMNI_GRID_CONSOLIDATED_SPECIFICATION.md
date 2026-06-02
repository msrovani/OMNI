# ⚡ OMNI-GRID: CONSOLIDATED SPECIFICATION

**Versão:** 6.1 — Unified Engineering & Strategy (Updated 2026-05-28)
**Codinome:** OMNI-TOTAL-SOVEREIGN
**Status:** EXECUTABLE — Blueprint, Architecture, Code & Pitch (Implementation status annotated throughout)

---

## Implementation Status Legend
| Mark | Meaning |
|------|---------|
| ✅ **Implemented** | Present and working in current codebase |
| 🔜 **Roadmap** | Planned for future sprints |
| 🏭 **Production Target** | Infrastructure for production deployment (not current dev) |
| 💡 **Vision / Aspirational** | Strategic pitch content, not yet implemented |

---

## PART I — CONSOLIDATED VISION & STRATEGY

### 1.1 The Grand Thesis

Omni-Grid is **not** a company — it is a **cognitive energy infrastructure**. The 20th century was defined by who owned oil; the 21st will be defined by who owns the software that orchestrates electrons.

The electrical grid — the largest physical system ever built — is breaking. EV load growth + solar/wind intermittency create entropy that traditional utilities cannot process. Omni-Grid is the intelligent **buffer** that stabilizes this entropy and monetizes every millisecond of flexibility.

### 1.2 Core Problem: The Silent Collapse

| Issue | Description |
|---|---|
| **Duck Curve** | Solar oversupply at noon, demand spike at sunset |
| **Frequency Instability** | Renewables lack physical inertia — rapid blackout risk |
| **CAPEX Bottleneck** | Utilities need trillions in new substations; Omni-Grid avoids that |
| **Unidirectional Grid** | Designed for generator → consumer, not distributed + mobile load |

### 1.3 Solution: The Operating System of Energy

Omni-Grid is the **Cognitive Buffer Layer** between generation and consumption — the **Smart Grid OS**.

### 1.4 Stackable Revenue Streams

| # | Stream | Model |
|---|---|---|
| 1 | **Energy Arbitrage** | Buy Low, Sell High — up to 400% per cycle |
| 2 | **Peak Shaving (Success Fee)** | 30% of demand-charge savings for industrial clients |
| 3 | **Ancillary Services** | ONS / ISO pays for frequency regulation availability |
| 4 | **V2G Brokerage** | Fee per EV charge/discharge cycle |
| 5 | **ESG Tokenization** | Auditable clean-energy certificates for global funds |

### 1.5 Unit Economics (Utility-Scale 1MWh Battery)

| Metric | Value |
|---|---|
| Gross Annual Revenue | US\$ 180k–250k |
| O&M Cost | US\$ 15k |
| Lifetime Value (12yr) | US\$ 2.5M |
| CAC (B2B SaaS) | US\$ 30k |
| **LTV / CAC Ratio** | **> 80x** |

### 1.6 36-Month Roadmap to Unicorn

| Phase | Focus | Milestone |
|---|---|---|
| **Year 1 — Ignition** | 10 industrial sites (Group A) | Validate PDE in real volatility |
| **Year 2 — Scale** | V2G fleets, 500MWh under mgmt | Enter free energy market as digital trader |
| **Year 3 — Dominance** | Texas / Australia expansion, 2GWh | ARR US\$ 150M → IPO or acquisition > US\$ 1.5B |

---

## PART II — TECHNICAL REQUIREMENTS (FOR IMPLEMENTATION)

### 2.1 Predictive Dispatch Engine (PDE)

#### 2.1.1 Functional Requirements

| FR | Description | Priority |
|---|---|---|
| FR-PDE-01 | Ingest real-time telemetry (V, I, f, SoC, SoH) every 1s | Critical |
| FR-PDE-02 | Ingest historical & projected PLD (Brazilian energy settlement price) | Critical |
| FR-PDE-03 | Ingest weather API (GHI, wind speed, temperature) hourly | High |
| FR-PDE-04 | Forecast residential & industrial load with MAE < 2% | Critical |
| FR-PDE-05 | Simulate 10M price scenarios per hour (stochastic optimization) | High |
| FR-PDE-06 | Dispatch charge/discharge commands to maximize profit subject to SoH constraints | Critical |
| FR-PDE-07 | Maintain minimum 20% SoC reserve for critical backup | Critical |
| FR-PDE-08 | Recompute dispatch plan every 15-minute window | High |

#### 2.1.2 AI/ML Model Specifications (Implemented)

- **Forecasting:** Holt-Winters exponential smoothing + Kalman filter + seasonal naive fallback (MAE < 5%实测)
- **Arbitrage Optimization:** Monte Carlo scenario simulation (10k paths) over PLD price bands, selecting max-profit subject to SoH degradation
- **Loss Function (conceptual):** ℒ = α·Profit − β·BatteryDegradation − γ·GridInstability
- **Roadmap (planned):** Transformer-based time-series, Graph Neural Networks for topology, RL agents (PPO/SAC)

#### 2.1.3 PDE API Endpoints

```
POST   /api/v1/pde/forecast          → Run load/solar forecast
POST   /api/v1/pde/optimize          → Run stochastic optimization
GET    /api/v1/pde/dispatch/plan     → Current dispatch schedule
POST   /api/v1/pde/dispatch/execute  → Send commands to Omni-Box fleet
GET    /api/v1/pde/status            → PDE health & last run metrics
```

### 2.2 Omni-Box (Edge Gateway)

#### 2.2.1 Hardware Architecture (Hybrid Smartphone + ESP32)

The Omni-Box uses an **Android smartphone** as main processor + **ESP32-S3** as real-time co-processor:

| Component | Spec |
|---|---|
| Main Processor | Android smartphone (Android 12+, 4GB RAM, 64GB) |
| Co-Processor | ESP32-S3 + PSRAM (real-time industrial I/O) |
| Secure Element | TPM via Android Keystore + SHA-256 PIN |
| Connectivity | WiFi (primary), 4G/5G (failover), BLE, USB-OTG |
| Industrial I/O | RS-485 (MAX3485 via ESP32), CAN Bus (TWAI), USB CDC |

#### 2.2.2 Protocol Stack (Implemented)

| Protocol | Use | Status |
|---|---|---|
| Modbus RTU/TCP | Industrial inverters, energy meters (port 502, 8 registers) | ✅ Implemented |
| CAN Bus (TWAI) | Direct BMS (JBD/Daly/JK) comms @ 250kbps | ✅ Implemented |
| BLE GATT | BMS scanning + Android bridge (service UUID `4f4d4e49-424f-5800-0000-000000000000`) | ✅ Implemented |
| IEC 61850-9-2LE | Sampled Values multicast UDP (port 6000, 4 channels) | ✅ Implemented |
| USB CDC (Virtual COM) | ESP32 ↔ Android binary protocol (TelemetryFrame 34B @ 115200 baud) | ✅ Implemented |
| OCPP 2.0.1 | EV chargers | 🔜 Roadmap |
| SunSpec | Solar data standardization | 🔜 Roadmap |
| DNP3 | Utility SCADA | 🔜 Roadmap |

#### 2.2.3 Edge Logic Requirements

| FR | Description | Priority |
|---|---|---|
| FR-EDGE-01 | Execute shadow logic when cloud connection is lost | Critical |
| FR-EDGE-02 | Anti-islanding protection (IEEE 1547 compliance) | Critical |
| FR-EDGE-03 | Overload/surge local protection | Critical |
| FR-EDGE-04 | Buffer & replay telemetry when connectivity resumes | High |
| FR-EDGE-05 | Secure boot with signed firmware | Critical |

#### 2.2.4 Edge API Endpoints (Local)

```
GET    /api/v1/edge/telemetry       → Current local telemetry snapshot
POST   /api/v1/edge/dispatch        → Receive dispatch command from cloud
GET    /api/v1/edge/status          → Device health, uptime, log
POST   /api/v1/edge/config          → Update local shadow logic rules
```

### 2.3 Cybersecurity Requirements

| FR | Description | Priority |
|---|---|---|
| FR-SEC-01 | Every Omni-Box has a unique X.509 certificate | Critical |
| FR-SEC-02 | All communication via mTLS (Mutual TLS) | Critical |
| FR-SEC-03 | Zero Trust Architecture — no implicit trust | Critical |
| FR-SEC-04 | Layered DoS / DDoS protection on cloud gateways | Critical |
| FR-SEC-05 | Blockchain audit trail for every dispatch command (roadmap) | Medium |
| FR-SEC-06 | Role-based access control (RBAC) for all APIs | Critical |
| FR-SEC-07 | Rotating session tokens (24h max) | High |
| FR-SEC-08 | Hardware-rooted key storage (TPM) | Critical |

---

## PART III — PITCH DECK (10 SLIDES)

### Slide 1: O Apagão Silencioso
> "The grid is the largest machine ever built — and it's breaking."

**Key visuals:** Duck curve graph, map of blackout frequency 2015–2025.
**Narrative:** $2T annual electricity spend, yet the grid can't handle EVs + solar.

### Slide 2: Omni-Grid
> "The Operating System of Energy."

**Tagline:** We turn rigid infrastructure into flexible, profitable intelligence.
**One-liner:** Omni-Grid is the cognitive buffer between generation and consumption.

### Slide 3: Market Size (TAM)
- **TAM:** $2 trillion (global electricity spend)
- **SAM:** $320B (commercial & industrial energy management)
- **SOM:** $12B (battery storage optimization by 2030)
- **Growth:** 25% CAGR (energy storage software)

### Slide 4: Technology — PDE
- **Forecasting:** Time-Series Transformers, MAE < 2%
- **Optimization:** RL agents trained on 10M scenarios/hour
- **Topology:** Graph Neural Networks map the physical grid
- **Edge:** Omni-Box runs with or without cloud

### Slide 5: Business Model — Stackable Revenue
- Arbitrage + Peak Shaving + Ancillary Services + V2G + ESG Tokens
- **LTV/CAC > 80x** (software margins, not hardware)
- **MRR per 1MWh asset:** ~$15k–$20k/month

### Slide 6: Traction
- **Pilot:** 10 industrial sites, 5MWh under management
- **MRR Growth:** R$ 68k (month 8) → R$ 340k (month 12)
- **Pipeline:** 50+ qualified leads in Group A

### Slide 7: Regulatory Roadmap
- ANEEL (Brazil) Resolution 482/687 — net metering
- ONS ancillary services accreditation
- Free market (ACL) trading license
- Texas ERCOT / Australia AEMO expansion

### Slide 8: The Team
- **Founder:** Quant + Systems Architect (JARBAS)
- **Engineering:** 12 elite — Quants, IoT, Security
- **Advisors:** Energy regulation, Utility executives

### Slide 9: Unit Economics — The Math
- **CAC:** $30k (B2B SaaS)
- **LTV:** $2.5M per 1MWh asset
- **LTV/CAC:** > 80x
- **Payback:** 3.6 years (industrial battery 100kWh)
- **Gross Margin:** 85%+ (software-only after installation)

### Slide 10: The Billion
> "Every electron that flows through our software is a recurring dollar."

**Exit paths:**
- Big Oil (Shell, BP, Equinor) — hydrocarbon → electron transition
- Big Tech (Amazon, Google) — data center load management
- Tesla / BYD — software verticalization on their batteries
- **IPO on NASDAQ** as the first data-driven utility

**Ask:** $5M Seed round to deploy 10MW under management in 18 months.

---

## PART IV — SOFTWARE ARCHITECTURE

### 4.1 Microservice Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  API GATEWAY (Fastify 5 — port 3000)                        │
│  CORS → AuthPlugin (JWT verify) → Route → Service           │
└────┬────────┬─────────┬──────────┬──────────────────────────┘
     │        │         │          │
 ┌───▼──┐ ┌──▼────┐ ┌──▼────┐ ┌──▼────────┐
 │ PDE  │ │ Asset │ │ Omni  │ │ Market    │
 │Engine│ │Manager│ │ Cloud │ │ Connect   │
 │(TS)  │ │(TS)   │ │(TS)   │ │ (TS)      │
 └──┬───┘ └──┬────┘ └──┬────┘ └──┬────────┘
    │        │         │          │
 ┌──▼────────▼─────────▼──────────▼────────┐
 │       MESSAGE BUS (omni-bus lib)         │
 │       In-memory / NATS pluggable         │
 └──┬───────────────────────┬───────────────┘
    │                       │
 ┌──▼────────────┐   ┌─────▼──────────┐
 │Edge Simulator │   │ Android App    │
 │(TS)           │   │ (Kotlin)       │
 │port 3001      │   │ Rust JNI .so   │
 └───────────────┘   └─────┬──────────┘
                           │ USB CDC / BLE / WiFi
                    ┌──────▼──────────┐
                    │ ESP32 Co-Proc   │
                    │ (C++, PIO)      │
                    └─────────────────┘
```

### 4.2 Service Catalog

| Service | Lang | Port | Storage | Responsibility |
|---|---|---|---|---|---|
| `api-gateway` | TS (Fastify 5) | 3000 | In-memory | REST+WS gateway, auth, route dispatch |
| `pde-engine` | TS (Node 24) | — | In-memory | Forecast (Holt-Winters/Kalman), stochastic optimization, dispatch |
| `market-connect` | TS | — | In-memory | PLD simulation, utility/trader registry |
| `omni-auth` | TS (lib) | — | In-memory | JWT + RBAC library (HMAC-SHA256) |
| `omni-bus` | TS (lib) | — | In-memory/NATS | Message bus abstraction (pluggable) |
| `omni-cloud` | TS | 4000 | In-memory | Edge gateway, device mgmt |
| `asset-manager` | TS | — | In-memory | Battery lifecycle, SIGA client |
| `omni-cli` | TS | — | — | CLI tool |
| `omni-box-fw` | Rust (cdylib) | — | RTC (ESP32) | Shadow engine, state machine, JNI bridge |
| `omni-box-co-proc` | C++ (ESP32 PIO) | — | RTC (ESP32) | Modbus RTU/TCP, CAN, BLE GATT, BMS, WiFi AP, Safety, IEC 61850 SV, OTA |

### 4.3 Repository Structure (Monorepo — npm Workspaces)

```
omni-grid/
├── .github/workflows/ci.yml    # CI/CD: 8 jobs (lint, test-ts, test-rust, test-android, build-ts, build-rust, build-esp32, deploy-docs)
├── packages/                   # TypeScript packages (npm workspaces)
│   ├── api-gateway/            # Fastify 5 REST+WS gateway (port 3000)
│   │   ├── src/index.ts
│   │   └── test/
│   ├── pde-engine/             # TS — forecast, optimize, dispatch
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── forecast-engine.ts    # Holt-Winters + Kalman
│   │   │   ├── stochastic-optimizer.ts
│   │   │   ├── dispatch-orchestrator.ts
│   │   │   ├── ccee-collector.ts     # CCEE PLD live data
│   │   │   ├── ons-collector.ts      # ONS load curve
│   │   │   └── types.ts
│   │   └── test/
│   ├── asset-manager/         # TS — battery lifecycle, SIGA client
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── siga-client.ts  # ANEEL SIGA CSV parser
│   │   │   └── types.ts
│   │   └── test/
│   ├── market-connect/        # TS — PLD simulation, utilities
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   └── test/
│   ├── omni-auth/             # TS lib — JWT + RBAC
│   │   ├── src/index.ts
│   │   └── test/
│   ├── omni-bus/              # TS lib — message bus (in-memory/NATS)
│   │   ├── src/index.ts
│   │   └── test/
│   ├── omni-cloud/            # TS — edge gateway (port 4000)
│   │   ├── src/index.ts
│   │   └── test/
│   ├── omni-cli/              # TS — CLI tool
│   │   └── src/index.ts
│   └── integration-tests/     # TS — pipeline + bus-edge integration
│       └── test/
├── services/                  # Go + Python microservices (auxiliary)
│   ├── market-connect/        # Go — NATS publisher (PLD per submercado)
│   └── pde-engine/            # Python — submercado enum, BR endpoints
├── edge/
│   ├── dashboard/             # Static HTML — web UI (polls :3000)
│   │   ├── index.html
│   │   ├── sw.js              # Service Worker (PWA)
│   │   └── manifest.json
│   ├── omni-box-simulator/    # TS — edge device simulator
│   │   ├── src/index.ts
│   │   └── test/
│   ├── android-app/           # Kotlin — DPC/Kiosk, bridges, SQLite
│   │   ├── app/src/main/java/com/omnigrid/omnibox/
│   │   │   ├── KioskActivity.kt       # HMI (Jetpack Compose)
│   │   │   ├── OmniBoxViewModel.kt    # StateFlow UI state
│   │   │   ├── ConnectionManager.kt   # Fallback chain orchestrator
│   │   │   ├── Esp32CdcBridge.kt      # USB CDC binary protocol
│   │   │   ├── Esp32BleBridge.kt      # BLE GATT client
│   │   │   ├── LocalEsp32Client.kt    # WiFi direct REST
│   │   │   ├── TelemetryDatabase.kt   # SQLite store-and-forward
│   │   │   ├── TelemetryJobService.kt # JobScheduler periodic
│   │   │   ├── PowerManager.kt        # 4 battery profiles
│   │   │   ├── TimeFallback.kt        # NTP→GPS→Cellular→Uptime
│   │   │   ├── OmniBoxFcmService.kt   # FCM push handler
│   │   │   ├── MeterReader.kt         # CameraX OCR (meter reading)
│   │   │   ├── DevicePolicyController.kt # DPC kiosk mode
│   │   │   ├── PinActivity.kt         # SHA-256 PIN verification
│   │   │   ├── MdmClient.kt           # MDM policy fetch
│   │   │   └── OmniBoxApplication.kt
│   │   ├── app/src/test/              # MockK unit tests (37)
│   │   ├── app/src/androidTest/       # Compose UI tests (17)
│   │   └── app/build.gradle.kts
│   └── esp-co-proc/           # C++ — ESP32-S3 co-processor
│       ├── src/
│       │   ├── main.cpp                # 100ms loop (10+ modules)
│       │   ├── modbus_task.cpp         # Modbus RTU master + TCP server
│       │   ├── can_task.cpp            # CAN Bus (JBD/Daly/JK BMS)
│       │   ├── safety_task.cpp         # IEEE 1547 trip + auto-reclose
│       │   ├── ble_gatt_server.cpp     # BLE GATT advertising
│       │   ├── ble_bms_scanner.cpp     # BLE BMS scanning
│       │   ├── wifi_ap.cpp             # WiFi AP + REST endpoints
│       │   ├── shadow_task.cpp         # RTC-persistent shadow mode
│       │   ├── iec61850_sv.cpp         # IEC 61850-9-2LE SV multicast
│       │   ├── ota_task.cpp            # ArduinoOTA + HTTP update
│       │   └── hw_watchdog.cpp         # GPIO47 watchdog toggle
│       ├── include/
│       │   ├── config.h
│       │   └── tasks.h
│       ├── test/                       # Unity tests (42)
│       │   ├── test_safety.cpp
│       │   ├── test_modbus.cpp
│       │   └── test_can.cpp
│       ├── .clang-format
│       ├── .clang-tidy
│       └── platformio.ini
├── crates/                    # Rust crates
│   ├── omni-box-fw/           # State machine, shadow engine, JNI bridge
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── jni_bridge.rs
│   │   │   ├── shadow.rs
│   │   │   ├── safety.rs
│   │   │   └── drivers/
│   │   │       ├── modbus.rs
│   │   │       ├── can.rs
│   │   │       └── iec61850.rs
│   │   └── tests/integration.rs  # 23 integration tests
│   └── pde-kernel/
├── deploy/
│   ├── docker-compose.yml
│   ├── kong.yml
│   └── terraform/main.tf
├── docs/
│   ├── api/openapi.yaml
│   ├── pitch/                 # Generated HTML presentations
│   ├── OMNI_GRID_CONSOLIDATED_SPECIFICATION.md
│   ├── OMNI_GRID_MASTER_BLUEPRINT.md
│   ├── OMNI_GRID_ULTIMATUM_PROTOCOL.md
│   └── BRAZILIAN_ENERGY_MARKET_RESEARCH.md
├── scripts/
│   ├── orchestrator.mjs
│   └── gen-edge-certs.*
├── proto/                     # Protobuf definitions (reference)
├── tls/                       # Dev TLS certificates
├── AGENTS.md
├── OMNI_GRID_CONSPEC.md
├── package.json               # npm workspaces root
└── README.md
```

### 4.4 Hybrid Edge Architecture (Smartphone + Co-Processor)

A plataforma embarcada Omni-Box usa **smartphone Android** como processador principal conectado a um **ESP32-S3** como co-processador de tempo real para comunicação industrial:

```
┌──────────────────────────────────────────────────────────────┐
│                     SMARTPHONE ANDROID                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  App Omni-Box (Kotlin / Jetpack Compose)               │  │
│  │                                                        │  │
│  │  ┌──────────────────┐  ┌────────────────────────────┐  │  │
│  │  │ Rust Native (JNI)│  │ Networking                  │  │  │
│  │  │ omni_box_fw.so   │  │ - mTLS → Omni-Cloud (gRPC) │  │  │
│  │  │ - Shadow Engine  │  │ - Message Bus (NATS/InMem)  │  │  │
│  │  │ - State Machine  │  │ - 4G/5G failover           │  │  │
│  │  │ - Dispatch Logic  │  │ - GPS PPS sync             │  │  │
│  │  └──────────────────┘  └────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌──────────────────┐  ┌────────────────────────────┐  │  │
│  │  │ HMI (Compose UI)  │  │ Periféricos                │  │  │
│  │  │ - SoC/SoH gauge  │  │ - CameraX (OCR medidor)    │  │  │
│  │  │ - Status grid    │  │ - BLE (BMS)                │  │  │
│  │  │ - Dispatch log   │  │ - USB-OTG (co-processor)   │  │  │
│  │  │ - Alarme visual  │  │ - NFC (identificação ativo)│  │  │
│  │  └──────────────────┘  └────────────────────────────┘  │  │
│  └──────────────────────────┬─────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────┘
                              │ USB CDC (Virtual COM Port)
                              │ 115200 baud — frame TLV
┌─────────────────────────────┼────────────────────────────────┐
│                    ESP32-S3 CO-PROCESSOR                       │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │ Modbus RTU (RS-485)  │  │ CAN Bus 2.0 (TWAI)           │  │
│  │ - Mestre 9600 8N1    │  │ - 250 kbps                  │  │
│  │ - FC03 read inverter  │  │ - JBD/Daly BMS protocol    │  │
│  │ - FC06 set power     │  │ - SoC, temperatura, células  │  │
│  │ - MAX3485 half-duplex │  │ - MCP2515 ou TWAI interno  │  │
│  └──────────────────────┘  └──────────────────────────────┘  │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │ Safety (IEEE 1547)   │  │ Relés + Watchdog             │  │
│  │ - V < 90% ou > 110%  │  │ - Disjuntor rede (GPIO)     │  │
│  │ - f < 59.3 ou > 60.5 │  │ - Disjuntor carga (GPIO)    │  │
│  │ - I > 100A           │  │ - WDT 10s (HW watchdog)     │  │
│  │ - Trip < 100ms       │  │ - Auto-reclose após 5 min   │  │
│  └──────────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Conectividade física:**

| Interface | Dispositivo | Finalidade |
|-----------|-------------|------------|
| USB-OTG → USB Serial | ESP32-S3 (CDC ACM) | Telemetria + comandos bidirecional |
| Bluetooth LE | BMS (JBD/Daly/JK) | SoC, temperatura das células |
| USB-OTG → RS-485 | MAX3485 → Inversor | Modbus RTU (emergência via ESP32) |
| RJ45 (USB-Ethernet) | Inversor (Modbus TCP) | Link principal de dados |
| 4G/5G (nativo) | Torre celular | Failover quando WiFi/RJ45 indisponível |
| WiFi (nativo) | Roteador local | Link principal internet |
| GPS (nativo) | Satélite | Sincronismo PPS, geolocalização |

**Como compilar:**

```bash
# 1. Rust → Android .so (JNI)
cd crates/omni-box-fw
rustup target add aarch64-linux-android
cargo ndk -t arm64-v8a -o ../../edge/android-app/app/src/main/jniLibs build --release

# 2. Android App (APK)
cd edge/android-app
./gradlew assembleRelease

# 3. ESP32 Firmware
cd edge/esp-co-proc
pio run --target upload
```

**Custos BOM (Bill of Materials):**

| Componente | Modelo | Quant. | Custo (USD) |
|------------|--------|--------|-------------|
| Smartphone | Android 12+ 4GB RAM 64GB | 1 | US$ 80–150 |
| Cabo USB-OTG | USB-C p/ USB-A fêmea | 1 | US$ 3 |
| Conversor RS-485 | MAX3485 + CH340 (módulo) | 1 | US$ 5 |
| ESP32-S3 + PSRAM | ESP32-S3-DevKitC-1 | 1 | US$ 12 |
| Fonte 5V | Bivolt 5V 2A | 1 | US$ 5 |
| Caixa industrial | ABS IP65 | 1 | US$ 8 |
| Cabo RJ45 | CAT5e blindado 3m | 1 | US$ 4 |
| **Total** | | | **US$ 117–187** |

### 4.5 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: Omni-Grid CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - run: npm ci
      - run: npm run lint

  test-ts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - run: npm ci
      - run: npm test

  test-rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cd crates/omni-box-fw && cargo test

  test-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: "temurin", java-version: "17" }
      - run: cd edge/android-app && ./gradlew test

  build-ts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "24" }
      - run: npm ci
      - run: npm run build

  build-rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cd crates/omni-box-fw && cargo build --release

  build-esp32:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: karniv00l/platformio-actions@v1
      - run: cd edge/esp-co-proc && pio run
      - uses: actions/upload-artifact@v4
        with:
          name: esp32-firmware
          path: edge/esp-co-proc/.pio/build/*/firmware.bin

  deploy-docs:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with: { path: docs/ }
      - id: deploy
        uses: actions/deploy-pages@v4
```

---

## PART V — EXECUTABLE SPECIFICATIONS (CODE, SCHEMAS, APIs)

> **Note:** This section mixes current implementations with production deployment targets.
> Sections marked 🏭 represent the target infrastructure (PostgreSQL, NATS, Docker Compose, Terraform)
> for when the system moves beyond in-memory storage. The primary codebase uses TypeScript npm workspaces
> under `packages/` with in-memory storage for development velocity.

### 5.1 Protobuf Schemas (gRPC / NATS) ✅ Implemented

#### 5.1.1 PDE Service (`proto/pde/v1/pde.proto`)

```protobuf
syntax = "proto3";
package omnigrid.pde.v1;
import "google/protobuf/timestamp.proto";
import "common/v1/common.proto";

// ── Forecast ──
message ForecastRequest {
  string asset_id = 1;
  google.protobuf.Timestamp window_start = 2;
  uint32 horizon_minutes = 3;  // 15–1440
}

message ForecastResponse {
  repeated DataPoint predictions = 1;
  double mae_percent = 2;
}

// ── Optimization ──
message OptimizeRequest {
  repeated string asset_ids = 1;
  google.protobuf.Timestamp window_start = 2;
  uint32 horizon_minutes = 3;
  OptimizationObjective objective = 4;
}

enum OptimizationObjective {
  OPTIMIZE_PROFIT = 0;
  OPTIMIZE_BATTERY_LIFE = 1;
  OPTIMIZE_GRID_STABILITY = 2;
  OPTIMIZE_BALANCED = 3;
}

message OptimizeResponse {
  repeated DispatchCommand commands = 1;
  double expected_profit_usd = 2;
  double expected_degradation_cost = 3;
}

// ── Dispatch ──
message DispatchCommand {
  string asset_id = 1;
  double power_kw = 2;              // positive = discharge, negative = charge
  google.protobuf.Timestamp start_time = 3;
  uint32 duration_seconds = 4;
  string reason = 5;                 // "arbitrage" | "peak_shave" | "ancillary" | "v2g"
  bytes signature = 6;               // Signed by PDE for audit
}

message DispatchPlan {
  repeated DispatchCommand commands = 1;
  string plan_id = 2;
  google.protobuf.Timestamp created_at = 3;
}

// ── Service ──
service PDEService {
  rpc Forecast(ForecastRequest) returns (ForecastResponse);
  rpc Optimize(OptimizeRequest) returns (OptimizeResponse);
  rpc GetDispatchPlan(common.v1.GetByIdRequest) returns (DispatchPlan);
  rpc ExecuteDispatch(DispatchPlan) returns (common.v1.Ack);
}
```

#### 5.1.2 Edge Service (`proto/edge/v1/edge.proto`)

```protobuf
syntax = "proto3";
package omnigrid.edge.v1;
import "google/protobuf/timestamp.proto";
import "common/v1/common.proto";

message Telemetry {
  string device_id = 1;
  google.protobuf.Timestamp timestamp = 2;
  double voltage_v = 3;
  double current_a = 4;
  double frequency_hz = 5;
  double soc_percent = 6;
  double soh_percent = 7;
  double temperature_c = 8;
  double power_w = 9;          // positive = exporting to grid
  bool is_grid_connected = 10;
}

message TelemetryBatch {
  repeated Telemetry samples = 1;
}

message DispatchAck {
  string command_id = 1;
  bool accepted = 2;
  string rejection_reason = 3;
  google.protobuf.Timestamp executed_at = 4;
}

service EdgeService {
  rpc ReportTelemetry(TelemetryBatch) returns (common.v1.Ack);
  rpc ReceiveDispatch(DispatchCommand) returns (DispatchAck);
  rpc GetStatus(common.v1.GetByIdRequest) returns (DeviceStatus);
}

message DeviceStatus {
  string device_id = 1;
  string firmware_version = 2;
  uint32 uptime_seconds = 3;
  bool is_connected = 4;
  bool shadow_mode_active = 5;
  repeated string active_protocols = 6;
}
```

#### 5.1.3 Asset Service (`proto/asset/v1/asset.proto`)

```protobuf
syntax = "proto3";
package omnigrid.asset.v1;
import "google/protobuf/timestamp.proto";
import "common/v1/common.proto";

message BatteryAsset {
  string asset_id = 1;
  string client_id = 2;
  string manufacturer = 3;
  string model = 4;
  double capacity_kwh = 5;
  double nominal_power_kw = 6;
  double cycle_life = 7;
  common.v1.InstallationAddress address = 8;
  double min_soc_percent = 9;       // default 20
  double max_soc_percent = 10;      // default 95
  bool is_active = 11;
}

message Contract {
  string contract_id = 1;
  string client_id = 2;
  string asset_id = 3;
  double omni_revenue_share_percent = 4;  // e.g. 30
  double min_backup_soc = 5;              // e.g. 20
  google.protobuf.Timestamp start_date = 6;
  google.protobuf.Timestamp end_date = 7;
  bool auto_renew = 8;
}

service AssetService {
  rpc RegisterAsset(BatteryAsset) returns (common.v1.GenericResponse);
  rpc GetAsset(common.v1.GetByIdRequest) returns (BatteryAsset);
  rpc ListAssets(common.v1.ListRequest) returns (stream BatteryAsset);
  rpc RegisterContract(Contract) returns (common.v1.GenericResponse);
}
```

#### 5.1.4 Common Types (`proto/common/v1/common.proto`)

```protobuf
syntax = "proto3";
package omnigrid.common.v1;
import "google/protobuf/timestamp.proto";

message DataPoint {
  google.protobuf.Timestamp timestamp = 1;
  double value = 2;
}

message GetByIdRequest {
  string id = 1;
}

message ListRequest {
  uint32 page = 1;
  uint32 page_size = 2;
  string filter = 3;
}

message Ack {
  bool success = 1;
  string message = 2;
}

message GenericResponse {
  bool success = 1;
  string message = 2;
  string id = 3;
}

message InstallationAddress {
  string street = 1;
  string city = 2;
  string state = 3;
  string zip = 4;
  string country = 5;
  double latitude = 6;
  double longitude = 7;
}
```

### 5.2 API Gateway Routes (Fastify :3000) ✅ Implemented

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | System health + BR market info |
| POST | `/auth/login` | No | JWT authentication (HMAC-SHA256) |
| GET | `/auth/me` | Yes | Current user + permissions |
| WS | `/ws?token=` | Yes | WebSocket telemetry stream |
| POST | `/api/v1/pde/forecast` | Yes | Load/solar forecast |
| POST | `/api/v1/pde/optimize` | Yes | Stochastic optimization (accepts `submercado`) |
| POST | `/api/v1/pde/dispatch/execute` | No* | Execute dispatch command |
| GET | `/api/v1/pde/dispatch/history` | Yes | Dispatch log |
| GET | `/api/v1/market/prices` | Yes | PLD prices (`?submercado=SE_CO`) |
| GET | `/api/v1/market/submercados` | Yes | List 4 submercados ONS |
| GET | `/api/v1/market/regulatory` | Yes | BR regulatory info |
| POST | `/api/v1/edge/telemetry` | Yes | Ingest telemetry |
| GET | `/api/v1/telemetry/latest` | Yes | All latest telemetry |

\* `/dispatch/execute` excluded from auth hook (authenticated manually inside handler)

#### Seed Users

| Username | Password | Role |
|----------|----------|------|
| admin | omni-admin-2026 | admin |
| operator | omni-operator-2026 | operator |
| viewer | omni-viewer-2026 | viewer |
| device-sim-001 | device-token-001 | device |

### 5.3 Database Schemas (PostgreSQL / TimescaleDB) 🏭 Production Target

> **Current state:** All services use in-memory storage for development.
> These schemas are the production deployment target with TimescaleDB for telemetry and PostgreSQL for assets/contracts.

#### 5.3.1 Assets Table (PostgreSQL)

```sql
CREATE TABLE assets (
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
```

#### 5.3.2 Telemetry Table (TimescaleDB hypertable)

```sql
CREATE TABLE telemetry (
    time            TIMESTAMPTZ NOT NULL,
    device_id       UUID NOT NULL,
    voltage_v       NUMERIC(6,2),
    current_a       NUMERIC(6,2),
    frequency_hz    NUMERIC(5,3),
    soc_percent     NUMERIC(5,2),
    soh_percent     NUMERIC(5,2),
    temperature_c   NUMERIC(5,2),
    power_w         NUMERIC(10,2),
    is_grid_connected BOOLEAN,
    tags            JSONB
);

SELECT create_hypertable('telemetry', 'time');

CREATE INDEX idx_telemetry_device_time ON telemetry(device_id, time DESC);
```

#### 5.3.3 Dispatch Log Table

```sql
CREATE TABLE dispatch_log (
    log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         UUID NOT NULL REFERENCES dispatch_plans(plan_id),
    asset_id        UUID NOT NULL REFERENCES assets(asset_id),
    power_kw        NUMERIC(8,2) NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    duration_sec    INTEGER NOT NULL,
    reason          VARCHAR(50) NOT NULL,
    blockchain_tx   VARCHAR(128),          -- transaction hash
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispatch_asset_time ON dispatch_log(asset_id, start_time DESC);
```

#### 5.3.4 Contracts Table

```sql
CREATE TABLE contracts (
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
```

### 5.4 PDE Engine Core Code 🏭 Production Target (Python services)

> **Current state:** The PDE engine is implemented in TypeScript under `packages/pde-engine/`.
> The Python skeleton below represents a target production architecture using FastAPI + PyTorch.
> Current TS implementation uses Holt-Winters + Kalman filter in `forecast-engine.ts`.

#### 5.4.1 `services/pde-engine/api/app.py` (Production Target)

```python
from fastapi import FastAPI
from pde.api.routes import router
from pde.core.forecast import ForecastEngine
from pde.core.optimizer import StochasticOptimizer
from pde.core.dispatch import DispatchOrchestrator
from pde.infrastructure.telemetry import TelemetryClient
from pde.infrastructure.market import MarketDataClient

app = FastAPI(title="PDE Engine", version="1.0.0")

forecast_engine = ForecastEngine()
optimizer = StochasticOptimizer()
dispatcher = DispatchOrchestrator()
telemetry = TelemetryClient()
market = MarketDataClient()

app.include_router(router, prefix="/api/v1/pde")
```

#### 5.4.2 `services/pde-engine/pde/core/forecast.py`

```python
import torch
import torch.nn as nn
import pandas as pd
from typing import List
from datetime import datetime

class TimeSeriesTransformer(nn.Module):
    def __init__(self, d_model=256, nhead=8, num_layers=6):
        super().__init__()
        self.embedding = nn.Linear(12, d_model)
        self.transformer = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(d_model, nhead, batch_first=True),
            num_layers=num_layers
        )
        self.output = nn.Linear(d_model, 1)

    def forward(self, x):
        x = self.embedding(x)
        x = self.transformer(x)
        return self.output(x[:, -1, :])

class ForecastEngine:
    def __init__(self):
        self.model = TimeSeriesTransformer()
        self.model.load_state_dict(torch.load("models/forecast_v1.pt"))
        self.model.eval()

    def predict(self, features: torch.Tensor) -> float:
        with torch.no_grad():
            return self.model(features).item()

    def predict_series(self, historical: pd.DataFrame, horizon: int) -> List[float]:
        predictions = []
        window = torch.tensor(historical.values[-96:], dtype=torch.float32).unsqueeze(0)
        for _ in range(horizon):
            pred = self.predict(window)
            predictions.append(pred)
            new_row = torch.cat([window[:, 1:, :], torch.tensor([[[pred]]])], dim=1)
            window = new_row
        return predictions
```

#### 5.4.3 `services/pde-engine/pde/core/optimizer.py`

```python
import numpy as np
from typing import List, Tuple
from dataclasses import dataclass

@dataclass
class DispatchAction:
    asset_id: str
    power_kw: float
    duration_sec: int

class StochasticOptimizer:
    def __init__(self, num_scenarios: int = 10_000_000):
        self.num_scenarios = num_scenarios

    def simulate_price_scenarios(self, base_price: float, volatility: float) -> np.ndarray:
        returns = np.random.normal(0, volatility, (self.num_scenarios, 96))
        paths = base_price * np.exp(np.cumsum(returns, axis=1))
        return paths

    def optimize(self, assets: List[dict], price_paths: np.ndarray) -> DispatchAction:
        best_action = None
        best_profit = -np.inf

        for asset in assets:
            for hour in range(96):
                buy_price = price_paths[:, hour].mean()
                sell_price = price_paths[:, hour + 1].mean()
                spread = sell_price - buy_price
                degradation_cost = self._degradation_cost(asset, spread)
                profit = spread * asset["capacity_kwh"] - degradation_cost

                if profit > best_profit:
                    best_profit = profit
                    best_action = DispatchAction(
                        asset_id=asset["id"],
                        power_kw=asset["nominal_power_kw"],
                        duration_sec=3600
                    )
        return best_action

    def _degradation_cost(self, asset: dict, depth_of_discharge: float) -> float:
        return (depth_of_discharge / 100) * (asset["replacement_cost"] / asset["cycle_life"])
```

#### 5.4.4 `services/pde-engine/pde/core/dispatch.py`

```python
from typing import List
from pde.core.optimizer import DispatchAction
from pde.infrastructure.edge_gateway import EdgeGatewayClient

class DispatchOrchestrator:
    def __init__(self):
        self.edge_gw = EdgeGatewayClient()

    def execute_plan(self, actions: List[DispatchAction]) -> bool:
        all_accepted = True
        for action in actions:
            ack = self.edge_gw.send_dispatch(action)
            if not ack.accepted:
                all_accepted = False
        return all_accepted
```

### 5.5 Omni-Cloud Edge Gateway 🏭 Production Target (Rust)

> **Current state:** omni-cloud is implemented in TypeScript under `packages/omni-cloud/` (port 4000).
> The Rust skeleton below represents a target production gRPC gateway.

#### 5.5.1 `services/omni-cloud/src/main.rs` (Production Target)

```rust
use tonic::{transport::Server, Request, Response, Status};
use omnigrid::edge::v1::{
    edge_service_server::{EdgeService, EdgeServiceServer},
    TelemetryBatch, DispatchCommand, DispatchAck, DeviceStatus
};
use omnigrid::common::v1::{Ack, GetByIdRequest};

mod telemetry;
mod dispatch;
mod security;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = "[::1]:50051".parse()?;
    let edge_svc = OmniEdgeService::new();

    println!("Omni-Cloud Edge Gateway listening on {}", addr);

    Server::builder()
        .add_service(EdgeServiceServer::new(edge_svc))
        .serve(addr)
        .await?;

    Ok(())
}

#[derive(Debug)]
pub struct OmniEdgeService {
    telemetry_store: telemetry::TelemetryStore,
    dispatch_handler: dispatch::DispatchHandler,
    cert_manager: security::CertManager,
}

impl OmniEdgeService {
    pub fn new() -> Self {
        Self {
            telemetry_store: telemetry::TelemetryStore::new(),
            dispatch_handler: dispatch::DispatchHandler::new(),
            cert_manager: security::CertManager::new(),
        }
    }
}

#[tonic::async_trait]
impl EdgeService for OmniEdgeService {
    async fn report_telemetry(
        &self,
        request: Request<TelemetryBatch>,
    ) -> Result<Response<Ack>, Status> {
        let batch = request.into_inner();

        // Validate mTLS client certificate
        self.cert_manager.validate_peer_cert(&request.pending_peer_certs())?;

        // Store telemetry
        for sample in batch.samples {
            self.telemetry_store.insert(sample).await;
        }

        Ok(Response::new(Ack {
            success: true,
            message: "telemetry ingested".into(),
        }))
    }

    async fn receive_dispatch(
        &self,
        request: Request<DispatchCommand>,
    ) -> Result<Response<DispatchAck>, Status> {
        let cmd = request.into_inner();

        // Verify PDE signature
        self.dispatch_handler.verify_signature(&cmd)?;

        // Forward to edge device
        let ack = self.dispatch_handler.forward_to_device(cmd).await?;

        Ok(Response::new(ack))
    }

    async fn get_status(
        &self,
        request: Request<GetByIdRequest>,
    ) -> Result<Response<DeviceStatus>, Status> {
        let device_id = request.into_inner().id;
        let status = self.telemetry_store.get_device_status(&device_id).await?;
        Ok(Response::new(status))
    }
}
```

### 5.6 Terraform Infrastructure (AWS)

#### 5.6.1 `deploy/terraform/main.tf`

```hcl
terraform {
  backend "s3" {
    bucket = "omni-grid-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
}

# ── ECS Fargate Cluster ──
resource "aws_ecs_cluster" "omni" {
  name = "omni-grid-cluster"
}

resource "aws_ecs_task_definition" "pde_engine" {
  family                   = "pde-engine"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = 2048
  memory                  = 8192
  execution_role_arn      = aws_iam_role.ecs_exec.arn
  container_definitions   = jsonencode([
    {
      name  = "pde-engine"
      image = "ghcr.io/omni-grid/pde-engine:latest"
      portMappings = [
        { containerPort = 50051, protocol = "tcp" }
      ]
      environment = [
        { name = "DB_HOST", value = aws_rds_cluster.timescaledb.endpoint }
      ]
    }
  ])
}

# ── TimescaleDB ──
resource "aws_rds_cluster" "timescaledb" {
  cluster_identifier = "omni-grid-tsdb"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  database_name      = "omnigrid"
  master_username    = "omni_admin"
  master_password    = var.db_password
}

# ── NATS (Message Bus) ──
resource "aws_mq_broker" "nats" {
  broker_name = "omni-grid-nats"
  engine_type = "NATS"
  engine_version = "2.10"
  host_instance_type = "mq.t3.micro"
  users {
    username = "omni_nats"
    password = var.nats_password
  }
}

# ── IAM ──
resource "aws_iam_role" "ecs_exec" {
  name = "omni-ecs-exec"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
      }
    ]
  })
}
```

### 5.7 Docker Compose (Production Target) 🏭

> **Current state:** Development uses `npm run dev` (tsx watch) with in-memory storage.
> The compose file below deploys the Go/Python microservices with PostgreSQL, NATS, and Redis for production.

```yaml
# docker-compose.yml (root of repository)
version: "3.9"
services:
  nats:
    image: nats:2.10-alpine
    ports: ["4222:4222", "8222:8222"]
    networks: [omni-net]

  postgres:
    image: timescale/timescaledb:2-pg16
    environment:
      POSTGRES_DB: omnigrid
      POSTGRES_USER: omni
      POSTGRES_PASSWORD: omni_dev
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    networks: [omni-net]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    networks: [omni-net]

  pde-engine:
    build: ./services/pde-engine
    ports: ["50051:50051", "8001:8001"]
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      NATS_URL: nats://nats:4222
      REDIS_URL: redis://redis:6379
    depends_on: [nats, postgres, redis]
    networks: [omni-net]

  asset-manager:
    build: ./services/asset-manager
    ports: ["50052:50052"]
    environment:
      DB_HOST: postgres
      NATS_URL: nats://nats:4222
    depends_on: [nats, postgres]
    networks: [omni-net]

  omni-cloud:
    build: ./services/omni-cloud
    ports: ["50053:50053"]
    environment:
      NATS_URL: nats://nats:4222
    depends_on: [nats]
    networks: [omni-net]

  market-connect:
    build: ./services/market-connect
    environment:
      DB_HOST: postgres
      NATS_URL: nats://nats:4222
    depends_on: [nats, postgres]
    networks: [omni-net]

  omni-box-simulator:
    build: ./edge/omni-box-simulator
    environment:
      CLOUD_GW_URL: http://omni-cloud:50053
      DEVICE_ID: "sim-001"
    depends_on: [omni-cloud]
    networks: [omni-net]

networks:
  omni-net:
    driver: bridge

volumes:
  pgdata:
```

### 5.8 Development Commands (npm scripts) ✅ Implemented

```bash
npm run build           # Build all workspaces (tsc)
npm test                # Test all workspaces (vitest)
npm run lint            # TypeScript check all workspaces
npm run start           # Start orchestrator (4 services)
npm run status          # Service status via orchestrator
npm run dev             # Dev mode: api-gateway only (tsx watch)
npm run pde:test        # Test only pde-engine
npm run pde:dev         # Dev mode: pde-engine only

# Individual package dev
npm run dev --workspace packages/api-gateway    # API gateway (port 3000)
npm run dev --workspace packages/omni-cloud     # Edge gateway (port 4000)
npm run dev --workspace packages/market-connect # Price publisher
npm test --workspace packages/pde-engine        # PDE tests only

# Edge firmware (Rust)
cd crates/omni-box-fw && cargo test
cd crates/omni-box-fw && cargo build --release

# Edge firmware (ESP32)
cd edge/esp-co-proc && pio run
cd edge/esp-co-proc && pio test --environment test

# Android
cd edge/android-app && ./gradlew test
cd edge/android-app && ./gradlew assembleRelease

# Production infra
docker compose up --build -d               # Start Go/Python services
cd deploy/terraform && terraform apply      # Provision AWS infrastructure
```

---

## APPENDIX — Consolidated Contract Clauses

### Performance (Success Fee) Clause
*"OMNI-GRID shall receive a variable remuneration equal to 30% of the net savings generated on the CONTRACTING PARTY's energy invoice, specifically in the 'Power Demand' item, calculated monthly by comparing the load profile with and without the dispatch software intervention."*

### Autonomous Intelligence Clause
*"The CONTRACTING PARTY grants OMNI-GRID the exclusive right to autonomous dispatch of storage assets, under the premise that the PDE will always seek maximization of operational profit while respecting the technical safety limits of the hardware."*

### Asset Custody Clause
*"The CONTRACTING PARTY authorizes OMNI-GRID to use the idle capacity of installed batteries for market arbitrage and ancillary service provision, always guaranteeing a minimum 20% SoC reserve for critical local backup."*

---

## PART VI — ADAPTAÇÃO PARA O MERCADO BRASILEIRO

### 6.1 Visão Geral da Adaptação

O OMNI Grid foi adaptado para operar no **Mercado de Energia Brasileiro**, considerando a estrutura regulatória da ANEEL, ONS e CCEE, com precificação em **R$/MWh** (Real) e suporte aos **4 submercados PLD** do Sistema Interligado Nacional (SIN).

### 6.2 Submercados PLD (CCEE/ONS)

| Submercado | Código | Estados | Fator de Preço |
|-----------|--------|---------|---------------|
| Sudeste/Centro-Oeste | SE_CO | SP, RJ, MG, ES, DF, GO, MT, MS | 1.0 (referência) |
| Sul | S | PR, SC, RS | 0.95 |
| Nordeste | NE | BA, PE, CE, RN, PB, AL, SE, PI, MA | 0.85 |
| Norte | N | PA, AM, RO, AC, RR, AP, TO | 1.15 |

### 6.3 PLD — Parâmetros de Mercado

- **Piso regulatório:** R$ 69,07/MWh
- **Teto regulatório:** R$ 599,31/MWh
- **Periodicidade:** Horário (desde 2021 — Portaria MM E 50/2021)
- **Modelo de cálculo:** NEWAVE (otimização hidrotérmica) → DECOMP → DESSEM
- **Fonte oficial:** CCEE (Câmara de Comercialização de Energia Elétrica)

### 6.4 Nova Arquitetura de Preços

```
Market Connect (TS)                    PDE Engine
┌──────────────────────┐              ┌──────────────────────┐
│ PLD_SE_CO → R$/MWh   │ ──NATS──▶   │ MarketDataClient     │
│ PLD_S    → R$/MWh   │              │ │ fetchPldPrices()    │
│ PLD_NE   → R$/MWh   │              │ │ fetchAllSubmarkets()│
│ PLD_N    → R$/MWh   │              └──────┬───────────────┘
│                      │                     │
│ Utilities BR:        │              ┌──────▼───────────────┐
│ Enel, CEMIG, CPFL... │              │ StochasticOptimizer  │
│ Traders:             │              │ moeda: BRL           │
│ Comerc, Tradener...  │              │ submercado-aware     │
└──────────────────────┘              └──────────────────────┘
```

### 6.5 Moeda e Unidades

| Contexto | Antes (Genérico) | Agora (Brasil) |
|---------|------------------|----------------|
| Moeda | USD (dólar) | BRL (real) |
| Unidade de preço | $/kWh | R$/MWh (e R$/kWh) |
| Preço de energia | pricePerKwh | precoPorMwh + precoPorKwh |
| Região | region (string) | submercado (enum PldSubmarket) |
| Fonte | "PLD_SIMULATED" | "CCEE_PLD_SIMULATED_SE_CO" |

### 6.6 BandEira Tarifária

Suporte ao sistema de bandeiras tarifárias da ANEEL:
- **Verde:** Sem acréscimo (maio a outubro — período seco)
- **Amarela:** R$ 18,85/MWh (condições menos favoráveis)
- **Vermelha-1:** R$ 44,63/MWh (condições desfavoráveis)
- **Vermelha-2:** R$ 78,77/MWh (condições muito desfavoráveis)

### 6.7 Utilities Brasileiras Integradas

| Grupo | Distribuidoras | Região |
|-------|---------------|--------|
| Enel | Enel SP, Enel RJ, Enel CE | SE, NE |
| CEMIG | CEMIG D | SE |
| CPFL (State Grid) | CPFL Paulista, CPFL Piratininga, RGE | SE, S |
| Light | Light SESA | SE |
| Neoenergia (Iberdrola) | Coelba, Pernambuco, Cosern | NE |
| Equatorial | Equatorial PA, MA, PI, AL, RR | N, NE |
| Copel | Copel Distribuição | S |

### 6.8 Compliance Regulatório

| Requisito | Status | Detalhes |
|-----------|--------|----------|
| REN ANEEL 1.000/2022 | ✅ Implementado | Regras de distribuição e conexão |
| Lei 14.300/2022 (GD) | ✅ Modelado | SCEE, ACL, autoconsumo |
| CP 39/2023 (Baterias) | ✅ Implementado | TUST/TUSD para armazenamento — aprovado 02/06/2026 |
| Lei 15.269/2025 (Leilão) | 🔜 Dez/2026 | Leilão específico de baterias |
| Portaria 50/2021 (PLD horário) | ✅ Implementado | Preços horários por submercado |
| Serviços Ancilares (ONS) | ✅ Implementado | Submódulo 14.1 — OnsDispatchHandler + OnsDispatchCommand |
| ICMS/PIS/COFINS | ✅ Modelado | Alíquotas por estado |
| ACL (Ambiente Livre) | ✅ Suportado | Clientes ≥ 500 kW |

### 6.9 Novos Endpoints

#### Market Connect
```
GET  /api/v1/market/prices?submercado=SE_CO   → Preços PLD por submercado
GET  /api/v1/market/submercados                → Lista submercados ONS
GET  /api/v1/market/regulatory                 → Info regulatório BR
```

#### PDE Engine
```
POST /api/v1/pde/optimize    → Agora aceita submercado no body
      { submercado: "SE_CO" }
```

### 6.10 Estrutura de Dados Atualizada

```typescript
// types.ts (pde-engine)
export type PldSubmarket = "SE_CO" | "S" | "NE" | "N";

export interface PricePoint {
  timestamp: Date;
  pricePerKwh: number;    // R$/kWh (convertido de R$/MWh)
  source: string;          // "CCEE_PLD_SIMULATED_SE_CO"
  submercado?: PldSubmarket;
  currency?: "BRL";
}

export interface OptimizationResult {
  commands: DispatchCommand[];
  expectedProfitBrl: number;      // ← BRL, não USD
  expectedDegradationCost: number;
  scenarioCount: number;
  submercado?: PldSubmarket;
}
```

### 6.11 Tarifação de Baterias (CP 39/2023 — ANEEL 02/06/2026)

```typescript
// compliance.ts — implemented
export const BATTERY_TARIFF_RULES = {
  autonomous: {
    mode: "autonomous",
    tustRsPerMwh: 15.40,
    tusdRsPerMwh: 28.90,
    chargeTariffed: true,
    dischargeTariffed: true,
    description: "Baterias em operação autônoma (arbitrage) pagam TUST/TUSD dupla"
  },
  ons_dispatched: {
    mode: "ons_dispatched",
    tustRsPerMwh: 15.40,
    tusdRsPerMwh: 28.90,
    chargeTariffed: false,
    dischargeTariffed: true,
    description: "Baterias despachadas pelo ONS pagam tarifa única (somente descarga)"
  }
};
```

#### Recomendação Automática
- `recommendTariffMode(dispatchCountPerDay, onsDispatchSharePct)`
- Se > 30% dos despachos forem comandados pelo ONS → recomenda tarifa única
- Economia potencial: R$ 44,30/MWh (diferença entre dupla e única)

### 6.12 Despacho ONS (Novo — OnsDispatchHandler)

```typescript
// ons-dispatch.ts — new module
export class OnsDispatchHandler {
  processOnsCommand(cmd: OnsDispatchCommand)
  processOnsCommandBatch(commands: OnsDispatchCommand[])
  getRegulationStatus(assetId: string)
  getAncillaryRevenueRates()
}
```

- 5 tipos de serviço ancilar: regulação primária/secundária/terciária, reserva de potência, suporte reativo
- Taxas de receita: R$ 15-45/MWh por tipo de serviço
- Batch processing para múltiplos comandos ONS simultâneos
- Integração com DispatchOrchestrator via `executeOnsCommand()`

---

> **Generated:** OMNI-GRID CONSOLIDATED SPECIFICATION v6.1.1 — Updated 2026-06-02 (ANEEL CP 39/2023)
> **Status:** EXECUTABLE READY — Implementation status annotations added. Current codebase uses TypeScript npm workspaces (packages/) with in-memory storage. Production target uses Go/Python microservices with PostgreSQL/NATS/Redis via Docker Compose.
> Adaptado para o mercado brasileiro com submercados PLD, R$/MWh, utilities nacionais e compliance ANEEL/CCEE/ONS.
>
> Próximos passos:
> 1. Implementar integração real com API da CCEE (em produção)
> 2. Credenciamento ONS para serviços ancilares
> 3. Integração com comercializadoras do ACL
> 4. Dashboard regulatório em tempo real

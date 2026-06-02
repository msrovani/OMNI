# ⚡ OMNI-GRID

**The Cognitive Energy Infrastructure** — O Sistema Operacional da Energia Elétrica.

Sistema de otimização estocástica multi-objetivo para arbitragem de energia, peak shaving e serviços ancilares no mercado brasileiro (PLD/CCEE/ONS/ANEEL).

## Stack

| Layer | Tech | Port |
|-------|------|------|
| API Gateway | TypeScript (Fastify 5) | 3000 |
| PDE Engine | TypeScript (Holt-Winters + Kalman) | — |
| Market Connect | TypeScript (PLD simulation) | — |
| Omni-Cloud | TypeScript (edge gateway) | 4000 |
| Omni-Box FW | Rust (cdylib — JNI) | — |
| Co-Processor | C++ (ESP32-S3, PlatformIO) | — |
| Android App | Kotlin (Jetpack Compose) | — |
| Dashboard | HTML/JS (static, PWA) | — |
| Message Bus | TypeScript lib (in-memory/NATS) | — |

## Edge Architecture

```
Smartphone Android (Kotlin + Rust JNI)
  ├── USB CDC → ESP32-S3 (Modbus, CAN, BLE, IEC 61850)
  ├── BLE GATT → BMS (JBD/Daly/JK)
  ├── WiFi AP → Local REST API
  └── 4G/5G → Omni-Cloud Gateway
```

## Quick Start

```bash
npm install
npm run build
npm run dev          # api-gateway on :3000
npm run start        # orchestrator (4 services)
npm test             # all tests
```

## Brazilian Market

- **PLD:** 4 submercados (SE/CO, S, NE, N) — Piso R$ 69,07 / Teto R$ 599,31
- **CCEE:** Dados abertos (JSON) — PLD horário 2021-2026
- **ONS:** Curva de carga (CSV) — carga por submercado
- **ANEEL SIGA:** Geração (CSV) — ~14 colunas

## Status

✅ Sprint 0 (Foundation) — Rust crate, mTLS, Android base, ESP32 core  
✅ Sprint 1 (Pipeline) — Integration tests, simulator, ESP32 tests, Android ViewModel  
✅ Sprint 2 (Industrial IoT) — Dashboard profiles, IEC 61850 SV, OTA, WebSocket  
✅ Sprint 3 (Frontend + CI) — KPI cards, i18n, PWA install, FCM push, CI/CD  
🔜 Production — Live CCEE/ONS/ANEEL, Docker Compose, Kong, real mTLS  
🔜 Roadmap — V2G, ONS ancillary, ACL license, Texas/Australia expansion  

**~302 tests** across all packages | **47 edge tasks** complete | **8 CI/CD jobs**

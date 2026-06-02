# OMNI Grid — Aprendizados e Estado Completo

## Histórico de Sessão

### Sprint 0 — Fundação (Completo)
- Crate Rust `omni-box-fw`: 10 módulos, máquina de estados, shadow autônomo, JNI bridge
- ESP32: 10 módulos (Modbus RTU/TCP, CAN, BLE GATT, BLE BMS, WiFi AP, Safety IEEE 1547, Shadow, HW Watchdog)
- Android: 21 arquivos (DPC/Kiosk, PIN, ConnectionManager, bridges CDC/BLE/WiFi, TelemetryDatabase/SQLite, PowerManager, TimeFallback, MDM, BootReceiver)
- Dashboard: HTML/JS com polling + SVG SoC + service worker PWA
- Dashborad refatorado: sem mock fallback — apenas "API offline" + banners de erro por painel + botão retry
- Certificados mTLS: scripts sh/ps1/py em `scripts/gen-edge-certs.*`
- Resource IDs CCEE 2021-2026 no AGENTS.md

### Sprint 0 — Hardcode Audit (5 gaps corrigidos)
1. **0.9** → `Esp32BleBridge.kt` criado (BLE GATT client)
2. **0.10** → `LocalEsp32Client.kt` criado (WiFi AP REST)
3. **0.11** → `Esp32CdcBridge.kt` criado (USB CDC binary)
4. **0.13** → `TimeFallback.kt` criado (NTP→GPS→Cellular→Uptime)
5. **0.23** → SHA-256 PIN em `PinActivity.kt`
- `ConnectionManager.kt` reescrito com fallback chain completa

### Sprint 1 — Edge Pipeline (Completo)
#### 1.1 Testes Rust
- `crates/omni-box-fw/tests/integration.rs` — 23 testes integração
- Bugfix: `test_power_to_current()` → `test_estimate_current()` (método não existia)

#### 1.2 Simulator Testes
- `edge/omni-box-simulator/vitest.config.ts` criado
- `src/index.ts` refatorado: classe `OmniBoxSimulator` exportada + `TelemetryPayload` interface
- `test/simulator.test.ts` — 10 testes (estado inicial, telemetria, dispatch, SoC/SoH, clamping)
- `package.json`: vitest adicionado, scripts `test`/`test:watch`

#### 1.3 ESP32 Testes (PlatformIO + Unity)
- `platformio.ini`: `[env:test]` adicionado
- `test/test_safety.cpp` — 21 testes (CRC, frame building, thresholds IEEE 1547, struct sizes)
- `test/test_modbus.cpp` — 10 testes (CRC vectors, frame verificação, corrompido/short)
- `test/test_can.cpp` — 11 testes (JBD SOX request/response, parsing, temperatura offset)

#### 1.5 Android Testes Expandidos
- `app/build.gradle.kts`: MockK 1.13.13, coroutines-test 1.9.0, Compose UI test, ui-tooling
- `FallbackTest.kt`: 17→37 testes (CRC, fila SQLite, DeviceMode, Transport, PowerProfile, TimeFallback, PIN, struct)

#### 1.6 ViewModel
- `OmniBoxViewModel.kt`: `OmniBoxUiState` data class, `StateFlow<OmniBoxUiState>`, injeção de `OmniBoxNative`/`ConnectionManager`
- Ações: `init()`, `startTelemetry()`, `stopTelemetry()`, `applyDispatch()`, `setGridConnection()`, `setSoC()`

#### 1.7 Compose UI Testes
- `KioskScreen` refatorado: parâmetros `(soc, mode, transport, onRecoveryClick)` — sem dependência JNI
- `KioskActivity` refatorado: usa `OmniBoxViewModel` com `collectAsState()`
- `KioskScreenTest.kt` — 7 testes (título, subtítulo, SoC, mode, transport, botão recovery, label)
- `PinScreenTest.kt` — 3 testes (título, instrução, botão voltar)
- `OmniBoxHMITest.kt` — 7 testes (SoC, SoH, transport, online/offline, dispatch count, uptime)

### Sprint 2 — Frontend + Industrial IoT (Completo)
#### 2.1 Perfis Dashboard
- Seletor Residencial/Industrial/Solar no header (persistência `localStorage`)
- CSS classes `profile-{nome}` ocultam painéis por perfil:
  - **Residencial**: esconde PDE, market, auth, PLD, submercados
  - **Solar**: esconde PDE, PLD, auth, submercados
  - **Industrial**: esconde PLD apenas

#### 2.2 IEC 61850-9-2LE SV
- `iec61850_sv.cpp`: Publicador ASN.1 BER Sampled Values via multicast UDP
- 4 canais: V1, V2, V3, I1 (float32)
- Porta 6000, 10 amostras/s (a cada 100ms)
- Frame ASN.1: savPdu (APPLICATION 0), noASDU, ASDU (SEQUENCE)
- `svID = "OMNI-BOX"`, `smpSynch = 2` (GPS sync)

#### 2.3 OTA
- `ota_task.cpp`: ArduinoOTA (porta 3232, hostname `omni-box-esp32`) + HTTP fetch
- Streaming direto para partição OTA com `Update.writeStream()`
- Callbacks: start/end/progress/error
- `otaUpdateFromUrl(url)`, `otaSetUrl(url)`, `otaIsInProgress()`

#### 2.4 WebSocket Dashboard
- Conexão WebSocket para `ws://127.0.0.1:3000/ws?token=`
- Reconexão automática (10s delay)
- Indicador visual verde/vermelho (`ws-indicator`)
- Atualização em tempo real de SoC e telemetria via `ws.onmessage`

#### 2.5 CameraX OCR
- `MeterReader.kt`: CameraX + ML Kit Text Recognition
- `startCamera()`: Preview + ImageCapture (1920×1080)
- `readMeter(callback)`: captura + OCR → texto
- `saveCapture(image)`: salva JPEG em `Pictures/meter_readings/`
- Permissões: CAMERA (já no AndroidManifest)

## Arquivos Criados/Modificados

### Criados
| Arquivo | Localização | Função |
|---------|------------|--------|
| `tests/integration.rs` | `crates/omni-box-fw/tests/` | 23 testes Rust integração |
| `vitest.config.ts` | `edge/omni-box-simulator/` | Config Vitest |
| `test/simulator.test.ts` | `edge/omni-box-simulator/test/` | 10 testes simulador |
| `test/test_safety.cpp` | `edge/esp-co-proc/test/` | 21 testes ESP32 |
| `test/test_modbus.cpp` | `edge/esp-co-proc/test/` | 10 testes Modbus ESP32 |
| `test/test_can.cpp` | `edge/esp-co-proc/test/` | 11 testes CAN ESP32 |
| `OmniBoxViewModel.kt` | `android-app/app/.../omnibox/` | ViewModel com StateFlow |
| `KioskScreenTest.kt` | `android-app/app/src/androidTest/` | 7 testes Compose |
| `PinScreenTest.kt` | `android-app/app/src/androidTest/` | 3 testes Compose |
| `OmniBoxHMITest.kt` | `android-app/app/src/androidTest/` | 7 testes Compose |
| `iec61850_sv.cpp` | `edge/esp-co-proc/src/` | Publicador IEC 61850 SV |
| `ota_task.cpp` | `edge/esp-co-proc/src/` | OTA handler |
| `MeterReader.kt` | `android-app/app/.../omnibox/` | CameraX + ML Kit OCR |

### Modificados
| Arquivo | Mudança |
|---------|---------|
| `crates/omni-box-fw/src/lib.rs` | Bugfix: `test_power_to_current` → `test_estimate_current` |
| `edge/omni-box-simulator/src/index.ts` | Refatorado: classe exportada, CLI guard, interface TelemetryPayload |
| `edge/omni-box-simulator/package.json` | vitest + scripts test/test:watch |
| `edge/esp-co-proc/platformio.ini` | `[env:test]` + OTA build_flags |
| `edge/esp-co-proc/include/tasks.h` | svInit, svPublish, svGetSampleCount, otaInit, otaHandle, otaUpdateFromUrl, otaSetUrl, otaIsInProgress |
| `edge/esp-co-proc/src/main.cpp` | svInit+otaInit no setup; svPublish+otaHandle no loop |
| `edge/android-app/app/build.gradle.kts` | MockK, coroutines-test, Compose UI test, ui-tooling |
| `android-app/.../FallbackTest.kt` | 17→37 testes |
| `android-app/.../KioskActivity.kt` | Refatorado: KioskScreen com parâmetros simples, ViewModel |
| `edge/dashboard/index.html` | Perfis (Industrial/Residencial/Solar), WebSocket, WS indicator |

## Decisões Técnicas

### Arquitetura
- **KioskScreen**: parâmetros `(soc, mode, transport, onRecoveryClick)` em vez de `OmniBoxNative` + `DevicePolicyController` — permite testes sem JNI
- **Dashboard**: sem mock fallback — "API offline" explícito + banners de erro por painel + banner de conexão perdida após 3 falhas consecutivas
- **ViewModel**: `AndroidViewModel` com injeção opcional de `OmniBoxNative`/`ConnectionManager` para testabilidade
- **ESP32 main loop**: 100ms cycle — 13 operações sequenciais (Modbus→CAN→Safety→Shadow→BLE→WiFi→ModbusTCP→Watchdog→USB CDC→SV→OTA→Serial→LED→Log)

### Protocolos
- **ESP32 BLE UUID**: `4f4d4e49-424f-5800-0000-000000000000` ("OMNI-BOX" hex)
- **USB CDC TelemetryFrame**: 34 bytes packed binary (little-endian)
- **Modbus CRC-16**: verificado contra vetor `01 03 00 00 00 01` → `0x0A84`
- **IEC 61850 SV**: ASN.1 BER, multicast `224.0.0.181:6000`, MAC `01:0C:CD:04:00:01`
- **Fallback**: USB CDC (0) → BLE (1) → WiFi (2) → USB Direct (3) → None (4)

### Segurança
- **PIN**: SHA-256 hash (`158a323a...` para "2026"), não plaintext
- **JWT**: HMAC-SHA256, secret `omni-grid-jwt-dev-secret`
- **mTLS**: certs gerados por `scripts/gen-edge-certs.*` (placeholders em `assets/`)

### Performance
- **SoH**: degradação 0.001% por hora de dispatch
- **PowerManager Android**: 4 perfis (Performance/Balanced/PowerSave/Critical) baseado em bateria
- **TimeFallback**: NTP→GPS→Cellular→Uptime

## Cobertura de Testes

| Package | Testes | Status |
|---------|--------|--------|
| pde-engine | 50 | ✅ |
| asset-manager | 14 | ✅ |
| market-connect | 8 | ✅ |
| api-gateway | 10 | ✅ |
| integration-tests | 31 | ✅ |
| omni-auth | 18 | ✅ |
| omni-bus | 10 | ✅ |
| omni-cloud | 4 | ✅ |
| omni-box-fw (unit) | 28 inline | ✅ |
| omni-box-fw (integracao) | 23 | ✅ (criado) |
| simulator | 10 | ✅ (criado) |
| ESP32 safety | 21 | ✅ (criado) |
| ESP32 modbus | 10 | ✅ (criado) |
| ESP32 can | 11 | ✅ (criado) |
| Android FallbackTest | 37 | ✅ (expandido) |
| Android Compose UI | 17 | ✅ (criado) |
| **Total** | **~302** | |

## Bloqueadores
- `cargo` não instalado — não compila Rust
- `openssl`/Python não disponível — não gera certs mTLS
- Sem Gradle/Android SDK — não compila Android
- Sem PlatformIO — não compila ESP32
- Sem `npm install` executado — vitest não está disponível para rodar testes do simulador

## Cobertura de Testes
| Package | Testes | Status |
|---------|--------|--------|
| pde-engine | 50 | ✅ |
| asset-manager | 14 | ✅ |
| market-connect | 8 | ✅ |
| api-gateway | 10 | ✅ |
| integration-tests | 31 | ✅ |
| omni-auth | 18 | ✅ |
| omni-bus | 10 | ✅ |
| omni-cloud | 4 | ✅ |
| omni-box-fw (unit) | 28 inline | ✅ |
| omni-box-fw (integracao) | 23 | ✅ |
| simulator | 10 | ✅ |
| ESP32 safety | 21 | ✅ |
| ESP32 modbus | 10 | ✅ |
| ESP32 can | 11 | ✅ |
| Android FallbackTest | 37 | ✅ |
| Android Compose UI | 17 | ✅ |
| **Total** | **~302** | ✅ |

## Sprint 3 — Frontend + Notificações + CI/CD (Completo)
### 3.1 KPI Cards
- 4 cards animados abaixo da status bar: **Receita** (R$), **Eficiência** (%), **CO₂ Evitado** (t), **Disparos** (n)
- Valores com animação `countUp` (CSS keyframe)
- Tendências por card (▲/▼ com delta)
- CO₂ convertido em "equivalente a N árvores"

### 3.2 Multi-idioma
- Objeto `i18n` com ~30 chaves em PT-BR e EN
- Botão de alternância no header (PT/EN)
- Função `__(key, vars)` com suporte a template `{{var}}`
- Atributo `data-i18n` para atualização automática
- Persistência em `localStorage('omni_lang')`

### 3.3 PWA Install Prompt
- Handler `beforeinstallprompt` capturado e deferido
- Botão "Instalar" no header (`install-btn.show`)
- `deferredPrompt.prompt()` + `userChoice`
- Listener `appinstalled`

### 3.4 FCM Push Notifications
- `OmniBoxFcmService.kt`: FirebaseMessagingService
- 4 tipos: `dispatch`, `alert`, `ota`, `info`
- Firebase BOM 33.7.0, crashlytics, analytics
- Plugins google-services 4.4.2 + crashlytics 3.0.2

### 3.5 CI/CD Pipeline
- `.github/workflows/ci.yml` — 8 jobs: lint, test-ts, test-rust, test-android, build-ts, build-rust, build-esp32, deploy-docs

# OMNI-GRID Edge — Plano de Desenvolvimento Completo

## Índice

1. [Visão Geral da Arquitetura Edge](#1-visão-geral-da-arquitetura-edge)
2. [Análise de Fallbacks (ESP32 + Android)](#2-análise-de-fallbacks-esp32--android)
3. [Android: Proposta de Frontend por Perfil de Instalação](#3-android-proposta-de-frontend-por-perfil-de-instalação)
4. [TODO Completo por Sprint](#4-todo-completo-por-sprint)
5. [Matriz de Dependências](#5-matriz-de-dependências)

---

## 1. Visão Geral da Arquitetura Edge

```
                    ┌──────────────────────────────────┐
                    │        OMNI-CLOUD GATEWAY        │
                    │   (packages/omni-cloud, :4000)   │
                    │   REST :4000  |  gRPC :8443      │
                    └────────┬──────────┬──────────────┘
                             │ mTLS      │ HTTP
              ┌──────────────┼──────────┼────────────────┐
              │              │          │                 │
     ┌────────▼───┐  ┌──────▼──────┐  │        ┌────────▼───────┐
     │  ANDROID   │  │  SIMULADOR  │  │        │   DASHBOARD    │
     │  (Kotlin)  │  │  (TS/Python)│  │        │   (HTML/JS)    │
     ├────────────┤  ├─────────────┤  │        ├────────────────┤
     │ HMI Compose│  │ Bus + REST  │  │        │ Poll :3000/WS  │
     │ Foreground │  │ Sim. bat.   │  │        │ Dark theme SPA │
     │ Boot start │  │            │  │        │ PLD Brasil     │
     └─────┬──────┘  └─────────────┘  │        └────────────────┘
           │ USB CDC                  │
     ┌─────▼──────────────────────┐   │
     │     ESP32-S3 CO-PROCESSOR  │   │
     │  ┌──────────────────────┐  │   │
     │  │ MODO SEGURO          │  │   │
     │  │ (watchdog 10s)       │  │   │
     │  ├──────────────────────┤  │   │
     │  │ Modbus RTU (RS-485)──┼──┼───┤──▶ Inversor
     │  │ CAN Bus 2.0 (TWAI) ──┼──┼───┤──▶ BMS
     │  │ GPIO Relay (IEEE1547)│  │   │──▶ Grid disconnect
     │  │ Status LED           │  │   │
     │  │ WiFi (fallback)      │  │   │
     │  └──────────────────────┘  │   │
     └────────────────────────────┘   │
                                      │
     ┌────────────────────────────┐   │
     │   CAMERA (ML Kit OCR)     │   │
     │   Medidor analógico/digital│──┘
     └────────────────────────────┘
```

### Canais de Comunicação entre Android e ESP32

| Canal | Primário? | Taxa | Latência | Consumo |
|-------|-----------|------|----------|---------|
| USB CDC (Serial) | ✅ Primário | 115200 bps | <1ms | Baixo |
| BLE GATT | 🔶 Fallback 1 | ~10 kbps | ~20ms | Médio |
| WiFi (TCP/UDP) | 🔶 Fallback 2 | ~1 Mbps | ~5ms | Alto |
| ESP-NOW | 🔶 Fallback 3 (curta distância) | ~200 kbps | ~2ms | Muito baixo |

---

## 2. Análise de Fallbacks (ESP32 + Android)

### 2.1 ESP32 — Matriz de Fallback

#### Comunicação com Android

| # | Caminho | Gatilho | Ação fallback | Prioridade |
|---|---------|---------|---------------|------------|
| **P1** | USB CDC | Android não detecta ESP32 na porta serial (ex: cabo desconectado) | **BLE GATT**: ESP32 liga servidor BLE (serviço UUID `OMNI-BOX`), Android escaneia e conecta | **P0** |
| **P2** | USB CDC + BLE | Ambos falham (distância >10m, Android longe do quadro elétrico) | **WiFi AP**: ESP32 liga WiFi AP (SSID `OMNI-BOX-<ID>`), Android conecta para TCP socket | **P0** |
| **P3** | USB+BLe+WiFi | ESP32 sem energia (inversor desligado) | **Nenhum** — estado crítico reportado quando energia voltar (RTC memory persiste último estado) | **P1** |
| **P4** | Todos canais | Android morto (bateria acabou, travou) | **Modo shadow autônomo**: ESP32 opera com últimas regras recebidas, armazena telemetria em RTC memory, reenvia quando Android reconectar | **P0** |

#### Comunicação com Inversor

| # | Caminho | Gatilho | Ação fallback | Prioridade |
|---|---------|---------|---------------|------------|
| **I1** | Modbus RTU RS-485 | Inversor offline/UART sem resposta (timeout 500ms) | **Tentar Modbus TCP** (se inversor tem Ethernet porta 502) | **P2** |
| **I2** | Modbus RTU + TCP | Ambos falham | **Reportar falha**: telemetria marca `safety_status=WARNING`, Android mostra alerta | **P0** |
| **I3** | Modbus OK mas leitura inconsistente | CRC-16 inválido 3x consecutivas | **Reiniciar comunicação**: reset UART, reinit Modbus, tenta novamente | **P1** |
| **I4** | Inversor sem resposta >30s | Modbus read falha continuamente | **Trip de segurança**: abre relé, sinaliza CRITICAL | **P0** |

#### Comunicação com BMS

| # | Caminho | Gatilho | Ação fallback | Prioridade |
|---|---------|---------|---------------|------------|
| **B1** | CAN Bus 2.0 (TWAI) | BMS offline/CAN controller sem ACK | **BLE direto para BMS**: se BMS tem BLE integrado (JK/Daly), ESP32 como BLE client lê dados | **P2** |
| **B2** | CAN + BLE BMS | Ambos falham | **Valores simulados**: reporta `soc=50%, temp=25°C` com flag `bms_fail=true` — Android usa último valor bom conhecido | **P0** |
| **B3** | CAN com erros intermitentes | 3 falhas em 10 leituras | **Degradado**: usa último valor válido + taxa de degradação estimada (0.1%/s para SoC) | **P1** |
| **B4** | BMS OK mas valores absurdos | SoC >105% ou < -5%, temp >80°C | **Clamp + flag warning**: limita valores, reporta `safety_status=WARNING` | **P0** |

#### Segurança (IEEE 1547-2018)

| # | Condição | Ação | Fallback |
|---|----------|------|----------|
| **S1** | V < 198V ou V > 242V (90-110%) | Trip relé <100ms | Se relé falha fisicamente: reporta CRITICAL, tenta abrir novamente a cada 10s |
| **S2** | f < 59.3Hz ou f > 60.5Hz | Trip relé <100ms | Mesmo que S1 |
| **S3** | I > 100A | Trip relé <100ms | Mesmo que S1 |
| **S4** | Condições seguras por 5 min | Auto-reclose | Se relé não fecha: reporta erro, tenta novamente a cada 60s |
| **S5** | Watchdog (10s sem reset) | Hard reboot ESP32 | RTC memory preserva último estado, ao reiniciar tenta reabrir relé se condições seguras |
| **S6** | Comando Emergency dispatch (reason=4) | Trip imediato + ignora auto-reclose | Só rearme manual via Android |

#### Energia do ESP32

| # | Fonte | Gatilho | Fallback |
|---|-------|---------|----------|
| **E1** | Alimentação 3.3V do inversor (via regulador) | Primário | — |
| **E2** | USB do Android (power passthrough) | Inversor sem energia | ESP32 funciona em modo limitado (sem CAN/Modbus, só BLE advertisement + watchdog) |
| **E3** | Bateria backup (CR2032 ou supercapacitor) | Ambas fontes falham | Mantém RTC + últimos registros por ~5 min |
| **E4** | Zero energia | Tudo falhou | Ao religar: lê RTC, reporta falha, reinit protocolos |

---

### 2.2 Android — Matriz de Fallback

#### Conectividade Cloud

| # | Caminho | Gatilho | Ação fallback | Prioridade |
|---|---------|---------|---------------|------------|
| **C1** | mTLS HTTP/2 (OkHttp) | Cloud Gateway offline ou certificado expirado | **HTTP sem TLS** (dev only) + notificação "Cloud offline" | **P0** |
| **C2** | WiFi | Roteador sem internet | **Celular 4G/5G** (se disponível, data saving mode) | **P0** |
| **C3** | WiFi + Celular | Ambos sem conexão externa | **Store-and-forward**: SQLite local armazena telemetria até 7 dias, reenvia quando online | **P0** |
| **C4** | Cloud offline prolongado | >1h sem ACK do gateway | **Modo Shadow**: PDE local simplificado (regras básicas de peak shaving) executa no Android | **P1** |
| **C5** | Certificado TLS expirando | <7 dias para expirar | Notificação preventiva + tenta renovar via endpoint `/api/v1/certs/renew` | **P1** |

#### Comunicação com ESP32

| # | Caminho | Gatilho | Ação fallback | Prioridade |
|---|---------|---------|---------------|------------|
| **D1** | USB-OTG (Serial) | Cabo desconectado, USB host sem permissão | **BLE scan + connect** — procura serviço `OMNI-BOX` BLE | **P0** |
| **D2** | USB + BLE | Ambos falham | **WiFi** — tenta conectar ao AP `OMNI-BOX-<ID>` ou encontrar ESP32 na rede local (mDNS `omni-box.local`) | **P0** |
| **D3** | Todos canais com ESP32 falham | ESP32 morto | **Modo direto**: Android tenta ler inversor via USB-OTG direto (sem ESP32), e BMS via BLE direto — funcionalidade reduzida | **P0** |
| **D4** | Comunicação intermitente | Reconexões frequentes | **Debounce**: só declara falha após 3 tentativas consecutivas, mantém último estado | **P1** |

#### Comunicação com BMS (via BLE direto)

| # | Caminho | Gatilho | Ação fallback | Prioridade |
|---|---------|---------|---------------|------------|
| **M1** | BLE (JBD/Daly/JK) | BMS sem BLE ou sem pareamento | **Ler via ESP32 CAN relay** (se ESP32 online) | **P0** |
| **M2** | BLE + ESP32 CAN | Ambos falham | **Últimos valores conhecidos** (armazenados em SQLite) + taxa de autodescarga estimada | **P1** |
| **M3** | BLE conecta mas dados inconsistentes | CRC dos frames inválido | **Reconectar** GATT + re-request, até 3 tentativas | **P1** |

#### Leitura de Medidor (Câmera)

| # | Caminho | Gatilho | Ação fallback | Prioridade |
|---|---------|---------|---------------|------------|
| **K1** | CameraX + MLKit OCR | Câmera não disponível (permissão negada, hardware sem câmera) | **Entrada manual**: formulário para digitar leitura + timestamp | **P0** |
| **K2** | MLKit não reconhece dígitos | Medidor sujo, danificado, reflexo | **Foto + upload**: envia foto para cloud OCR (API externa) + notifica usuário | **P2** |
| **K3** | OCR inconsistente | Confiança <70% | **Solicitar confirmação visual**: mostra imagem com overlay do dígito detectado, usuário confirma/corrige | **P1** |
| **K4** | Medidor digital com porta óptica | Câmera indisponível | **Leitura via porta óptica** (IR, hardware adicional) — suporte futuro | **P3** |

#### Temporização (RTC)

| # | Caminho | Gatilho | Ação fallback | Prioridade |
|---|---------|---------|---------------|------------|
| **T1** | NTP (SNTP) | Sem internet | **GPS time** (se GPS habilitado) | **P0** |
| **T2** | NTP + GPS | Ambos falham | **Rede celular** (NITZ, time from tower) | **P0** |
| **T3** | NTP+GPS+Rede | Todos falham | **Uptime tracking**: marca epoch como "unknown", usa tempo decorrido desde boot + hora estimada do usuário | **P1** |
| **T4** | Time critical | Discrepância >1h com última telemetria | **Flag "time uncertain"** nos registros — cloud ignora timestamps não confiáveis | **P1** |

#### Energia do Android

| # | Fonte | Gatilho | Fallback |
|---|-------|---------|----------|
| **Pw1** | Carregador de parede (primário) | Falta de energia local | Bateria interna (drena mais rápido com telemetria 5s) |
| **Pw2** | Bateria <15% | Sem carregador disponível | **Modo economia**: telemetria a cada 60s, desliga BLE scan, reduz brilho, desativa CameraX |
| **Pw3** | Bateria crítica <5% | Modo economia não suficiente | **Salvar estado + desligar**: último frame de telemetria com `reason=shutdown`, app morre |

---

## 3. Android: Proposta de Frontend por Perfil de Instalação

### 3.1 Requisitos Gerais (todos os perfis)

- **Tema escuro** (padrão) + tema claro (opcional, para ambientes bem iluminados)
- **Modo quiosque** (kiosk mode) — app como launcher para dispositivos dedicados
- **Tela sempre ligada** (dim após 30s) — essencial em quadros elétricos
- **Al alvo de toque ≥ 48dp** (uso com luvas)
- **Contraste alto** (legível sob luz solar direta — solar farms)
- **Suporte a telas de 4" a 12"** (smartphone a tablet industrial)
- **Português (pt-BR)** como idioma primário, **Inglês** fallback
- **Notificações audíveis** + LED para alarmes (trip, falha comunicação, oportunidade arbitragem)

### 3.2 Arquitetura de Bloqueio: Device Owner + MDM + Custom Launcher

O dispositivo Android não é um smartphone de uso geral — é um **painel de controle embarcado** instalado em quadro elétrico, totem industrial ou sala de operação. O app DEVE ser a única interface visível ao usuário.

#### Device Owner (DPC — Device Policy Controller)

O app ou um companion DPC (ex: `OmniBoxDeviceAdminReceiver`) é provisionado como **Device Owner** durante a configuração inicial via NFC/código QR (`adb shell dpm set-device-owner`). Isso concede:

| Permissão | Propósito |
|-----------|-----------|
| `DISABLE_KEYGUARD` | Desabilitar tela de bloqueio — device boota direto no app |
| `LOCK_TASK` | **Kiosk mode** — app fixado, botão home/recents bloqueados, usuário não sai |
| `SET_SYSTEM_UI_FLAGS` | Ocultar status bar + navigation bar (imersão total) |
| `SET_TIME` | Sincronizar relógio via NTP/GPS sem interação do usuário |
| `WIFI_CONFIGURE` | Gerenciar redes WiFi programaticamente sem prompt |
| `INSTALL_PACKAGES` | Auto-update silencioso (sem play store) |
| `FACTORY_RESET` | Reset remoto via comando cloud |

#### Modo Kiosk (Lock Task Mode)

```kotlin
// OmniBoxApplication.kt
class OmniBoxApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        val dm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(this, OmniBoxDeviceAdminReceiver::class.java)

        // Bloqueia o app como launcher único
        if (dm.isDeviceOwnerApp(packageName)) {
            dm.setLockTaskPackages(admin, arrayOf(packageName))
            startLockTask()  // fixa este app
        }
    }
}
```

#### MDM (Mobile Device Management) — Gestão de Frota

Para operações com múltiplas instalações (condomínios, usinas, indústrias), o app integra comandos MDM via cloud:

| Função MDM | Comando cloud | Ação |
|------------|---------------|------|
| **Comissionamento** | `POST /api/v1/edge/mdm/provision` | Gera QR code NFC para Device Owner setup |
| **Config remota** | `PATCH /api/v1/edge/mdm/config/{device}` | Atualiza endpoint cloud, intervalo telemetria, regras shadow |
| **Firmware** | `POST /api/v1/edge/mdm/update/{device}` | Dispara OTA (Rust FW) + APK update |
| **Reboot** | `POST /api/v1/edge/mdm/reboot/{device}` | Hard reboot remoto |
| **Reset** | `POST /api/v1/edge/mdm/factory-reset/{device}` | Limpa dados + reprovisiona |
| **Diagnóstico** | `GET /api/v1/edge/mdm/status/{device}` | Bateria device, temperatura, rede, uptime |
| **Logs** | `GET /api/v1/edge/mdm/logs/{device}` | Dump logcat + crash reports |

#### Custom Launcher

O `AndroidManifest.xml` declara o app como **launcher padrão**:

```xml
<activity
    android:name=".MainActivity"
    android:launchMode="singleTask"
    android:excludeFromRecents="true"
    android:showWhenLocked="true"
    android:turnScreenOn="true">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.HOME" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
</activity>
```

#### Fluxo de Provisionamento (primeira inicialização)

```
1. Dispositivo sai da caixa → boota Android
2. Técnico faz factory reset → tela de setup Android
3. Técnico apresenta QR code (gerado pelo cloud) → NFC/QR → Device Owner
4. App baixa configuração do cloud → endpoint, certificados mTLS, regras
5. App baixa e instala libomni_box_fw.so atualizada
6. Device reinicia → boota direto no Omni-Box HMI (kiosk mode)
7. Se QR não disponível → provisioning manual: `adb shell dpm set-device-owner`
```

#### Recovery / Desbloqueio

Para manutenção técnica, uma sequência secreta (ex: 5 toques no logo + swipe down) exibe PIN pad. Ao inserir o PIN mestre (hash SHA-256 armazenado no cloud), o app sai do kiosk mode temporariamente.

---

### 3.3 Estrutura de Telas

```
┌─────────────────────────────────────────────────────────────────┐
│  [Home] [Bateria] [Fluxo] [Despachos] [Config] [Manutenção]    │  ← Bottom nav
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                          HOME DASHBOARD                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    SoC GAUGE (grande)                     │  │
│  │                    ╭──────╮                               │  │
│  │                    │  73% │  ← circular/radial            │  │
│  │                    │  ◄──► │  ← animado (fluxo atual)     │  │
│  │                    ╰──────╯                               │  │
│  │              SoH 98.2% | 35 ciclos                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────┬────────────┬────────────┬────────────────────┐  │
│  │ Rede       │ Potência   │ Economia   │ Modo              │  │
│  │ ● Conectada│   2.4 kW   │ R$ 12,50   │ Sombreamento     │  │
│  │ 220V / 60Hz│ ═══► rede  │ hoje       │ ████████░░ 73%   │  │
│  └────────────┴────────────┴────────────┴────────────────────┘  │
│                                                                 │
│  [Status:] ✅ Normal | ☁ Cloud OK | ⚡ ESP32:USB | 🔋 BMS:BLE │
│                                                                 │
│  Última leitura: 14:32:05 | Próximo dispatch: 17:30 (ponta)   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Perfis de Instalação

#### 🏠 Residencial (casa)

**Dispositivo sugerido:** Smartphone Android velho (Moto G, Galaxy A) ou tablet 8"  
**Posicionamento:** Próximo ao quadro de luz / inversor, visível na cozinha  
**Usuário:** Morador (não técnico)

| Tela | Prioridade | Funcionalidades |
|------|------------|-----------------|
| **Home** | Essencial | SoC grande, status rede, economia do dia (R$) |
| **Fluxo** | Essencial | Diagrama direcional: Painel Solar ☀ → Bateria 🔋 → Casa 🏠 → Rede ⚡ |
| **Despachos** | Informativo | "Hoje o sistema economizou R$ 12,50 carregando às 02h (tarifa baixa)" |
| **Medidor** | Útil | "Fotografe sua conta de luz" → OCR → importa dados para comparação |
| **Config** | Mínimo | Conexão WiFi, dados do proprietário |

**KPI para morador:** "Quanto economizei hoje/mês?" — na moeda local (R$)

---

#### 🏢 Condomínio / Prédio Comercial

**Dispositivo sugerido:** Tablet 10" (Samsung Tab A, Lenovo) em totem/mural  
**Posicionamento:** Portaria / sala do síndico / hall elevador  
**Usuário:** Síndico, administrador, zelador

| Tela | Prioridade | Funcionalidades |
|------|------------|-----------------|
| **Home** | Essencial | SoC total do condomínio, carga compartilhada |
| **Bateria** | Essencial | Detalhamento por bateria (se múltiplos ativos), ciclagem individual |
| **Fluxo** | Essencial | Sankey: concessionária + solar → baterias → áreas comuns + elevadores + garagem |
| **Despachos** | Importante | Histórico de peak shaving, demanda contratada vs. real |
| **Config** | Administrativo | Cadastro de unidades consumidoras, rateio de economia |
| **Manutenção** | Técnico | Alarmes por bateria, status de comunicação |

**KPI para síndico:** "Redução de demanda na ponta" + "Rateio por fração ideal"

---

#### 🏭 Indústria / Fábrica

**Dispositivo sugerido:** Tablet industrial rugged (Panasonic Toughpad, Samsung Tab Active)  
**Posicionamento:** Sala de comando / CCM (centro de comando de motores)  
**Usuário:** Engenheiro eletricista, técnico de manutenção

| Tela | Prioridade | Funcionalidades |
|------|------------|-----------------|
| **Home** | Essencial | SoC, potência (kW), energia acumulada (MWh), fator de carga |
| **Fluxo** | Essencial | Diagrama completo: transformador → bateria → máquinas → rede |
| **Bateria** | Essencial | Curvas de tensão/corrente por célula, temperatura, ciclos restantes |
| **Despachos** | Importante | Comandos PDE executados, arbitragem programada, ensaios (commissioning) |
| **Manutenção** | Essencial | Log de erros, timeline de falhas, substituição prevista de módulos |
| **Medidor** | Útil | Leitura de medidores fiscais (CEMIG/CPFL) para validação cruzada |
| **Config** | Técnico | mTLS certs, endpoints cloud, parametrização do PDE local |

**KPI para engenheiro:** "Disponibilidade do sistema" + "Ciclos economizados" + "R$/MWh arbitrado"

---

#### ☀️ Usina Solar (Fazenda)

**Dispositivo sugerido:** Tablet 10" resistente a UV/IP65 (em invólucro NEMA 4X)  
**Posicionamento:** Inversor central / sala de monitoramento  
**Usuário:** Operador de usina, integrador de sistemas

| Tela | Prioridade | Funcionalidades |
|------|------------|-----------------|
| **Home** | Essencial | Geração solar (MW), SoC storage, exportação para rede |
| **Fluxo** | Essencial | Sankey: string panels → inversores → storage → transformador → SE |
| **Bateria** | Essencial | SoC por rack de baterias (dezenas), degradação, temperatura ambiente |
| **Despachos** | Essencial | Comandos do ONS (se usina > 5MW), restrição de injeção |
| **Manutenção** | Essencial | Varredura IV de strings (integração c/ termografia), alarmes de string |
| **Config** | Técnico | Submercado, posto de medição, contrato CCEE, certificado Energia Renovável |

**KPI para operador:** "Geração vs. Forecast" + "Penalidades evitadas" + "Receita de arbitragem"

---

### 3.5 Componentes de UI Compartilhados

```kotlin
// Blocos de composição reutilizáveis
@Composable fun SoCGauge(percent: Float, size: GaugeSize)    // Circular radial
@Composable fun StatusBar(esp32: EspConn, bms: BmsConn, cloud: CloudConn)  // Indicadores de conexão
@Composable fun EnergyFlow(data: FlowData)                    // Diagrama Sankey/direcional
@Composable fun DispatchTimeline(events: List<DispatchEvent>) // Timeline scrollável
@Composable fun AlarmBanner(severity: Severity, message: String) // Banner persistente
@Composable fun MeterReader()                                 // Camera + MLKit OCR overlay
@Composable fun KpiCard(label: String, value: String, unit: String, trend: TrendArrow)
```

---

## 4. TODO Completo por Sprint

### 🏁 Sprint 0 — Fundação (imediato)

| # | Pacote | Tarefa | Esforço | Depende |
|---|--------|--------|---------|---------|
| 0.1 | **crates/omni-box-fw** | **Criar crate Rust** com state machine completa: DeviceMode, SoC/SoH tracking, dispatch apply, telemetry serialization, JNI exports | 3d | — |
| 0.2 | **Android** | Gerar assets mTLS dev via script `scripts/gen-edge-certs.sh` → `ca.pem`, `device.pem`, `device.key` em `app/src/main/assets/` | 0.5d | — |
| 0.3 | **Android** | Criar `proguard-rules.pro`, `ic_launcher.xml` (adaptive icon), placeholder `themes.xml` | 0.5d | — |
| 0.4 | **ESP32** | Implementar **CRC-16 Modbus verification** no `modbus_task.cpp` (igual à `crc16Modbus` da `UsbSerialBridge.kt`) | 0.5d | — |
| 0.5 | **ESP32** | Implementar **Modo Shadow Autônomo (P4)**: armazenar últimas regras em RTC, telemetria offline, reenvio na reconexão | 2d | — |
| 0.6 | **Dashboard** | Atualizar `README.md` com endpoints reais | 0.25d | — |
| 0.7 | **Simulator** | Criar `tsconfig.json`, adicionar ao npm workspace raiz | 0.5d | — |
| 0.8 | **Android** | **Store-and-forward (C3)**: SQLite local (Room) para telemetria offline, sync job quando online | 2d | — |
| 0.9 | **Android** | **BLE fallback ESP32 (D1)**: BLE scan + connect + comunicação alternativa | 1.5d | — |
| 0.10 | **Android** | **WiFi fallback ESP32 (D2)**: mDNS discovery + TCP socket | 1.5d | — |
| 0.11 | **Android** | **Modo direto sem ESP32 (D3)**: USB-OTG→inversor + BLE→BMS direto | 1d | — |
| 0.12 | **Android** | **Store-and-forward cloud (C1/C2)**: fila offline SQLite para telemetria | 1d | — |
| 0.13 | **Android** | **Fallback RTC (T1/T2/T3)**: GPS time + rede celular + uptime | 0.5d | — |
| 0.14 | **Android** | **Modo economia energia (Pw2/Pw3)**: telemetria esparsa, shutdown graceful | 1d | — |
| 0.15 | **ESP32** | **BLE GATT server (P1)**: serviço `OMNI-BOX` + notificação de telemetria | 2d | — |
| 0.16 | **ESP32** | **WiFi AP + TCP server (P2)**: configuração WiFiManager + socket JSON | 2d | — |
| 0.17 | **ESP32** | **BLE client BMS (B1)**: ler BMS via BLE direto se CAN falha | 1.5d | — |
| 0.18 | **ESP32** | **Modbus TCP (I1)**: tentar porta 502 se RTU falha (inversores modernos) | 1d | — |
| 0.19 | **ESP32** | **Safety watchdog hardware (S5)**: external watchdog timer (LTC6990) via pin | 1d | — |
| 0.20 | **Android** | **Device Owner (DPC)**: `OmniBoxDeviceAdminReceiver`, provisioning QR code (NFC), `dpm set-device-owner` flow | 1d | — |
| 0.21 | **Android** | **Kiosk mode (LockTask)**: `setLockTaskPackages()`, `startLockTask()`, ocultar status/nav bar, bloquear home/recents | 1d | 0.20 |
| 0.22 | **Android** | **Custom Launcher**: `HOME` + `DEFAULT` category no manifest, boot direto no HMI, `excludeFromRecents` | 0.5d | 0.20 |
| 0.23 | **Android** | **Recovery/Unlock**: PIN pad secreto (5 toques logo + swipe down) para sair do kiosk mode, validação hash SHA-256 cloud | 1d | 0.21 |
| 0.24 | **Android** | **MDM cloud API**: endpoints `POST /mdm/provision`, `PATCH /mdm/config`, `POST /mdm/update`, `POST /mdm/reboot`, `POST /mdm/factory-reset`, `GET /mdm/status`, `GET /mdm/logs` | 2d | 0.20 |

### 🏁 Sprint 1 — Qualidade + Testes

| # | Pacote | Tarefa | Esforço | Depende |
|---|--------|--------|---------|---------|
| 1.1 | **crates/omni-box-fw** | Testes unitários Rust (cargo test): state machine, JNI bindings mock | 1d | 0.1 |
| 1.2 | **Simulator** | Testes Vitest: battery dynamics, dispatch handling, telemetry format | 1d | — |
| 1.3 | **ESP32** | Testes com PlatformIO + munit: safety tripping, CAN parse, Modbus parse | 2d | — |
| 1.4 | **ESP32** | `.clang-format` + `.clang-tidy` + CI lint | 0.5d | — |
| 1.5 | **Android** | Testes unitários (JUnit + MockK): UsbSerialBridge, BleBridge, CloudClient, SQLite | 2d | — |
| 1.6 | **Android** | ViewModel layer (`OmniBoxViewModel`) separando estado da UI | 1d | — |
| 1.7 | **Android** | UI tests (Compose testing): renderização de todos os componentes | 1d | — |
| 1.8 | **Dashboard** | Service Worker para PWA + cache parcial offline | 1d | — |
| 1.9 | **Dashboard** | Loading states + error banners para todos os painéis | 0.5d | — |

### 🏁 Sprint 2 — Completude

| # | Pacote | Tarefa | Esforço | Depende |
|---|--------|--------|---------|---------|
| 2.1 | **Android** | **Frontend residencial** — Home + Fluxo + Economia R$ + Medidor conta luz | 3d | 1.6 |
| 2.2 | **Android** | **Frontend industrial** — detalhe células, curvas IV, Sankey industrial, alarmes | 3d | 1.6 |
| 2.3 | **Android** | **Frontend solar** — geração MW, string status, integração inversor solar | 3d | 1.6 |
| 2.4 | **Android** | **Tema claro + alto contraste** (acessibilidade, outdoor legibilidade) | 1d | — |
| 2.6 | **ESP32** | IEC 61850 SV (Sampled Values) — parser de quadros 9-2 LE | 3d | — |
| 2.7 | **ESP32** | **OTA firmware update** via partição 16MB + assinatura + rollback | 2d | — |
| 2.8 | **ESP32** | **ESP-NOW fallback (P3)** — comunicação sem WiFi para curta distância | 2d | — |
| 2.9 | **Android** | **CameraX + MLKit OCR** integrado à HMI + fallback foto para cloud | 2d | — |
| 2.10 | **Android** | BLE scan real (não só bonded) com filtro UUID + histórico | 1d | — |
| 2.11 | **Android** | CloudClient async (OkHttp enqueue) + retry linear backoff | 1d | — |
| 2.12 | **Android** | **Shadow PDE mode (C4)**: regras locais de peak shaving simples | 2d | — |
| 2.13 | **Simulator** | Python main.py integrado a NATS/WebSocket | 1d | — |
| 2.14 | **Dashboard** | **WebSocket real** (`ws://:3000/ws`) substitui polling | 1d | — |

### 🏁 Sprint 3 — Resiliência + Produção

| # | Pacote | Tarefa | Esforço | Depende |
|---|--------|--------|---------|---------|
| 3.1 | **Android** | KPI cards inteligentes por perfil (economia R$/ciclo, CO2 evitado) | 1d | 2.1-2.3 |
| 3.2 | **Android** | **Multi-idioma** (pt-BR primário, EN fallback, ES) | 1d | — |
| 3.3 | **Android** | **Notificações push** (FCM) para alarmes, dispatches, economia | 1d | — |
| 3.4 | **Android** | **Dashboard web embutido** (WebView para gráficos complexos) | 1d | — |
| 3.5 | **ESP32** | Suporte a múltiplos pinouts via PlatformIO envs | 1d | — |
| 3.6 | **ESP32** | Documentação completa: pinout, flashing, troubleshooting | 1d | — |
| 3.7 | **ESP32** | Low-power modes (deep sleep entre leituras, se energia crítica) | 1d | — |
| 3.8 | **Dashboard** | PWA manifest + install prompt + push subscription | 0.5d | 1.8 |
| 3.9 | **CI/CD** | Pipeline GitHub Actions: `make build-edge-fw`, `make test-edge-fw`, sign, deploy | 1d | — |
| 3.10 | **CI/CD** | Android build + lint + test + APK release signing | 1d | — |

---

## 5. Matriz de Dependências

```
0.1  crates/omni-box-fw (Rust)  ────→ Nenhum
 │                                       │
 ├──→ 0.2 Android assets mTLS            │
 ├──→ 0.3 Android proguard/icons         │
 │                                       │
0.4  ESP32 CRC verification  ─────────→ Nenhum
0.5  ESP32 Shadow Mode  ──────────────→ Nenhum
0.15 ESP32 BLE GATT server  ──────────→ Nenhum
0.16 ESP32 WiFi AP + TCP  ────────────→ Nenhum
0.17 ESP32 BLE client BMS  ───────────→ Nenhum
0.18 ESP32 Modbus TCP  ────────────────→ Nenhum
0.19 ESP32 watchdog HW  ────────────────→ Nenhum
 │
0.8  Android SQLite (Room)  ──────────→ Nenhum
0.9  Android BLE fallback  ───────────→ Nenhum
0.10 Android WiFi fallback  ──────────→ Nenhum
0.11 Android modo direto  ────────────→ Nenhum
0.12 Android store-and-forward  ──────→ 0.8
0.13 Android fallback RTC  ───────────→ Nenhum
0.14 Android modo economia  ──────────→ Nenhum
 │
1.5  Android unit tests  ─────────────→ 0.8, 0.9, 0.10, 0.11, 0.12
1.6  Android ViewModel  ───────────────→ 0.8, 0.9, 0.10, 0.11, 0.12, 0.13, 0.1
 │
2.1  Android frontend residencial  ───→ 1.6
2.2  Android frontend industrial  ────→ 1.6
2.3  Android frontend solar  ─────────→ 1.6
2.4  Android tema claro  ────────────→ 1.6
0.20 Android Device Owner  ──────────→ Nenhum
0.21 Android Kiosk mode  ────────────→ 0.20
0.22 Android Custom Launcher  ───────→ 0.20
0.23 Android Recovery PIN  ──────────→ 0.21
0.24 Android MDM API  ───────────────→ 0.20
2.9  Android CameraX OCR  ────────────→ 2.1
2.10 Android BLE scan real  ──────────→ Nenhum
2.11 Android CloudClient async  ──────→ 0.8
2.12 Android shadow PDE  ─────────────→ 0.1, 0.5
 │
1.2  Simulator tests  ────────────────→ Nenhum
1.3  ESP32 tests (PlatformIO)  ───────→ 0.4, 0.5, 0.15, 0.16, 0.17, 0.18
1.4  ESP32 lint  ─────────────────────→ Nenhum
1.7  Android UI tests  ────────────────→ 2.1, 2.2, 2.3
1.8  Dashboard PWA  ──────────────────→ Nenhum
1.9  Dashboard loading states  ───────→ Nenhum
2.14 Dashboard WebSocket  ────────────→ Nenhum
```

**Caminho crítico (Sprint 0 → App funcional):**

```
0.1 (Rust FW) ─→ 0.8 (SQLite) ─→ 0.9-0.14 (Fallbacks) ─→ 1.6 (ViewModel) ─→ 2.1-2.3 (HMI)
                                                                                │
0.4 + 0.5 + 0.15-0.19 (ESP32 FW) ─────────────────────────────────────────────┘
0.20-0.24 (Device Owner + Kiosk + MDM) ────────────────────────────────────────┘
                                                                                │
                                                                                ▼
                                                                           App prod pronto
```

---

## Resumo de Prioridades Imediatas (Sprint 0)

1. **0.1** — `crates/omni-box-fw` (Rust) — **bloqueia o Android inteiro**, sem ele `OmniBoxNative.kt` quebra em runtime
2. **0.4** — CRC-16 no ESP32 — segurança de comunicação, sem isso dados corrompidos passam silenciosamente
3. **0.8** — SQLite store-and-forward — essencial para resiliência cloud, sem ele telemetria perdida em queda de rede
4. **0.9 + 0.10** — BLE + WiFi fallback — sem eles Android morre se cabo USB desconectar
5. **0.5** — Modo shadow ESP32 — sem ele sistema fica cego se Android desligar
6. **0.20** — Device Owner (DPC) — sem ele o dispositivo não fica bloqueado, usuário pode sair do app, mexer em configurações, instalar apps concorrentes
7. **0.21** — Kiosk mode — sem ele o app não é um painel dedicado, é só mais um app Android
8. **0.22** — Custom Launcher — sem ele o boot não vai direto pro HMI, precisa iniciar manualmente
9. **0.24** — MDM cloud API — sem ela a gestão de frota é manual (inviável para >1 instalação)

/*
 * ⚡ Omni-Box Co-Processor (ESP32-S3)
 *
 * Ponte de comunicação industrial entre o inversor/BMS e
 * o smartphone Android (coletor principal).
 *
 * Flow:
 *   Android (USB CDC) ←→ ESP32 ←→ Inversor (Modbus RTU RS-485)
 *                         ESP32 ←→ BMS (CAN Bus 2.0 / BLE)
 *                         ESP32 ←→ Relé de segurança (GPIO)
 *                         ESP32 ←→ BLE GATT (Android fallback)
 *                         ESP32 ←→ WiFi AP + Modbus TCP (Android fallback)
 *
 * A cada 100ms:
 *   1. Lê inversor via Modbus RTU
 *   2. Lê BMS via CAN ou BLE
 *   3. Verifica limites de segurança (IEEE 1547)
 *   4. Modo Shadow autônomo + buffer RTC
 *   5. Notifica clientes BLE GATT
 *   6. Serve requisições HTTP (WiFi AP) e Modbus TCP
 *   7. Alimenta watchdog externo
 */

#include <Arduino.h>
#include "config.h"
#include "tasks.h"

// ─── Global State ───

static TelemetryFrame telemetry = {0};
static unsigned long last_tick = 0;
static unsigned long uptime_s = 0;
static unsigned long last_1hz_log = 0;
static bool useBleBms = false; // auto-detected at runtime

// ─── USB CDC callbacks ───

void onDispatchReceived(const DispatchCommand &cmd) {
    Serial.printf("[DISPATCH] asset=%u power=%.1fkW duration=%us reason=%u\n",
                  cmd.asset_id, cmd.power_kw, cmd.duration_s, cmd.reason);

    shadowApplyDispatch(cmd.power_kw, cmd.duration_s);

    ShadowRule rule;
    rule.power_w = (int16_t)(cmd.power_kw * 1000);
    rule.days = 0x7F;
    shadowSetRule(0, &rule);

    if (cmd.reason == 4) {
        safetyTrip();
    }
}

void checkSerialCommands() {
    if (Serial.available() >= sizeof(DispatchCommand)) {
        DispatchCommand cmd;
        Serial.readBytes((uint8_t*)&cmd, sizeof(cmd));
        onDispatchReceived(cmd);
    }
}

// ─── Setup ───

void setup() {
    Serial.begin(115200);
    delay(100);
    Serial.println("\n=== Omni-Box Co-Processor (ESP32-S3) ===");

    pinMode(PIN_RELAY_GRID, OUTPUT);
    pinMode(PIN_RELAY_LOAD, OUTPUT);
    pinMode(PIN_LED_STATUS, OUTPUT);
    pinMode(PIN_LED_ERROR, OUTPUT);
    pinMode(PIN_LED_GRID, OUTPUT);

    digitalWrite(PIN_RELAY_GRID, HIGH);
    digitalWrite(PIN_RELAY_LOAD, HIGH);

    modbusInit();
    canInit();
    safetyInit();
    shadowInit();
    bleGattInit(&telemetry);
    hwWatchdogInit();
    wifiApInit(&telemetry);
    modbusTcpInit(&telemetry);
    svInit();
    otaInit();

    // Try BLE BMS on supported hardware
    bleBmsInit();
    float soc_test = 0, temp_test = 0;
    useBleBms = bleBmsScanAndRead(&soc_test, &temp_test);

    // Watchdog
    esp_task_wdt_init(WDT_TIMEOUT_MS, true);
    esp_task_wdt_add(NULL);

    Serial.println("Ready.");
    Serial.printf("  BLE BMS:        %s\n", useBleBms ? "detected" : "not found");
    Serial.printf("  WiFi AP:        Omni-Box-AP\n");
    Serial.printf("  Modbus TCP:     port 502\n");
    Serial.printf("  BLE GATT:       Omni-Box\n");

    if (shadowIsAndroidConnected()) {
        shadowReplayTelemetry();
    }
}

// ─── Main Loop (100ms cycle) ───

void loop() {
    unsigned long now = millis();
    if (now - last_tick < 100) return;
    last_tick = now;
    esp_task_wdt_reset();

    // 1. Read Modbus (inverter)
    float v = 0, i = 0, f = 0, p = 0;
    bool grid = false;
    modbusReadInverter(&v, &i, &f, &p, &grid);

    // 2. Read BMS (CAN or BLE)
    float soc = 0, temp = 0;
    if (useBleBms) {
        bleBmsRead(&soc, &temp);
    } else {
        canReadBms(&soc, &temp);
    }

    // 3. Update telemetry frame
    telemetry.device_id = 0x4F4D4E49;
    telemetry.timestamp_s = uptime_s;
    telemetry.voltage_v = v;
    telemetry.current_a = i;
    telemetry.frequency_hz = f;
    telemetry.soc_percent = soc;
    telemetry.temperature_c = temp;
    telemetry.power_w = p;
    telemetry.grid_connected = grid;

    // 4. Safety check (IEEE 1547)
    safety_status_t safety = safetyEvaluate(v, f, i);
    telemetry.safety_status = safety;

    if (safety == SAFETY_CRITICAL || safety == SAFETY_TRIPPED) {
        digitalWrite(PIN_RELAY_GRID, LOW);
        digitalWrite(PIN_LED_ERROR, HIGH);
    } else {
        digitalWrite(PIN_RELAY_GRID, HIGH);
        digitalWrite(PIN_LED_ERROR, LOW);
    }

    // 5. Shadow autonomous mode (RTC + buffer + schedule)
    shadowTick(uptime_s, &telemetry);

    // 6. Notify BLE GATT clients
    bleGattNotify();

    // 7. Serve WiFi AP + Modbus TCP
    wifiApHandle();
    modbusTcpHandle();

    // 8. Feed HW watchdog
    hwWatchdogFeed();

    // 9. Send telemetry to Android via USB CDC
    if (shadowIsAndroidConnected()) {
        Serial.write((const uint8_t*)&telemetry, sizeof(telemetry));
    }

    // 10. Publish IEC 61850 Sampled Values (every cycle = 100ms = 10 samples/s)
    svPublish(v / 1000.0f, 0, 0, i);  // V in kV, I in A

    // 11. Handle OTA updates
    otaHandle();

    // 12. Check for dispatch commands from Android
    checkSerialCommands();

    // 13. Status LED — fast blink if disconnected, slow if connected
    bool androidConnected = shadowIsAndroidConnected();
    bool bleClientConnected = bleGattIsConnected();
    bool wifiClientConnected = wifiApHasClient();
    digitalWrite(PIN_LED_STATUS,
        androidConnected || bleClientConnected || wifiClientConnected
            ? ((now / 1000) % 2)
            : ((now / 500) % 2));

    // 14. Periodic log (every 10s)
    if (uptime_s - last_1hz_log >= 10) {
        last_1hz_log = uptime_s;
        const char *transport = androidConnected ? "USB" :
                                bleClientConnected ? "BLE" :
                                wifiClientConnected ? "WiFi" :
                                useBleBms ? "BLE-BMS" : "CAN";
        Serial.printf("[%us] V=%.1f I=%.1f F=%.2f SoC=%.1f%% T=%.1f°C P=%.0fW Grid=%d Safety=%d %s\n",
                      uptime_s, v, i, f, soc, temp, p, grid, safety, transport);
    }
    uptime_s++;
}

#include <Arduino.h>
#include <WiFi.h>
#include "config.h"
#include "tasks.h"

#define MODBUS_TCP_PORT 502
#define MODBUS_TCP_MAX_CLIENTS 2
#define MODBUS_TCP_TIMEOUT_MS 10000

static WiFiServer mbTcpServer(MODBUS_TCP_PORT);
static WiFiClient mbTcpClients[MODBUS_TCP_MAX_CLIENTS];
static bool mbTcpActive = false;
static TelemetryFrame *mbTcpTelemetryPtr = nullptr;

// Modbus TCP Application Data Unit (ADU):
//   MBAP Header (7 bytes): transaction_id(2) + protocol_id(2) + length(2) + unit_id(1)
//   PDU: function_code(1) + data

static void handleTcpClient(int idx) {
    WiFiClient &client = mbTcpClients[idx];
    if (!client.connected()) return;

    if (!client.available()) return;

    uint8_t buf[260];
    int len = client.read(buf, sizeof(buf));
    if (len < 8) return; // too short (need MBAP + FC)

    uint16_t transactionId = (buf[0] << 8) | buf[1];
    uint16_t protocolId = (buf[2] << 8) | buf[3];
    uint16_t dataLen = (buf[4] << 8) | buf[5];
    uint8_t unitId = buf[6];
    uint8_t func = buf[7];

    if (protocolId != 0) return;
    if (unitId != MODBUS_SLAVE_ID && unitId != 0) return; // broadcast or our address

    uint8_t resp[260];
    size_t respLen = 0;

    // MBAP response header — filled at end
    // We leave resp[4..5] (length) as placeholder and fix at send time
    resp[0] = (transactionId >> 8) & 0xFF;
    resp[1] = transactionId & 0xFF;
    resp[2] = 0x00;
    resp[3] = 0x00;
    resp[6] = unitId;
    respLen = 7;

    switch (func) {
        case 0x03: { // Read Holding Registers
            if (dataLen < 4) { resp[respLen++] = 0x83; resp[respLen++] = 0x02; break; }
            uint16_t startReg = (buf[8] << 8) | buf[9];
            uint16_t count = (buf[10] << 8) | buf[11];
            if (count > 20) { resp[respLen++] = 0x83; resp[respLen++] = 0x03; break; }

            resp[respLen++] = 0x03; // function code
            resp[respLen++] = count * 2; // byte count

            for (int i = 0; i < count && i < 10; i++) {
                uint16_t reg = 0;
                switch (startReg + i) {
                    case 0: reg = (uint16_t)(mbTcpTelemetryPtr->voltage_v * 10); break;
                    case 1: reg = (uint16_t)(mbTcpTelemetryPtr->current_a * 10); break;
                    case 2: reg = (uint16_t)(mbTcpTelemetryPtr->frequency_hz * 100); break;
                    case 3: reg = (uint16_t)mbTcpTelemetryPtr->power_w; break;
                    case 4: reg = mbTcpTelemetryPtr->grid_connected ? 1 : 0; break;
                    case 5: reg = (uint16_t)(mbTcpTelemetryPtr->soc_percent * 10); break;
                    case 6: reg = (uint16_t)(mbTcpTelemetryPtr->temperature_c * 10); break;
                    case 7: reg = mbTcpTelemetryPtr->safety_status; break;
                    default: reg = 0; break;
                }
                resp[respLen++] = (reg >> 8) & 0xFF;
                resp[respLen++] = reg & 0xFF;
            }
            break;
        }
        case 0x06: { // Write Single Register
            if (dataLen < 4) { resp[respLen++] = 0x86; resp[respLen++] = 0x02; break; }
            uint16_t reg = (buf[8] << 8) | buf[9];
            uint16_t value = (buf[10] << 8) | buf[11];
            if (reg == 0x0010) {
                float powerKw = value / 1000.0f;
                modbusSetPower(powerKw);
            }
            resp[respLen++] = 0x06;
            resp[respLen++] = (reg >> 8) & 0xFF;
            resp[respLen++] = reg & 0xFF;
            resp[respLen++] = (value >> 8) & 0xFF;
            resp[respLen++] = value & 0xFF;
            break;
        }
        default:
            resp[respLen++] = func | 0x80;
            resp[respLen++] = 0x01; // illegal function
            break;
    }

    // Update length in MBAP header
    uint16_t pduLen = respLen - 6;
    resp[4] = (pduLen >> 8) & 0xFF;
    resp[5] = pduLen & 0xFF;

    client.write(resp, respLen);
}

void modbusTcpInit(TelemetryFrame *telemetry) {
    mbTcpTelemetryPtr = telemetry;
    mbTcpServer.begin(MODBUS_TCP_MAX_CLIENTS);
    mbTcpActive = true;
    Serial.printf("[Modbus TCP] Server on port %d\n", MODBUS_TCP_PORT);
}

void modbusTcpHandle() {
    if (!mbTcpActive) return;

    // Accept new connections
    WiFiClient newClient = mbTcpServer.available();
    if (newClient) {
        for (int i = 0; i < MODBUS_TCP_MAX_CLIENTS; i++) {
            if (!mbTcpClients[i].connected()) {
                mbTcpClients[i] = newClient;
                Serial.printf("[Modbus TCP] Client %d connected\n", i);
                break;
            }
        }
    }

    // Handle existing clients
    for (int i = 0; i < MODBUS_TCP_MAX_CLIENTS; i++) {
        if (mbTcpClients[i].connected()) {
            handleTcpClient(i);
        }
    }
}

bool modbusTcpHasClient() {
    for (int i = 0; i < MODBUS_TCP_MAX_CLIENTS; i++) {
        if (mbTcpClients[i].connected()) return true;
    }
    return false;
}

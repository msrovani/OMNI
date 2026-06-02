/*
 * Modbus RTU Master (RS-485) — Inversor de frequência
 *
 * Protocolo: Modbus RTU via UART1 com MAX3485 (RS-485 half-duplex)
 *
 * Registradores do inversor (mapa típico):
 *   0x0000: Tensão CC (V)
 *   0x0001: Corrente CA (A)
 *   0x0002: Frequência (Hz)
 *   0x0003: Potência ativa (W)
 *   0x0004: Status da rede (0/1)
 */

#include <Arduino.h>
#include <ModbusRTU.h>
#include "config.h"

static ModbusRTU mb;

// ─── CRC-16 (Modbus) — identical to UsbSerialBridge.crc16Modbus() ───

static uint16_t crc16Modbus(const uint8_t *data, size_t len) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    return crc;
}

// Build a Modbus read request frame (FC03/FC04)
static size_t buildReadFrame(uint8_t *buf, uint8_t slave, uint8_t func,
                             uint16_t reg, uint16_t count) {
    size_t idx = 0;
    buf[idx++] = slave;
    buf[idx++] = func;
    buf[idx++] = (reg >> 8) & 0xFF;
    buf[idx++] = reg & 0xFF;
    buf[idx++] = (count >> 8) & 0xFF;
    buf[idx++] = count & 0xFF;
    uint16_t crc = crc16Modbus(buf, idx);
    buf[idx++] = crc & 0xFF;
    buf[idx++] = (crc >> 8) & 0xFF;
    return idx;
}

// Build a Modbus write single register frame (FC06)
static size_t buildWriteFrame(uint8_t *buf, uint8_t slave,
                              uint16_t reg, uint16_t value) {
    size_t idx = 0;
    buf[idx++] = slave;
    buf[idx++] = 0x06;
    buf[idx++] = (reg >> 8) & 0xFF;
    buf[idx++] = reg & 0xFF;
    buf[idx++] = (value >> 8) & 0xFF;
    buf[idx++] = value & 0xFF;
    uint16_t crc = crc16Modbus(buf, idx);
    buf[idx++] = crc & 0xFF;
    buf[idx++] = (crc >> 8) & 0xFF;
    return idx;
}

// Verify CRC of a received Modbus frame (excluding the CRC bytes)
static bool verifyModbusFrame(const uint8_t *buf, size_t len) {
    if (len < 4) return false;           // addr + func + 2 CRC
    uint16_t expected = crc16Modbus(buf, len - 2);
    uint16_t received = (uint16_t)buf[len - 1] << 8 | buf[len - 2];
    return expected == received;
}

void modbusInit() {
    Serial1.begin(MODBUS_BAUD, SERIAL_8N1, PIN_MODBUS_RX, PIN_MODBUS_TX);
    mb.begin(&Serial1, PIN_MODBUS_RTS);
    mb.setTimeout(500);
    Serial.println("[Modbus] Initialised (9600 8N1 RS-485)");
}

bool modbusReadInverter(float *voltage, float *current, float *freq, float *power, bool *grid) {
    uint16_t regs[10] = {0};

    // Use library for now; raw-frame fallback via buildModbusFrame + verifyModbusFrame
    // is available for Modbus TCP or manual serial when library unavailable.
    if (!mb.readHoldingRegisters(MODBUS_SLAVE_ID, 0, regs, 10)) {
        Serial.println("[Modbus] Read failed — inverter offline?");
        *grid = false;
        return false;
    }

    *voltage = regs[0] * 0.1f;
    *current = regs[1] * 0.1f;
    *freq    = regs[2] * 0.01f;
    *power   = regs[3] * 1.0f;
    *grid    = (regs[4] != 0);

    return true;
}

void modbusSetPower(float powerKw) {
    uint16_t powerW = (uint16_t)(powerKw * 1000);
    uint8_t frame[8];
    buildWriteFrame(frame, MODBUS_SLAVE_ID, 0x0010, powerW);

    // Send raw frame via Serial1 (bypass library for direct control)
    Serial1.write(frame, sizeof(frame));
    Serial1.flush();

    // Also send via library as fallback
    mb.writeSingleRegister(MODBUS_SLAVE_ID, 0x0010, powerW);
    Serial.printf("[Modbus] Set power to %.1f kW\n", powerKw);
}

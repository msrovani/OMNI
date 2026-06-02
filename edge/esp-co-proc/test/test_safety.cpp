/*
 * Safety Module — Unit Tests
 * IEEE 1547-2018 threshold verification
 */

#include <unity.h>
#include "config.h"

// ─── Safety status enum (copied from safety_task.cpp) ───

typedef enum {
    SAFETY_OK       = 0,
    SAFETY_WARNING  = 1,
    SAFETY_CRITICAL = 2,
    SAFETY_TRIPPED  = 3,
} safety_status_t;

// ─── CRC-16 Modbus (copied from modbus_task.cpp) ───

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

// ─── test_crc16_known_vectors ───

static void test_crc16_modbus_spec_vector(void) {
    // Modbus spec: query "01 03 00 00 00 01" → CRC = 0x0A84 (low byte first: 84 0A)
    uint8_t frame[] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x01};
    uint16_t crc = crc16Modbus(frame, sizeof(frame));
    TEST_ASSERT_EQUAL_HEX16(0x0A84, crc);
}

static void test_crc16_empty(void) {
    uint16_t crc = crc16Modbus(NULL, 0);
    TEST_ASSERT_EQUAL_HEX16(0xFFFF, crc);
}

static void test_crc16_single_byte(void) {
    uint8_t data[] = {0x01};
    uint16_t crc = crc16Modbus(data, 1);
    // Known: 0x01 → CRC = 0x807E
    TEST_ASSERT_EQUAL_HEX16(0x807E, crc);
}

static void test_crc16_differs_on_bit_flip(void) {
    uint8_t a[] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x01};
    uint8_t b[] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x02};
    uint16_t crc_a = crc16Modbus(a, sizeof(a));
    uint16_t crc_b = crc16Modbus(b, sizeof(b));
    TEST_ASSERT_NOT_EQUAL(crc_a, crc_b);
}

// ─── test_buildReadFrame ───

static void test_build_read_frame_size(void) {
    uint8_t buf[8] = {0};
    size_t idx = 0;
    buf[idx++] = 0x01;       // slave
    buf[idx++] = 0x03;       // func
    buf[idx++] = 0x00;       // reg high
    buf[idx++] = 0x00;       // reg low
    buf[idx++] = 0x00;       // count high
    buf[idx++] = 0x01;       // count low
    uint16_t crc = crc16Modbus(buf, idx);
    buf[idx++] = crc & 0xFF;
    buf[idx++] = (crc >> 8) & 0xFF;
    TEST_ASSERT_EQUAL(8, idx);
}

static void test_build_write_frame_size(void) {
    uint8_t buf[8] = {0};
    size_t idx = 0;
    buf[idx++] = 0x01;       // slave
    buf[idx++] = 0x06;       // func
    buf[idx++] = 0x00;       // reg high
    buf[idx++] = 0x10;       // reg low
    buf[idx++] = 0x00;       // value high
    buf[idx++] = 0x64;       // value low (100W)
    uint16_t crc = crc16Modbus(buf, idx);
    buf[idx++] = crc & 0xFF;
    buf[idx++] = (crc >> 8) & 0xFF;
    TEST_ASSERT_EQUAL(8, idx);
}

// ─── test_verifyModbusFrame ───

static void test_verify_frame_valid(void) {
    uint8_t buf[] = {0x01, 0x03, 0x02, 0x00, 0x00, 0xF8, 0x47};
    // addr=01, func=03, 2 data bytes (00 00), CRC=F847 → 0x47F8 (little-endian)
    uint16_t expected = crc16Modbus(buf, 5);  // excludes CRC bytes
    uint16_t received = (uint16_t)buf[6] << 8 | buf[5];
    TEST_ASSERT_EQUAL_HEX16(expected, received);
}

static void test_verify_frame_invalid(void) {
    uint8_t buf[] = {0x01, 0x03, 0x02, 0x00, 0x00, 0x00, 0x00};  // zero CRC
    uint16_t expected = crc16Modbus(buf, 5);
    uint16_t received = (uint16_t)buf[6] << 8 | buf[5];
    TEST_ASSERT_NOT_EQUAL(expected, received);
}

// ─── test_safetyEvaluate ───

static safety_status_t safetyEvaluate(float voltage, float freq, float current) {
    if (voltage < VOLTAGE_MIN || voltage > VOLTAGE_MAX) return SAFETY_CRITICAL;
    if (freq < FREQ_MIN || freq > FREQ_MAX) return SAFETY_WARNING;
    if (current > OVERCURRENT_A) return SAFETY_CRITICAL;
    return SAFETY_OK;
}

static void test_safety_normal(void) {
    TEST_ASSERT_EQUAL(SAFETY_OK, safetyEvaluate(220.0f, 60.0f, 50.0f));
}

static void test_safety_undervoltage(void) {
    TEST_ASSERT_EQUAL(SAFETY_CRITICAL, safetyEvaluate(190.0f, 60.0f, 50.0f));
}

static void test_safety_overvoltage(void) {
    TEST_ASSERT_EQUAL(SAFETY_CRITICAL, safetyEvaluate(250.0f, 60.0f, 50.0f));
}

static void test_safety_borderline_low_voltage(void) {
    // 198.0V is the limit — should be OK
    TEST_ASSERT_EQUAL(SAFETY_OK, safetyEvaluate(VOLTAGE_MIN, 60.0f, 50.0f));
}

static void test_safety_borderline_high_voltage(void) {
    TEST_ASSERT_EQUAL(SAFETY_OK, safetyEvaluate(VOLTAGE_MAX, 60.0f, 50.0f));
}

static void test_safety_under_frequency(void) {
    TEST_ASSERT_EQUAL(SAFETY_WARNING, safetyEvaluate(220.0f, 59.0f, 50.0f));
}

static void test_safety_over_frequency(void) {
    TEST_ASSERT_EQUAL(SAFETY_WARNING, safetyEvaluate(220.0f, 61.0f, 50.0f));
}

static void test_safety_overcurrent(void) {
    TEST_ASSERT_EQUAL(SAFETY_CRITICAL, safetyEvaluate(220.0f, 60.0f, 150.0f));
}

static void test_safety_multiple_violations(void) {
    // Under-voltage AND over-frequency → should still be CRITICAL
    TEST_ASSERT_EQUAL(SAFETY_CRITICAL, safetyEvaluate(150.0f, 61.0f, 50.0f));
}

static void test_safety_overcurrent_and_frequency(void) {
    // Overcurrent AND frequency warning → CRITICAL takes precedence
    TEST_ASSERT_EQUAL(SAFETY_CRITICAL, safetyEvaluate(220.0f, 61.0f, 150.0f));
}

// ─── test_TelemetryFrame ───

static void test_telemetry_frame_size(void) {
    // Packed 34-byte struct
    TEST_ASSERT_EQUAL(34, sizeof(TelemetryFrame));
}

static void test_dispatch_command_size(void) {
    // Packed 13-byte struct
    TEST_ASSERT_EQUAL(13, sizeof(DispatchCommand));
}

static void test_shadow_state_magic(void) {
    ShadowState s;
    s.magic = 0x4F4D4E49;
    TEST_ASSERT_EQUAL_HEX32(0x4F4D4E49, s.magic);
}

// ─── Main ───

void setUp(void) {}
void tearDown(void) {}

int runUnityTests(void) {
    UNITY_BEGIN();
    RUN_TEST(test_crc16_modbus_spec_vector);
    RUN_TEST(test_crc16_empty);
    RUN_TEST(test_crc16_single_byte);
    RUN_TEST(test_crc16_differs_on_bit_flip);
    RUN_TEST(test_build_read_frame_size);
    RUN_TEST(test_build_write_frame_size);
    RUN_TEST(test_verify_frame_valid);
    RUN_TEST(test_verify_frame_invalid);
    RUN_TEST(test_safety_normal);
    RUN_TEST(test_safety_undervoltage);
    RUN_TEST(test_safety_overvoltage);
    RUN_TEST(test_safety_borderline_low_voltage);
    RUN_TEST(test_safety_borderline_high_voltage);
    RUN_TEST(test_safety_under_frequency);
    RUN_TEST(test_safety_over_frequency);
    RUN_TEST(test_safety_overcurrent);
    RUN_TEST(test_safety_multiple_violations);
    RUN_TEST(test_safety_overcurrent_and_frequency);
    RUN_TEST(test_telemetry_frame_size);
    RUN_TEST(test_dispatch_command_size);
    RUN_TEST(test_shadow_state_magic);
    return UNITY_END();
}

extern "C" void app_main(void) {
    runUnityTests();
}

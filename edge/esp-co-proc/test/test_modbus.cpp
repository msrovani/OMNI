/*
 * Modbus Task — Frame Building & CRC Unit Tests
 */

#include <unity.h>
#include "config.h"

// ─── Local CRC-16 implementation (identical to modbus_task.cpp) ───

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

// ─── Frame builders (identical to modbus_task.cpp) ───

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

static bool verifyModbusFrame(const uint8_t *buf, size_t len) {
    if (len < 4) return false;
    uint16_t expected = crc16Modbus(buf, len - 2);
    uint16_t received = (uint16_t)buf[len - 1] << 8 | buf[len - 2];
    return expected == received;
}

// ─── Tests ───

static void test_crc16_spec_vector(void) {
    uint8_t frame[] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x01};
    TEST_ASSERT_EQUAL_HEX16(0x0A84, crc16Modbus(frame, sizeof(frame)));
}

static void test_crc16_all_zeros(void) {
    uint8_t frame[] = {0x00, 0x00, 0x00, 0x00};
    TEST_ASSERT_EQUAL_HEX16(0x800D, crc16Modbus(frame, sizeof(frame)));
}

static void test_crc16_alternating(void) {
    uint8_t frame[] = {0xAA, 0x55, 0xAA, 0x55};
    uint16_t crc = crc16Modbus(frame, sizeof(frame));
    TEST_ASSERT_NOT_EQUAL(0x0000, crc);
    TEST_ASSERT_NOT_EQUAL(0xFFFF, crc);
}

static void test_build_read_frame_valid(void) {
    uint8_t buf[8];
    size_t len = buildReadFrame(buf, 0x01, 0x03, 0x0000, 0x0001);
    TEST_ASSERT_EQUAL(8, len);
    TEST_ASSERT_EQUAL(0x01, buf[0]);  // slave
    TEST_ASSERT_EQUAL(0x03, buf[1]);  // func
    TEST_ASSERT_EQUAL(0x00, buf[2]);  // reg high
    TEST_ASSERT_EQUAL(0x00, buf[3]);  // reg low
    TEST_ASSERT_EQUAL(0x00, buf[4]);  // count high
    TEST_ASSERT_EQUAL(0x01, buf[5]);  // count low
    // CRC in buf[6] and buf[7]
    uint16_t crc = (uint16_t)buf[7] << 8 | buf[6];
    TEST_ASSERT_EQUAL_HEX16(0x0A84, crc);
}

static void test_build_read_frame_different_slave(void) {
    uint8_t buf[8];
    size_t len = buildReadFrame(buf, 0x0A, 0x04, 0x0010, 0x0005);
    TEST_ASSERT_EQUAL(8, len);
    TEST_ASSERT_EQUAL(0x0A, buf[0]);
    TEST_ASSERT_EQUAL(0x04, buf[1]);
    // Verify CRC integrity
    TEST_ASSERT_TRUE(verifyModbusFrame(buf, len));
}

static void test_build_write_frame_valid(void) {
    uint8_t buf[8];
    size_t len = buildWriteFrame(buf, 0x01, 0x0010, 5000);
    TEST_ASSERT_EQUAL(8, len);
    TEST_ASSERT_EQUAL(0x01, buf[0]);
    TEST_ASSERT_EQUAL(0x06, buf[1]);
    TEST_ASSERT_EQUAL(0x00, buf[2]);  // reg high
    TEST_ASSERT_EQUAL(0x10, buf[3]);  // reg low
    TEST_ASSERT_EQUAL(0x13, buf[4]);  // 5000 = 0x1388
    TEST_ASSERT_EQUAL(0x88, buf[5]);
    TEST_ASSERT_TRUE(verifyModbusFrame(buf, len));
}

static void test_verify_valid_frame(void) {
    uint8_t buf[] = {0x01, 0x03, 0x02, 0x00, 0x00, 0xF8, 0x47};
    TEST_ASSERT_TRUE(verifyModbusFrame(buf, sizeof(buf)));
}

static void test_verify_too_short(void) {
    uint8_t buf[] = {0x01, 0x03, 0x00};
    TEST_ASSERT_FALSE(verifyModbusFrame(buf, sizeof(buf)));
}

static void test_verify_corrupted_crc(void) {
    uint8_t buf[] = {0x01, 0x03, 0x02, 0x00, 0x00, 0x00, 0x00};
    TEST_ASSERT_FALSE(verifyModbusFrame(buf, sizeof(buf)));
}

static void test_verify_single_register_response(void) {
    // Response: slave=01, func=03, count=02, data=00 64 (100), CRC=...?
    uint8_t buf[7];
    buf[0] = 0x01;
    buf[1] = 0x03;
    buf[2] = 0x02;       // byte count
    buf[3] = 0x00;       // value high
    buf[4] = 0x64;       // value low (100)
    uint16_t crc = crc16Modbus(buf, 5);
    buf[5] = crc & 0xFF;
    buf[6] = (crc >> 8) & 0xFF;
    TEST_ASSERT_TRUE(verifyModbusFrame(buf, sizeof(buf)));
}

// ─── Main ───

void setUp(void) {}
void tearDown(void) {}

int runUnityTests(void) {
    UNITY_BEGIN();
    RUN_TEST(test_crc16_spec_vector);
    RUN_TEST(test_crc16_all_zeros);
    RUN_TEST(test_crc16_alternating);
    RUN_TEST(test_build_read_frame_valid);
    RUN_TEST(test_build_read_frame_different_slave);
    RUN_TEST(test_build_write_frame_valid);
    RUN_TEST(test_verify_valid_frame);
    RUN_TEST(test_verify_too_short);
    RUN_TEST(test_verify_corrupted_crc);
    RUN_TEST(test_verify_single_register_response);
    return UNITY_END();
}

extern "C" void app_main(void) {
    runUnityTests();
}

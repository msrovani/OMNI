/*
 * CAN Bus — Frame Parsing & BMS Protocol Unit Tests
 *
 * Tests JBD BMS SOX response parsing and CAN frame structure.
 */

#include <unity.h>
#include "config.h"

// ─── CAN message structure (subset of twai_message_t) ───

typedef struct {
    uint32_t identifier;
    uint8_t data_length_code;
    uint8_t data[8];
} can_message_t;

// ─── JBD BMS response parser (identical to can_task.cpp) ───

static bool parseJbdSoxResponse(const can_message_t *msg, float *soc, float *temperature) {
    if (msg->data_length_code < 8) return false;
    if (msg->data[0] != 0xDD || msg->data[1] != 0x03) return false;

    *soc = msg->data[18];           // SoC (%) at byte 18
    int8_t temp_raw = (int8_t)msg->data[14];
    *temperature = temp_raw + 40.0f;  // JBD offset 40
    return true;
}

// ─── JBD SOX request builder ───

static void buildJbdSoxRequest(can_message_t *msg) {
    msg->identifier = 0x00;
    msg->data_length_code = 8;
    msg->data[0] = 0xDD;
    msg->data[1] = 0x03;
    for (int i = 2; i < 8; i++) msg->data[i] = 0x00;
}

// ─── Tests ───

static void test_can_message_size(void) {
    TEST_ASSERT_EQUAL(8, sizeof(can_message_t::data));
}

static void test_build_jbd_sox_request(void) {
    can_message_t msg;
    buildJbdSoxRequest(&msg);
    TEST_ASSERT_EQUAL(0x00, msg.identifier);
    TEST_ASSERT_EQUAL(8, msg.data_length_code);
    TEST_ASSERT_EQUAL(0xDD, msg.data[0]);
    TEST_ASSERT_EQUAL(0x03, msg.data[1]);
    for (int i = 2; i < 8; i++) {
        TEST_ASSERT_EQUAL(0x00, msg.data[i]);
    }
}

static void test_parse_jbd_sox_response_valid(void) {
    can_message_t msg;
    msg.identifier = 0x00;
    msg.data_length_code = 8;
    memset(msg.data, 0, sizeof(msg.data));
    msg.data[0] = 0xDD;
    msg.data[1] = 0x03;
    msg.data[14] = 40;    // 40 - 40 + 40 = 40°C (raw = 0 → offset 40)
    msg.data[18] = 75;    // 75% SoC

    float soc, temp;
    bool ok = parseJbdSoxResponse(&msg, &soc, &temp);
    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL_FLOAT(75.0f, soc);
    TEST_ASSERT_EQUAL_FLOAT(40.0f, temp);
}

static void test_parse_jbd_sox_negative_temp(void) {
    can_message_t msg;
    msg.identifier = 0x00;
    msg.data_length_code = 8;
    memset(msg.data, 0, sizeof(msg.data));
    msg.data[0] = 0xDD;
    msg.data[1] = 0x03;
    msg.data[14] = (uint8_t)(int8_t)(-10);  // -10 raw → -10 + 40 = 30°C
    msg.data[18] = 50;

    float soc, temp;
    bool ok = parseJbdSoxResponse(&msg, &soc, &temp);
    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL_FLOAT(50.0f, soc);
    TEST_ASSERT_EQUAL_FLOAT(30.0f, temp);
}

static void test_parse_jbd_sox_hot_temp(void) {
    can_message_t msg;
    msg.identifier = 0x00;
    msg.data_length_code = 8;
    memset(msg.data, 0, sizeof(msg.data));
    msg.data[0] = 0xDD;
    msg.data[1] = 0x03;
    msg.data[14] = (uint8_t)(int8_t)(45);  // 45 raw → 45 + 40 = 85°C
    msg.data[18] = 100;

    float soc, temp;
    bool ok = parseJbdSoxResponse(&msg, &soc, &temp);
    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL_FLOAT(100.0f, soc);
    TEST_ASSERT_EQUAL_FLOAT(85.0f, temp);
}

static void test_parse_jbd_sox_invalid_start_byte(void) {
    can_message_t msg;
    msg.identifier = 0x00;
    msg.data_length_code = 8;
    memset(msg.data, 0, sizeof(msg.data));
    msg.data[0] = 0xEE;  // wrong start byte
    msg.data[1] = 0x03;

    float soc = 0, temp = 0;
    bool ok = parseJbdSoxResponse(&msg, &soc, &temp);
    TEST_ASSERT_FALSE(ok);
}

static void test_parse_jbd_sox_invalid_command(void) {
    can_message_t msg;
    msg.identifier = 0x00;
    msg.data_length_code = 8;
    memset(msg.data, 0, sizeof(msg.data));
    msg.data[0] = 0xDD;
    msg.data[1] = 0x04;  // wrong command (cell voltage, not SOX)

    float soc = 0, temp = 0;
    bool ok = parseJbdSoxResponse(&msg, &soc, &temp);
    TEST_ASSERT_FALSE(ok);
}

static void test_parse_jbd_sox_short_frame(void) {
    can_message_t msg;
    msg.identifier = 0x00;
    msg.data_length_code = 2;  // too short
    memset(msg.data, 0, sizeof(msg.data));
    msg.data[0] = 0xDD;
    msg.data[1] = 0x03;

    float soc = 0, temp = 0;
    bool ok = parseJbdSoxResponse(&msg, &soc, &temp);
    TEST_ASSERT_FALSE(ok);
}

static void test_parse_jbd_sox_zero_soc(void) {
    can_message_t msg;
    msg.identifier = 0x00;
    msg.data_length_code = 8;
    memset(msg.data, 0, sizeof(msg.data));
    msg.data[0] = 0xDD;
    msg.data[1] = 0x03;
    msg.data[14] = 25;     // 25 raw → 65°C
    msg.data[18] = 0;      // 0% SoC

    float soc, temp;
    bool ok = parseJbdSoxResponse(&msg, &soc, &temp);
    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL_FLOAT(0.0f, soc);
}

static void test_parse_jbd_sox_full_soc(void) {
    can_message_t msg;
    msg.identifier = 0x00;
    msg.data_length_code = 8;
    memset(msg.data, 0, sizeof(msg.data));
    msg.data[0] = 0xDD;
    msg.data[1] = 0x03;
    msg.data[14] = 25;     // 65°C
    msg.data[18] = 100;    // 100% SoC

    float soc, temp;
    bool ok = parseJbdSoxResponse(&msg, &soc, &temp);
    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL_FLOAT(100.0f, soc);
}

static void test_parse_jbd_sox_overflow_temp(void) {
    can_message_t msg;
    msg.identifier = 0x00;
    msg.data_length_code = 8;
    memset(msg.data, 0, sizeof(msg.data));
    msg.data[0] = 0xDD;
    msg.data[1] = 0x03;
    msg.data[14] = (uint8_t)(int8_t)(-128);  // -128 raw → -88°C
    msg.data[18] = 50;

    float soc, temp;
    bool ok = parseJbdSoxResponse(&msg, &soc, &temp);
    TEST_ASSERT_TRUE(ok);
    TEST_ASSERT_EQUAL_FLOAT(-88.0f, temp);
}

// ─── Main ───

void setUp(void) {}
void tearDown(void) {}

int runUnityTests(void) {
    UNITY_BEGIN();
    RUN_TEST(test_can_message_size);
    RUN_TEST(test_build_jbd_sox_request);
    RUN_TEST(test_parse_jbd_sox_response_valid);
    RUN_TEST(test_parse_jbd_sox_negative_temp);
    RUN_TEST(test_parse_jbd_sox_hot_temp);
    RUN_TEST(test_parse_jbd_sox_invalid_start_byte);
    RUN_TEST(test_parse_jbd_sox_invalid_command);
    RUN_TEST(test_parse_jbd_sox_short_frame);
    RUN_TEST(test_parse_jbd_sox_zero_soc);
    RUN_TEST(test_parse_jbd_sox_full_soc);
    RUN_TEST(test_parse_jbd_sox_overflow_temp);
    return UNITY_END();
}

extern "C" void app_main(void) {
    runUnityTests();
}

/*
 * CAN Bus 2.0 — BMS (Battery Management System)
 *
 * Protocolo: JBD BMS (Li-ion) / Daly BMS
 *   - ID broadcast: 0x00
 *   - Comando SOX: 0x03 (read SOC/SOH)
 *   - Comando Cell Voltages: 0x04
 *
 * Hardware: MCP2515 via SPI ou TWAI controller embarcado
 */

#include <Arduino.h>
#include <driver/twai.h>
#include "config.h"

static bool can_initialised = false;

void canInit() {
    twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(
        (gpio_num_t)PIN_CAN_TX, (gpio_num_t)PIN_CAN_RX, TWAI_MODE_NORMAL
    );
    twai_timing_config_t t_config = TWAI_TIMING_CONFIG_HIT(250000);
    twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();

    if (twai_driver_install(&g_config, &t_config, &f_config) == ESP_OK) {
        twai_start();
        can_initialised = true;
        Serial.println("[CAN] Bus initialised (250 kbps)");
    } else {
        Serial.println("[CAN] Failed to initialise — check wiring");
    }
}

bool canReadBms(float *soc, float *temperature) {
    if (!can_initialised) {
        *soc = 50.0f;
        *temperature = 25.0f;
        return false;
    }

    // Send JBD SOX request: 0xDD 0x03 0x00 0x00 CRC
    twai_message_t request = {
        .flags = TWAI_MSG_FLAG_NONE,
        .identifier = 0x00,
        .data_length_code = 8,
    };
    request.data[0] = 0xDD;  // Start byte
    request.data[1] = 0x03;  // SOX command
    request.data[2] = 0x00;
    request.data[3] = 0x00;
    request.data[4] = 0x00;
    request.data[5] = 0x00;
    request.data[6] = 0x00;
    request.data[7] = 0x00;

    if (twai_transmit(&request, pdMS_TO_TICKS(100)) != ESP_OK) {
        *soc = 50.0f;
        *temperature = 25.0f;
        return false;
    }

    // Wait for response
    twai_message_t response;
    if (twai_receive(&response, pdMS_TO_TICKS(200)) != ESP_OK) {
        *soc = 50.0f;
        *temperature = 25.0f;
        return false;
    }

    // Parse JBD response
    // Bytes: 0xDD 0x03 [len] [cells] [V_high] [V_low] ... [SoC] ... [temp]
    if (response.data[0] == 0xDD && response.data[1] == 0x03) {
        *soc = response.data[18];  // SoC (%) at byte 18
        int8_t temp_raw = (int8_t)response.data[14];
        *temperature = temp_raw + 40.0f;  // JBD: offset 40
        return true;
    }

    return false;
}

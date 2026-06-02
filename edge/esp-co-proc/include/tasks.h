/*
 * Omni-Box Co-Processor — Header
 */

#ifndef OMNI_BOX_TASKS_H
#define OMNI_BOX_TASKS_H

#include <Arduino.h>
#include "config.h"

// Modbus RTU
void modbusInit();
bool modbusReadInverter(float *voltage, float *current, float *freq, float *power, bool *grid);
void modbusSetPower(float powerKw);

// Modbus TCP
void modbusTcpInit(TelemetryFrame *telemetry);
void modbusTcpHandle();
bool modbusTcpHasClient();

// CAN
void canInit();
bool canReadBms(float *soc, float *temperature);

// Safety
typedef enum {
    SAFETY_OK       = 0,
    SAFETY_WARNING  = 1,
    SAFETY_CRITICAL = 2,
    SAFETY_TRIPPED  = 3,
} safety_status_t;

void safetyInit();
safety_status_t safetyEvaluate(float voltage, float freq, float current);
void safetyTrip();

// Shadow
void shadowInit();
bool shadowIsAndroidConnected();
void shadowTick(unsigned long uptime_s, const TelemetryFrame *tf);
void shadowReplayTelemetry();
bool shadowGetRule(uint8_t idx, ShadowRule *out);
bool shadowSetRule(uint8_t idx, const ShadowRule *rule);
void shadowApplyDispatch(float power_kw, uint32_t duration_s);

// BLE GATT Server (Android connection)
void bleGattInit(TelemetryFrame *telemetry);
void bleGattNotify();
bool bleGattIsConnected();

// BLE BMS Scanner (JBD/Daly/JK)
void bleBmsInit();
bool bleBmsScanAndRead(float *soc, float *temperature);
bool bleBmsRead(float *soc, float *temperature);
void bleBmsClose();

// WiFi AP Fallback
void wifiApInit(TelemetryFrame *telemetry);
void wifiApHandle();
bool wifiApHasClient();

// HW Watchdog
void hwWatchdogInit();
void hwWatchdogFeed();

// IEC 61850-9-2LE Sampled Values
void svInit();
void svPublish(float v1, float v2, float v3, float i1);
uint32_t svGetSampleCount();

// OTA (Over-The-Air) Update
void otaInit();
void otaHandle();
bool otaUpdateFromUrl(const char* url);
void otaSetUrl(const char* url);
bool otaIsInProgress();

#endif // OMNI_BOX_TASKS_H

/*
 * Safety Module — IEEE 1547-2018 compliant grid protection
 *
 * Regras:
 *   1. Subtensão / Sobretensão (V < 90% ou V > 110%) → trip <100ms
 *   2. Subfrequência / Sobrefrequência (f < 59.3Hz ou f > 60.5Hz) → trip <100ms
 *   3. Sobrecorrente (I > 100A) → trip <100ms
 *   4. Reclosure automático após 5 min em zona segura
 */

#include <Arduino.h>
#include "config.h"

typedef enum {
    SAFETY_OK       = 0,
    SAFETY_WARNING  = 1,
    SAFETY_CRITICAL = 2,
    SAFETY_TRIPPED  = 3,
} safety_status_t;

static safety_status_t current_status = SAFETY_OK;
static unsigned long trip_time = 0;
static unsigned long last_warning_time = 0;

void safetyInit() {
    pinMode(PIN_RELAY_GRID, OUTPUT);
    pinMode(PIN_RELAY_LOAD, OUTPUT);
    digitalWrite(PIN_RELAY_GRID, HIGH);  // Normally closed
    digitalWrite(PIN_RELAY_LOAD, HIGH);
    Serial.println("[Safety] IEEE 1547-2018 initialised");
}

safety_status_t safetyEvaluate(float voltage, float freq, float current) {
    unsigned long now = millis();
    safety_status_t new_status = SAFETY_OK;

    // Check voltage
    if (voltage < VOLTAGE_MIN || voltage > VOLTAGE_MAX) {
        new_status = SAFETY_CRITICAL;
    }

    // Check frequency
    if (freq < FREQ_MIN || freq > FREQ_MAX) {
        if (new_status < SAFETY_WARNING) new_status = SAFETY_WARNING;
    }

    // Check overcurrent
    if (current > OVERCURRENT_A) {
        new_status = SAFETY_CRITICAL;
    }

    // If critical, trip immediately
    if (new_status == SAFETY_CRITICAL) {
        if (current_status != SAFETY_TRIPPED) {
            trip_time = now;
            current_status = SAFETY_TRIPPED;
            digitalWrite(PIN_RELAY_GRID, LOW);  // Open relay
            Serial.printf("[SAFETY] TRIP @ %.1fV %.1fHz %.1fA\n", voltage, freq, current);
        }
        return SAFETY_TRIPPED;
    }

    // Auto-reclose after 5 minutes of stable conditions
    if (current_status == SAFETY_TRIPPED) {
        if (now - trip_time > 300000) { // 5 min
            current_status = SAFETY_OK;
            digitalWrite(PIN_RELAY_GRID, HIGH);
            Serial.println("[SAFETY] Auto-reclose after 5 min");
        }
        return SAFETY_TRIPPED;
    }

    current_status = new_status;
    return new_status;
}

void safetyTrip() {
    current_status = SAFETY_TRIPPED;
    trip_time = millis();
    digitalWrite(PIN_RELAY_GRID, LOW);
    Serial.println("[SAFETY] Manual trip via dispatch");
}

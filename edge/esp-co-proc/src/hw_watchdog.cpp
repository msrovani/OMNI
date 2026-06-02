#include <Arduino.h>
#include "config.h"

// External HW Watchdog via GPIO heartbeat.
// Connect this pin to the WDI (watchdog input) of an external
// watchdog timer IC (e.g., MAX823, TPS3823, or STM6601).
//
// The external watchdog expects a periodic toggle. If the toggle
// stops for longer than the IC's timeout period, it asserts RST
// and resets the ESP32.
//
// Pin options:
//   - Use an unused GPIO (e.g., GPIO 47 on ESP32-S3 DevKit)
//   - Toggle at half the watchdog IC's timeout period (e.g.,
//     1.6s toggle for a 3.2s timeout IC like the MAX823)

#define PIN_HW_WATCHDOG 47
#define HW_WDT_TOGGLE_MS 1000 // Toggle every 1s (for 2.4-3.2s timeout ICs)

static unsigned long lastHwWdtToggle = 0;
static bool hwWdtState = false;

void hwWatchdogInit() {
    pinMode(PIN_HW_WATCHDOG, OUTPUT);
    digitalWrite(PIN_HW_WATCHDOG, LOW);
    Serial.printf("[HW WDT] External watchdog on GPIO %d (toggle every %dms)\n",
                  PIN_HW_WATCHDOG, HW_WDT_TOGGLE_MS);
}

void hwWatchdogFeed() {
    unsigned long now = millis();
    if (now - lastHwWdtToggle >= HW_WDT_TOGGLE_MS) {
        lastHwWdtToggle = now;
        hwWdtState = !hwWdtState;
        digitalWrite(PIN_HW_WATCHDOG, hwWdtState);
    }
}

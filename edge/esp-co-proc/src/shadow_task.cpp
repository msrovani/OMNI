#include <Arduino.h>
#include "config.h"
#include "tasks.h"

// ─── RTC Memory (survives soft reset, not power loss) ───

static RTC_NOINIT_ATTR ShadowState shadow;
static RTC_NOINIT_ATTR ShadowEntry buffer[SHADOW_BUFFER_SIZE];
static RTC_NOINIT_ATTR ShadowRule rules[SHADOW_MAX_RULES];

static bool android_connected = false;
static bool shadow_ready = false;
static unsigned long last_shadow_tick = 0;

// ─── Internal helpers ───

static bool isMagicValid() {
    return shadow.magic == 0x4F4D4E49;
}

static void initShadowState() {
    shadow.magic = 0x4F4D4E49;
    shadow.uptime_at_last_reset_s = 0;
    shadow.last_soc = 100.0f;
    shadow.last_power_kw = 0.0f;
    shadow.last_mode = 0;
    shadow.dispatch_end_s = 0;
    shadow.dispatch_power_kw = 0.0f;
    shadow.buffer_head = 0;
    shadow.buffer_tail = 0;
    for (int i = 0; i < SHADOW_MAX_RULES; i++) {
        rules[i].hour = 0;
        rules[i].minute = 0;
        rules[i].power_w = 0;
        rules[i].days = 0;
    }
}

// ─── API ───

void shadowInit() {
    Serial.print("[Shadow] ");
    if (isMagicValid()) {
        Serial.println("RTC state restored ✓");
    } else {
        initShadowState();
        Serial.println("Fresh RTC state initialised");
    }
    shadow_ready = true;
}

bool shadowIsAndroidConnected() {
    // USB CDC: DTR signal indicates host presence
    bool detected = Serial.dtr() || Serial.rts();
    if (detected && !android_connected) {
        Serial.println("[Shadow] Android reconnected — replaying buffer");
        android_connected = true;
    } else if (!detected && android_connected) {
        Serial.println("[Shadow] Android disconnected — entering autonomous mode");
        android_connected = false;
    }
    return android_connected;
}

void shadowPushTelemetry(const TelemetryFrame *tf) {
    if (!shadow_ready) return;
    uint8_t next = (shadow.buffer_head + 1) % SHADOW_BUFFER_SIZE;
    if (next == shadow.buffer_tail) {
        shadow.buffer_tail = (shadow.buffer_tail + 1) % SHADOW_BUFFER_SIZE; // overwrite oldest
    }
    buffer[shadow.buffer_head].timestamp_s = tf->timestamp_s;
    buffer[shadow.buffer_head].voltage_v = tf->voltage_v;
    buffer[shadow.buffer_head].current_a = tf->current_a;
    buffer[shadow.buffer_head].soc_percent = tf->soc_percent;
    buffer[shadow.buffer_head].power_w = tf->power_w;
    buffer[shadow.buffer_head].grid_connected = tf->grid_connected;
    buffer[shadow.buffer_head].safety_status = tf->safety_status;
    shadow.buffer_head = next;
}

void shadowReplayTelemetry() {
    if (!android_connected) return;
    while (shadow.buffer_tail != shadow.buffer_head) {
        ShadowEntry *e = &buffer[shadow.buffer_tail];
        // Replay as compact CSV over CDC
        Serial.printf("@T,%u,%.1f,%.1f,%.1f,%.0f,%d,%d\n",
                      e->timestamp_s, e->voltage_v, e->current_a,
                      e->soc_percent, e->power_w,
                      e->grid_connected, e->safety_status);
        shadow.buffer_tail = (shadow.buffer_tail + 1) % SHADOW_BUFFER_SIZE;
    }
    Serial.println("[Shadow] Buffer replay complete");
}

bool shadowGetRule(uint8_t idx, ShadowRule *out) {
    if (idx >= SHADOW_MAX_RULES) return false;
    *out = rules[idx];
    return true;
}

bool shadowSetRule(uint8_t idx, const ShadowRule *rule) {
    if (idx >= SHADOW_MAX_RULES) return false;
    rules[idx] = *rule;
    return true;
}

// Check if any scheduled rule should fire (called at 1Hz)
bool shadowCheckSchedule(float current_soc, float *out_power_kw) {
    time_t now = time(nullptr);
    struct tm *t = localtime(&now);
    uint8_t hour = t->tm_hour;
    uint8_t minute = t->tm_min;
    uint8_t dow = t->tm_wday; // 0=Sun

    for (int i = 0; i < SHADOW_MAX_RULES; i++) {
        if (rules[i].power_w == 0) continue;
        if ((rules[i].days & (1 << dow)) == 0) continue;
        if (rules[i].hour != hour || rules[i].minute != minute) continue;

        int16_t pw = rules[i].power_w;
        // Safety: don't over-discharge
        if (pw > 0 && current_soc < 20.0f) {
            *out_power_kw = 0;
            return false;
        }
        // Safety: don't over-charge
        if (pw < 0 && current_soc > 95.0f) {
            *out_power_kw = 0;
            return false;
        }
        *out_power_kw = pw / 1000.0f;
        return true;
    }
    return false;
}

void shadowApplyDispatch(float power_kw, uint32_t duration_s) {
    shadow.dispatch_end_s = shadow.uptime_at_last_reset_s + duration_s;
    shadow.dispatch_power_kw = power_kw;
    shadow.last_mode = 1;
    modbusSetPower(power_kw);
}

void shadowTick(unsigned long uptime_s, const TelemetryFrame *tf) {
    if (!shadow_ready) return;

    shadow.uptime_at_last_reset_s = uptime_s;
    shadow.last_soc = tf->soc_percent;
    shadow.last_power_kw = tf->power_w / 1000.0f;
    shadow.last_mode = (tf->power_w > 0) ? 3 : (tf->power_w < 0 ? 2 : 0);

    // Push telemetry buffer at 1Hz
    unsigned long now = millis();
    if (now - last_shadow_tick >= SHADOW_INTERVAL_MS) {
        last_shadow_tick = now;
        shadowPushTelemetry(tf);
    }

    // Autonomous dispatch check
    bool is_connected = shadowIsAndroidConnected();
    if (!is_connected) {
        // Check if active dispatch has expired
        if (shadow.last_mode == 1 && uptime_s >= shadow.dispatch_end_s) {
            modbusSetPower(0);
            shadow.last_mode = 0;
            Serial.println("[Shadow] Dispatch expired; returning to idle");
        }
        // Check schedule rules
        float schedule_power = 0;
        if (shadowCheckSchedule(tf->soc_percent, &schedule_power)) {
            shadowApplyDispatch(schedule_power, 3600); // 1h default
            Serial.printf("[Shadow] Schedule fired: %.1f kW\n", schedule_power);
        }
    }
}
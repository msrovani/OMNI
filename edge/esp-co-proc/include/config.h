#ifndef OMNI_BOX_CONFIG_H
#define OMNI_BOX_CONFIG_H

// ─── Pinout (ESP32-S3 DevKit) ───

// RS-485 (Modbus RTU) — UART1
#define PIN_MODBUS_TX      17
#define PIN_MODBUS_RX      18
#define PIN_MODBUS_RTS     21  // DE/RE (MAX3485)
#define MODBUS_BAUD        9600
#define MODBUS_SLAVE_ID    0x01  // Inversor

// CAN Bus (BMS) — TWAI controller
#define PIN_CAN_TX         5
#define PIN_CAN_RX         6
#define CAN_BITRATE        250000  // 250 kbps

// Safety relay (disconnect grid)
#define PIN_RELAY_GRID     10
#define PIN_RELAY_LOAD     11

// Status LEDs
#define PIN_LED_STATUS     48  // built-in RGB
#define PIN_LED_ERROR      14
#define PIN_LED_GRID       13

// Watchdog
#define WDT_TIMEOUT_MS     10000  // 10s

// USB CDC (to Android)
#define USB_VID            0x303A
#define USB_PID            0x1001
#define USB_MANUFACTURER   "Omni-Grid"
#define USB_PRODUCT        "Omni-Box Co-Processor"

// ─── Safety thresholds (IEEE 1547-2018) ───

#define VOLTAGE_NOMINAL    220.0f
#define VOLTAGE_MIN        198.0f  // 90%
#define VOLTAGE_MAX        242.0f  // 110%
#define FREQ_NOMINAL       60.0f
#define FREQ_MIN           59.3f   // 59.3 Hz
#define FREQ_MAX           60.5f   // 60.5 Hz
#define OVERCURRENT_A      100.0f
#define TRIP_DELAY_MS      100     // <100ms trip time

// ─── Telemetry frame ───

struct TelemetryFrame {
    uint32_t device_id;
    uint32_t timestamp_s;
    float voltage_v;
    float current_a;
    float frequency_hz;
    float soc_percent;
    float temperature_c;
    float power_w;
    bool grid_connected;
    uint8_t safety_status;  // 0=OK, 1=Warning, 2=Critical, 3=Tripped
} __attribute__((packed));

// ─── Dispatch command (from Android via USB CDC) ───

struct DispatchCommand {
    uint32_t asset_id;
    float power_kw;
    uint32_t duration_s;
    uint8_t reason;  // 0=Arbitrage, 1=PeakShave, 2=Ancillary, 3=V2G
} __attribute__((packed));

// ─── Shadow Autonomous Mode (RTC persistence) ───

#define SHADOW_BUFFER_SIZE   60    // 60s @ 1Hz telemetry buffer
#define SHADOW_INTERVAL_MS   1000  // Shadow telemetry sample rate (1Hz)
#define SHADOW_MAX_RULES     10    // Max stored dispatch schedules

// RTC-persistent shadow state
typedef struct {
    uint32_t magic;                    // Validation: 0x4F4D4E49 ("OMNI")
    uint32_t uptime_at_last_reset_s;
    float    last_soc;
    float    last_power_kw;
    uint8_t  last_mode;                // 0=idle, 1=dispatch, 2=charge, 3=discharge
    uint32_t dispatch_end_s;           // When current dispatch finishes (uptime)
    float    dispatch_power_kw;
    uint8_t  buffer_head;
    uint8_t  buffer_tail;
} __attribute__((packed)) ShadowState;

// Buffered telemetry entry
typedef struct {
    uint32_t timestamp_s;
    float    voltage_v;
    float    current_a;
    float    soc_percent;
    float    power_w;
    bool     grid_connected;
    uint8_t  safety_status;
} __attribute__((packed)) ShadowEntry;

// Scheduled dispatch rule
typedef struct {
    uint8_t  hour;      // 0-23
    uint8_t  minute;    // 0-59
    int16_t  power_w;   // Negative=charge, Positive=discharge, 0=nop
    uint8_t  days;      // Bitmask: bit 0=Sun, 1=Mon, ..., 6=Sat
} __attribute__((packed)) ShadowRule;

#endif // OMNI_BOX_CONFIG_H

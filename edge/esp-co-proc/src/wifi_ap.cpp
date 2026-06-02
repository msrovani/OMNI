#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include "config.h"
#include "tasks.h"

#define WIFI_AP_SSID    "Omni-Box-AP"
#define WIFI_AP_PASS    "omnibox2026"
#define WIFI_AP_CHANNEL 6
#define WIFI_AP_MAX_CONN 4

static WebServer server(80);
static bool apActive = false;
static TelemetryFrame *apTelemetryPtr = nullptr;

static void handleTelemetry() {
    if (!apTelemetryPtr) {
        server.send(503, "application/json", "{\"error\":\"not ready\"}");
        return;
    }
    char buf[256];
    snprintf(buf, sizeof(buf),
        "{\"device_id\":%lu,\"uptime\":%lu,\"voltage\":%.1f,\"current\":%.1f,"
        "\"frequency\":%.2f,\"soc\":%.1f,\"temperature\":%.1f,\"power\":%.0f,"
        "\"grid\":%d,\"safety\":%d}",
        apTelemetryPtr->device_id, apTelemetryPtr->timestamp_s,
        apTelemetryPtr->voltage_v, apTelemetryPtr->current_a,
        apTelemetryPtr->frequency_hz, apTelemetryPtr->soc_percent,
        apTelemetryPtr->temperature_c, apTelemetryPtr->power_w,
        apTelemetryPtr->grid_connected, apTelemetryPtr->safety_status);
    server.send(200, "application/json", buf);
}

static void handleDispatch() {
    if (!server.hasArg("plain")) {
        server.send(400, "application/json", "{\"error\":\"no body\"}");
        return;
    }
    String body = server.arg("plain");
    if (body.length() < sizeof(DispatchCommand)) {
        server.send(400, "application/json", "{\"error\":\"short body\"}");
        return;
    }
    DispatchCommand cmd;
    memcpy(&cmd, body.c_str(), sizeof(cmd));
    shadowApplyDispatch(cmd.power_kw, cmd.duration_s);
    server.send(200, "application/json", "{\"status\":\"ok\"}");
}

static void handleHealth() {
    server.send(200, "application/json",
        "{\"status\":\"ok\",\"device\":\"omni-box\",\"uptime\":" +
        String(millis() / 1000) + "}");
}

static void handleNotFound() {
    server.send(404, "application/json", "{\"error\":\"not found\"}");
}

void wifiApInit(TelemetryFrame *telemetry) {
    apTelemetryPtr = telemetry;

    WiFi.mode(WIFI_AP);
    WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASS, WIFI_AP_CHANNEL, 0, WIFI_AP_MAX_CONN);
    IPAddress ip = WiFi.softAPIP();
    Serial.printf("[WiFi AP] SSID=%s IP=%s\n", WIFI_AP_SSID, ip.toString().c_str());

    server.on("/telemetry", HTTP_GET, handleTelemetry);
    server.on("/dispatch", HTTP_POST, handleDispatch);
    server.on("/health", HTTP_GET, handleHealth);
    server.onNotFound(handleNotFound);
    server.begin();

    apActive = true;
}

void wifiApHandle() {
    if (apActive) server.handleClient();
}

bool wifiApHasClient() {
    return apActive && WiFi.softAPgetStationNum() > 0;
}

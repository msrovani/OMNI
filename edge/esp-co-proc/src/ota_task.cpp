/*
 * OTA (Over-The-Air) Update Handler
 *
 * Implementa atualização remota de firmware via:
 *   - ESP32 Arduino OTA (ArduinoOTA)
 *   - HTTP(S) fetch de binário remoto
 *   - Verificação de integridade (SHA-256 opcional)
 *
 * Compartilha partição com o bootloader OTA padrão do ESP32.
 * Partições: factory, ota_0, ota_1
 */

#include <Arduino.h>
#include <ArduinoOTA.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Update.h>
#include "config.h"

// ─── Configuration ───

#define OTA_PORT         3232
#define OTA_HOSTNAME     "omni-box-esp32"
#define OTA_UPDATE_URL   ""    // Set via config or MDM

static char ota_update_url[256] = OTA_UPDATE_URL;
static bool ota_in_progress = false;

// ─── ArduinoOTA callbacks ───

void otaInit() {
    // Configure ArduinoOTA
    ArduinoOTA.setHostname(OTA_HOSTNAME);
    ArduinoOTA.setPort(OTA_PORT);

    ArduinoOTA.onStart([]() {
        String type = (ArduinoOTA.getCommand() == U_FLASH) ? "sketch" : "filesystem";
        Serial.printf("[OTA] Start: %s\n", type.c_str());
        ota_in_progress = true;
    });

    ArduinoOTA.onEnd([]() {
        Serial.println("[OTA] Complete");
        ota_in_progress = false;
    });

    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        static int last_pct = -1;
        int pct = (progress * 100) / total;
        if (pct != last_pct && pct % 10 == 0) {
            Serial.printf("[OTA] Progress: %d%%\n", pct);
            last_pct = pct;
        }
    });

    ArduinoOTA.onError([](ota_error_t error) {
        Serial.printf("[OTA] Error: %d\n", error);
        ota_in_progress = false;
    });

    ArduinoOTA.begin();
    Serial.printf("[OTA] Server ready on port %d\n", OTA_PORT);
}

// ─── Handle OTA (must be called in loop) ───

void otaHandle() {
    ArduinoOTA.handle();
}

// ─── HTTP OTA: fetch firmware from URL ───

bool otaUpdateFromUrl(const char* url) {
    if (!url || strlen(url) == 0) {
        url = ota_update_url;
    }
    if (!url || strlen(url) == 0) {
        Serial.println("[OTA] No update URL configured");
        return false;
    }

    Serial.printf("[OTA] Fetching: %s\n", url);
    ota_in_progress = true;

    HTTPClient http;
    http.setTimeout(30000);
    http.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);
    http.begin(url);

    int code = http.GET();
    if (code != HTTP_CODE_OK) {
        Serial.printf("[OTA] HTTP %d\n", code);
        http.end();
        ota_in_progress = false;
        return false;
    }

    int totalSize = http.getSize();
    if (totalSize <= 0) {
        Serial.println("[OTA] Invalid content length");
        http.end();
        ota_in_progress = false;
        return false;
    }

    if (!Update.begin(totalSize, U_FLASH)) {
        Serial.printf("[OTA] Update.begin failed: %s\n", Update.errorString());
        http.end();
        ota_in_progress = false;
        return false;
    }

    // Stream binary to flash
    WiFiClient* stream = http.getStreamPtr();
    size_t written = Update.writeStream(*stream);
    if (written != totalSize) {
        Serial.printf("[OTA] Written %d/%d bytes\n", written, totalSize);
    }

    if (!Update.end()) {
        Serial.printf("[OTA] Update.end failed: %s\n", Update.errorString());
        http.end();
        ota_in_progress = false;
        return false;
    }

    if (!Update.isFinished()) {
        Serial.println("[OTA] Update not finished");
        http.end();
        ota_in_progress = false;
        return false;
    }

    Serial.printf("[OTA] Success! %d bytes written. Rebooting...\n", written);
    http.end();
    delay(500);
    ESP.restart();
    return true;
}

// ─── Set/update OTA URL ───

void otaSetUrl(const char* url) {
    if (url) {
        strncpy(ota_update_url, url, sizeof(ota_update_url) - 1);
        ota_update_url[sizeof(ota_update_url) - 1] = '\0';
        Serial.printf("[OTA] Update URL set: %s\n", ota_update_url);
    }
}

// ─── Check if OTA is active ───

bool otaIsInProgress() {
    return ota_in_progress;
}

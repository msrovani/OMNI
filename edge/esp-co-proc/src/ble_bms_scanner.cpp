#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEClient.h>
#include "config.h"

// JBD BMS UART-over-BLE: service 0xFFE0, characteristic 0xFFE1
static BLEUUID BMS_SERVICE_UUID("0000ffe0-0000-1000-8000-00805f9b34fb");
static BLEUUID BMS_CHAR_UUID("0000ffe1-0000-1000-8000-00805f9b34fb");

// Daly BMS: service 0xFFE0, characteristic 0xFFE1
// JK BMS: service 0xFFE0, characteristic 0xFFE1
// Common across many Chinese BMS modules

static BLEClient *bmsClient = nullptr;
static BLERemoteCharacteristic *bmsChar = nullptr;
static bool bmsFound = false;
static float lastBmsSoc = 50.0f;
static float lastBmsTemp = 25.0f;

class BmsAdvertCallbacks : public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) override {
        if (advertisedDevice.haveServiceUUID() &&
            advertisedDevice.isAdvertisingService(BMS_SERVICE_UUID)) {
            advertisedDevice.getScan()->stop();
            bmsFound = true;
            bmsClient->connect(advertisedDevice);
            Serial.printf("[BLE BMS] Found device: %s\n",
                          advertisedDevice.getName().c_str());
        }
    }
};

void bleBmsInit() {
    BLEDevice::init("Omni-Box-BMS");
    bmsClient = BLEClient::createClient();
    Serial.println("[BLE BMS] Scanner initialised");
}

bool bleBmsScanAndRead(float *soc, float *temperature) {
    if (bmsFound && bmsClient->isConnected()) {
        return bleBmsRead(soc, temperature);
    }

    bmsFound = false;
    BLEScan *scan = BLEDevice::getScan();
    scan->setAdvertisedDeviceCallbacks(new BmsAdvertCallbacks());
    scan->setInterval(100);
    scan->setWindow(50);
    scan->setActiveScan(true);

    BLEScanResults results = scan->start(3, false);
    if (results.getCount() == 0) {
        Serial.println("[BLE BMS] No BMS found during scan");
        *soc = lastBmsSoc;
        *temperature = lastBmsTemp;
        return false;
    }

    if (!bmsFound || !bmsClient->isConnected()) {
        *soc = lastBmsSoc;
        *temperature = lastBmsTemp;
        return false;
    }

    BLERemoteService *svc = bmsClient->getService(BMS_SERVICE_UUID);
    if (!svc) {
        bmsClient->disconnect();
        return false;
    }
    bmsChar = svc->getCharacteristic(BMS_CHAR_UUID);
    if (!bmsChar) {
        bmsClient->disconnect();
        return false;
    }

    return bleBmsRead(soc, temperature);
}

bool bleBmsRead(float *soc, float *temperature) {
    if (!bmsChar) return false;

    // JBD SOX command: 0xDD 0x03 0x00 0x00 0x00 + CRC
    // Simplified: read characteristic directly
    std::string value = bmsChar->readValue();
    if (value.length() < 20) {
        *soc = lastBmsSoc;
        *temperature = lastBmsTemp;
        return false;
    }

    const uint8_t *data = reinterpret_cast<const uint8_t*>(value.data());

    // JBD SOX response: byte 12 = SoC*10, byte 14 = temperature-40
    int socRaw = data[12];
    int tempRaw = data[14];

    lastBmsSoc = socRaw * 0.1f;
    lastBmsTemp = (tempRaw - 40) * 1.0f;

    if (soc) *soc = lastBmsSoc;
    if (temperature) *temperature = lastBmsTemp;
    return true;
}

void bleBmsClose() {
    if (bmsClient && bmsClient->isConnected()) {
        bmsClient->disconnect();
    }
    bmsFound = false;
}

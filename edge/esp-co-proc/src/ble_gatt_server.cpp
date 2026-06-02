#include <Arduino.h>
#include "config.h"
#include "tasks.h"

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>

// 128-bit UUIDs derived from "OMNI-BOX" hex signature
#define BLE_SERVICE_UUID        "4f4d4e49-424f-5800-0000-000000000000"
#define BLE_CHAR_TELEMETRY_UUID "4f4d4e49-0001-5800-0000-000000000001"
#define BLE_CHAR_DISPATCH_UUID  "4f4d4e49-0002-5800-0000-000000000002"
#define BLE_CHAR_COMMAND_UUID   "4f4d4e49-0003-5800-0000-000000000003"

static BLEServer *bleServer = nullptr;
static BLECharacteristic *telemetryChar = nullptr;
static BLECharacteristic *dispatchChar = nullptr;
static BLECharacteristic *commandChar = nullptr;
static bool deviceConnected = false;
static TelemetryFrame *bleTelemetryPtr = nullptr;

class BleServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* srv) override {
        deviceConnected = true;
        Serial.println("[BLE] Android connected");
    }
    void onDisconnect(BLEServer* srv) override {
        deviceConnected = false;
        Serial.println("[BLE] Android disconnected — advertising");
        srv->startAdvertising();
    }
};

class CommandCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *ch) override {
        std::string value = ch->getValue();
        if (value.length() < sizeof(DispatchCommand)) return;
        DispatchCommand cmd;
        memcpy(&cmd, value.data(), sizeof(cmd));
        shadowApplyDispatch(cmd.power_kw, cmd.duration_s);
        Serial.printf("[BLE] Dispatch via GATT: %.1f kW for %u s\n",
                      cmd.power_kw, cmd.duration_s);
    }
};

void bleGattInit(TelemetryFrame *telemetry) {
    bleTelemetryPtr = telemetry;
    BLEDevice::init("Omni-Box");
    bleServer = BLEDevice::createServer();
    bleServer->setCallbacks(new BleServerCallbacks());

    BLEService *service = bleServer->createService(BLE_SERVICE_UUID);

    telemetryChar = service->createCharacteristic(
        BLE_CHAR_TELEMETRY_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    telemetryChar->addDescriptor(new BLE2902());

    dispatchChar = service->createCharacteristic(
        BLE_CHAR_DISPATCH_UUID,
        BLECharacteristic::PROPERTY_READ
    );

    commandChar = service->createCharacteristic(
        BLE_CHAR_COMMAND_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    commandChar->setCallbacks(new CommandCallbacks());

    service->start();

    BLEAdvertising *adv = bleServer->getAdvertising();
    adv->addServiceUUID(BLE_SERVICE_UUID);
    adv->setScanResponse(true);
    adv->setMinPreferred(0x06);
    adv->setMinPreferred(0x12);
    BLEDevice::startAdvertising();

    Serial.println("[BLE] GATT server advertising as 'Omni-Box'");
}

void bleGattNotify() {
    if (!deviceConnected || !bleTelemetryPtr) return;
    telemetryChar->setValue((uint8_t*)bleTelemetryPtr, sizeof(TelemetryFrame));
    telemetryChar->notify();
}

bool bleGattIsConnected() {
    return deviceConnected;
}

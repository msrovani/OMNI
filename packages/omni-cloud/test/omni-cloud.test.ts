import { describe, it, expect, beforeEach } from "vitest";
import { OmniCloudService } from "../src/index.js";

describe("OmniCloudService", () => {
  let service: OmniCloudService;

  beforeEach(() => {
    service = new OmniCloudService();
  });

  it("should register a device", () => {
    const device = service.registerDevice("sim-001");
    expect(device.deviceId).toBe("sim-001");
    expect(device.isConnected).toBe(true);
    expect(service.getDeviceCount()).toBe(1);
  });

  it("should ingest telemetry", () => {
    service.ingestTelemetry({
      deviceId: "sim-001",
      timestamp: new Date().toISOString(),
      socPercent: 75.5,
      sohPercent: 99.2,
      powerW: 1200,
      voltageV: 400,
      frequencyHz: 60.01,
      temperatureC: 28.3,
      isGridConnected: true,
    });

    const device = service.getDevice("sim-001");
    expect(device).toBeDefined();
    expect(device!.telemetry).toHaveLength(1);
    expect(device!.telemetry[0]!.socPercent).toBe(75.5);
  });

  it("should auto-register device on first telemetry", () => {
    service.ingestTelemetry({
      deviceId: "unknown-device",
      timestamp: new Date().toISOString(),
      socPercent: 50,
      sohPercent: 100,
      powerW: 0,
      voltageV: 400,
      frequencyHz: 60,
      temperatureC: 25,
      isGridConnected: true,
    });

    expect(service.getDeviceCount()).toBe(1);
    expect(service.getDevice("unknown-device")?.isConnected).toBe(true);
  });

  it("should cap telemetry buffer at 5000 samples per device", () => {
    for (let i = 0; i < 12000; i++) {
      service.ingestTelemetry({
        deviceId: "sim-001",
        timestamp: new Date(Date.now() + i).toISOString(),
        socPercent: 50 + Math.sin(i * 0.1) * 10,
        sohPercent: 99,
        powerW: i * 10,
        voltageV: 400,
        frequencyHz: 60,
        temperatureC: 25,
        isGridConnected: true,
      });
    }
    const device = service.getDevice("sim-001")!;
    expect(device.telemetry.length).toBeLessThanOrEqual(5000);
  });
});

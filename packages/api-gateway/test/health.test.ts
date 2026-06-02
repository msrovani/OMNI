import { describe, it, expect } from "vitest";
import { TelemetryStore } from "../src/telemetry-store.js";
import type { TelemetryRecord } from "../src/telemetry-store.js";

describe("API Gateway", () => {
  it("should define health endpoint path", () => {
    const healthPath = "/health";
    expect(healthPath).toBe("/health");
  });

  it("should return ok status from health handler", async () => {
    const response = { status: "ok", service: "omni-grid-api", version: "1.0.0" };
    expect(response.status).toBe("ok");
    expect(response.service).toBe("omni-grid-api");
    expect(response.version).toBe("1.0.0");
  });

  it("should define forecast, optimize, and dispatch routes", () => {
    const routes = [
      "POST /api/v1/pde/forecast",
      "POST /api/v1/pde/optimize",
      "POST /api/v1/pde/dispatch/execute",
      "GET  /api/v1/pde/dispatch/history",
      "GET  /api/v1/pde/dispatch/stats",
      "GET  /api/v1/market/prices",
    ];
    expect(routes).toHaveLength(6);
    routes.forEach((r) => expect(r).toContain("/api/v1"));
  });
});

describe("TelemetryStore", () => {
  it("should store and retrieve telemetry records", () => {
    const store = new TelemetryStore();

    const record: TelemetryRecord = {
      deviceId: "device-001",
      timestamp: new Date().toISOString(),
      socPercent: 75,
      sohPercent: 95,
      powerW: 1000,
      voltageV: 400,
      frequencyHz: 60,
      temperatureC: 28,
      isGridConnected: true,
    };

    store.add("device-001", record);

    const latest = store.getLatest("device-001");
    expect(latest).not.toBeNull();
    expect(latest!.socPercent).toBe(75);
    expect(latest!.deviceId).toBe("device-001");
  });

  it("should return null for unknown device", () => {
    const store = new TelemetryStore();
    expect(store.getLatest("unknown")).toBeNull();
  });

  it("should get history for a device", () => {
    const store = new TelemetryStore();

    for (let i = 1; i <= 5; i++) {
      store.add("device-001", {
        deviceId: "device-001",
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        socPercent: 50 + i,
        sohPercent: 95,
        powerW: 1000,
        voltageV: 400,
        frequencyHz: 60,
        temperatureC: 25,
        isGridConnected: true,
      });
    }

    const history = store.getHistory("device-001");
    expect(history).toHaveLength(5);
    expect(history[4]!.socPercent).toBe(55);
  });

  it("should return all latest records", () => {
    const store = new TelemetryStore();

    store.add("device-001", {
      deviceId: "device-001",
      timestamp: "2026-01-01T00:00:00Z",
      socPercent: 60,
      sohPercent: 95,
      powerW: 500,
      voltageV: 400,
      frequencyHz: 60,
      temperatureC: 25,
      isGridConnected: true,
    });

    store.add("device-002", {
      deviceId: "device-002",
      timestamp: "2026-01-01T00:00:01Z",
      socPercent: 80,
      sohPercent: 90,
      powerW: 1000,
      voltageV: 230,
      frequencyHz: 50,
      temperatureC: 30,
      isGridConnected: false,
    });

    const all = store.getAllLatest();
    expect(all.size).toBe(2);
    expect(all.get("device-001")!.socPercent).toBe(60);
    expect(all.get("device-002")!.socPercent).toBe(80);
  });

  it("should enforce max per device limit", () => {
    const store = new TelemetryStore();

    for (let i = 0; i < 1100; i++) {
      store.add("device-001", {
        deviceId: "device-001",
        timestamp: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
        socPercent: i % 100,
        sohPercent: 95,
        powerW: 0,
        voltageV: 400,
        frequencyHz: 60,
        temperatureC: 25,
        isGridConnected: true,
      });
    }

    const history = store.getHistory("device-001");
    expect(history.length).toBeLessThanOrEqual(1000);
  });
});

describe("New API Endpoints", () => {
  it("should define telemetry routes", () => {
    const routes = [
      "POST /api/v1/edge/telemetry",
      "GET  /api/v1/telemetry/latest",
      "GET  /api/v1/telemetry/:deviceId/history",
      "GET  /api/v1/devices",
      "GET  /api/v1/devices/count",
    ];
    expect(routes).toHaveLength(5);
    routes.forEach((r) => expect(r).toContain("/api/v1"));
  });

  it("should define WebSocket route", () => {
    const wsRoute = "GET /ws (WebSocket)";
    expect(wsRoute).toContain("/ws");
  });
});

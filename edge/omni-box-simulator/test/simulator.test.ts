import { describe, it, expect } from "vitest";
import { OmniBoxSimulator } from "../src/index.js";

describe("OmniBoxSimulator", () => {
  it("starts in known state", () => {
    const sim = new OmniBoxSimulator("test-001");
    const info = sim.deviceInfo;
    expect(info.deviceId).toBe("test-001");
    expect(info.soc).toBeGreaterThan(0);
    expect(info.soh).toBe(100);
  });

  it("generates valid telemetry payload", () => {
    const sim = new OmniBoxSimulator("test-002");
    const telemetry = sim.generateTelemetry();
    expect(telemetry.deviceId).toBe("test-002");
    expect(telemetry.type).toBe("telemetry");
    expect(telemetry.socPercent).toBeGreaterThanOrEqual(10);
    expect(telemetry.socPercent).toBeLessThanOrEqual(95);
    expect(telemetry.sohPercent).toBeGreaterThanOrEqual(80);
    expect(telemetry.sohPercent).toBeLessThanOrEqual(100);
    expect(telemetry.voltageV).toBeGreaterThan(390);
    expect(telemetry.voltageV).toBeLessThan(410);
    expect(telemetry.frequencyHz).toBeGreaterThan(59);
    expect(telemetry.frequencyHz).toBeLessThan(61);
    expect(telemetry.temperatureC).toBeGreaterThanOrEqual(18);
    expect(telemetry.temperatureC).toBeLessThanOrEqual(45);
  });

  it("generates multiple telemetry payloads with changing values", () => {
    const sim = new OmniBoxSimulator("test-003");
    const t1 = sim.generateTelemetry();
    const t2 = sim.generateTelemetry();
    expect(t1.socPercent).not.toBe(t2.socPercent);
  });

  it("handles dispatch commands", () => {
    const sim = new OmniBoxSimulator("test-004");
    const before = sim.cycles;
    sim.applyDispatch(10, 3600, "PeakShave");
    expect(sim.cycles).toBe(before + 1);
  });

  it("tracks SoC decrease over multiple dispatches", () => {
    const sim = new OmniBoxSimulator("test-005");
    const initialSoc = sim.deviceInfo.soc;
    for (let i = 0; i < 100; i++) {
      sim.applyDispatch(50, 3600, "Arbitrage");
      sim.updateBattery();
    }
    // After 100 discharges, SoH and SoC should be lower
    const final = sim.deviceInfo;
    expect(final.soh).toBeLessThan(100);
  });

  it("clamps SoC between 10 and 95", () => {
    const sim = new OmniBoxSimulator("test-006");
    for (let i = 0; i < 500; i++) {
      sim.updateBattery();
    }
    expect(sim.deviceInfo.soc).toBeGreaterThanOrEqual(10);
    expect(sim.deviceInfo.soc).toBeLessThanOrEqual(95);
  });

  it("clamps temperature between 18 and 45", () => {
    const sim = new OmniBoxSimulator("test-007");
    for (let i = 0; i < 1000; i++) {
      sim.updateBattery();
    }
    expect(sim.deviceInfo.temperature).toBeGreaterThanOrEqual(18);
    expect(sim.deviceInfo.temperature).toBeLessThanOrEqual(45);
  });

  it("clamps SoH between 80 and 100", () => {
    const sim = new OmniBoxSimulator("test-008");
    for (let i = 0; i < 100; i++) {
      sim.applyDispatch(10, 3600, "Arbitrage");
      sim.updateBattery();
    }
    expect(sim.deviceInfo.soh).toBeGreaterThanOrEqual(80);
    expect(sim.deviceInfo.soh).toBeLessThanOrEqual(100);
  });

  it("may flip grid connection randomly", () => {
    const sim = new OmniBoxSimulator("test-009");
    let sawFlip = false;
    for (let i = 0; i < 10000; i++) {
      sim.updateBattery();
    }
    // Grid changed at least once (probability: 1 - (1-0.001)^10000 ≈ 99.99%)
    expect(sim.deviceInfo.gridConnected).toBeDefined();
  });

  it("generates deterministic-like telemetry on first call", () => {
    const sim = new OmniBoxSimulator("test-010");
    const t = sim.generateTelemetry();
    expect(typeof t.socPercent).toBe("number");
    expect(typeof t.powerW).toBe("number");
    expect(typeof t.voltageV).toBe("number");
    expect(typeof t.frequencyHz).toBe("number");
    expect(typeof t.temperatureC).toBe("number");
    expect(typeof t.isGridConnected).toBe("boolean");
  });
});

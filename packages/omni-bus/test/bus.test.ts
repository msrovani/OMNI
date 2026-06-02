import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemoryBus, channelDispatch, channelTelemetry, channelPrices } from "../src/index.js";

describe("InMemoryBus", () => {
  let bus: InMemoryBus;

  beforeEach(async () => {
    bus = new InMemoryBus();
    await bus.connect();
  });

  afterEach(async () => {
    await bus.disconnect();
  });

  it("should publish and receive messages", async () => {
    const received: any[] = [];
    await bus.subscribe(channelDispatch(), (msg) => received.push(msg));

    await bus.publish(channelDispatch("bat-001"), {
      type: "dispatch",
      source: "pde-engine",
      commandId: "cmd-001",
      assetId: "bat-001",
      powerKw: 50,
      durationSeconds: 3600,
      reason: "arbitrage",
      signature: "sig123",
    });

    expect(received).toHaveLength(1);
    expect(received[0].assetId).toBe("bat-001");
  });

  it("should support wildcard subscriptions", async () => {
    const received: any[] = [];
    const unsub = await bus.subscribe("telemetry.*", (msg) => received.push(msg));

    await bus.publish("telemetry.sim-001", {
      type: "telemetry",
      source: "sim-001",
      deviceId: "sim-001",
      timestamp: new Date().toISOString(),
      socPercent: 75,
      powerW: 1200,
      voltageV: 400,
      frequencyHz: 60,
      temperatureC: 28,
      isGridConnected: true,
    });

    expect(received).toHaveLength(1);
    expect(received[0].deviceId).toBe("sim-001");

    unsub.unsubscribe();
    await bus.publish("telemetry.sim-002", {
      type: "telemetry",
      source: "sim-002",
      deviceId: "sim-002",
      timestamp: new Date().toISOString(),
      socPercent: 50,
      powerW: 800,
      voltageV: 400,
      frequencyHz: 60,
      temperatureC: 25,
      isGridConnected: true,
    });
    expect(received).toHaveLength(1); // unsubscribed
  });

  it("should track listener count", async () => {
    await bus.subscribe("test.channel", async () => {});
    await bus.subscribe("test.channel", async () => {});
    expect(bus.listenerCount("test.channel")).toBe(2);
  });

  it("should connect and disconnect", async () => {
    expect(bus.isConnected()).toBe(true);
    await bus.disconnect();
    expect(bus.isConnected()).toBe(false);
  });

  it("should reject publish when disconnected", async () => {
    await bus.disconnect();
    await expect(
      bus.publish("test.x", {
        type: "command" as any,
        source: "test",
        target: "x",
        action: "ping",
        payload: {},
      }),
    ).rejects.toThrow("Bus not connected");
  });

  it("should handle multiple subscribers on same channel", async () => {
    const r1: any[] = [];
    const r2: any[] = [];
    await bus.subscribe("multi.test", (m) => r1.push(m));
    await bus.subscribe("multi.test", (m) => r2.push(m));

    await bus.publish("multi.test", {
      type: "command" as any,
      source: "test",
      target: "all",
      action: "ping",
      payload: {},
    });

    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
  });
});

describe("Channel Helpers", () => {
  it("channelTelemetry without deviceId", () => {
    expect(channelTelemetry()).toBe("telemetry.*");
  });
  it("channelTelemetry with deviceId", () => {
    expect(channelTelemetry("sim-001")).toBe("telemetry.sim-001");
  });
  it("channelDispatch without assetId", () => {
    expect(channelDispatch()).toBe("dispatch.*");
  });
  it("channelPrices with region", () => {
    expect(channelPrices("SE")).toBe("market.prices.SE");
  });
});

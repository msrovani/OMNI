import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { channelTelemetry, channelDispatch, channelCommands, type BusMessage, type TelemetryMessage, type DispatchMessage, type CommandMessage } from "@omni-grid/omni-bus";
import {
  createTestContext,
  destroyTestContext,
  subscribeTelemetry,
  subscribeDispatches,
  type TestContext,
} from "../src/index.js";

describe("Bus + Edge Simulator Integration", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await destroyTestContext(ctx);
  });

  it("should create bus, subscribe to telemetry.* and receive published telemetry", async () => {
    const collector = await subscribeTelemetry(ctx.bus);

    await ctx.bus.publish(channelTelemetry("edge-device-42"), {
      type: "telemetry",
      source: "edge-device-42",
      deviceId: "edge-device-42",
      timestamp: new Date().toISOString(),
      socPercent: 88.3,
      sohPercent: 99.2,
      powerW: 3400,
      voltageV: 398.5,
      frequencyHz: 59.98,
      temperatureC: 31.2,
      isGridConnected: true,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(collector.messages).toHaveLength(1);
    expect(collector.messages[0].deviceId).toBe("edge-device-42");
    expect(collector.messages[0].socPercent).toBe(88.3);
    expect(collector.messages[0].isGridConnected).toBe(true);

    collector.sub.unsubscribe();
  });

  it("should receive telemetry on wildcard subscription telemetry.*", async () => {
    const msgs: TelemetryMessage[] = [];
    const sub = await ctx.bus.subscribe("telemetry.*", (msg: BusMessage) => {
      if ((msg as TelemetryMessage).type === "telemetry") {
        msgs.push(msg as TelemetryMessage);
      }
    });

    await ctx.bus.publish("telemetry.device-alpha", {
      type: "telemetry", source: "device-alpha", deviceId: "device-alpha",
      timestamp: new Date().toISOString(), socPercent: 60, powerW: 500,
      voltageV: 400, frequencyHz: 60, temperatureC: 25, isGridConnected: true,
    });

    await ctx.bus.publish("telemetry.device-beta", {
      type: "telemetry", source: "device-beta", deviceId: "device-beta",
      timestamp: new Date().toISOString(), socPercent: 45, powerW: -200,
      voltageV: 402, frequencyHz: 60.01, temperatureC: 26, isGridConnected: true,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(msgs).toHaveLength(2);
    expect(msgs[0].deviceId).toBe("device-alpha");
    expect(msgs[1].deviceId).toBe("device-beta");

    sub.unsubscribe();
  });

  it("should receive telemetry on device-specific subscription telemetry.{deviceId}", async () => {
    const msgs: TelemetryMessage[] = [];
    const sub = await ctx.bus.subscribe("telemetry.specific-device", (msg: BusMessage) => {
      if ((msg as TelemetryMessage).type === "telemetry") {
        msgs.push(msg as TelemetryMessage);
      }
    });

    await ctx.bus.publish(channelTelemetry("specific-device"), {
      type: "telemetry", source: "specific-device", deviceId: "specific-device",
      timestamp: new Date().toISOString(), socPercent: 90, powerW: 100,
      voltageV: 401, frequencyHz: 60, temperatureC: 24, isGridConnected: true,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].deviceId).toBe("specific-device");

    sub.unsubscribe();
  });

  it("should publish dispatch command and verify subscriber receives it", async () => {
    const collector = await subscribeDispatches(ctx.bus, "battery-asset-77");

    await ctx.bus.publish(channelDispatch("battery-asset-77"), {
      type: "dispatch",
      source: "pde-engine",
      commandId: "dispatch-77",
      assetId: "battery-asset-77",
      powerKw: -30,
      durationSeconds: 900,
      reason: "peak_shave",
      signature: "abcdef123456",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(collector.messages).toHaveLength(1);
    expect(collector.messages[0].commandId).toBe("dispatch-77");
    expect(collector.messages[0].powerKw).toBe(-30);
    expect(collector.messages[0].reason).toBe("peak_shave");

    collector.sub.unsubscribe();
  });

  it("should receive dispatch on wildcard dispatch.*", async () => {
    const msgs: DispatchMessage[] = [];
    const sub = await ctx.bus.subscribe("dispatch.*", (msg: BusMessage) => {
      if ((msg as DispatchMessage).type === "dispatch") {
        msgs.push(msg as DispatchMessage);
      }
    });

    await ctx.bus.publish("dispatch.some-asset", {
      type: "dispatch", source: "test", commandId: "d1",
      assetId: "some-asset", powerKw: 50, durationSeconds: 600,
      reason: "arbitrage", signature: "sig1",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].assetId).toBe("some-asset");

    sub.unsubscribe();
  });

  it("should preserve message content integrity through publish/subscribe", async () => {
    const telCol = await subscribeTelemetry(ctx.bus);
    const dispatchCol = await subscribeDispatches(ctx.bus);

    const telemetry: TelemetryMessage = {
      type: "telemetry",
      source: "integrity-check",
      deviceId: "integrity-check",
      timestamp: "2026-05-27T12:00:00.000Z",
      socPercent: 55.5,
      sohPercent: 98.7,
      powerW: 1500,
      voltageV: 405.2,
      frequencyHz: 60.03,
      temperatureC: 29.8,
      isGridConnected: true,
    };

    const dispatch: DispatchMessage = {
      type: "dispatch",
      source: "pde-engine",
      commandId: "integ-cmd-01",
      assetId: "integrity-check",
      powerKw: 40,
      durationSeconds: 1800,
      reason: "ancillary",
      signature: "integ-sig-001",
    };

    await ctx.bus.publish(channelTelemetry("integrity-check"), telemetry);
    await ctx.bus.publish(channelDispatch("integrity-check"), dispatch);

    await new Promise((r) => setTimeout(r, 50));

    expect(telCol.messages).toHaveLength(1);
    expect(telCol.messages[0]).toEqual(telemetry);

    expect(dispatchCol.messages).toHaveLength(1);
    expect(dispatchCol.messages[0]).toEqual(dispatch);

    telCol.sub.unsubscribe();
    dispatchCol.sub.unsubscribe();
  });

  it("should support multiple subscribers on the same channel", async () => {
    const msgs1: TelemetryMessage[] = [];
    const msgs2: TelemetryMessage[] = [];

    const sub1 = await ctx.bus.subscribe(channelTelemetry("multi-device"), (msg: BusMessage) => {
      if ((msg as TelemetryMessage).type === "telemetry") msgs1.push(msg as TelemetryMessage);
    });
    const sub2 = await ctx.bus.subscribe(channelTelemetry("multi-device"), (msg: BusMessage) => {
      if ((msg as TelemetryMessage).type === "telemetry") msgs2.push(msg as TelemetryMessage);
    });

    await ctx.bus.publish(channelTelemetry("multi-device"), {
      type: "telemetry", source: "multi-device", deviceId: "multi-device",
      timestamp: new Date().toISOString(), socPercent: 70, powerW: 800,
      voltageV: 400, frequencyHz: 60, temperatureC: 25, isGridConnected: true,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(msgs1).toHaveLength(1);
    expect(msgs2).toHaveLength(1);

    sub1.unsubscribe();
    sub2.unsubscribe();
  });

  it("should not deliver to unsubscribed handlers", async () => {
    const msgs: TelemetryMessage[] = [];
    const sub = await ctx.bus.subscribe(channelTelemetry("temp-device"), (msg: BusMessage) => {
      if ((msg as TelemetryMessage).type === "telemetry") msgs.push(msg as TelemetryMessage);
    });

    sub.unsubscribe();

    await ctx.bus.publish(channelTelemetry("temp-device"), {
      type: "telemetry", source: "temp-device", deviceId: "temp-device",
      timestamp: new Date().toISOString(), socPercent: 50, powerW: 0,
      voltageV: 400, frequencyHz: 60, temperatureC: 25, isGridConnected: true,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(msgs).toHaveLength(0);
  });

  it("should allow a device simulator to send telemetry and receive dispatches end-to-end", async () => {
    const deviceId = "omni-box-sim-01";

    const telReceived: TelemetryMessage[] = [];
    const dispatchReceived: DispatchMessage[] = [];

    // Edge device subscribes to its dispatch channel (like the real simulator does)
    const dispatchSub = await ctx.bus.subscribe(channelDispatch(deviceId), async (msg: BusMessage) => {
      const d = msg as DispatchMessage;
      if (d.type === "dispatch") {
        dispatchReceived.push(d);
      }
    });

    // Cloud / monitoring service subscribes to telemetry
    const telSub = await ctx.bus.subscribe(channelTelemetry(), (msg: BusMessage) => {
      const t = msg as TelemetryMessage;
      if (t.type === "telemetry") {
        telReceived.push(t);
      }
    });

    // Simulate device sending telemetry
    await ctx.bus.publish(channelTelemetry(deviceId), {
      type: "telemetry",
      source: deviceId,
      deviceId,
      timestamp: new Date().toISOString(),
      socPercent: 82.1,
      sohPercent: 99.5,
      powerW: 2400,
      voltageV: 401.2,
      frequencyHz: 60.01,
      temperatureC: 27.4,
      isGridConnected: true,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(telReceived).toHaveLength(1);
    expect(telReceived[0].deviceId).toBe(deviceId);

    // Simulate PDE engine sending a dispatch command
    await ctx.bus.publish(channelDispatch(deviceId), {
      type: "dispatch",
      source: "pde-engine",
      commandId: `dispatch-${deviceId}`,
      assetId: deviceId,
      powerKw: -15,
      durationSeconds: 1200,
      reason: "v2g",
      signature: "edge-sim-sig",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(dispatchReceived).toHaveLength(1);
    expect(dispatchReceived[0].assetId).toBe(deviceId);
    expect(dispatchReceived[0].powerKw).toBe(-15);
    expect(dispatchReceived[0].reason).toBe("v2g");

    dispatchSub.unsubscribe();
    telSub.unsubscribe();
  });

  it("should not deliver messages to channels with no subscribers", async () => {
    const collector = await subscribeTelemetry(ctx.bus, "device-1");

    await ctx.bus.publish(channelTelemetry("device-2"), {
      type: "telemetry", source: "device-2", deviceId: "device-2",
      timestamp: new Date().toISOString(), socPercent: 50, powerW: 0,
      voltageV: 400, frequencyHz: 60, temperatureC: 25, isGridConnected: true,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(collector.messages).toHaveLength(0);

    await ctx.bus.publish(channelTelemetry("device-1"), {
      type: "telemetry", source: "device-1", deviceId: "device-1",
      timestamp: new Date().toISOString(), socPercent: 80, powerW: 1000,
      voltageV: 402, frequencyHz: 60, temperatureC: 26, isGridConnected: true,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(collector.messages).toHaveLength(1);

    collector.sub.unsubscribe();
  });

  it("should handle command messages on commands.* channel", async () => {
    const cmds: CommandMessage[] = [];
    const sub = await ctx.bus.subscribe(channelCommands(), (msg: BusMessage) => {
      if ((msg as CommandMessage).type === "command") {
        cmds.push(msg as CommandMessage);
      }
    });

    await ctx.bus.publish(channelCommands("gateway-1"), {
      type: "command",
      source: "cloud",
      target: "gateway-1",
      action: "set_mode",
      payload: { mode: "eco" },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(cmds).toHaveLength(1);
    expect(cmds[0].target).toBe("gateway-1");
    expect(cmds[0].action).toBe("set_mode");
    expect(cmds[0].payload).toEqual({ mode: "eco" });

    sub.unsubscribe();
  });
});

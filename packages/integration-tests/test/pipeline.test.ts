import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Role, Permission } from "@omni-grid/omni-auth";
import {
  createTestContext,
  destroyTestContext,
  subscribeTelemetry,
  subscribeDispatches,
  authenticate,
  type TestContext,
} from "../src/index.js";

describe("Full Pipeline Integration", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await destroyTestContext(ctx);
  });

  it("should authenticate admin and retrieve JWT token", () => {
    const token = authenticate(ctx, "admin", "omni-admin-2026");
    expect(token).toBeTruthy();
    expect(token.split(".").length).toBe(3);

    const { payload, user } = ctx.auth.verifyToken(token);
    expect(payload.role).toBe(Role.Admin);
    expect(user.username).toBe("admin");
  });

  it("should authenticate device user", () => {
    const token = authenticate(ctx, "device-sim-001", "device-token-001");
    expect(token).toBeTruthy();
    const { payload } = ctx.auth.verifyToken(token);
    expect(payload.role).toBe(Role.Device);
  });

  it("should reject invalid credentials", () => {
    expect(() => authenticate(ctx, "admin", "wrong-password")).toThrow();
    expect(() => authenticate(ctx, "nonexistent", "password")).toThrow();
  });

  it("should generate PDE forecast via ForecastEngine", () => {
    const result = ctx.forecast.predict("asset-battery-001", [], 4);
    expect(result.assetId).toBe("asset-battery-001");
    expect(result.predictions).toHaveLength(4);
    expect(result.timestamps).toHaveLength(4);
    for (const pred of result.predictions) {
      expect(pred).toBeGreaterThan(0);
    }
  });

  it("should produce 24h forecast", () => {
    const result = ctx.forecast.predict("asset-large-001", [], 96);
    expect(result.predictions).toHaveLength(96);
    expect(result.timestamps).toHaveLength(96);
    expect(result.maePercent).toBeCloseTo(1.5, 1);
  });

  it("should run PDE optimization and generate dispatch commands", async () => {
    const prices = await ctx.marketData.fetchPldPrices(new Date(), new Date(Date.now() + 24 * 3600_000), true);
    expect(prices.length).toBeGreaterThan(0);

    const result = ctx.optimizer.optimize(
      [{ id: "battery-1", clientId: "default", manufacturer: "Generic", model: "Battery-100", capacityKwh: 100, nominalPowerKw: 50, cycleLife: 6000, replacementCost: 50000, minSocPercent: 20, maxSocPercent: 95, installedAt: new Date() }],
      prices,
      { "battery-1": 80 },
      "balanced",
    );

    expect(result.commands.length).toBeGreaterThanOrEqual(0);
    expect(typeof result.expectedProfitBrl).toBe("number");
    expect(typeof result.scenarioCount).toBe("number");
  });

  it("should execute a dispatch via DispatchOrchestrator", async () => {
    const record = await ctx.dispatcher.execute({
      assetId: "battery-1",
      powerKw: 50,
      durationSeconds: 3600,
      reason: "arbitrage",
    });

    expect(record.commandId).toBeTruthy();
    expect(record.assetId).toBe("battery-1");
    expect(record.powerKw).toBe(50);
    expect(record.signature).toBeTruthy();
    expect(record.accepted).toBe(true);

    const valid = ctx.dispatcher.verify(
      { assetId: "battery-1", powerKw: 50, durationSeconds: 3600, reason: "arbitrage" },
      record.signature,
    );
    expect(valid).toBe(true);
  });

  it("should track dispatch history after executions", async () => {
    await ctx.dispatcher.execute({ assetId: "battery-1", powerKw: 30, durationSeconds: 1800, reason: "peak_shave" });
    await ctx.dispatcher.execute({ assetId: "battery-2", powerKw: 50, durationSeconds: 3600, reason: "arbitrage" });

    const history = ctx.dispatcher.getHistory();
    expect(history).toHaveLength(2);
    expect(ctx.dispatcher.getHistory("battery-1")).toHaveLength(1);
    expect(ctx.dispatcher.getStats().totalCommands).toBe(2);
  });

  it("should send telemetry via bus and verify delivery", async () => {
    const collector = await subscribeTelemetry(ctx.bus);

    await ctx.bus.publish("telemetry.sim-device-01", {
      type: "telemetry",
      source: "sim-device-01",
      deviceId: "sim-device-01",
      timestamp: new Date().toISOString(),
      socPercent: 75.5,
      powerW: 1200,
      voltageV: 401,
      frequencyHz: 60.02,
      temperatureC: 28.3,
      isGridConnected: true,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(collector.messages).toHaveLength(1);
    expect(collector.messages[0].deviceId).toBe("sim-device-01");
    expect(collector.messages[0].socPercent).toBe(75.5);

    collector.sub.unsubscribe();
  });

  it("should send dispatch via bus and verify delivery", async () => {
    const collector = await subscribeDispatches(ctx.bus, "battery-fleet-01");

    await ctx.bus.publish("dispatch.battery-fleet-01", {
      type: "dispatch",
      source: "pde-engine",
      commandId: "cmd-001",
      assetId: "battery-fleet-01",
      powerKw: 50,
      durationSeconds: 3600,
      reason: "arbitrage",
      signature: "test-sig",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(collector.messages).toHaveLength(1);
    expect(collector.messages[0].assetId).toBe("battery-fleet-01");
    expect(collector.messages[0].powerKw).toBe(50);
    expect(collector.messages[0].reason).toBe("arbitrage");

    collector.sub.unsubscribe();
  });

  it("should deliver both telemetry and dispatch on the same bus", async () => {
    const telemetryCol = await subscribeTelemetry(ctx.bus);
    const dispatchCol = await subscribeDispatches(ctx.bus);

    await ctx.bus.publish("telemetry.device-99", {
      type: "telemetry",
      source: "device-99",
      deviceId: "device-99",
      timestamp: new Date().toISOString(),
      socPercent: 50,
      powerW: 0,
      voltageV: 400,
      frequencyHz: 60,
      temperatureC: 25,
      isGridConnected: true,
    });

    await ctx.bus.publish("dispatch.device-99", {
      type: "dispatch",
      source: "test",
      commandId: "cmd-99",
      assetId: "device-99",
      powerKw: -20,
      durationSeconds: 600,
      reason: "v2g",
      signature: "sig-99",
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(telemetryCol.messages).toHaveLength(1);
    expect(dispatchCol.messages).toHaveLength(1);
    expect(dispatchCol.messages[0].reason).toBe("v2g");

    telemetryCol.sub.unsubscribe();
    dispatchCol.sub.unsubscribe();
  });

  describe("RBAC Permissions", () => {
    it("should allow admin to access all permissions", () => {
      const allPerms = [
        Permission.AssetsRead, Permission.AssetsWrite, Permission.AssetsDelete,
        Permission.DispatchRead, Permission.DispatchExecute,
        Permission.MarketRead,
        Permission.AdminUsers, Permission.AdminSystem, Permission.AdminAudit,
        Permission.TelemetryRead, Permission.TelemetryWrite,
      ];
      for (const perm of allPerms) {
        expect(ctx.auth.hasPermission(ctx.users.admin, perm)).toBe(true);
      }
    });

    it("should allow device to write telemetry", () => {
      expect(ctx.auth.hasPermission(ctx.users.device, Permission.TelemetryWrite)).toBe(true);
    });

    it("should deny device read permissions", () => {
      expect(ctx.auth.hasPermission(ctx.users.device, Permission.AssetsRead)).toBe(false);
      expect(ctx.auth.hasPermission(ctx.users.device, Permission.MarketRead)).toBe(false);
      expect(ctx.auth.hasPermission(ctx.users.device, Permission.DispatchRead)).toBe(false);
    });

    it("should allow viewer to read but not write telemetry", () => {
      expect(ctx.auth.hasPermission(ctx.users.viewer, Permission.TelemetryRead)).toBe(true);
      expect(ctx.auth.hasPermission(ctx.users.viewer, Permission.TelemetryWrite)).toBe(false);
    });

    it("should deny viewer dispatch execute", () => {
      expect(ctx.auth.hasPermission(ctx.users.viewer, Permission.DispatchExecute)).toBe(false);
    });

    it("should enforce permission via requirePermission", () => {
      expect(() => ctx.auth.requirePermission(ctx.users.viewer, Permission.DispatchExecute)).toThrow("Insufficient permissions");
      expect(() => ctx.auth.requirePermission(ctx.users.device, Permission.AdminSystem)).toThrow("Insufficient permissions");
      expect(() => ctx.auth.requirePermission(ctx.users.admin, Permission.AdminSystem)).not.toThrow();
    });
  });

  describe("Market Data", () => {
    it("should fetch simulated PLD prices", async () => {
      const prices = await ctx.marketData.fetchPldPrices(new Date(), new Date(Date.now() + 3600_000), true);
      expect(prices.length).toBeGreaterThan(0);
      for (const p of prices) {
        expect(p.pricePerKwh).toBeGreaterThan(0);
        expect(p.source).toMatch(/CCEE_PLD_SIMULATED/);
      }
    });

    it("should produce different prices for different hours", async () => {
      const prices = await ctx.marketData.fetchPldPrices(new Date(), new Date(Date.now() + 24 * 3600_000), true);
      const uniquePrices = new Set(prices.map((p) => p.pricePerKwh));
      expect(uniquePrices.size).toBeGreaterThan(1);
    });

    it("should cache price results", async () => {
      const start = new Date();
      const end = new Date(start.getTime() + 3600_000);
      const p1 = await ctx.marketData.fetchPldPrices(start, end, true);
      const p2 = await ctx.marketData.fetchPldPrices(start, end, true);
      expect(p2).toEqual(p1);
    });
  });
});

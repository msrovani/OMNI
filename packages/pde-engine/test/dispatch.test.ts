import { describe, it, expect } from "vitest";
import { DispatchOrchestrator } from "../src/dispatch.js";

describe("DispatchOrchestrator", () => {
  it("should sign and verify commands", () => {
    const dispatcher = new DispatchOrchestrator("test-key");
    const sig = dispatcher.sign({
      assetId: "bat-001",
      powerKw: 50,
      durationSeconds: 3600,
      reason: "arbitrage",
    });
    const verified = dispatcher.verify(
      {
        assetId: "bat-001",
        powerKw: 50,
        durationSeconds: 3600,
        reason: "arbitrage",
      },
      sig
    );
    expect(verified).toBe(true);
  });

  it("should reject tampered commands", () => {
    const dispatcher = new DispatchOrchestrator("test-key");
    const sig = dispatcher.sign({
      assetId: "bat-001",
      powerKw: 50,
      durationSeconds: 3600,
      reason: "arbitrage",
    });
    const verified = dispatcher.verify(
      {
        assetId: "bat-001",
        powerKw: 100,
        durationSeconds: 3600,
        reason: "arbitrage",
      },
      sig
    );
    expect(verified).toBe(false);
  });

  it("should record command history", async () => {
    const dispatcher = new DispatchOrchestrator();
    await dispatcher.execute({
      assetId: "bat-001",
      powerKw: 50,
      durationSeconds: 3600,
      reason: "arbitrage",
    });
    expect(dispatcher.getStats().totalCommands).toBe(1);
    expect(dispatcher.getStats().acceptedCount).toBe(1);
  });

  it("should filter history by assetId", async () => {
    const dispatcher = new DispatchOrchestrator();
    await dispatcher.execute({
      assetId: "bat-001",
      powerKw: 50,
      durationSeconds: 3600,
      reason: "arbitrage",
    });
    await dispatcher.execute({
      assetId: "bat-002",
      powerKw: 100,
      durationSeconds: 1800,
      reason: "peak_shave",
    });
    expect(dispatcher.getHistory("bat-001")).toHaveLength(1);
    expect(dispatcher.getHistory("bat-002")).toHaveLength(1);
    expect(dispatcher.getHistory()).toHaveLength(2);
  });

  it("should execute ons_command reason type", async () => {
    const dispatcher = new DispatchOrchestrator();
    const record = await dispatcher.execute({
      assetId: "bat-001",
      powerKw: 50,
      durationSeconds: 3600,
      reason: "ons_command",
    });
    expect(record.reason).toBe("ons_command");
    expect(record.accepted).toBe(true);
  });

  it("should execute ONS command and store metadata", async () => {
    const dispatcher = new DispatchOrchestrator();
    const record = await dispatcher.executeOnsCommand(
      {
        assetId: "bat-001",
        serviceType: "frequency_regulation_primary",
        powerKw: 50,
        durationSeconds: 3600,
        meritoOrder: 1,
        deadline: new Date(),
        onsCommandId: "ONS-2026-TEST",
        submercado: "SE_CO",
      },
      "test-sig"
    );
    expect(record.reason).toBe("ons_command");
    expect(record.onsCommandId).toBe("ONS-2026-TEST");
    expect(record.serviceType).toBe("frequency_regulation_primary");
    expect(record.accepted).toBe(true);
  });

  it("should return ancillary history", async () => {
    const dispatcher = new DispatchOrchestrator();
    await dispatcher.execute({ assetId: "bat-001", powerKw: 50, durationSeconds: 3600, reason: "arbitrage" });
    await dispatcher.execute({ assetId: "bat-001", powerKw: 50, durationSeconds: 3600, reason: "ancillary" });
    await dispatcher.executeOnsCommand(
      { assetId: "bat-001", serviceType: "reserve_power", powerKw: 100, durationSeconds: 1800, meritoOrder: 1, deadline: new Date(), onsCommandId: "ONS-T", submercado: "SE_CO" },
      "sig"
    );
    const ancillary = dispatcher.getAncillaryHistory();
    expect(ancillary).toHaveLength(2);
  });

  it("should track ons_command count in stats", async () => {
    const dispatcher = new DispatchOrchestrator();
    await dispatcher.execute({ assetId: "bat-001", powerKw: 50, durationSeconds: 3600, reason: "arbitrage" });
    await dispatcher.executeOnsCommand(
      { assetId: "bat-001", serviceType: "frequency_regulation_primary", powerKw: 50, durationSeconds: 3600, meritoOrder: 1, deadline: new Date(), onsCommandId: "ONS-S", submercado: "SE_CO" },
      "sig"
    );
    const stats = dispatcher.getStats();
    expect(stats.ancillaryCount).toBe(0);
    expect(stats.onsCommandCount).toBe(1);
  });
});

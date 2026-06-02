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
});

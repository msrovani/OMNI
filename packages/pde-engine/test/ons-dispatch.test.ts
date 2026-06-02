import { describe, it, expect } from "vitest";
import { OnsDispatchHandler } from "../src/ons-dispatch.js";

describe("OnsDispatchHandler", () => {
  it("should sign and verify ONS commands", () => {
    const handler = new OnsDispatchHandler("test-ons-key");
    const cmd = {
      assetId: "bat-001",
      serviceType: "frequency_regulation_primary" as const,
      powerKw: 50,
      durationSeconds: 3600,
      meritoOrder: 1,
      deadline: new Date(),
      onsCommandId: "ONS-2026-001",
      submercado: "SE_CO" as const,
    };
    const sig = handler.sign(cmd);
    expect(sig).toBeTruthy();
    expect(sig.length).toBe(64);
  });

  it("should process an ONS command and return dispatch + record + revenue", async () => {
    const handler = new OnsDispatchHandler("test-key");
    const result = await handler.processOnsCommand({
      assetId: "bat-001",
      serviceType: "frequency_regulation_secondary",
      powerKw: 100,
      durationSeconds: 1800,
      meritoOrder: 2,
      deadline: new Date(Date.now() + 300000),
      onsCommandId: "ONS-2026-002",
      submercado: "S",
    });

    expect(result.dispatchCommand.reason).toBe("ons_command");
    expect(result.dispatchCommand.powerKw).toBe(100);
    expect(result.record.serviceType).toBe("frequency_regulation_secondary");
    expect(result.record.onsCommandId).toBe("ONS-2026-002");
    expect(result.record.accepted).toBe(true);
    expect(result.estimatedRevenue).toBeGreaterThan(0);
  });

  it("should calculate ancillary revenue correctly", () => {
    const handler = new OnsDispatchHandler();
    const rates = handler.getAncillaryRevenueRates();
    expect(rates.frequency_regulation_primary).toBe(45);
    expect(rates.frequency_regulation_secondary).toBe(35);
    expect(rates.frequency_regulation_tertiary).toBe(25);
    expect(rates.reserve_power).toBe(20);
    expect(rates.reactive_support).toBe(15);
  });

  it("should process a batch of ONS commands", async () => {
    const handler = new OnsDispatchHandler("batch-key");
    const commands = [
      {
        assetId: "bat-001",
        serviceType: "frequency_regulation_primary" as const,
        powerKw: 50,
        durationSeconds: 3600,
        meritoOrder: 1,
        deadline: new Date(),
        onsCommandId: "ONS-2026-003",
        submercado: "SE_CO" as const,
      },
      {
        assetId: "bat-001",
        serviceType: "reserve_power" as const,
        powerKw: 200,
        durationSeconds: 7200,
        meritoOrder: 3,
        deadline: new Date(),
        onsCommandId: "ONS-2026-004",
        submercado: "SE_CO" as const,
      },
    ];

    const result = await handler.processOnsCommandBatch(commands);
    expect(result.dispatchCommands).toHaveLength(2);
    expect(result.records).toHaveLength(2);
    expect(result.totalRevenue).toBeGreaterThan(0);
  });

  it("should track frequency regulation status per asset", async () => {
    const handler = new OnsDispatchHandler();

    await handler.processOnsCommand({
      assetId: "bat-001",
      serviceType: "frequency_regulation_primary",
      powerKw: 50,
      durationSeconds: 3600,
      meritoOrder: 1,
      deadline: new Date(),
      onsCommandId: "ONS-2026-005",
      submercado: "SE_CO",
    });

    await handler.processOnsCommand({
      assetId: "bat-001",
      serviceType: "frequency_regulation_secondary",
      powerKw: 100,
      durationSeconds: 1800,
      meritoOrder: 2,
      deadline: new Date(),
      onsCommandId: "ONS-2026-006",
      submercado: "SE_CO",
    });

    const status = handler.getRegulationStatus("bat-001");
    expect(status).toBeDefined();
    expect(status!.primaryMw).toBe(0.05);
    expect(status!.secondaryMw).toBe(0.1);
    expect(status!.accreditationStatus).toBe("accredited");
    expect(status!.totalAncillaryRevenueBrlPerMonth).toBeGreaterThan(0);
  });

  it("should filter records by assetId", async () => {
    const handler = new OnsDispatchHandler();

    await handler.processOnsCommand({
      assetId: "bat-001",
      serviceType: "frequency_regulation_primary",
      powerKw: 50,
      durationSeconds: 3600,
      meritoOrder: 1,
      deadline: new Date(),
      onsCommandId: "ONS-001",
      submercado: "SE_CO",
    });

    await handler.processOnsCommand({
      assetId: "bat-002",
      serviceType: "reserve_power",
      powerKw: 100,
      durationSeconds: 3600,
      meritoOrder: 2,
      deadline: new Date(),
      onsCommandId: "ONS-002",
      submercado: "NE",
    });

    expect(handler.getRecords("bat-001")).toHaveLength(1);
    expect(handler.getRecords("bat-002")).toHaveLength(1);
    expect(handler.getRecords()).toHaveLength(2);
  });

  it("should return correct stats", async () => {
    const handler = new OnsDispatchHandler();
    expect(handler.getStats().totalCommands).toBe(0);

    await handler.processOnsCommand({
      assetId: "bat-001",
      serviceType: "frequency_regulation_primary",
      powerKw: 50,
      durationSeconds: 3600,
      meritoOrder: 1,
      deadline: new Date(),
      onsCommandId: "ONS-003",
      submercado: "SE_CO",
    });

    const stats = handler.getStats();
    expect(stats.totalCommands).toBe(1);
    expect(stats.totalRevenueBrl).toBeGreaterThan(0);
    expect(stats.accreditedAssets).toBe(1);
  });

  it("should handle different ancillary service types", async () => {
    const handler = new OnsDispatchHandler();
    const types = [
      "frequency_regulation_primary",
      "frequency_regulation_secondary",
      "frequency_regulation_tertiary",
      "reserve_power",
      "reactive_support",
    ] as const;

    for (let i = 0; i < types.length; i++) {
      const result = await handler.processOnsCommand({
        assetId: "bat-001",
        serviceType: types[i],
        powerKw: 100,
        durationSeconds: 3600,
        meritoOrder: i + 1,
        deadline: new Date(),
        onsCommandId: `ONS-TYPE-${i}`,
        submercado: "SE_CO",
      });
      expect(result.estimatedRevenue).toBeGreaterThan(0);
      expect(result.record.serviceType).toBe(types[i]);
    }

    const status = handler.getRegulationStatus("bat-001");
    expect(status!.primaryMw).toBeGreaterThan(0);
    expect(status!.secondaryMw).toBeGreaterThan(0);
    expect(status!.tertiaryMw).toBeGreaterThan(0);
    expect(status!.reservePowerMw).toBeGreaterThan(0);
  });
});

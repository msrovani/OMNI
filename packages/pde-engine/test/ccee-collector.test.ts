import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CceeCollector } from "../src/ccee-collector.js";

const MOCK_JSON_RESPONSE = {
  fields: [
    { id: "_id", type: "int" },
    { id: "MES_REFERENCIA", type: "text" },
    { id: "SUBMERCADO", type: "text" },
    { id: "PERIODO_COMERCIALIZACAO", type: "numeric" },
    { id: "DIA", type: "text" },
    { id: "HORA", type: "numeric" },
    { id: "PLD_HORA", type: "numeric" },
  ],
  records: [
    [1, "202605", "SUDESTE", 649, "27", 0, 298.02],
    [2, "202605", "SUDESTE", 649, "27", 1, 285.5],
    [3, "202605", "SUL", 649, "27", 0, 275.1],
    [4, "202605", "NORDESTE", 649, "27", 0, 268.3],
    [5, "202605", "NORTE", 649, "27", 0, 310.45],
    [6, "202605", "SUDESTE", 649, "27", 6, 420.0],
    [7, "202605", "SUDESTE", 649, "28", 0, 302.1],
    [8, "202605", "SUDESTE", 649, "28", 18, 550.0],
  ],
};

describe("CceeCollector", () => {
  let collector: CceeCollector;

  beforeEach(() => {
    collector = new CceeCollector();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(MOCK_JSON_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch and parse PLD prices for SE_CO", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    const prices = await collector.fetchPldPrices(start, end, "SE_CO");
    expect(prices.length).toBeGreaterThan(0);
    prices.forEach((p) => {
      expect(p.submercado).toBe("SE_CO");
      expect(p.currency).toBe("BRL");
      expect(p.source).toMatch(/CCEE_PLD_LIVE_SE_CO/);
      expect(p.pricePerKwh).toBeGreaterThan(0);
    });
  });

  it("should fetch all submercados", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    const all = await collector.fetchAllSubmarkets(start, end);
    expect(all.size).toBe(4);
    expect(all.get("SE_CO")!.length).toBeGreaterThan(0);
    expect(all.get("S")!.length).toBeGreaterThan(0);
    expect(all.get("NE")!.length).toBeGreaterThan(0);
    expect(all.get("N")!.length).toBeGreaterThan(0);
  });

  it("should map CCEE submercado names correctly", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    const ne = await collector.fetchPldPrices(start, end, "NE");
    expect(ne[0].submercado).toBe("NE");
    expect(ne[0].source).toBe("CCEE_PLD_LIVE_NE");
  });

  it("should convert R$/MWh to R$/kWh", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    const prices = await collector.fetchPldPrices(start, end, "SE_CO");
    const pld298 = prices.find((p) => Math.abs(p.pricePerKwh - 0.29802) < 0.001);
    expect(pld298).toBeDefined();
  });

  it("should cache results and not re-fetch", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    await collector.fetchPldPrices(start, end, "SE_CO");
    const countAfterFirst = collector.getFetchCount();
    await collector.fetchPldPrices(start, end, "SE_CO");
    expect(collector.getFetchCount()).toBe(countAfterFirst);
  });

  it("should clear cache", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    await collector.fetchPldPrices(start, end, "SE_CO");
    collector.clearCache();
    expect(collector.getFetchCount()).toBe(1);
  });

  it("should filter by date range", async () => {
    const start = new Date("2026-05-28T00:00:00Z");
    const end = new Date("2026-05-29T00:00:00Z");
    const prices = await collector.fetchPldPrices(start, end, "SE_CO");
    expect(prices.every((p) => p.timestamp >= start)).toBe(true);
  });

  it("should handle fetch errors gracefully", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    await expect(
      collector.fetchPldPrices(new Date("2026-05-27T00:00:00Z"), new Date("2026-05-28T00:00:00Z"))
    ).rejects.toThrow();
  });
});

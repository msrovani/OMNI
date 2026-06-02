import { describe, it, expect, vi, afterEach } from "vitest";
import { MarketDataClient } from "../src/market-data.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MarketDataClient", () => {
  it("should fetch live price points when simulate=false", async () => {
    const mockRecords = [
      ["rec1", "202605", "SUDESTE", "2026", "27", "0", "250.00"],
      ["rec2", "202605", "SUDESTE", "2026", "27", "1", "180.50"],
    ];
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ records: mockRecords }), { status: 200 }))
    );

    const client = new MarketDataClient({ useCceeCollector: true });
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-27T06:00:00Z");
    const prices = await client.fetchPldPrices(start, end, false, "SE_CO");
    expect(prices.length).toBeGreaterThan(0);
    prices.forEach((p) => {
      expect(p.pricePerKwh).toBeGreaterThan(0);
      expect(p.currency).toBe("BRL");
      expect(p.source).toMatch(/CCEE_PLD_LIVE/);
    });
  });

  it("should fall back to simulated data when live fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const client = new MarketDataClient();
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-27T01:00:00Z");
    const prices = await client.fetchPldPrices(start, end, true);
    expect(prices.length).toBeGreaterThan(0);
    prices.forEach((p) => {
      expect(p.pricePerKwh).toBeGreaterThan(0);
      expect(p.source).toMatch(/CCEE_PLD_SIMULATED/);
    });
  });

  it("should cache results", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ records: [] }), { status: 200 }))
    );
    const client = new MarketDataClient();
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-27T01:00:00Z");
    const first = await client.fetchPldPrices(start, end, true);
    const second = await client.fetchPldPrices(start, end, true);
    expect(first.length).toBeGreaterThan(0);
    expect(first).toEqual(second);
  });

  it("should clear cache", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ records: [] }), { status: 200 }))
    );
    const client = new MarketDataClient();
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-27T01:00:00Z");
    await client.fetchPldPrices(start, end, true);
    client.clearCache();
    const prices = await client.fetchPldPrices(start, end, true);
    expect(prices.length).toBeGreaterThan(0);
  });

  it("should fetch prices for specific submercado", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ records: [] }), { status: 200 }))
    );
    const client = new MarketDataClient();
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-27T03:00:00Z");
    const prices = await client.fetchPldPrices(start, end, true, "NE");
    expect(prices.length).toBeGreaterThan(0);
    prices.forEach((p) => {
      expect(p.submercado).toBe("NE");
      expect(p.currency).toBe("BRL");
      expect(p.source).toMatch(/CCEE_PLD_SIMULATED_NE/);
    });
  });

  it("should fetch all submercados", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ records: [] }), { status: 200 }))
    );
    const client = new MarketDataClient();
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-27T01:00:00Z");
    const all = await client.fetchAllSubmarkets(start, end, true);
    expect(all.size).toBe(4);
    for (const [sm, prices] of all) {
      expect(prices.length).toBeGreaterThan(0);
      expect(prices[0].submercado).toBe(sm);
    }
  });
});

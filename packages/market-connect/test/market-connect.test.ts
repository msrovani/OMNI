import { describe, it, expect, beforeEach } from "vitest";
import { MarketConnectBrazilService } from "../src/index.js";

describe("MarketConnectBrazilService", () => {
  let market: MarketConnectBrazilService;

  beforeEach(() => {
    market = new MarketConnectBrazilService();
  });

  it("should simulate a price quote for default submercado", () => {
    const quote = market.simulatePrice();
    expect(quote.precoPorMwh).toBeGreaterThan(0);
    expect(quote.precoPorKwh).toBeGreaterThan(0);
    expect(quote.precoPorMwh / 1000).toBeCloseTo(quote.precoPorKwh, 2);
    expect(quote.fonte).toMatch(/CCEE_PLD_SIMULATED/);
    expect(quote.submercado).toBe("SE_CO");
    expect(quote.moeda).toBe("BRL");
    expect(quote.id).toBeDefined();
  });

  it("should simulate all 4 submercados", () => {
    const quotes = market.simulateAllSubmarkets();
    expect(quotes).toHaveLength(4);
    const codes = quotes.map((q) => q.submercado);
    expect(codes).toContain("SE_CO");
    expect(codes).toContain("S");
    expect(codes).toContain("NE");
    expect(codes).toContain("N");
  });

  it("should store price history", () => {
    for (let i = 0; i < 5; i++) {
      market.simulatePrice("SE_CO");
    }
    expect(market.getPriceCount()).toBe(5);
    expect(market.getRecentPrices(3)).toHaveLength(3);
  });

  it("should compute average price", () => {
    market.simulatePrice("SE_CO");
    market.simulatePrice("SE_CO");
    const avg = market.getAveragePrice(new Date(0));
    expect(avg).toBeGreaterThan(0);
  });

  it("should notify subscribers", () => {
    const received: any[] = [];
    const unsub = market.subscribe((price) => received.push(price));
    market.simulatePrice("SE_CO");
    expect(received).toHaveLength(1);
    expect(received[0]!.precoPorMwh).toBeGreaterThan(0);
    unsub();
    market.simulatePrice("NE");
    expect(received).toHaveLength(1);
  });

  it("should cap history at 10000", () => {
    for (let i = 0; i < 12000; i++) {
      market.simulatePrice("SE_CO");
    }
    expect(market.getPriceCount()).toBeLessThanOrEqual(10000);
  });

  it("should list utility providers", () => {
    const utilities = market.getUtilityProviders();
    expect(utilities["enel-sp"]).toBeDefined();
    expect(utilities["cemig"]).toBeDefined();
  });

  it("should list traders", () => {
    const traders = market.getTraders();
    expect(traders["tradener"]).toBeDefined();
    expect(traders["comerc"]).toBeDefined();
  });
});

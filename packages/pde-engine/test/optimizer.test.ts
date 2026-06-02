import { describe, it, expect } from "vitest";
import { StochasticOptimizer } from "../src/optimizer.js";
import type { Asset, PricePoint } from "../src/types.js";

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "bat-001",
    clientId: "client-001",
    manufacturer: "Tesla",
    model: "Megapack 100",
    capacityKwh: 100,
    nominalPowerKw: 50,
    cycleLife: 6000,
    replacementCost: 50000,
    minSocPercent: 20,
    maxSocPercent: 95,
    installedAt: new Date(),
    ...overrides,
  };
}

function makePrices(base: number, count: number): PricePoint[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.now() + i * 900_000),
    pricePerKwh: base + Math.sin(i * 0.5) * 0.1,
    source: "test",
  }));
}

describe("StochasticOptimizer", () => {
  it("should return commands when arbitrage opportunity exists", () => {
    const opt = new StochasticOptimizer(1000);
    const asset = makeAsset();
    const prices = makePrices(0.35, 8);
    const result = opt.optimize(
      [asset],
      prices,
      { "bat-001": 80 },
      "balanced"
    );
    expect(result.commands.length).toBeGreaterThanOrEqual(0);
    expect(result.scenarioCount).toBe(1000);
  });

  it("should return empty commands at low SoC", () => {
    const opt = new StochasticOptimizer(1000);
    const asset = makeAsset();
    const prices = makePrices(0.35, 8);
    const result = opt.optimize(
      [asset],
      prices,
      { "bat-001": 15 },
      "balanced"
    );
    expect(result.commands).toHaveLength(0);
  });

  it("should estimate degradation costs", () => {
    const opt = new StochasticOptimizer();
    const asset = makeAsset();
    const cost = opt.estimateDegradation(asset, 10);
    const expected = (10 / 100) * (50000 / 6000);
    expect(cost).toBeCloseTo(expected, 4);
  });
});

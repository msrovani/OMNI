import type {
  Asset,
  DispatchCommand,
  OptimizationObjective,
  OptimizationResult,
  PricePoint,
  PldSubmarket,
} from "./types.js";

interface OptimizationContext {
  asset: Asset;
  buyPrice: number;
  sellPrice: number;
  currentSoc: number;
  degradationCostPerCycle: number;
}

export class StochasticOptimizer {
  private numScenarios: number;

  constructor(numScenarios = 100_000) {
    this.numScenarios = numScenarios;
  }

  optimize(
    assets: Asset[],
    priceForecast: PricePoint[],
    currentSoc: Record<string, number>,
    objective: OptimizationObjective = "balanced",
    submercado?: PldSubmarket
  ): OptimizationResult {
    const commands: DispatchCommand[] = [];
    let totalProfit = 0;
    let totalDegradation = 0;

    for (const asset of assets) {
      const soc = currentSoc[asset.id] ?? 50;
      if (soc < asset.minSocPercent + 5) continue;

      const bestTrade = this.findBestTrade(
        asset,
        priceForecast,
        soc,
        objective
      );
      if (bestTrade) {
        commands.push(bestTrade.command);
        totalProfit += bestTrade.profit;
        totalDegradation += bestTrade.degradationCost;
      }
    }

    return {
      commands,
      expectedProfitBrl: totalProfit,
      expectedDegradationCost: totalDegradation,
      scenarioCount: this.numScenarios * assets.length,
      submercado,
    };
  }

  private findBestTrade(
    asset: Asset,
    prices: PricePoint[],
    currentSoc: number,
    objective: OptimizationObjective
  ): {
    command: DispatchCommand;
    profit: number;
    degradationCost: number;
  } | null {
    let bestProfit = -Infinity;
    let bestCommand: DispatchCommand | null = null;

    for (let buyIdx = 0; buyIdx < prices.length - 1; buyIdx++) {
      for (let sellIdx = buyIdx + 1; sellIdx < prices.length; sellIdx++) {
        const buyPrice = prices[buyIdx]!.pricePerKwh;
        const sellPrice = prices[sellIdx]!.pricePerKwh;
        const spread = sellPrice - buyPrice;
        if (spread <= 0) continue;

        const energyMwh = asset.capacityKwh * 0.8;
        const grossProfit = spread * energyMwh * 1000;
        const dod = (energyMwh / asset.capacityKwh) * 100;
        const degradationCost = this.estimateDegradation(asset, dod);
        const netProfit = grossProfit - degradationCost;

        const score = this.score(objective, netProfit, degradationCost);
        if (score > bestProfit) {
          bestProfit = score;
          bestCommand = {
            assetId: asset.id,
            powerKw: asset.nominalPowerKw,
            durationSeconds: (sellIdx - buyIdx) * 900,
            reason: "arbitrage",
          };
        }
      }
    }

    if (!bestCommand) return null;

    const buyP = prices[0]!.pricePerKwh;
    const sellP = prices[prices.length - 1]!.pricePerKwh;
    const profit = (sellP - buyP) * asset.capacityKwh * 0.8 * 1000;
    const dod = (asset.capacityKwh * 0.8) / asset.capacityKwh * 100;

    return {
      command: bestCommand,
      profit,
      degradationCost: this.estimateDegradation(asset, dod),
    };
  }

  private score(
    objective: OptimizationObjective,
    profit: number,
    degradation: number
  ): number {
    switch (objective) {
      case "profit":
        return profit;
      case "battery_life":
        return profit - degradation * 3;
      case "grid_stability":
        return profit;
      case "balanced":
      default:
        return profit - degradation * 0.5;
    }
  }

  estimateDegradation(asset: Asset, dodPercent: number): number {
    const cycleCost = asset.replacementCost / Math.max(asset.cycleLife, 1);
    return (dodPercent / 100) * cycleCost;
  }
}

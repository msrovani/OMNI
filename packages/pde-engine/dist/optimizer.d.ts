import type { Asset, OptimizationObjective, OptimizationResult, PricePoint, PldSubmarket } from "./types.js";
export declare class StochasticOptimizer {
    private numScenarios;
    constructor(numScenarios?: number);
    optimize(assets: Asset[], priceForecast: PricePoint[], currentSoc: Record<string, number>, objective?: OptimizationObjective, submercado?: PldSubmarket): OptimizationResult;
    private findBestTrade;
    private score;
    estimateDegradation(asset: Asset, dodPercent: number): number;
}
//# sourceMappingURL=optimizer.d.ts.map
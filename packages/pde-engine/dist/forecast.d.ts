import type { ForecastResult } from "./types.js";
export { type ForecastPoint } from "./types.js";
export interface ForecastModel {
    name: string;
    fit(historical: number[], period: number): void;
    predict(steps: number): number[];
    update(actual: number): void;
    getConfidenceInterval(steps: number): {
        upper: number[];
        lower: number[];
    };
    getMetrics(): {
        mae: number;
        rmse: number;
        mape: number;
    };
}
export declare class HoltWintersModel implements ForecastModel {
    readonly name = "Holt-Winters";
    private alpha;
    private beta;
    private gamma;
    private period;
    private level;
    private trend;
    private seasonal;
    private fitted;
    private lastIdx;
    private errorHistory;
    private kalman;
    constructor(options?: {
        alpha?: number;
        beta?: number;
        gamma?: number;
    });
    fit(historical: number[], period?: number): void;
    predict(steps: number): number[];
    update(actual: number): void;
    getConfidenceInterval(steps: number): {
        upper: number[];
        lower: number[];
    };
    getMetrics(): {
        mae: number;
        rmse: number;
        mape: number;
    };
}
export declare function createHoltWintersModel(options?: {
    alpha?: number;
    beta?: number;
    gamma?: number;
}): ForecastModel;
export declare function createNaiveSeasonalModel(): ForecastModel;
interface ForecastFeatures {
    hourOfDay: number;
    dayOfWeek: number;
    month: number;
    isWeekend: number;
    temperature: number;
    solarIrradiance: number;
    prevLoadKwh: number;
    sameHourYesterdayKwh: number;
    rollingAvg3hKwh: number;
}
export declare class ForecastEngine {
    private hwModel;
    constructor();
    predict(assetId: string, features: ForecastFeatures[], horizon: number): ForecastResult;
    updateForecastWithActual(actualLoad: number): void;
    getModel(): HoltWintersModel;
    private computeMae;
}
export declare function generateForecast(historical: number[], horizon: number, period?: number): {
    predictions: number[];
    confidenceUpper: number[];
    confidenceLower: number[];
    metrics: {
        mae: number;
        rmse: number;
        mape: number;
    };
};
export declare function updateForecastWithActual(model: ForecastModel, actual: number): void;
//# sourceMappingURL=forecast.d.ts.map
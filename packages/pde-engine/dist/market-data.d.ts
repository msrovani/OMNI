import type { PricePoint, PldSubmarket } from "./types.js";
export declare const PLD_SUBMARKETS: PldSubmarket[];
export declare class MarketDataClient {
    private cache;
    fetchPldPrices(start: Date, end: Date, simulate?: boolean, submercado?: PldSubmarket): Promise<PricePoint[]>;
    fetchAllSubmarkets(start: Date, end: Date, simulate?: boolean): Promise<Map<PldSubmarket, PricePoint[]>>;
    clearCache(): void;
}
//# sourceMappingURL=market-data.d.ts.map
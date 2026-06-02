import type { PricePoint, PldSubmarket } from "./types.js";
import { CceeCollector } from "./ccee-collector.js";

export const PLD_SUBMARKETS: PldSubmarket[] = ["SE_CO", "S", "NE", "N"];

const PISO_PLD = 69.07;
const TETO_PLD = 599.31;

function simulatePldPrice(submercado: PldSubmarket, hour: number): number {
  const brtHour = hour;

  let base: number;
  if (brtHour < 6) {
    base = PISO_PLD + Math.random() * 80;
  } else if (brtHour >= 18 && brtHour < 21) {
    base = 300 + Math.random() * 250;
  } else if (brtHour >= 10 && brtHour < 17) {
    base = 200 + Math.random() * 150;
  } else {
    base = 100 + Math.random() * 100;
  }

  const factor: Record<PldSubmarket, number> = {
    SE_CO: 1.0,
    S: 0.95,
    NE: 0.85 + Math.random() * 0.15,
    N: 1.1 + Math.random() * 0.2,
  };

  const noise = (Math.random() - 0.5) * 60;
  const price = Math.max(PISO_PLD, Math.min(TETO_PLD, base * (factor[submercado] ?? 1) + noise));
  return Math.round(price * 100) / 100;
}

export interface MarketDataClientOptions {
  useCceeCollector?: boolean;
}

export class MarketDataClient {
  private cache: Map<string, PricePoint[]> = new Map();
  private cceeCollector: CceeCollector;
  private useLiveData: boolean;

  constructor(options?: MarketDataClientOptions) {
    this.cceeCollector = new CceeCollector();
    this.useLiveData = options?.useCceeCollector ?? false;
  }

  async fetchPldPrices(
    start: Date,
    end: Date,
    simulate = false,
    submercado: PldSubmarket = "SE_CO"
  ): Promise<PricePoint[]> {
    const key = `${submercado}-${start.toISOString()}-${end.toISOString()}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    if (!simulate || this.useLiveData) {
      try {
        const live = await this.cceeCollector.fetchPldPrices(start, end, submercado);
        if (live.length > 0) {
          this.cache.set(key, live);
          return live;
        }
      } catch {
        // fall through to simulation
      }
    }

    const prices: PricePoint[] = [];
    const current = new Date(start);

    while (current < end) {
      const brtHour = (current.getUTCHours() - 3 + 24) % 24;

      if (simulate) {
        const price = simulatePldPrice(submercado, brtHour);
        prices.push({
          timestamp: new Date(current),
          pricePerKwh: price / 1000,
          source: `CCEE_PLD_SIMULATED_${submercado}`,
          submercado,
          currency: "BRL",
        });
      }
      current.setUTCMinutes(current.getUTCMinutes() + 15);
    }

    this.cache.set(key, prices);
    if (this.cache.size > 10) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    return prices;
  }

  async fetchAllSubmarkets(
    start: Date,
    end: Date,
    simulate = false
  ): Promise<Map<PldSubmarket, PricePoint[]>> {
    const result = new Map<PldSubmarket, PricePoint[]>();
    for (const sm of PLD_SUBMARKETS) {
      const prices = await this.fetchPldPrices(start, end, simulate, sm);
      result.set(sm, prices);
    }
    return result;
  }

  clearCache(): void {
    this.cache.clear();
    this.cceeCollector.clearCache();
  }
}

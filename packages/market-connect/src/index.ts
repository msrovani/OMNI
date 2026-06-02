import { randomUUID } from "node:crypto";

export type PldSubmarket = "SE_CO" | "S" | "NE" | "N";

export interface PldSubmarketInfo {
  code: PldSubmarket;
  name: string;
  states: string[];
  weightPct: number;
}

export const PLD_SUBMARKETS: PldSubmarketInfo[] = [
  { code: "SE_CO", name: "Sudeste/Centro-Oeste", states: ["SP","RJ","MG","ES","DF","GO","MT","MS"], weightPct: 60 },
  { code: "S",      name: "Sul",                  states: ["PR","SC","RS"],                          weightPct: 15 },
  { code: "NE",     name: "Nordeste",             states: ["BA","PE","CE","RN","PB","AL","SE","PI","MA"], weightPct: 15 },
  { code: "N",      name: "Norte",                states: ["PA","AM","RO","AC","RR","AP","TO"],       weightPct: 10 },
];

export type UtilityProvider = keyof typeof UTILITY_PROVIDERS;

export const UTILITY_PROVIDERS = {
  "enel-sp":     { name: "Enel SP",          region: "SE_CO", group: "Enel" },
  "cemig":       { name: "CEMIG",            region: "SE_CO", group: "CEMIG" },
  "cpfl":        { name: "CPFL Paulista",    region: "SE_CO", group: "CPFL (State Grid)" },
  "light":       { name: "Light",            region: "SE_CO", group: "Light" },
  "edp-sp":      { name: "EDP SP",           region: "SE_CO", group: "EDP" },
  "copel":       { name: "Copel",            region: "S",     group: "Copel" },
  "celesc":      { name: "Celesc",           region: "S",     group: "Celesc" },
  "neoenergia-coelba":  { name: "Neoenergia Coelba",    region: "NE", group: "Neoenergia (Iberdrola)" },
  "neoenergia-pe":      { name: "Neoenergia Pernambuco", region: "NE", group: "Neoenergia (Iberdrola)" },
  "equatorial-pa":      { name: "Equatorial Pará",      region: "N",  group: "Equatorial" },
  "energisa-mt":  { name: "Energisa MT",       region: "SE_CO", group: "Energisa" },
} as const;

export type TraderProvider = keyof typeof TRADER_PROVIDERS;

export const TRADER_PROVIDERS = {
  "tradener":      { name: "Tradener",            focus: "Nacional" },
  "comerc":        { name: "Comerc",              focus: "Maior comercializadora independente" },
  "ecom-energia":  { name: "Ecom Energia",        focus: "Gestão de energia" },
  "safira":        { name: "Safira Energia",      focus: "Varejista" },
  "delta-energia": { name: "Delta Energia",       focus: "Comercialização e gestão" },
} as const;

export interface PriceQuoteBr {
  id: string;
  timestamp: Date;
  precoPorMwh: number;
  precoPorKwh: number;
  submercado: PldSubmarket;
  fonte: string;
  moeda: "BRL";
  bandeiraTarifaria?: "verde" | "amarela" | "vermelha-1" | "vermelha-2";
}

const CCEE_2026_RESOURCE_ID = "3f279d6b-1069-42f7-9b0a-217b084729c4";
const CCEE_BASE_URL = "https://dadosabertos.ccee.org.br/datastore/dump";

function getCurrentBandeira(): PriceQuoteBr["bandeiraTarifaria"] {
  const month = new Date().getMonth();
  if (month >= 4 && month <= 9) return "verde";
  if (Math.random() < 0.3) return "amarela";
  return "verde";
}

function simulatePldPrice(submercado: PldSubmarket): number {
  const hour = new Date().getUTCHours();
  const brtHour = (hour - 3 + 24) % 24;

  const piso = 69.07;
  const teto = 599.31;

  let base: number;
  if (brtHour < 6) {
    base = piso + Math.random() * 80;
  } else if (brtHour >= 18 && brtHour < 21) {
    base = 300 + Math.random() * 250;
  } else if (brtHour >= 10 && brtHour < 17) {
    base = 200 + Math.random() * 150;
  } else {
    base = 100 + Math.random() * 100;
  }

  const submercadoFactor: Record<PldSubmarket, number> = {
    SE_CO: 1.0,
    S: 0.95,
    NE: 0.85 + Math.random() * 0.15,
    N: 1.1 + Math.random() * 0.2,
  };

  const noise = (Math.random() - 0.5) * 60;
  const price = Math.max(piso, Math.min(teto, base * (submercadoFactor[submercado] ?? 1) + noise));
  return Math.round(price * 100) / 100;
}

const CCEE_SUBMERCADO_MAP: Record<string, PldSubmarket> = {
  SUDESTE: "SE_CO",
  SUL: "S",
  NORDESTE: "NE",
  NORTE: "N",
};

class MarketConnectBrazilService {
  private priceHistory: PriceQuoteBr[] = [];
  private subscribers: Array<(price: PriceQuoteBr) => void> = [];
  private cceeSource: "simulated" | "live" = "live";

  simulatePrice(submercado: PldSubmarket = "SE_CO"): PriceQuoteBr {
    const precoPorMwh = simulatePldPrice(submercado);

    const quote: PriceQuoteBr = {
      id: randomUUID(),
      timestamp: new Date(),
      precoPorMwh,
      precoPorKwh: Math.round((precoPorMwh / 1000) * 100000) / 100000,
      submercado,
      fonte: "CCEE_PLD_SIMULATED",
      moeda: "BRL",
      bandeiraTarifaria: getCurrentBandeira(),
    };

    this.priceHistory.push(quote);
    if (this.priceHistory.length > 10000) {
      this.priceHistory = this.priceHistory.slice(-5000);
    }

    this.notifySubscribers(quote);
    return quote;
  }

  simulateAllSubmarkets(): PriceQuoteBr[] {
    return PLD_SUBMARKETS.map((sm) => this.simulatePrice(sm.code));
  }

  subscribe(callback: (price: PriceQuoteBr) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  private notifySubscribers(quote: PriceQuoteBr): void {
    for (const sub of this.subscribers) {
      try {
        sub(quote);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  getRecentPrices(limit = 100): PriceQuoteBr[] {
    return this.priceHistory.slice(-limit);
  }

  getAveragePrice(since: Date): number {
    const filtered = this.priceHistory.filter((p) => p.timestamp >= since);
    if (filtered.length === 0) return 0;
    const sum = filtered.reduce((acc, p) => acc + p.precoPorMwh, 0);
    return sum / filtered.length;
  }

  getPriceCount(): number {
    return this.priceHistory.length;
  }

  async fetchLivePrices(submercado?: PldSubmarket): Promise<PriceQuoteBr[]> {
    try {
      const url = `${CCEE_BASE_URL}/${CCEE_2026_RESOURCE_ID}?format=json`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return [];

      const body = await res.json() as { records: unknown[][] };
      if (!body.records) return [];

      const quotes: PriceQuoteBr[] = [];
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 86_400_000);

      for (const r of body.records) {
        if (!Array.isArray(r) || r.length < 7) continue;
        const submercadoName = String(r[2] ?? "").toUpperCase();
        const mappedSub = CCEE_SUBMERCADO_MAP[submercadoName];
        if (!mappedSub) continue;
        if (submercado && mappedSub !== submercado) continue;

        const dia = String(r[4] ?? "");
        const hora = Number(r[5] ?? 0);
        const mesRef = String(r[1] ?? "");
        const year = parseInt(mesRef.slice(0, 4), 10);
        const month = parseInt(mesRef.slice(4, 6), 10) - 1;
        const day = parseInt(dia, 10);
        if (isNaN(year) || isNaN(month) || isNaN(day)) continue;

        const ts = new Date(Date.UTC(year, month, day, hora, 0, 0, 0));
        if (ts < oneDayAgo) continue;

        const pldMwh = Number(r[6] ?? 0);
        const quote: PriceQuoteBr = {
          id: randomUUID(),
          timestamp: ts,
          precoPorMwh: pldMwh,
          precoPorKwh: Math.round((pldMwh / 1000) * 100000) / 100000,
          submercado: mappedSub,
          fonte: "CCEE_PLD_LIVE",
          moeda: "BRL",
          bandeiraTarifaria: getCurrentBandeira(),
        };
        quotes.push(quote);
      }

      if (quotes.length > 0) {
        this.cceeSource = "live";
        for (const q of quotes) {
          this.priceHistory.push(q);
          this.notifySubscribers(q);
        }
        if (this.priceHistory.length > 10000) {
          this.priceHistory = this.priceHistory.slice(-5000);
        }
      }

      return quotes;
    } catch {
      return [];
    }
  }

  async fetchLiveAllSubmarkets(): Promise<PriceQuoteBr[]> {
    return this.fetchLivePrices();
  }

  getCceeSource(): "simulated" | "live" {
    return this.cceeSource;
  }

  getUtilityProviders(): typeof UTILITY_PROVIDERS {
    return UTILITY_PROVIDERS;
  }

  getTraders(): typeof TRADER_PROVIDERS {
    return TRADER_PROVIDERS;
  }
}

const market = new MarketConnectBrazilService();

async function publishPrices() {
  const live = await market.fetchLiveAllSubmarkets();
  const quotes = live.length > 0 ? live : market.simulateAllSubmarkets();
  for (const q of quotes) {
    console.log(
      `[PRECO] ${q.timestamp.toISOString()} | ` +
      `PLD ${q.submercado}: R$ ${q.precoPorMwh.toFixed(2)}/MWh ` +
      `(R$ ${(q.precoPorKwh * 100).toFixed(4)}/kWh) | Bandeira: ${q.bandeiraTarifaria} | Fonte: ${q.fonte}`
    );
  }
}

publishPrices();
setInterval(publishPrices, 900_000);

console.log("Market Connect Brasil iniciado — publicando preços PLD CCEE a cada 15min");
console.log(`Submercados: ${PLD_SUBMARKETS.map(s => s.code).join(", ")}`);

export { MarketConnectBrazilService };

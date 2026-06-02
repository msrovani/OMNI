import type { PricePoint, PldSubmarket } from "./types.js";

const CCEE_BASE_URL = "https://dadosabertos.ccee.org.br/datastore/dump";

const CCEE_RESOURCE_IDS: Record<number, string> = {
  2021: "51922462-16b4-4c64-8327-4e14d6ee8c6c",
  2022: "723cf7e6-6c29-4da6-aa39-e4c8804baf65",
  2023: "5fc317af-7191-4f8a-94e7-f77c56c747b3",
  2024: "1b5b6946-8036-4622-a7a3-b21f33fc52b7",
  2025: "2a180a6b-f092-43eb-9f82-a48798b803dc",
  2026: "3f279d6b-1069-42f7-9b0a-217b084729c4",
};

const CCEE_SUBMERCADO_MAP: Record<string, PldSubmarket> = {
  SUDESTE: "SE_CO",
  SUL: "S",
  NORDESTE: "NE",
  NORTE: "N",
};

interface CceeRecord {
  mesReferencia: string;
  submercado: string;
  dia: string;
  hora: number;
  pldMwh: number;
}

export class CceeCollector {
  private cache: Map<string, PricePoint[]> = new Map();
  private fetchCount = 0;
  private readonly maxCacheSize = 20;

  async fetchPldPrices(
    start: Date,
    end: Date,
    submercado?: PldSubmarket
  ): Promise<PricePoint[]> {
    const cacheKey = `${submercado ?? "all"}-${start.toISOString()}-${end.toISOString()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const years = this.getYearsInRange(start, end);
    const allRecords: CceeRecord[] = [];

    for (const year of years) {
      const records = await this.fetchYearData(year);
      allRecords.push(...records);
    }

    const filtered = this.filterRecords(allRecords, start, end, submercado);
    const prices = this.recordsToPricePoints(filtered);

    this.cache.set(cacheKey, prices);
    if (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    return prices;
  }

  async fetchAllSubmarkets(
    start: Date,
    end: Date
  ): Promise<Map<PldSubmarket, PricePoint[]>> {
    const result = new Map<PldSubmarket, PricePoint[]>();
    for (const sm of ["SE_CO", "S", "NE", "N"] as PldSubmarket[]) {
      const prices = await this.fetchPldPrices(start, end, sm);
      result.set(sm, prices);
    }
    return result;
  }

  getFetchCount(): number {
    return this.fetchCount;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async fetchYearData(year: number): Promise<CceeRecord[]> {
    const resourceId = CCEE_RESOURCE_IDS[year];
    if (!resourceId) return [];

    const url = `${CCEE_BASE_URL}/${resourceId}?format=json`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`CCEE API error: ${response.status} for year ${year}`);
    }

    this.fetchCount++;

    const body = await response.json() as {
      fields: { id: string; type: string }[];
      records: unknown[][];
    };

    if (!body.records) return [];

    return body.records
      .filter((r): r is unknown[] => Array.isArray(r) && r.length >= 7)
      .map((r) => ({
        mesReferencia: String(r[1] ?? ""),
        submercado: String(r[2] ?? "").toUpperCase(),
        dia: String(r[4] ?? ""),
        hora: Number(r[5] ?? 0),
        pldMwh: Number(r[6] ?? 0),
      }))
      .filter((r) => r.mesReferencia.length === 6 && r.dia.length > 0);
  }

  private getYearsInRange(start: Date, end: Date): number[] {
    const years: number[] = [];
    const sy = start.getUTCFullYear();
    const ey = end.getUTCFullYear();
    for (let y = sy; y <= ey; y++) {
      if (CCEE_RESOURCE_IDS[y]) years.push(y);
    }
    return years;
  }

  private filterRecords(
    records: CceeRecord[],
    start: Date,
    end: Date,
    submercado?: PldSubmarket
  ): CceeRecord[] {
    return records.filter((r) => {
      if (submercado) {
        const mapped = CCEE_SUBMERCADO_MAP[r.submercado];
        if (mapped !== submercado) return false;
      }

      const ts = this.buildCceeTimestamp(r.mesReferencia, r.dia, r.hora);
      if (!ts) return false;

      return ts >= start && ts <= end;
    });
  }

  private buildCceeTimestamp(mesReferencia: string, dia: string, hora: number): Date | null {
    const year = parseInt(mesReferencia.slice(0, 4), 10);
    const month = parseInt(mesReferencia.slice(4, 6), 10) - 1;
    const day = parseInt(dia, 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(Date.UTC(year, month, day, hora, 0, 0, 0));
  }

  private recordsToPricePoints(records: CceeRecord[]): PricePoint[] {
    return records.map((r) => {
      const ts = this.buildCceeTimestamp(r.mesReferencia, r.dia, r.hora);
      const submercado = CCEE_SUBMERCADO_MAP[r.submercado] ?? undefined;
      return {
        timestamp: ts ?? new Date(0),
        pricePerKwh: r.pldMwh / 1000,
        source: `CCEE_PLD_LIVE_${submercado ?? r.submercado}`,
        submercado,
        currency: "BRL",
      };
    });
  }
}

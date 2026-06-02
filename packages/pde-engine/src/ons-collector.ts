import type { PldSubmarket } from "./types.js";

export interface LoadRecord {
  timestamp: Date;
  loadMw: number;
  submercado: PldSubmarket;
}

export interface GenerationRecord {
  timestamp: Date;
  solarMw: number;
  windMw: number;
  hydroMw: number;
  thermalMw: number;
  submercado: PldSubmarket;
}

const ONS_CARGA_CSV_URL =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/curva-carga-ho/CURVA_CARGA_2026.csv";

const ONS_GERACAO_URL =
  "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/balanco_dessem_detalhe";

const ONS_SUBSISTEMA_MAP: Record<number, PldSubmarket> = {
  1: "SE_CO",
  2: "S",
  3: "NE",
  4: "N",
};

const ONS_NOME_SUBSISTEMA_MAP: Record<string, PldSubmarket> = {
  "SE/CO": "SE_CO",
  SUL: "S",
  NORDESTE: "NE",
  NORTE: "N",
  "Sudeste/Centro-Oeste": "SE_CO",
  Sul: "S",
  Nordeste: "NE",
  Norte: "N",
};

export class OnsCollector {
  private cargaCache: LoadRecord[] | null = null;
  private lastCargaFetch = 0;
  private readonly cacheTtlMs = 300_000;

  async fetchCarga(
    start: Date,
    end: Date,
    submercado?: PldSubmarket
  ): Promise<LoadRecord[]> {
    const records = await this.getOrFetchCarga();
    return records.filter((r) => {
      if (submercado && r.submercado !== submercado) return false;
      return r.timestamp >= start && r.timestamp <= end;
    });
  }

  async fetchAllSubmercadosCarga(
    start: Date,
    end: Date
  ): Promise<Map<PldSubmarket, LoadRecord[]>> {
    const records = await this.getOrFetchCarga();
    const result = new Map<PldSubmarket, LoadRecord[]>();
    for (const sm of ["SE_CO", "S", "NE", "N"] as PldSubmarket[]) {
      const filtered = records.filter(
        (r) => r.submercado === sm && r.timestamp >= start && r.timestamp <= end
      );
      result.set(sm, filtered);
    }
    return result;
  }

  clearCache(): void {
    this.cargaCache = null;
    this.lastCargaFetch = 0;
  }

  private async getOrFetchCarga(): Promise<LoadRecord[]> {
    const now = Date.now();
    if (this.cargaCache && now - this.lastCargaFetch < this.cacheTtlMs) {
      return this.cargaCache;
    }

    const response = await fetch(ONS_CARGA_CSV_URL, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`ONS API error: ${response.status} fetching carga`);
    }

    const csv = await response.text();
    const records = this.parseCargaCsv(csv);

    this.cargaCache = records;
    this.lastCargaFetch = now;

    return records;
  }

  private parseCargaCsv(csv: string): LoadRecord[] {
    const lines = csv.split("\n");
    if (lines.length < 2) return [];

    const header = lines[0].toLowerCase().split(";");
    const idIdx = header.indexOf("id_subsistema");
    const nomeIdx = header.indexOf("nom_subsistema");
    const dataIdx = header.indexOf("din_instante");
    const valIdx = header.indexOf("val_cargaenergiahomwmed");

    if (idIdx === -1 || dataIdx === -1 || valIdx === -1) return [];

    const records: LoadRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";");
      if (cols.length < Math.max(idIdx, dataIdx, valIdx) + 1) continue;

      const ts = new Date(cols[dataIdx]?.trim());
      if (isNaN(ts.getTime())) continue;

      const loadVal = parseFloat(cols[valIdx]?.trim().replace(",", "."));
      if (isNaN(loadVal)) continue;

      let submercado: PldSubmarket | undefined;

      const idVal = parseInt(cols[idIdx]?.trim(), 10);
      if (!isNaN(idVal) && ONS_SUBSISTEMA_MAP[idVal]) {
        submercado = ONS_SUBSISTEMA_MAP[idVal];
      }

      if (!submercado && nomeIdx !== -1) {
        const nome = cols[nomeIdx]?.trim();
        if (nome && ONS_NOME_SUBSISTEMA_MAP[nome]) {
          submercado = ONS_NOME_SUBSISTEMA_MAP[nome];
        }
      }

      if (!submercado) continue;

      records.push({
        timestamp: ts,
        loadMw: loadVal,
        submercado,
      });
    }

    return records;
  }
}

export type SigaEnergySource =
  | "Hidraulica"
  | "Eolica"
  | "Solar_Fotovoltaica"
  | "Termeletrica"
  | "Nuclear"
  | "CGH"
  | "PCH"
  | "Biomassa"
  | "Outra";

export type SigaPhase =
  | "Operacao"
  | "Construcao"
  | "Construcao_Nao_Iniciada"
  | "Desativada"
  | "Revogada";

export interface SigaGenerationAsset {
  id: string;
  name: string;
  state: string;
  municipality: string;
  capacityMw: number;
  source: SigaEnergySource;
  fuel?: string;
  phase: SigaPhase;
  status: string;
  operationDate?: Date;
  aneelRegistration: string;
  owner: string;
  cnpj?: string;
  latitude?: number;
  longitude?: number;
  submercado?: string;
}

const SIGA_CSV_URL =
  "https://dadosabertos.aneel.gov.br/dataset/6d90b77c-c5f5-4d81-bdec-7bc619494bb9/resource/11ec447d-698d-4ab8-977f-b424d5deee6a/download/siga-empreendimentos-geracao.csv";

export class SigaClient {
  private cache: SigaGenerationAsset[] | null = null;
  private lastFetch = 0;
  private readonly cacheTtlMs = 600_000;

  async fetchAssets(): Promise<SigaGenerationAsset[]> {
    const now = Date.now();
    if (this.cache && now - this.lastFetch < this.cacheTtlMs) {
      return this.cache;
    }

    const response = await fetch(SIGA_CSV_URL, {
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`SIGA API error: ${response.status}`);
    }

    const csv = await response.text();
    const assets = this.parseCsv(csv);

    this.cache = assets;
    this.lastFetch = now;

    return assets;
  }

  async findByState(state: string): Promise<SigaGenerationAsset[]> {
    const all = await this.fetchAssets();
    return all.filter((a) => a.state.toUpperCase() === state.toUpperCase());
  }

  async findBySource(source: SigaEnergySource): Promise<SigaGenerationAsset[]> {
    const all = await this.fetchAssets();
    return all.filter((a) => a.source === source);
  }

  async findByRegistration(reg: string): Promise<SigaGenerationAsset | undefined> {
    const all = await this.fetchAssets();
    return all.find((a) => a.aneelRegistration === reg);
  }

  async getTotalCapacityMw(source?: SigaEnergySource): Promise<number> {
    const all = await this.fetchAssets();
    const filtered = source ? all.filter((a) => a.source === source) : all;
    return filtered.reduce((sum, a) => sum + a.capacityMw, 0);
  }

  clearCache(): void {
    this.cache = null;
    this.lastFetch = 0;
  }

  private normalizeHeader(h: string): string {
    return h
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  private parseCsv(csv: string): SigaGenerationAsset[] {
    const lines = csv.split(/\r?\n/);
    if (lines.length < 2) return [];

    const rawHeaders = lines[0].split(";");
    const headers = rawHeaders.map((h) => this.normalizeHeader(h));

    const idx = (name: string) => {
      const normal = this.normalizeHeader(name);
      return headers.indexOf(normal);
    };

    const idIdx = idx("ide") ?? idx("id");
    const nameIdx = idx("nom_empreendimento") ?? idx("nome") ?? idx("nome_empreendimento");
    const stateIdx = idx("sig_uf") ?? idx("uf");
    const cityIdx = idx("municipio") ?? idx("municipio");
    const capIdx = idx("capacidade_mw") ?? idx("capacidade") ?? idx("potencia_mw");
    const sourceIdx = idx("fonte") ?? idx("fonte_energia");
    const fuelIdx = idx("combustivel");
    const phaseIdx = idx("fase");
    const statusIdx = idx("situacao_operacao") ?? idx("situacao");
    const dateIdx = idx("dat_operacao") ?? idx("data_operacao") ?? idx("data_entrada_operacao");
    const regIdx =
      idx("num_outorga") ?? idx("numero_outorga") ?? idx("aneel_registration") ?? idx("registro_aneel");
    const ownerIdx = idx("proprietario") ?? idx("empreendedor") ?? idx("agente");
    const cnpjIdx = idx("cnpj") ?? idx("cnpj_proprietario");
    const latIdx = idx("latitude");
    const lonIdx = idx("longitude");
    const subIdx = idx("submercado") ?? idx("submercado");

    const assets: SigaGenerationAsset[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";");
      if (cols.length < 3) continue;

      const name = nameIdx !== -1 ? cols[nameIdx]?.trim() : "";
      if (!name) continue;

      const capStr = capIdx !== -1 ? cols[capIdx]?.trim().replace(",", ".") : "0";
      const capacityMw = parseFloat(capStr);
      if (isNaN(capacityMw)) continue;

      assets.push({
        id: idIdx !== -1 ? cols[idIdx]?.trim() || String(i) : String(i),
        name,
        state: stateIdx !== -1 ? cols[stateIdx]?.trim() || "" : "",
        municipality: cityIdx !== -1 ? cols[cityIdx]?.trim() || "" : "",
        capacityMw,
        source: (sourceIdx !== -1 ? cols[sourceIdx]?.trim() : "Outra") as SigaEnergySource,
        fuel: fuelIdx !== -1 ? cols[fuelIdx]?.trim() : undefined,
        phase: (phaseIdx !== -1 ? cols[phaseIdx]?.trim() : "Operacao") as SigaPhase,
        status: statusIdx !== -1 ? cols[statusIdx]?.trim() || "" : "",
        operationDate: dateIdx !== -1 ? new Date(cols[dateIdx]?.trim()) : undefined,
        aneelRegistration: regIdx !== -1 ? cols[regIdx]?.trim() || "" : "",
        owner: ownerIdx !== -1 ? cols[ownerIdx]?.trim() || "" : "",
        cnpj: cnpjIdx !== -1 ? cols[cnpjIdx]?.trim() : undefined,
        latitude: latIdx !== -1 ? parseFloat(cols[latIdx]?.trim().replace(",", ".")) : undefined,
        longitude: lonIdx !== -1 ? parseFloat(cols[lonIdx]?.trim().replace(",", ".")) : undefined,
        submercado: subIdx !== -1 ? cols[subIdx]?.trim() : undefined,
      });
    }

    return assets;
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SigaClient } from "../src/siga-client.js";

const MOCK_SIGA_CSV = `IDE;NOM_EMPREENDIMENTO;SIG_UF;MUNICIPIO;CAPACIDADE_MW;FONTE;COMBUSTIVEL;FASE;SITUACAO_OPERACAO;DAT_OPERACAO;NUM_OUTORGA;PROPRIETARIO;CNPJ;LATITUDE;LONGITUDE;SUBMERCADO
1;Usina Solar BR;BA;Juazeiro;180.5;Solar_Fotovoltaica;;Operacao;Em Operacao;2023-06-15;ANEEL-2023-001;SolarCo Ltda;12.345.678/0001-90;-9.42;-40.5;NORDESTE
2;Parque Eolico Sul;RS;Santana;120.0;Eolica;;Operacao;Em Operacao;2024-01-20;ANEEL-2024-002;WindPower SA;98.765.432/0001-10;-30.1;-51.2;SUL
3;Hidreletrica Serra;MG;Ouro Preto;50.0;Hidraulica;;Operacao;Em Operacao;2022-03-10;ANEEL-2022-003;HidroBR;11.111.222/0001-33;-20.3;-43.5;SE_CO
4;Termo Norte;PA;Belem;300.0;Termeletrica;Gas Natural;Construcao;Em Construcao;;ANEEL-2024-004;ThermoEnergy Ltda;44.555.666/0001-77;-1.4;-48.5;NORTE
5;PCH Rio Claro;SP;Rio Claro;30.0;PCH;;Operacao;Em Operacao;2021-11-01;ANEEL-2021-005;MiniHidro SA;77.888.999/0001-00;-22.4;-47.5;SE_CO`;

describe("SigaClient", () => {
  let client: SigaClient;

  beforeEach(() => {
    client = new SigaClient();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(MOCK_SIGA_CSV, {
          status: 200,
          headers: { "Content-Type": "text/csv" },
        })
      )
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch and parse SIGA assets", async () => {
    const assets = await client.fetchAssets();
    expect(assets.length).toBe(5);
    expect(assets[0].name).toBe("Usina Solar BR");
    expect(assets[0].capacityMw).toBe(180.5);
    expect(assets[0].source).toBe("Solar_Fotovoltaica");
    expect(assets[0].aneelRegistration).toBe("ANEEL-2023-001");
  });

  it("should map submercado correctly", async () => {
    const assets = await client.fetchAssets();
    expect(assets[0].submercado).toBe("NORDESTE");
    expect(assets[2].submercado).toBe("SE_CO");
    expect(assets[3].submercado).toBe("NORTE");
  });

  it("should find assets by state", async () => {
    const ba = await client.findByState("BA");
    expect(ba.length).toBe(1);
    expect(ba[0].name).toContain("Solar");
    const rs = await client.findByState("RS");
    expect(rs.length).toBe(1);
    expect(rs[0].name).toContain("Eolico");
  });

  it("should find assets by energy source", async () => {
    const solar = await client.findBySource("Solar_Fotovoltaica");
    expect(solar.length).toBe(1);
    const eolica = await client.findBySource("Eolica");
    expect(eolica.length).toBe(1);
    const operacao = await client.findBySource("Termeletrica");
    expect(operacao.length).toBe(1);
  });

  it("should find by ANEEL registration", async () => {
    const asset = await client.findByRegistration("ANEEL-2023-001");
    expect(asset).toBeDefined();
    expect(asset!.name).toBe("Usina Solar BR");
    const missing = await client.findByRegistration("NONEXISTENT");
    expect(missing).toBeUndefined();
  });

  it("should calculate total capacity", async () => {
    const total = await client.getTotalCapacityMw();
    expect(total).toBe(180.5 + 120 + 50 + 300 + 30);
    const solarTotal = await client.getTotalCapacityMw("Solar_Fotovoltaica");
    expect(solarTotal).toBe(180.5);
  });

  it("should cache results within TTL", async () => {
    await client.fetchAssets();
    expect(fetch).toHaveBeenCalledTimes(1);
    await client.fetchAssets();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should clear cache", async () => {
    await client.fetchAssets();
    client.clearCache();
    await client.fetchAssets();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("should handle empty CSV gracefully", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response("", { status: 200, headers: { "Content-Type": "text/csv" } })
      )
    );
    const assets = await client.fetchAssets();
    expect(assets.length).toBe(0);
  });

  it("should handle fetch errors", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    await expect(client.fetchAssets()).rejects.toThrow();
  });
});

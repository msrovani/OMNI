import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OnsCollector } from "../src/ons-collector.js";

const MOCK_CARGA_CSV = `id_subsistema;nom_subsistema;din_instante;val_cargaenergiahomwmed
1;SE/CO;2026-05-27 00:00:00;45000.5
2;SUL;2026-05-27 00:00:00;12000.3
3;NORDESTE;2026-05-27 00:00:00;11000.0
4;NORTE;2026-05-27 00:00:00;5000.2
1;SE/CO;2026-05-27 01:00:00;44000.1
2;SUL;2026-05-27 01:00:00;11800.7
3;NORDESTE;2026-05-27 06:00:00;12500.0
4;NORTE;2026-05-27 18:00:00;6500.8`;

describe("OnsCollector", () => {
  let collector: OnsCollector;

  beforeEach(() => {
    collector = new OnsCollector();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(MOCK_CARGA_CSV, {
          status: 200,
          headers: { "Content-Type": "text/csv" },
        })
      )
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch and parse carga data", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    const records = await collector.fetchCarga(start, end);
    expect(records.length).toBeGreaterThan(0);
    records.forEach((r) => {
      expect(r.loadMw).toBeGreaterThan(0);
      expect(["SE_CO", "S", "NE", "N"]).toContain(r.submercado);
    });
  });

  it("should filter by submercado", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    const se = await collector.fetchCarga(start, end, "SE_CO");
    expect(se.every((r) => r.submercado === "SE_CO")).toBe(true);
  });

  it("should fetch all submercados", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    const all = await collector.fetchAllSubmercadosCarga(start, end);
    expect(all.size).toBe(4);
    expect(all.get("SE_CO")!.length).toBeGreaterThan(0);
    expect(all.get("S")!.length).toBeGreaterThan(0);
    expect(all.get("NE")!.length).toBeGreaterThan(0);
    expect(all.get("N")!.length).toBeGreaterThan(0);
  });

  it("should cache results within TTL", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    await collector.fetchCarga(start, end);
    expect(fetch).toHaveBeenCalledTimes(1);
    await collector.fetchCarga(start, end);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should clear cache", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    await collector.fetchCarga(start, end);
    collector.clearCache();
    await collector.fetchCarga(start, end);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("should map ONS subsystem codes correctly", async () => {
    const start = new Date("2026-05-27T00:00:00Z");
    const end = new Date("2026-05-28T00:00:00Z");
    const records = await collector.fetchCarga(start, end);
    const se = records.find((r) => r.loadMw === 45000.5);
    expect(se?.submercado).toBe("SE_CO");
    const s = records.find((r) => r.loadMw === 12000.3);
    expect(s?.submercado).toBe("S");
  });

  it("should handle fetch errors gracefully", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    await expect(
      collector.fetchCarga(new Date("2026-05-27T00:00:00Z"), new Date("2026-05-28T00:00:00Z"))
    ).rejects.toThrow();
  });
});

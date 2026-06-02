import { describe, it, expect } from "vitest";
import {
  getRegulatoryCompliance,
  getPldParameters,
  getSubmercadoName,
  getFullComplianceReport,
} from "../src/compliance.js";

describe("Brazilian Compliance", () => {
  it("should return regulatory compliance info", () => {
    const compliance = getRegulatoryCompliance();
    expect(compliance.aneelResolution).toContain("REN 1.000/2022");
    expect(compliance.gdCompensationModel).toBe("SCEE");
    expect(compliance.moeda).toBe("BRL");
  });

  it("should return PLD parameters", () => {
    const pld = getPldParameters();
    expect(pld.piso).toBe(69.07);
    expect(pld.teto).toBe(599.31);
    expect(pld.moeda).toBe("BRL");
    expect(pld.submercados).toHaveLength(4);
  });

  it("should return submercado names", () => {
    expect(getSubmercadoName("SE_CO")).toBe("Sudeste/Centro-Oeste");
    expect(getSubmercadoName("S")).toBe("Sul");
    expect(getSubmercadoName("NE")).toBe("Nordeste");
    expect(getSubmercadoName("N")).toBe("Norte");
  });

  it("should return full compliance report", () => {
    const report = getFullComplianceReport();
    expect(report.length).toBeGreaterThan(0);
    const aneel = report.find((r) => r.orgao === "ANEEL");
    expect(aneel).toBeDefined();
    expect(aneel!.status).toBe("conforme");
  });
});

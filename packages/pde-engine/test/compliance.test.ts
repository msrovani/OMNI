import { describe, it, expect } from "vitest";
import {
  getRegulatoryCompliance,
  getPldParameters,
  getSubmercadoName,
  getFullComplianceReport,
  getBatteryTariffRules,
  getBatteryTariffRule,
  calculateBatteryTariff,
  recommendTariffMode,
  BATTERY_TARIFF_RULES,
} from "../src/compliance.js";

describe("Brazilian Compliance", () => {
  it("should return regulatory compliance info", () => {
    const compliance = getRegulatoryCompliance();
    expect(compliance.aneelResolution).toContain("REN 1.000/2022");
    expect(compliance.aneelBatteryResolution).toContain("CP 39/2023");
    expect(compliance.onsAncillaryAccreditation).toContain("Lei 15.269/2025");
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
    const batteryReg = report.find((r) => r.resolucao === "CP 39/2023");
    expect(batteryReg).toBeDefined();
    expect(batteryReg!.status).toBe("conforme");
    const onsAncillary = report.find((r) => r.resolucao === "Submódulo 14.1");
    expect(onsAncillary).toBeDefined();
    expect(onsAncillary!.status).toBe("conforme");
  });
});

describe("Battery Tariff Rules", () => {
  it("should return both tariff modes", () => {
    const rules = getBatteryTariffRules();
    expect(rules).toHaveLength(2);
    const modes = rules.map((r) => r.mode);
    expect(modes).toContain("autonomous");
    expect(modes).toContain("ons_dispatched");
  });

  it("should return correct tariff rule for autonomous mode", () => {
    const rule = getBatteryTariffRule("autonomous");
    expect(rule.chargeTariffed).toBe(true);
    expect(rule.dischargeTariffed).toBe(true);
    expect(rule.tustRsPerMwh).toBeGreaterThan(0);
    expect(rule.tusdRsPerMwh).toBeGreaterThan(0);
    expect(rule.regulation).toContain("CP 39/2023");
  });

  it("should return correct tariff rule for ONS-dispatched mode", () => {
    const rule = getBatteryTariffRule("ons_dispatched");
    expect(rule.chargeTariffed).toBe(false);
    expect(rule.dischargeTariffed).toBe(true);
    expect(rule.description).toContain("tarifa única");
  });

  it("should calculate tariff for autonomous mode with double charging", () => {
    const result = calculateBatteryTariff("autonomous", 1, 350);
    expect(result.chargeCostRs).toBeGreaterThan(0);
    expect(result.dischargeCostRs).toBeGreaterThan(0);
    expect(result.totalRsPerMwh).toBeGreaterThan(0);
    expect(result.netRevenueRs).toBeLessThan(350);
  });

  it("should calculate tariff for ONS-dispatched mode with single charging", () => {
    const result = calculateBatteryTariff("ons_dispatched", 1, 350);
    expect(result.chargeCostRs).toBe(0);
    expect(result.dischargeCostRs).toBeGreaterThan(0);
    expect(result.netRevenueRs).toBeGreaterThan(0);
  });

  it("should recommend ONS-dispatched mode when share > 30%", () => {
    const rec = recommendTariffMode(4, 40);
    expect(rec.recommended).toBe("ons_dispatched");
    expect(rec.savingsRsPerMwh).toBeGreaterThan(0);
    expect(rec.rationale).toContain("40%");
  });

  it("should recommend autonomous mode when share <= 30%", () => {
    const rec = recommendTariffMode(4, 20);
    expect(rec.recommended).toBe("autonomous");
    expect(rec.savingsRsPerMwh).toBe(0);
  });

  it("should have consistent TUST/TUSD values across modes", () => {
    const autonomous = BATTERY_TARIFF_RULES.autonomous;
    const onsDispatched = BATTERY_TARIFF_RULES.ons_dispatched;
    expect(autonomous.tustRsPerMwh).toBe(onsDispatched.tustRsPerMwh);
    expect(autonomous.tusdRsPerMwh).toBe(onsDispatched.tusdRsPerMwh);
  });
});

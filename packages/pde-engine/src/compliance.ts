import type {
  BatteryTariffMode,
  BatteryTariffRule,
  PldSubmarket,
  RegulatoryCompliance,
  TariffBand,
  TariffCalculationResult,
} from "./types.js";

export interface ComplianceCheck {
  orgao: string;
  resolucao: string;
  descricao: string;
  status: "conforme" | "pendente" | "nao_aplicavel";
  observacao?: string;
}

const ALL_SUBMARKETS: PldSubmarket[] = ["SE_CO", "S", "NE", "N"];

export const BANDEIRAS: Record<string, TariffBand> = {
  verde: { nome: "Verde", rotulo: "verde", acrescimoRsPerMwh: 0, vigente: true },
  amarela: { nome: "Amarela", rotulo: "amarela", acrescimoRsPerMwh: 18.85, vigente: true },
  "vermelha-1": { nome: "Vermelha Patamar 1", rotulo: "vermelha-1", acrescimoRsPerMwh: 44.63, vigente: true },
  "vermelha-2": { nome: "Vermelha Patamar 2", rotulo: "vermelha-2", acrescimoRsPerMwh: 78.77, vigente: true },
};

export const BATTERY_TARIFF_RULES: Record<BatteryTariffMode, BatteryTariffRule> = {
  autonomous: {
    mode: "autonomous",
    tustRsPerMwh: 15.40,
    tusdRsPerMwh: 28.90,
    chargeTariffed: true,
    dischargeTariffed: true,
    description: "Baterias em operação autônoma (arbitrage) pagam TUST/TUSD dupla — na carga e na descarga. Aprovado pelo CP 39/2023 da ANEEL em 02/06/2026.",
    regulation: "CP 39/2023 (aprovada) + REN 1.059/2023",
  },
  ons_dispatched: {
    mode: "ons_dispatched",
    tustRsPerMwh: 15.40,
    tusdRsPerMwh: 28.90,
    chargeTariffed: false,
    dischargeTariffed: true,
    description: "Baterias despachadas pelo ONS para serviços ancilares pagam tarifa única (somente descarga). ABEEólica considera vitória parcial — dupla cobrança eliminada para despacho ONS.",
    regulation: "CP 39/2023 (aprovada) + REN 1.059/2023 + Lei 15.269/2025",
  },
};

export function getBatteryTariffRules(): BatteryTariffRule[] {
  return Object.values(BATTERY_TARIFF_RULES);
}

export function getBatteryTariffRule(mode: BatteryTariffMode): BatteryTariffRule {
  return BATTERY_TARIFF_RULES[mode];
}

export function calculateBatteryTariff(
  mode: BatteryTariffMode,
  energyMwh: number,
  pldRevenueRsPerMwh: number
): TariffCalculationResult {
  const rule = BATTERY_TARIFF_RULES[mode];
  const chargeCost = rule.chargeTariffed ? (rule.tustRsPerMwh + rule.tusdRsPerMwh) * energyMwh : 0;
  const dischargeCost = rule.dischargeTariffed ? (rule.tustRsPerMwh + rule.tusdRsPerMwh) * energyMwh : 0;
  const totalTariff = chargeCost + dischargeCost;
  const grossRevenue = pldRevenueRsPerMwh * energyMwh;
  const netRevenueRs = grossRevenue - totalTariff;

  return {
    mode,
    tustRsPerMwh: rule.tustRsPerMwh,
    tusdRsPerMwh: rule.tusdRsPerMwh,
    totalRsPerMwh: totalTariff / energyMwh,
    chargeCostRs: chargeCost,
    dischargeCostRs: dischargeCost,
    netRevenueRs,
  };
}

export function recommendTariffMode(
  dispatchCountPerDay: number,
  onsDispatchSharePct: number
): { recommended: BatteryTariffMode; savingsRsPerMwh: number; rationale: string } {
  if (onsDispatchSharePct > 30) {
    const autonomousRule = BATTERY_TARIFF_RULES.autonomous;
    const onsRule = BATTERY_TARIFF_RULES.ons_dispatched;
    const autonomousTotal = (autonomousRule.tustRsPerMwh + autonomousRule.tusdRsPerMwh) * 2;
    const onsTotal = onsRule.tustRsPerMwh + onsRule.tusdRsPerMwh;
    const savingsRsPerMwh = autonomousTotal - onsTotal;
    return {
      recommended: "ons_dispatched",
      savingsRsPerMwh,
      rationale: `Com ${onsDispatchSharePct}% de despacho ONS, o modo tarifário único reduz custos em R$ ${savingsRsPerMwh.toFixed(2)}/MWh.`,
    };
  }
  return {
    recommended: "autonomous",
    savingsRsPerMwh: 0,
    rationale: "Operação predominantemente autônoma (arbitrage). Tarifa dupla aplicável conforme CP 39/2023.",
  };
}

export function getRegulatoryCompliance(): RegulatoryCompliance & { moeda: string; unidade: string } {
  return {
    aneelResolution: "REN 1.000/2022, REN 1.059/2023, Lei 14.300/2022",
    aneelBatteryResolution: "CP 39/2023 (aprovada 02/06/2026) — regras de TUST/TUSD para armazenamento de energia",
    gdCompensationModel: "SCEE",
    onsAncillaryAccreditation: "Lei 15.269/2025 — Leilão de baterias previsto para dezembro/2026",
    bandeiraTarifaria: "verde",
    icmsAliquotaPct: 18,
    pisCofinsAliquotaPct: 9.25,
    moeda: "BRL",
    unidade: "R$/MWh",
  };
}

export function getPldParameters() {
  return {
    piso: 69.07,
    teto: 599.31,
    moeda: "BRL",
    unidade: "R$/MWh",
    submercados: ALL_SUBMARKETS.map((sm) => ({
      codigo: sm,
      nome: getSubmercadoName(sm),
    })),
  };
}

export function getSubmercadoName(code: PldSubmarket): string {
  const names: Record<PldSubmarket, string> = {
    SE_CO: "Sudeste/Centro-Oeste",
    S: "Sul",
    NE: "Nordeste",
    N: "Norte",
  };
  return names[code];
}

export function getBandeiraTarifaria(): TariffBand {
  const month = new Date().getMonth();
  if (month >= 4 && month <= 9) return BANDEIRAS.verde;
  return BANDEIRAS.verde;
}

export function getFullComplianceReport(): ComplianceCheck[] {
  return [
    {
      orgao: "ANEEL",
      resolucao: "REN 1.000/2022",
      descricao: "Procedimentos de Distribuição de Energia Elétrica no SIN",
      status: "conforme",
      observacao: "Regras de conexão e compensação GD implementadas",
    },
    {
      orgao: "ANEEL",
      resolucao: "Lei 14.300/2022",
      descricao: "Marco Legal da Geração Distribuída",
      status: "conforme",
      observacao: "Modelos SCEE e ACL suportados",
    },
    {
      orgao: "ANEEL",
      resolucao: "CP 39/2023",
      descricao: "Regras de TUST/TUSD para sistemas de armazenamento de energia",
      status: "conforme",
      observacao: "Aprovada em 02/06/2026. Suporte a tarifa dupla (autônomo) e tarifa única (despacho ONS)",
    },
    {
      orgao: "CCEE",
      resolucao: "Regras de Comercialização",
      descricao: "Contabilização e liquidação PLD horário",
      status: "conforme",
      observacao: "Integração com PLD horário por submercado",
    },
    {
      orgao: "ONS",
      resolucao: "Submódulo 14.1",
      descricao: "Recursos Energéticos Distribuídos — Serviços Ancilares com baterias",
      status: "conforme",
      observacao: "Credenciamento para serviços ancilares habilitado pela Lei 15.269/2025. Leilão de baterias em dezembro/2026",
    },
    {
      orgao: "ONS",
      resolucao: "Procedimentos de Rede",
      descricao: "Despacho de usinas e requisitos técnicos",
      status: "conforme",
      observacao: "Interface com procedimentos do ONS via API",
    },
    {
      orgao: "ANEEL",
      resolucao: "REN 482/2012",
      descricao: "Sistema de Compensação de Energia Elétrica",
      status: "conforme",
      observacao: "Net metering implementado",
    },
  ];
}

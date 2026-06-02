export type PldSubmarket = "SE_CO" | "S" | "NE" | "N";

export const PLD_SUBMARKET_NAMES: Record<PldSubmarket, string> = {
  SE_CO: "Sudeste/Centro-Oeste",
  S: "Sul",
  NE: "Nordeste",
  N: "Norte",
};

export type CurrencyCode = "BRL";

export interface TelemetrySample {
  deviceId: string;
  timestamp: Date;
  voltageV: number;
  currentA: number;
  frequencyHz: number;
  socPercent: number;
  sohPercent: number;
  temperatureC: number;
  powerW: number;
  isGridConnected: boolean;
}

export interface Asset {
  id: string;
  clientId: string;
  manufacturer: string;
  model: string;
  capacityKwh: number;
  nominalPowerKw: number;
  cycleLife: number;
  replacementCost: number;
  minSocPercent: number;
  maxSocPercent: number;
  installedAt: Date;
  submercado?: PldSubmarket;
  aneelRegistration?: string;
}

export interface PricePoint {
  timestamp: Date;
  pricePerKwh: number;
  source: string;
  submercado?: PldSubmarket;
  currency?: CurrencyCode;
}

export interface DispatchCommand {
  assetId: string;
  powerKw: number;
  durationSeconds: number;
  reason: "arbitrage" | "peak_shave" | "ancillary" | "v2g" | "ons_command";
  signature?: string;
}

export interface ForecastPoint {
  hour: number;
  loadKw: number;
  upperBound?: number;
  lowerBound?: number;
  isForecast: boolean;
}

export interface ForecastResult {
  assetId: string;
  predictions: number[];
  timestamps: Date[];
  maePercent: number;
  points?: ForecastPoint[];
  confidenceUpper?: number[];
  confidenceLower?: number[];
}

export interface OptimizationResult {
  commands: DispatchCommand[];
  expectedProfitBrl: number;
  expectedDegradationCost: number;
  scenarioCount: number;
  submercado?: PldSubmarket;
}

export type OptimizationObjective =
  | "profit"
  | "battery_life"
  | "grid_stability"
  | "balanced";

export interface RegulatoryCompliance {
  aneelResolution: string;
  aneelBatteryResolution?: string;
  cceeRegistration?: string;
  onsAccreditation?: string;
  onsAncillaryAccreditation?: string;
  gdCompensationModel?: "SCEE" | "ACL" | "AUTOCONSUMO";
  bandeiraTarifaria?: "verde" | "amarela" | "vermelha-1" | "vermelha-2";
  icmsAliquotaPct?: number;
  pisCofinsAliquotaPct?: number;
  moeda?: string;
  unidade?: string;
}

export type BatteryTariffMode = "autonomous" | "ons_dispatched";

export interface TariffBand {
  nome: string;
  rotulo: "verde" | "amarela" | "vermelha-1" | "vermelha-2";
  acrescimoRsPerMwh: number;
  vigente: boolean;
}

export interface BatteryTariffRule {
  mode: BatteryTariffMode;
  tustRsPerMwh: number;
  tusdRsPerMwh: number;
  chargeTariffed: boolean;
  dischargeTariffed: boolean;
  description: string;
  regulation: string;
}

export interface TariffCalculationResult {
  mode: BatteryTariffMode;
  tustRsPerMwh: number;
  tusdRsPerMwh: number;
  totalRsPerMwh: number;
  chargeCostRs: number;
  dischargeCostRs: number;
  netRevenueRs: number;
}

export type AncillaryServiceType =
  | "frequency_regulation_primary"
  | "frequency_regulation_secondary"
  | "frequency_regulation_tertiary"
  | "reserve_power"
  | "reactive_support";

export interface OnsDispatchCommand {
  assetId: string;
  serviceType: AncillaryServiceType;
  powerKw: number;
  durationSeconds: number;
  meritoOrder: number;
  deadline: Date;
  onsCommandId: string;
  signature?: string;
  submercado: PldSubmarket;
}

export interface OnsDispatchRecord {
  commandId: string;
  assetId: string;
  serviceType: AncillaryServiceType;
  powerKw: number;
  durationSeconds: number;
  timestamp: Date;
  onsCommandId: string;
  meritoOrder: number;
  accepted: boolean;
  revenueBrl: number;
  signature: string;
}

export interface FrequencyRegulationStatus {
  assetId: string;
  primaryMw: number;
  secondaryMw: number;
  tertiaryMw: number;
  reservePowerMw: number;
  totalAncillaryRevenueBrlPerMonth: number;
  accreditationStatus: "accredited" | "pending" | "not_applied";
}

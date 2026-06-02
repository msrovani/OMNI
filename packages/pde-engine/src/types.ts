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
  reason: "arbitrage" | "peak_shave" | "ancillary" | "v2g";
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
  cceeRegistration?: string;
  onsAccreditation?: string;
  gdCompensationModel?: "SCEE" | "ACL" | "AUTOCONSUMO";
  bandeiraTarifaria?: "verde" | "amarela" | "vermelha-1" | "vermelha-2";
  icmsAliquotaPct?: number;
  pisCofinsAliquotaPct?: number;
  moeda?: string;
  unidade?: string;
}

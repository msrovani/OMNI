import { createHmac, randomUUID } from "node:crypto";
import type {
  AncillaryServiceType,
  DispatchCommand,
  FrequencyRegulationStatus,
  OnsDispatchCommand,
  OnsDispatchRecord,
  PldSubmarket,
} from "./types.js";

const ANCILLARY_REVENUE_RATES: Record<AncillaryServiceType, number> = {
  frequency_regulation_primary: 45.0,
  frequency_regulation_secondary: 35.0,
  frequency_regulation_tertiary: 25.0,
  reserve_power: 20.0,
  reactive_support: 15.0,
};

export class OnsDispatchHandler {
  private records: OnsDispatchRecord[] = [];
  private signingKey: string;
  private regulationStatus: Map<string, FrequencyRegulationStatus> = new Map();

  constructor(signingKey?: string) {
    this.signingKey = signingKey ?? "omni-grid-ons-key";
  }

  private toPayload(cmd: OnsDispatchCommand): string {
    return [
      cmd.onsCommandId,
      cmd.assetId,
      cmd.serviceType,
      cmd.powerKw.toString(),
      cmd.durationSeconds.toString(),
      cmd.meritoOrder.toString(),
      cmd.submercado,
    ].join("|");
  }

  sign(cmd: OnsDispatchCommand): string {
    return createHmac("sha256", this.signingKey)
      .update(this.toPayload(cmd))
      .digest("hex");
  }

  verify(cmd: OnsDispatchCommand, signature: string): boolean {
    const expected = this.sign(cmd);
    if (signature.length !== expected.length) return false;
    try {
      const { timingSafeEqual } = require("node:crypto");
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async processOnsCommand(onsCmd: OnsDispatchCommand): Promise<{
    dispatchCommand: DispatchCommand;
    record: OnsDispatchRecord;
    estimatedRevenue: number;
  }> {
    const signature = this.sign(onsCmd);
    const estimatedRevenue = this.estimateAncillaryRevenue(
      onsCmd.serviceType,
      onsCmd.powerKw,
      onsCmd.durationSeconds
    );

    const dispatchCommand: DispatchCommand = {
      assetId: onsCmd.assetId,
      powerKw: onsCmd.powerKw,
      durationSeconds: onsCmd.durationSeconds,
      reason: "ons_command",
      signature,
    };

    const record: OnsDispatchRecord = {
      commandId: randomUUID(),
      assetId: onsCmd.assetId,
      serviceType: onsCmd.serviceType,
      powerKw: onsCmd.powerKw,
      durationSeconds: onsCmd.durationSeconds,
      timestamp: new Date(),
      onsCommandId: onsCmd.onsCommandId,
      meritoOrder: onsCmd.meritoOrder,
      accepted: true,
      revenueBrl: estimatedRevenue,
      signature,
    };

    this.records.push(record);
    this.updateRegulationStatus(onsCmd);

    return { dispatchCommand, record, estimatedRevenue };
  }

  private estimateAncillaryRevenue(
    serviceType: AncillaryServiceType,
    powerKw: number,
    durationSeconds: number
  ): number {
    const ratePerMwh = ANCILLARY_REVENUE_RATES[serviceType];
    const hours = durationSeconds / 3600;
    const energyMwh = (powerKw * hours) / 1000;
    return ratePerMwh * energyMwh;
  }

  private updateRegulationStatus(cmd: OnsDispatchCommand): void {
    const existing = this.regulationStatus.get(cmd.assetId) ?? {
      assetId: cmd.assetId,
      primaryMw: 0,
      secondaryMw: 0,
      tertiaryMw: 0,
      reservePowerMw: 0,
      totalAncillaryRevenueBrlPerMonth: 0,
      accreditationStatus: "accredited" as const,
    };

    const powerMw = cmd.powerKw / 1000;
    switch (cmd.serviceType) {
      case "frequency_regulation_primary":
        existing.primaryMw += powerMw;
        break;
      case "frequency_regulation_secondary":
        existing.secondaryMw += powerMw;
        break;
      case "frequency_regulation_tertiary":
        existing.tertiaryMw += powerMw;
        break;
      case "reserve_power":
        existing.reservePowerMw += powerMw;
        break;
    }

    const hoursThisMonth = 720;
    existing.totalAncillaryRevenueBrlPerMonth =
      (existing.primaryMw * ANCILLARY_REVENUE_RATES.frequency_regulation_primary +
        existing.secondaryMw * ANCILLARY_REVENUE_RATES.frequency_regulation_secondary +
        existing.tertiaryMw * ANCILLARY_REVENUE_RATES.frequency_regulation_tertiary +
        existing.reservePowerMw * ANCILLARY_REVENUE_RATES.reserve_power) *
      hoursThisMonth;

    this.regulationStatus.set(cmd.assetId, existing);
  }

  async processOnsCommandBatch(
    commands: OnsDispatchCommand[]
  ): Promise<{
    dispatchCommands: DispatchCommand[];
    records: OnsDispatchRecord[];
    totalRevenue: number;
  }> {
    const results = await Promise.all(commands.map((c) => this.processOnsCommand(c)));
    return {
      dispatchCommands: results.map((r) => r.dispatchCommand),
      records: results.map((r) => r.record),
      totalRevenue: results.reduce((sum, r) => sum + r.estimatedRevenue, 0),
    };
  }

  getRecords(assetId?: string): OnsDispatchRecord[] {
    if (assetId) return this.records.filter((r) => r.assetId === assetId);
    return [...this.records];
  }

  getRegulationStatus(assetId: string): FrequencyRegulationStatus | undefined {
    return this.regulationStatus.get(assetId);
  }

  getAncillaryRevenueRates(): Record<AncillaryServiceType, number> {
    return { ...ANCILLARY_REVENUE_RATES };
  }

  getStats(): {
    totalCommands: number;
    totalRevenueBrl: number;
    accreditedAssets: number;
  } {
    return {
      totalCommands: this.records.length,
      totalRevenueBrl: this.records.reduce((s, r) => s + r.revenueBrl, 0),
      accreditedAssets: this.regulationStatus.size,
    };
  }
}

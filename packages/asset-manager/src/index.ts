import { randomUUID } from "node:crypto";

interface BatteryAsset {
  id: string;
  clientId: string;
  manufacturer: string;
  model: string;
  capacityKwh: number;
  nominalPowerKw: number;
  cycleLife: number;
  minSocPercent: number;
  maxSocPercent: number;
  isActive: boolean;
  installedAt: Date;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
}

interface Contract {
  id: string;
  clientId: string;
  assetId: string;
  omniRevenueSharePercent: number;
  minBackupSoc: number;
  startDate: Date;
  endDate?: Date;
  autoRenew: boolean;
  status: "active" | "expired" | "cancelled";
}

class AssetManager {
  private assets = new Map<string, BatteryAsset>();
  private contracts = new Map<string, Contract>();

  registerAsset(
    input: Omit<BatteryAsset, "id" | "installedAt" | "isActive">
  ): BatteryAsset {
    const asset: BatteryAsset = {
      ...input,
      id: randomUUID(),
      isActive: true,
      installedAt: new Date(),
    };
    this.assets.set(asset.id, asset);
    return asset;
  }

  getAsset(id: string): BatteryAsset | undefined {
    return this.assets.get(id);
  }

  listAssets(clientId?: string): BatteryAsset[] {
    const all = Array.from(this.assets.values());
    return clientId
      ? all.filter((a) => a.clientId === clientId)
      : all;
  }

  registerContract(
    input: Omit<Contract, "id" | "status">
  ): Contract {
    const contract: Contract = {
      ...input,
      id: randomUUID(),
      status: "active",
    };
    this.contracts.set(contract.id, contract);
    return contract;
  }

  getContract(id: string): Contract | undefined {
    return this.contracts.get(id);
  }

  listContracts(clientId?: string): Contract[] {
    const all = Array.from(this.contracts.values());
    return clientId
      ? all.filter((c) => c.clientId === clientId)
      : all;
  }

  getAssetCount(): number {
    return this.assets.size;
  }

  getContractCount(): number {
    return this.contracts.size;
  }

  getActiveContractCount(): number {
    return Array.from(this.contracts.values()).filter(
      (c) => c.status === "active"
    ).length;
  }
}

export { AssetManager };
export { SigaClient } from "./siga-client.js";
export type {
  SigaGenerationAsset,
  SigaEnergySource,
  SigaPhase,
} from "./siga-client.js";
export type { BatteryAsset, Contract };

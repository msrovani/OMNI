import { describe, it, expect, beforeEach } from "vitest";
import { AssetManager } from "../src/index.js";

describe("AssetManager", () => {
  let manager: AssetManager;

  beforeEach(() => {
    manager = new AssetManager();
  });

  it("should register an asset with generated ID", () => {
    const asset = manager.registerAsset({
      clientId: "client-001",
      manufacturer: "Tesla",
      model: "Megapack 100",
      capacityKwh: 100,
      nominalPowerKw: 50,
      cycleLife: 6000,
      minSocPercent: 20,
      maxSocPercent: 95,
    });
    expect(asset.id).toBeDefined();
    expect(asset.isActive).toBe(true);
    expect(asset.installedAt).toBeInstanceOf(Date);
    expect(manager.getAssetCount()).toBe(1);
  });

  it("should retrieve an asset by ID", () => {
    const asset = manager.registerAsset({
      clientId: "client-001",
      manufacturer: "BYD",
      model: "Container 200",
      capacityKwh: 200,
      nominalPowerKw: 100,
      cycleLife: 5000,
      minSocPercent: 15,
      maxSocPercent: 95,
    });
    const found = manager.getAsset(asset.id);
    expect(found).toBeDefined();
    expect(found!.manufacturer).toBe("BYD");
  });

  it("should list assets filtered by client", () => {
    manager.registerAsset({
      clientId: "client-a",
      manufacturer: "A",
      model: "M1",
      capacityKwh: 100,
      nominalPowerKw: 50,
      cycleLife: 6000,
      minSocPercent: 20,
      maxSocPercent: 95,
    });
    manager.registerAsset({
      clientId: "client-b",
      manufacturer: "B",
      model: "M2",
      capacityKwh: 200,
      nominalPowerKw: 100,
      cycleLife: 5000,
      minSocPercent: 20,
      maxSocPercent: 95,
    });
    expect(manager.listAssets("client-a")).toHaveLength(1);
    expect(manager.listAssets()).toHaveLength(2);
  });

  it("should register a contract", () => {
    const asset = manager.registerAsset({
      clientId: "client-001",
      manufacturer: "Tesla",
      model: "MP",
      capacityKwh: 100,
      nominalPowerKw: 50,
      cycleLife: 6000,
      minSocPercent: 20,
      maxSocPercent: 95,
    });
    const contract = manager.registerContract({
      clientId: "client-001",
      assetId: asset.id,
      omniRevenueSharePercent: 30,
      minBackupSoc: 20,
      startDate: new Date(),
      autoRenew: true,
    });
    expect(contract.status).toBe("active");
    expect(manager.getContractCount()).toBe(1);
    expect(manager.getActiveContractCount()).toBe(1);
  });
});

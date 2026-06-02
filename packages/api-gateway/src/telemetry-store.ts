export interface TelemetryRecord {
  deviceId: string;
  timestamp: string;
  socPercent: number;
  sohPercent: number;
  powerW: number;
  voltageV: number;
  frequencyHz: number;
  temperatureC: number;
  isGridConnected: boolean;
}

export class TelemetryStore {
  private store = new Map<string, TelemetryRecord[]>();
  private maxPerDevice = 1000;

  add(deviceId: string, record: TelemetryRecord): void {
    if (!this.store.has(deviceId)) {
      this.store.set(deviceId, []);
    }
    const records = this.store.get(deviceId)!;
    records.push(record);
    if (records.length > this.maxPerDevice) {
      records.splice(0, records.length - this.maxPerDevice);
    }
  }

  getLatest(deviceId?: string): TelemetryRecord | null {
    if (deviceId) {
      const records = this.store.get(deviceId);
      if (!records || records.length === 0) return null;
      return records[records.length - 1]!;
    }
    let latest: TelemetryRecord | null = null;
    let latestTs = "";
    for (const records of this.store.values()) {
      if (records.length === 0) continue;
      const last = records[records.length - 1]!;
      if (last.timestamp > latestTs) {
        latestTs = last.timestamp;
        latest = last;
      }
    }
    return latest;
  }

  getHistory(deviceId: string, limit?: number): TelemetryRecord[] {
    const records = this.store.get(deviceId);
    if (!records) return [];
    if (limit && limit > 0 && records.length > limit) {
      return records.slice(records.length - limit);
    }
    return [...records];
  }

  getAllLatest(): Map<string, TelemetryRecord> {
    const result = new Map<string, TelemetryRecord>();
    for (const [deviceId, records] of this.store.entries()) {
      if (records.length > 0) {
        result.set(deviceId, records[records.length - 1]!);
      }
    }
    return result;
  }
}

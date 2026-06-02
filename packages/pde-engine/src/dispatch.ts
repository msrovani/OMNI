import { createHmac, timingSafeEqual } from "node:crypto";
import type { DispatchCommand } from "./types.js";

interface DispatchRecord {
  commandId: string;
  assetId: string;
  powerKw: number;
  durationSeconds: number;
  reason: string;
  timestamp: Date;
  signature: string;
  accepted: boolean;
}

export class DispatchOrchestrator {
  private history: DispatchRecord[] = [];
  private signingKey: string;

  constructor(signingKey?: string) {
    this.signingKey = signingKey ?? "omni-grid-default-key";
  }

  private toPayload(
    command: Omit<DispatchCommand, "signature">
  ): string {
    return [
      command.assetId,
      command.powerKw.toString(),
      command.durationSeconds.toString(),
      command.reason,
    ].join("|");
  }

  sign(command: Omit<DispatchCommand, "signature">): string {
    const payload = this.toPayload(command);

    return createHmac("sha256", this.signingKey)
      .update(payload)
      .digest("hex");
  }

  verify(command: DispatchCommand, signature: string): boolean {
    const expected = this.sign(command);
    if (signature.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async execute(command: DispatchCommand): Promise<DispatchRecord> {
    const signature = this.sign(command);
    const record: DispatchRecord = {
      commandId: crypto.randomUUID(),
      ...command,
      timestamp: new Date(),
      signature,
      accepted: true,
    };
    this.history.push(record);
    return record;
  }

  getHistory(assetId?: string): DispatchRecord[] {
    if (assetId) return this.history.filter((r) => r.assetId === assetId);
    return [...this.history];
  }

  getStats(): {
    totalCommands: number;
    acceptedCount: number;
    rejectedCount: number;
  } {
    return {
      totalCommands: this.history.length,
      acceptedCount: this.history.filter((r) => r.accepted).length,
      rejectedCount: this.history.filter((r) => !r.accepted).length,
    };
  }
}

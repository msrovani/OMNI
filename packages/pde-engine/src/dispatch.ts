import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { DispatchCommand, OnsDispatchCommand } from "./types.js";

export interface DispatchRecord {
  commandId: string;
  assetId: string;
  powerKw: number;
  durationSeconds: number;
  reason: string;
  timestamp: Date;
  signature: string;
  accepted: boolean;
  onsCommandId?: string;
  serviceType?: string;
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
      commandId: randomUUID(),
      assetId: command.assetId,
      powerKw: command.powerKw,
      durationSeconds: command.durationSeconds,
      reason: command.reason,
      timestamp: new Date(),
      signature,
      accepted: true,
    };
    this.history.push(record);
    return record;
  }

  async executeOnsCommand(onsCmd: OnsDispatchCommand, signature: string): Promise<DispatchRecord> {
    const record: DispatchRecord = {
      commandId: randomUUID(),
      assetId: onsCmd.assetId,
      powerKw: onsCmd.powerKw,
      durationSeconds: onsCmd.durationSeconds,
      reason: "ons_command",
      timestamp: new Date(),
      signature,
      accepted: true,
      onsCommandId: onsCmd.onsCommandId,
      serviceType: onsCmd.serviceType,
    };
    this.history.push(record);
    return record;
  }

  getHistory(assetId?: string): DispatchRecord[] {
    if (assetId) return this.history.filter((r) => r.assetId === assetId);
    return [...this.history];
  }

  getAncillaryHistory(): DispatchRecord[] {
    return this.history.filter(
      (r) => r.reason === "ancillary" || r.reason === "ons_command"
    );
  }

  getStats(): {
    totalCommands: number;
    acceptedCount: number;
    rejectedCount: number;
    ancillaryCount: number;
    onsCommandCount: number;
  } {
    return {
      totalCommands: this.history.length,
      acceptedCount: this.history.filter((r) => r.accepted).length,
      rejectedCount: this.history.filter((r) => !r.accepted).length,
      ancillaryCount: this.history.filter((r) => r.reason === "ancillary").length,
      onsCommandCount: this.history.filter((r) => r.reason === "ons_command").length,
    };
  }
}

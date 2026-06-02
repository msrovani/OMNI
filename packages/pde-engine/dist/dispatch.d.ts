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
export declare class DispatchOrchestrator {
    private history;
    private signingKey;
    constructor(signingKey?: string);
    private toPayload;
    sign(command: Omit<DispatchCommand, "signature">): string;
    verify(command: DispatchCommand, signature: string): boolean;
    execute(command: DispatchCommand): Promise<DispatchRecord>;
    getHistory(assetId?: string): DispatchRecord[];
    getStats(): {
        totalCommands: number;
        acceptedCount: number;
        rejectedCount: number;
    };
}
export {};
//# sourceMappingURL=dispatch.d.ts.map
import { createHmac, timingSafeEqual } from "node:crypto";
export class DispatchOrchestrator {
    history = [];
    signingKey;
    constructor(signingKey) {
        this.signingKey = signingKey ?? "omni-grid-default-key";
    }
    toPayload(command) {
        return [
            command.assetId,
            command.powerKw.toString(),
            command.durationSeconds.toString(),
            command.reason,
        ].join("|");
    }
    sign(command) {
        const payload = this.toPayload(command);
        return createHmac("sha256", this.signingKey)
            .update(payload)
            .digest("hex");
    }
    verify(command, signature) {
        const expected = this.sign(command);
        if (signature.length !== expected.length)
            return false;
        try {
            return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        }
        catch {
            return false;
        }
    }
    async execute(command) {
        const signature = this.sign(command);
        const record = {
            commandId: crypto.randomUUID(),
            ...command,
            timestamp: new Date(),
            signature,
            accepted: true,
        };
        this.history.push(record);
        return record;
    }
    getHistory(assetId) {
        if (assetId)
            return this.history.filter((r) => r.assetId === assetId);
        return [...this.history];
    }
    getStats() {
        return {
            totalCommands: this.history.length,
            acceptedCount: this.history.filter((r) => r.accepted).length,
            rejectedCount: this.history.filter((r) => !r.accepted).length,
        };
    }
}
//# sourceMappingURL=dispatch.js.map
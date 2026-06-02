// ⚡ Omni-Grid Message Bus
// Abstraction over NATS with in-memory fallback for dev.
import { EventEmitter } from "node:events";
import { z } from "zod";
// ─── Message Schemas ───
export const TelemetryMessageSchema = z.object({
    type: z.literal("telemetry"),
    source: z.string(),
    deviceId: z.string(),
    timestamp: z.string(),
    socPercent: z.number(),
    sohPercent: z.number().optional(),
    powerW: z.number(),
    voltageV: z.number(),
    frequencyHz: z.number(),
    temperatureC: z.number(),
    isGridConnected: z.boolean(),
});
export const DispatchMessageSchema = z.object({
    type: z.literal("dispatch"),
    source: z.string(),
    commandId: z.string(),
    assetId: z.string(),
    powerKw: z.number(),
    durationSeconds: z.number(),
    reason: z.enum(["arbitrage", "peak_shave", "ancillary", "v2g"]),
    signature: z.string(),
});
export const PriceMessageSchema = z.object({
    type: z.literal("price"),
    source: z.string(),
    timestamp: z.string(),
    pricePerKwh: z.number(),
    region: z.string().default("SE"),
    product: z.string().default("PLD"),
});
export const CommandMessageSchema = z.object({
    type: z.literal("command"),
    source: z.string(),
    target: z.string(),
    action: z.string(),
    payload: z.record(z.unknown()),
});
export function channelTelemetry(deviceId) {
    return deviceId ? `telemetry.${deviceId}` : "telemetry.*";
}
export function channelDispatch(assetId) {
    return assetId ? `dispatch.${assetId}` : "dispatch.*";
}
export function channelPrices(region) {
    return region ? `market.prices.${region}` : "market.prices";
}
export function channelCommands(target) {
    return target ? `commands.${target}` : "commands.*";
}
export class InMemoryBus {
    name = "in-memory";
    emitter = new EventEmitter();
    connected = false;
    maxListeners = 1000;
    subs = new Map();
    async connect() {
        this.emitter.setMaxListeners(this.maxListeners);
        this.connected = true;
    }
    async disconnect() {
        this.emitter.removeAllListeners();
        this.subs.clear();
        this.connected = false;
    }
    /** Match a NATS-style pattern against a topic (token-based) */
    matchPattern(pattern, topic) {
        const p = pattern.split(".");
        const t = topic.split(".");
        for (let i = 0; i < p.length; i++) {
            if (p[i] === ">")
                return true;
            if (p[i] === "*")
                continue;
            if (p[i] !== t[i])
                return false;
        }
        return p.length === t.length;
    }
    async publish(channel, message) {
        if (!this.connected)
            throw new Error("Bus not connected");
        // Find all matching subscriptions via pattern matching
        for (const [, handlers] of this.subs) {
            for (const sub of handlers) {
                if (this.matchPattern(sub.raw, channel)) {
                    try {
                        void sub.handler(message);
                    }
                    catch (err) {
                        console.error(`[omni-bus] handler error on ${channel}:`, err);
                    }
                }
            }
        }
    }
    async subscribe(channel, handler) {
        if (!this.connected)
            await this.connect();
        const wrapped = { raw: channel, handler };
        if (!this.subs.has(channel)) {
            this.subs.set(channel, []);
        }
        this.subs.get(channel).push(wrapped);
        return {
            unsubscribe: () => {
                const arr = this.subs.get(channel);
                if (arr) {
                    const idx = arr.indexOf(wrapped);
                    if (idx >= 0)
                        arr.splice(idx, 1);
                    if (arr.length === 0)
                        this.subs.delete(channel);
                }
            },
        };
    }
    isConnected() {
        return this.connected;
    }
    listenerCount(channel) {
        const arr = this.subs.get(channel);
        return arr ? arr.length : 0;
    }
}
// ─── NATS Bus (Production — requires NATS server) ───
export class NatsBus {
    name = "nats";
    nc = null;
    subs = new Map();
    url;
    constructor(url = "nats://localhost:4222") {
        this.url = url;
    }
    async connect() {
        try {
            const { connect } = await import("nats");
            this.nc = await connect({ servers: this.url });
        }
        catch {
            throw new Error(`NATS not available at ${this.url}. Install nats package or use InMemoryBus.`);
        }
    }
    async disconnect() {
        if (this.nc) {
            await this.nc.drain();
            await this.nc.close();
            this.nc = null;
        }
        this.subs.clear();
    }
    async publish(channel, message) {
        if (!this.nc)
            throw new Error("NATS not connected");
        this.nc.publish(channel, JSON.stringify(message));
    }
    async subscribe(channel, handler) {
        if (!this.nc)
            await this.connect();
        const sub = this.nc.subscribe(channel, {
            callback: (err, msg) => {
                if (err) {
                    console.error(`[nats] error on ${channel}:`, err);
                    return;
                }
                try {
                    const data = JSON.parse(msg.data.toString());
                    handler(data);
                }
                catch (e) {
                    console.error(`[nats] parse error on ${channel}:`, e);
                }
            },
        });
        this.subs.set(channel, sub);
        return {
            unsubscribe: () => {
                sub.unsubscribe();
                this.subs.delete(channel);
            },
        };
    }
    isConnected() {
        return this.nc !== null && !this.nc.isClosed();
    }
}
export function createBus(backend = "in-memory", url) {
    if (backend === "nats")
        return new NatsBus(url);
    return new InMemoryBus();
}
//# sourceMappingURL=index.js.map
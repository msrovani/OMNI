import { z } from "zod";
export declare const TelemetryMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"telemetry">;
    source: z.ZodString;
    deviceId: z.ZodString;
    timestamp: z.ZodString;
    socPercent: z.ZodNumber;
    sohPercent: z.ZodOptional<z.ZodNumber>;
    powerW: z.ZodNumber;
    voltageV: z.ZodNumber;
    frequencyHz: z.ZodNumber;
    temperatureC: z.ZodNumber;
    isGridConnected: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    type: "telemetry";
    source: string;
    deviceId: string;
    timestamp: string;
    socPercent: number;
    powerW: number;
    voltageV: number;
    frequencyHz: number;
    temperatureC: number;
    isGridConnected: boolean;
    sohPercent?: number | undefined;
}, {
    type: "telemetry";
    source: string;
    deviceId: string;
    timestamp: string;
    socPercent: number;
    powerW: number;
    voltageV: number;
    frequencyHz: number;
    temperatureC: number;
    isGridConnected: boolean;
    sohPercent?: number | undefined;
}>;
export declare const DispatchMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"dispatch">;
    source: z.ZodString;
    commandId: z.ZodString;
    assetId: z.ZodString;
    powerKw: z.ZodNumber;
    durationSeconds: z.ZodNumber;
    reason: z.ZodEnum<["arbitrage", "peak_shave", "ancillary", "v2g"]>;
    signature: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "dispatch";
    source: string;
    commandId: string;
    assetId: string;
    powerKw: number;
    durationSeconds: number;
    reason: "arbitrage" | "peak_shave" | "ancillary" | "v2g";
    signature: string;
}, {
    type: "dispatch";
    source: string;
    commandId: string;
    assetId: string;
    powerKw: number;
    durationSeconds: number;
    reason: "arbitrage" | "peak_shave" | "ancillary" | "v2g";
    signature: string;
}>;
export declare const PriceMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"price">;
    source: z.ZodString;
    timestamp: z.ZodString;
    pricePerKwh: z.ZodNumber;
    region: z.ZodDefault<z.ZodString>;
    product: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "price";
    source: string;
    timestamp: string;
    pricePerKwh: number;
    region: string;
    product: string;
}, {
    type: "price";
    source: string;
    timestamp: string;
    pricePerKwh: number;
    region?: string | undefined;
    product?: string | undefined;
}>;
export declare const CommandMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"command">;
    source: z.ZodString;
    target: z.ZodString;
    action: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: "command";
    source: string;
    target: string;
    action: string;
    payload: Record<string, unknown>;
}, {
    type: "command";
    source: string;
    target: string;
    action: string;
    payload: Record<string, unknown>;
}>;
export type TelemetryMessage = z.infer<typeof TelemetryMessageSchema>;
export type DispatchMessage = z.infer<typeof DispatchMessageSchema>;
export type PriceMessage = z.infer<typeof PriceMessageSchema>;
export type CommandMessage = z.infer<typeof CommandMessageSchema>;
export type BusMessage = TelemetryMessage | DispatchMessage | PriceMessage | CommandMessage;
export type Channel = "telemetry.*" | "telemetry.{deviceId}" | "dispatch.*" | "dispatch.{assetId}" | "market.prices" | "market.prices.{region}" | "commands.*" | "commands.{target}";
export declare function channelTelemetry(deviceId?: string): string;
export declare function channelDispatch(assetId?: string): string;
export declare function channelPrices(region?: string): string;
export declare function channelCommands(target?: string): string;
export interface Subscription {
    unsubscribe(): void;
}
export type MessageHandler = (msg: BusMessage) => void | Promise<void>;
export interface IMessageBus {
    readonly name: string;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    publish(channel: string, message: BusMessage): Promise<void>;
    subscribe(channel: string, handler: MessageHandler): Promise<Subscription>;
    isConnected(): boolean;
}
export declare class InMemoryBus implements IMessageBus {
    readonly name = "in-memory";
    private emitter;
    private connected;
    private maxListeners;
    private subs;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    /** Match a NATS-style pattern against a topic (token-based) */
    private matchPattern;
    publish(channel: string, message: BusMessage): Promise<void>;
    subscribe(channel: string, handler: MessageHandler): Promise<Subscription>;
    isConnected(): boolean;
    listenerCount(channel: string): number;
}
export declare class NatsBus implements IMessageBus {
    readonly name = "nats";
    private nc;
    private subs;
    private url;
    constructor(url?: string);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    publish(channel: string, message: BusMessage): Promise<void>;
    subscribe(channel: string, handler: MessageHandler): Promise<Subscription>;
    isConnected(): boolean;
}
export type BusBackend = "in-memory" | "nats";
export declare function createBus(backend?: BusBackend, url?: string): IMessageBus;
//# sourceMappingURL=index.d.ts.map
import { InMemoryBus, channelTelemetry, channelDispatch, channelPrices, type BusMessage, type TelemetryMessage, type DispatchMessage } from "@omni-grid/omni-bus";
import { AuthService, Role, Permission, type UserRecord } from "@omni-grid/omni-auth";
import { ForecastEngine, StochasticOptimizer, DispatchOrchestrator, MarketDataClient } from "@omni-grid/pde-engine";

const API_BASE = "http://127.0.0.1:3000";
const JWT_SECRET = "omni-grid-jwt-dev-secret";

export interface TestContext {
  bus: InMemoryBus;
  auth: AuthService;
  forecast: ForecastEngine;
  optimizer: StochasticOptimizer;
  dispatcher: DispatchOrchestrator;
  marketData: MarketDataClient;
  users: {
    admin: UserRecord;
    operator: UserRecord;
    viewer: UserRecord;
    device: UserRecord;
  };
}

export async function createTestContext(): Promise<TestContext> {
  const bus = new InMemoryBus();
  await bus.connect();

  const auth = new AuthService(JWT_SECRET, 86400);
  const forecast = new ForecastEngine();
  const optimizer = new StochasticOptimizer(100_000);
  const dispatcher = new DispatchOrchestrator();
  const marketData = new MarketDataClient();

  const admin = auth.registerUser({ username: "admin", password: "omni-admin-2026", role: Role.Admin });
  const operator = auth.registerUser({ username: "operator", password: "omni-operator-2026", role: Role.Operator });
  const viewer = auth.registerUser({ username: "viewer", password: "omni-viewer-2026", role: Role.Viewer });
  const device = auth.registerUser({ username: "device-sim-001", password: "device-token-001", role: Role.Device });

  return { bus, auth, forecast, optimizer, dispatcher, marketData, users: { admin, operator, viewer, device } };
}

export async function destroyTestContext(ctx: TestContext): Promise<void> {
  await ctx.bus.disconnect();
}

export interface TelemetryCollector {
  messages: TelemetryMessage[];
  sub: { unsubscribe(): void };
}

export async function subscribeTelemetry(bus: InMemoryBus, deviceId?: string): Promise<TelemetryCollector> {
  const messages: TelemetryMessage[] = [];
  const sub = await bus.subscribe(channelTelemetry(deviceId), (msg: BusMessage) => {
    if ((msg as TelemetryMessage).type === "telemetry") {
      messages.push(msg as TelemetryMessage);
    }
  });
  return { messages, sub };
}

export interface DispatchCollector {
  messages: DispatchMessage[];
  sub: { unsubscribe(): void };
}

export async function subscribeDispatches(bus: InMemoryBus, assetId?: string): Promise<DispatchCollector> {
  const messages: DispatchMessage[] = [];
  const sub = await bus.subscribe(channelDispatch(assetId), (msg: BusMessage) => {
    if ((msg as DispatchMessage).type === "dispatch") {
      messages.push(msg as DispatchMessage);
    }
  });
  return { messages, sub };
}

export function authenticate(ctx: TestContext, username: string, password: string): string {
  return ctx.auth.authenticate(username, password);
}

export async function tryApiLogin(): Promise<string | null> {
  try {
    const resp = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "omni-admin-2026" }),
      signal: AbortSignal.timeout(2000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    return data.token ?? null;
  } catch {
    return null;
  }
}

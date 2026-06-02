// ⚡ Omni-Grid API Gateway
// Integrates: JWT Auth, Message Bus, PDE Engine, gRPC Edge Gateway, WebSocket, Telemetry Store

import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { z } from "zod";
import {
  ForecastEngine,
  StochasticOptimizer,
  DispatchOrchestrator,
  MarketDataClient,
} from "@omni-grid/pde-engine";
import {
  AuthService,
  Role,
  Permission,
  registerAuthPlugin,
  AuthError,
} from "@omni-grid/omni-auth";
import {
  createBus,
  InMemoryBus,
  channelDispatch,
  channelPrices,
  channelTelemetry,
  type BusMessage,
  type IMessageBus,
} from "@omni-grid/omni-bus";
import { TelemetryStore } from "./telemetry-store.js";
import { WsBroadcast } from "./ws-broadcast.js";
import {
  PLD_SUBMARKETS,
  PLD_SUBMARKET_NAMES,
  type PldSubmarket,
} from "@omni-grid/pde-engine";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
const HOST = process.env["HOST"] ?? "0.0.0.0";
const BUS_BACKEND = process.env["BUS_BACKEND"] ?? "in-memory";
const JWT_SECRET = process.env["JWT_SECRET"] ?? "omni-grid-jwt-dev-secret";
const OMNICLOUD_GRPC_URL = process.env["OMNICLOUD_GRPC_URL"] ?? "http://127.0.0.1:50053";

// ─── Initialize Core Services ───

const forecastEngine = new ForecastEngine();
const optimizer = new StochasticOptimizer(100_000);
const dispatcher = new DispatchOrchestrator();
const marketClient = new MarketDataClient({ useCceeCollector: true });
const authService = new AuthService(JWT_SECRET, 86400);
const telemetryStore = new TelemetryStore();
const wsBroadcast = new WsBroadcast();
let messageBus: IMessageBus;

// ─── Zod Schemas ───

const TelemetryPayloadSchema = z.object({
  deviceId: z.string().min(1, "deviceId is required"),
  socPercent: z.number().min(0).max(100).optional(),
  sohPercent: z.number().min(0).max(100).optional(),
  powerW: z.number().optional(),
  voltageV: z.number().optional(),
  frequencyHz: z.number().optional(),
  temperatureC: z.number().optional(),
  isGridConnected: z.boolean().optional(),
});

// ─── Create Seed Users ───

authService.registerUser({
  username: "admin",
  password: "omni-admin-2026",
  role: Role.Admin,
});
authService.registerUser({
  username: "operator",
  password: "omni-operator-2026",
  role: Role.Operator,
});
authService.registerUser({
  username: "viewer",
  password: "omni-viewer-2026",
  role: Role.Viewer,
});
authService.registerUser({
  username: "device-sim-001",
  password: "device-token-001",
  role: Role.Device,
});

console.log("Seed users created:");
console.log("  admin    → admin:omni-admin-2026");
console.log("  operator → operator:omni-operator-2026");
console.log("  viewer   → viewer:omni-viewer-2026");

// ─── Create Fastify App ───

const app = Fastify({ logger: true });

await app.register(cors, { origin: "*" });

// ─── WebSocket Plugin ───

await app.register(websocket);

// ─── Auth Plugin ───

await app.register(registerAuthPlugin, {
  authService,
  excludePaths: ["/health", "/auth/login", "/api/v1/pde/dispatch/execute"],
});

// ─── Message Bus ───

messageBus = createBus(BUS_BACKEND as any);
await messageBus.connect();
console.log(`Message Bus connected [${messageBus.name}]`);

// ─── Subscribe to bus events (logging / audit) ───

await messageBus.subscribe("dispatch.*", async (msg: BusMessage) => {
  console.log(`[BUS] Dispatch: ${(msg as any).assetId} → ${(msg as any).powerKw}kW`);
  wsBroadcast.broadcastDispatch(msg);
});

await messageBus.subscribe("telemetry.*", async (msg: BusMessage) => {
  console.log(`[BUS] Telemetry: ${(msg as any).deviceId} → SoC=${(msg as any).socPercent}%`);
});

await messageBus.subscribe("price.*", async (msg: BusMessage) => {
  wsBroadcast.broadcastMarketPrice(msg);
});

// ─── Routes ───

// Health (no auth)
app.get("/health", async () => ({
  status: "ok",
  service: "omni-grid-api",
  version: "1.0.0",
  bus: messageBus.name,
  mercado: "Brasil",
  moeda: "BRL",
  submercados: PLD_SUBMARKETS,
  timestamp: new Date().toISOString(),
}));

// Login (no auth)
app.post<{
  Body: { username: string; password: string };
}>("/auth/login", async (req, reply) => {
  const { username, password } = req.body;
  if (!username || !password) {
    reply.status(400).send({ error: "username and password required" });
    return;
  }
  try {
    const token = authService.authenticate(username, password);
    reply.send({ token, tokenType: "Bearer", expiresIn: 86400 });
  } catch (err: any) {
    reply.status(401).send({ error: err.message ?? "Authentication failed" });
  }
});

// Token info
app.get("/auth/me", async (req) => ({
  user: (req as any).user?.username,
  role: (req as any).user?.role,
  permissions: (req as any).user
    ? authService.getPermissionsForRole((req as any).user.role)
    : [],
}));

// ─── WebSocket Route ───

app.get("/ws", { websocket: true }, (socket: WebSocket, req) => {
  try {
    const query = req.query as Record<string, string>;
    const token = query["token"];
    if (!token) {
      socket.close(4001, "Missing token");
      return;
    }
    const { user } = authService.verifyToken(token);
    (req as any).user = user;

    wsBroadcast.addClient(socket);

    // Send latest telemetry on connect
    const latest = telemetryStore.getAllLatest();
    if (latest.size > 0) {
      const telemetryData: Record<string, any> = {};
      for (const [deviceId, record] of latest.entries()) {
        telemetryData[deviceId] = record;
      }
      socket.send(JSON.stringify({ event: "init", data: telemetryData }));
    }

    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") {
          socket.send(JSON.stringify({ event: "pong" }));
        }
      } catch {
        // ignore malformed messages
      }
    });

  } catch {
    socket.close(4001, "Invalid token");
  }
});

// ─── PDE Endpoints ───

// Forecast
app.post<{
  Body: { assetId: string; horizon?: number; features?: any[] };
}>("/api/v1/pde/forecast", async (req) => {
  const { assetId, horizon = 4, features = [] } = req.body;
  return forecastEngine.predict(assetId, features, horizon);
});

// Optimize
app.post<{
  Body: {
    assetIds: string[];
    objective?: string;
    currentSoc?: Record<string, number>;
    submercado?: PldSubmarket;
  };
}>("/api/v1/pde/optimize", async (req) => {
  const { assetIds, objective = "balanced", currentSoc = {}, submercado = "SE_CO" } = req.body;
  const assets = assetIds.map((id) => defaultAsset(id));
  const prices = await marketClient.fetchPldPrices(
    new Date(),
    new Date(Date.now() + 24 * 3600_000),
    true,
    submercado,
  );
  const result = optimizer.optimize(assets, prices, currentSoc, objective as any, submercado);

  // Publish optimized commands to message bus
  for (const cmd of result.commands) {
    const signature = dispatcher.sign(cmd);
    await messageBus.publish(channelDispatch(cmd.assetId), {
      type: "dispatch",
      source: "pde-engine",
      commandId: crypto.randomUUID(),
      assetId: cmd.assetId,
      powerKw: cmd.powerKw,
      durationSeconds: cmd.durationSeconds,
      reason: cmd.reason,
      submercado,
      signature,
    });
  }

  return result;
});

// Dispatch execute
app.post<{
  Body: { assetId: string; powerKw: number; durationSeconds: number; reason: string };
}>("/api/v1/pde/dispatch/execute", async (req, reply) => {
  const { assetId, powerKw, durationSeconds, reason } = req.body;
  const cmd = { assetId, powerKw, durationSeconds, reason: reason as any };
  try {
    const record = await dispatcher.execute(cmd);

    // Publish to bus
    await messageBus.publish(channelDispatch(assetId), {
      type: "dispatch",
      source: "api-gateway",
      commandId: record.commandId,
      assetId,
      powerKw,
      durationSeconds,
      reason: reason as any,
      signature: record.signature,
    });

    return record;
  } catch (err: any) {
    reply.status(500).send({ error: err.message ?? "Dispatch execution failed" });
  }
});

app.get("/api/v1/pde/dispatch/history", async (req) => {
  const assetId = (req.query as any).assetId;
  return dispatcher.getHistory(assetId);
});

app.get("/api/v1/pde/dispatch/stats", async () => {
  return dispatcher.getStats();
});

app.get("/api/v1/pde/status", async () => ({
  service: "pde-engine",
  version: "1.0.0",
  status: "operational",
  bus: messageBus.name,
  busConnected: messageBus.isConnected(),
}));

// ─── Market ───

app.get("/api/v1/market/prices", async (req) => {
  const { start, end, submercado } = req.query as any;
  const sm: PldSubmarket = submercado ?? "SE_CO";
  const s = start ? new Date(start) : new Date();
  const e = end ? new Date(end) : new Date(Date.now() + 24 * 3600_000);
  const prices = await marketClient.fetchPldPrices(s, e, false, sm);

  // Publish latest price to bus
  if (prices.length > 0) {
    const latest = prices[prices.length - 1]!;
    await messageBus.publish(channelPrices(), {
      type: "price",
      source: "market-connect",
      timestamp: latest.timestamp.toISOString(),
      pricePerKwh: latest.pricePerKwh,
      region: sm,
      submercado: sm,
      currency: "BRL",
      product: "PLD",
    });
  }

  return prices;
});

app.get("/api/v1/market/submercados", async () => {
  return PLD_SUBMARKETS.map((code) => ({
    code,
    name: PLD_SUBMARKET_NAMES[code],
  }));
});

app.get("/api/v1/market/regulatory", async () => ({
  pais: "Brasil",
  orgaos: {
    aneel: "Agência Nacional de Energia Elétrica",
    ons: "Operador Nacional do Sistema Elétrico",
    ccee: "Câmara de Comercialização de Energia Elétrica",
    epe: "Empresa de Pesquisa Energética",
  },
  legislacao: {
    marcoLegal: "Lei 14.120/2021",
    marcoGD: "Lei 14.300/2022",
    ren1000: "REN ANEEL 1.000/2022",
    pldHorario: "Portaria MM E 50/2021",
  },
  moeda: "BRL",
  unidade: "R$/MWh",
  pld: {
    piso: 69.07,
    teto: 599.31,
    submercados: PLD_SUBMARKETS.map((code) => ({
      code,
      name: PLD_SUBMARKET_NAMES[code],
    })),
  },
}));

// ─── Telemetry Endpoints ───

app.post("/api/v1/edge/telemetry", async (req, reply) => {
  try {
    const body = TelemetryPayloadSchema.parse(req.body);

    const record = {
      deviceId: body.deviceId,
      timestamp: new Date().toISOString(),
      socPercent: body.socPercent ?? 50,
      sohPercent: body.sohPercent ?? 100,
      powerW: body.powerW ?? 0,
      voltageV: body.voltageV ?? 400,
      frequencyHz: body.frequencyHz ?? 60,
      temperatureC: body.temperatureC ?? 25,
      isGridConnected: body.isGridConnected ?? true,
    };

    // Store in telemetry store
    telemetryStore.add(body.deviceId, record);

    // Publish to message bus
    await messageBus.publish(channelTelemetry(body.deviceId), {
      type: "telemetry",
      source: body.deviceId,
      ...record,
    });

    // Broadcast via WebSocket
    wsBroadcast.broadcastTelemetry(body.deviceId, record);

    return { accepted: true, deviceId: body.deviceId };
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      reply.status(400).send({ error: "Validation failed", details: err.errors });
      return;
    }
    reply.status(500).send({ error: err.message ?? "Internal server error" });
  }
});

app.get("/api/v1/telemetry/latest", async () => {
  const all = telemetryStore.getAllLatest();
  const result: Record<string, any> = {};
  for (const [deviceId, record] of all.entries()) {
    result[deviceId] = record;
  }
  return result;
});

app.get<{
  Params: { deviceId: string };
}>("/api/v1/telemetry/:deviceId/history", async (req) => {
  const { deviceId } = req.params;
  const limit = parseInt((req.query as any).limit ?? "100", 10);
  return telemetryStore.getHistory(deviceId, limit);
});

app.get("/api/v1/devices", async () => {
  const all = telemetryStore.getAllLatest();
  return Array.from(all.keys()).map((deviceId) => ({
    deviceId,
    lastSeen: all.get(deviceId)!.timestamp,
  }));
});

app.get("/api/v1/devices/count", async () => {
  return { count: telemetryStore.getAllLatest().size };
});

// ─── Bus Admin ───

app.get("/api/v1/bus/status", async () => ({
  backend: messageBus.name,
  connected: messageBus.isConnected(),
  listenerCount: messageBus instanceof InMemoryBus ? messageBus.listenerCount("*") : -1,
}));

app.post("/api/v1/bus/publish", async (req, reply) => {
  const body = req.body as any;
  if (!body?.channel || !body?.message) {
    reply.status(400).send({ error: "channel and message required" });
    return;
  }
  await messageBus.publish(body.channel, body.message);
  return { published: true, channel: body.channel };
});

// ─── gRPC Edge Gateway Proxy ───

app.get("/api/v1/edge/status", async () => {
  try {
    const resp = await fetch(`${OMNICLOUD_GRPC_URL}/health`);
    const data = await resp.json();
    return { edgeGateway: "connected", status: data };
  } catch {
    return { edgeGateway: "disconnected", url: OMNICLOUD_GRPC_URL };
  }
});

// ─── Start ───

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`\n=== Omni-Grid API Gateway ===`);
  console.log(`  REST API:   http://${HOST}:${PORT}`);
  console.log(`  WebSocket:  ws://${HOST}:${PORT}/ws`);
  console.log(`  Health:     http://${HOST}:${PORT}/health`);
  console.log(`  Login:      POST http://${HOST}:${PORT}/auth/login`);
  console.log(`  Bus:        ${messageBus.name}`);
  console.log(`  gRPC Edge:  ${OMNICLOUD_GRPC_URL}`);
  console.log(`=============================\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// ─── Graceful Shutdown ───

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await messageBus.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down...");
  await messageBus.disconnect();
  process.exit(0);
});

// ─── Helpers ───

function defaultAsset(id: string) {
  return {
    id,
    clientId: "default",
    manufacturer: "Generic",
    model: "Battery-100",
    capacityKwh: 100,
    nominalPowerKw: 50,
    cycleLife: 6000,
    replacementCost: 50000,
    minSocPercent: 20,
    maxSocPercent: 95,
    installedAt: new Date(),
  };
}

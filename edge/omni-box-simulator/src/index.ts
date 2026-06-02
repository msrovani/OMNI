// ⚡ Omni-Box Simulator — Full Pipeline Integration
// Connects to Message Bus, sends telemetry, receives dispatches.
// Simulates a real edge device with battery dynamics.

import {
  createBus,
  channelTelemetry,
  channelDispatch,
  type BusMessage,
  type DispatchMessage,
} from "@omni-grid/omni-bus";
import { AuthService, Role } from "@omni-grid/omni-auth";

const DEVICE_ID = process.env["DEVICE_ID"] ?? "sim-001";
const BUS_BACKEND = process.env["BUS_BACKEND"] ?? "in-memory";
const API_URL = process.env["API_URL"] ?? "http://127.0.0.1:3000";
const TELEMETRY_INTERVAL_MS = parseInt(process.env["TELEMETRY_INTERVAL_MS"] ?? "5000", 10);
const API_TOKEN = process.env["API_TOKEN"];

export class OmniBoxSimulator {
  private deviceId: string;
  private soc = 50.0;
  private soh = 100.0;
  private temperature = 25.0;
  private powerW = 0;
  public gridConnected = true;
  private charging = false;
  public cycles = 0;
  private bus = createBus(BUS_BACKEND as any);
  private auth = new AuthService("omni-grid-jwt-dev-secret");
  private token = "";

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.auth.registerUser({
      username: deviceId,
      password: "device-token-001",
      role: Role.Device,
    });
  }

  get deviceInfo(): { deviceId: string; soc: number; soh: number; temperature: number; powerW: number; gridConnected: boolean; cycles: number } {
    return {
      deviceId: this.deviceId,
      soc: this.soc,
      soh: this.soh,
      temperature: this.temperature,
      powerW: this.powerW,
      gridConnected: this.gridConnected,
      cycles: this.cycles,
    };
  }

  applyDispatch(powerKw: number, durationSeconds: number, reason: string): void {
    this.charging = powerKw < 0;
    this.powerW = Math.abs(powerKw) * 1000;
    this.cycles++;
  }

  updateBattery(): void {
    if (this.charging) {
      this.soc += 0.5 + Math.random() * 0.5;
      this.temperature += 0.05;
    } else if (this.powerW > 0) {
      this.soc -= (this.powerW / 50000) * 5;
      this.temperature += 0.02;
    } else {
      this.soc -= Math.random() * 0.1;
      this.temperature -= 0.01;
    }

    // Clamp values
    this.soc = Math.max(10, Math.min(95, this.soc));
    this.temperature = Math.max(18, Math.min(45, this.temperature));
    this.soh = Math.max(80, this.soh - 0.001 * (this.cycles > 0 ? 1 : 0));

    // Simulate grid fluctuations
    if (Math.random() < 0.001) {
      this.gridConnected = !this.gridConnected;
    }
  }

  generateTelemetry(): TelemetryPayload {
    this.updateBattery();
    return {
      type: "telemetry" as const,
      source: this.deviceId,
      deviceId: this.deviceId,
      timestamp: new Date().toISOString(),
      socPercent: Math.round(this.soc * 100) / 100,
      sohPercent: Math.round(this.soh * 100) / 100,
      powerW: Math.round(this.powerW),
      voltageV: 400 + Math.random() * 10 - 5,
      frequencyHz: 60 + Math.random() * 0.1 - 0.05,
      temperatureC: Math.round(this.temperature * 10) / 10,
      isGridConnected: this.gridConnected,
    };
  }

  async start(): Promise<void> {
    console.log(`\n=== Omni-Box Simulator [${this.deviceId}] ===`);

    if (API_TOKEN) {
      this.token = API_TOKEN;
    } else {
      try {
        const resp = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: this.deviceId,
            password: "device-token-001",
          }),
        });
        const data = await resp.json() as any;
        this.token = data.token;
        console.log(`  Authenticated: ${data.tokenType} ${this.token.slice(0, 20)}...`);
      } catch (err) {
        console.log(`  Auth unavailable (API not running?): using local bus`);
      }
    }

    await this.bus.connect();
    console.log(`  Bus connected [${this.bus.name}]`);

    await this.bus.subscribe(channelDispatch(this.deviceId), async (msg: BusMessage) => {
      const dispatch = msg as DispatchMessage;
      console.log(`\n  ⚡ DISPATCH RECEIVED:`);
      console.log(`     Asset:     ${dispatch.assetId}`);
      console.log(`     Power:     ${dispatch.powerKw}kW`);
      console.log(`     Duration:  ${dispatch.durationSeconds}s`);
      console.log(`     Reason:    ${dispatch.reason}`);
      console.log(`     Signature: ${dispatch.signature.slice(0, 16)}...`);

      this.applyDispatch(dispatch.powerKw, dispatch.durationSeconds, dispatch.reason);
    });

    console.log(`  Telemetry every ${TELEMETRY_INTERVAL_MS / 1000}s\n`);
    await this.telemetryLoop();
  }

  private async telemetryLoop(): Promise<void> {
    while (true) {
      await this.delay(TELEMETRY_INTERVAL_MS);
      const telemetry = this.generateTelemetry();

      await this.bus.publish(channelTelemetry(this.deviceId), telemetry);

      if (this.token) {
        try {
          await fetch(`${API_URL}/api/v1/edge/telemetry`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify(telemetry),
          });
        } catch {
          // API might not be available
        }
      }

      console.log(
        `[${new Date().toLocaleTimeString()}] ${this.deviceId} | ` +
        `SoC=${telemetry.socPercent}% | ` +
        `SoH=${telemetry.sohPercent}% | ` +
        `Power=${telemetry.powerW}W | ` +
        `Temp=${telemetry.temperatureC}°C | ` +
        `Cycles=${this.cycles}`,
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

export interface TelemetryPayload {
  type: "telemetry";
  source: string;
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

if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  const sim = new OmniBoxSimulator(DEVICE_ID);
  sim.start().catch(console.error);
}

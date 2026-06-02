#!/usr/bin/env node

import { Command } from "commander";
import * as readline from "node:readline/promises";
import { config } from "./config.js";
import { authStore } from "./auth-store.js";
import {
  colorSuccess,
  colorError,
  colorWarning,
  colorInfo,
  formatTable,
} from "./formatters.js";
import { DispatchOrchestrator } from "@omni-grid/pde-engine";
import { InMemoryBus, channelTelemetry, channelDispatch } from "@omni-grid/omni-bus";

const program = new Command();
const hasJson = () => process.argv.includes("--json");

function printJson(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = authStore.getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.method === "POST" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const url = `${config.apiUrl}${path}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function promptPassword(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const password = await rl.question("Password: ");
  rl.close();
  return password;
}

program
  .name("omni")
  .version("1.0.0")
  .description("Omni-Grid energy system CLI");

program
  .command("status")
  .description("Show system health")
  .action(async () => {
    const json = hasJson();
    try {
      const health = await apiFetch<{ status: string }>("/health");
      const devices = await apiFetch<{ count: number }>("/api/v1/devices/count");
      const telemetry = await apiFetch<{ timestamp?: string }>("/api/v1/telemetry/latest");

      if (json) {
        printJson({ health, devices, telemetry });
        return;
      }

      console.log(formatTable([
        ["API Status", health.status === "ok" ? colorSuccess("Online") : colorError("Offline")],
        ["Connected Devices", colorInfo(String(devices.count ?? devices))],
        ["Last Telemetry", telemetry.timestamp ? colorInfo(new Date(telemetry.timestamp).toISOString()) : colorWarning("N/A")],
      ], { header: ["Check", "Status"] }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (json) {
        printJson({ error: msg });
        return;
      }
      console.error(colorError(`Error: ${msg}`));
    }
  });

program
  .command("login")
  .description("Authenticate and store JWT")
  .argument("<username>", "username")
  .argument("[password]", "password (prompted if not provided)")
  .action(async (username: string, password?: string) => {
    const pw = password ?? (await promptPassword());
    const json = hasJson();
    try {
      const result = await apiFetch<{ token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password: pw }),
      });
      authStore.setToken(result.token);
      if (json) {
        printJson({ success: true, token: result.token });
        return;
      }
      console.log(colorSuccess("Login successful"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (json) {
        printJson({ error: msg });
        return;
      }
      console.error(colorError(`Login failed: ${msg}`));
    }
  });

program
  .command("forecast")
  .description("Run PDE forecast")
  .action(async () => {
    const json = hasJson();
    try {
      const result = await apiFetch<{
        predictions: number[];
        timestamps: string[];
        maePercent: number;
        assetId: string;
      }>("/api/v1/pde/forecast");

      if (json) {
        printJson(result);
        return;
      }

      console.log(colorInfo(`Forecast for asset: ${result.assetId}  |  MAE: ${result.maePercent.toFixed(1)}%`));
      console.log();
      const rows = result.predictions.slice(0, 24).map((kw: number, i: number) => [
        new Date(result.timestamps[i]!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        kw.toFixed(2),
      ]);
      console.log(formatTable(rows, { header: ["Hour", "Load (kW)"] }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (json) {
        printJson({ error: msg });
        return;
      }
      console.error(colorError(`Forecast failed: ${msg}`));
    }
  });

program
  .command("optimize")
  .description("Run PDE optimization")
  .action(async () => {
    const json = hasJson();
    try {
      const result = await apiFetch<{
        expectedProfitUsd: number;
        expectedDegradationCost: number;
        scenarioCount: number;
        commands: Array<{
          assetId: string;
          powerKw: number;
          durationSeconds: number;
          reason: string;
        }>;
      }>("/api/v1/pde/optimize");

      if (json) {
        printJson(result);
        return;
      }

      const bestPrice = result.commands[0]?.powerKw ?? 0;
      const volume = result.commands.reduce((s: number, c: { powerKw: number }) => s + c.powerKw, 0);

      console.log(formatTable([
        ["Best Price", colorSuccess(`$${bestPrice.toFixed(2)}`), "per kWh"],
        ["Volume", colorInfo(`${volume.toFixed(0)} kW`), ""],
        ["Expected Return", result.expectedProfitUsd >= 0
          ? colorSuccess(`+$${result.expectedProfitUsd.toFixed(2)}`)
          : colorError(`-$${Math.abs(result.expectedProfitUsd).toFixed(2)}`), ""],
        ["Degradation Cost", colorWarning(`$${result.expectedDegradationCost.toFixed(2)}`), ""],
        ["Scenarios Run", colorInfo(String(result.scenarioCount)), ""],
      ], { header: ["Metric", "Value", ""] }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (json) {
        printJson({ error: msg });
        return;
      }
      console.error(colorError(`Optimization failed: ${msg}`));
    }
  });

const dispatchCmd = program
  .command("dispatch")
  .description("Dispatch commands");

dispatchCmd
  .command("execute")
  .description("Create and execute a dispatch command")
  .requiredOption("--asset <id>", "asset ID")
  .requiredOption("--power <kw>", "power in kW", Number)
  .requiredOption("--duration <s>", "duration in seconds", Number)
  .requiredOption("--reason <type>", "dispatch reason (arbitrage, peak_shave, ancillary, v2g)")
  .action(async (opts: { asset: string; power: number; duration: number; reason: string }) => {
    const json = hasJson();
    const validReasons = ["arbitrage", "peak_shave", "ancillary", "v2g"];
    if (!validReasons.includes(opts.reason)) {
      console.error(colorError(`Invalid reason "${opts.reason}". Valid: ${validReasons.join(", ")}`));
      return;
    }

    try {
      const orchestrator = new DispatchOrchestrator(config.jwtSecret);
      const command = {
        assetId: opts.asset,
        powerKw: opts.power,
        durationSeconds: opts.duration,
        reason: opts.reason as "arbitrage" | "peak_shave" | "ancillary" | "v2g",
      };

      const signature = orchestrator.sign(command);
      const signedCommand = { ...command, signature };

      const bus = new InMemoryBus();
      await bus.connect();
      await bus.publish(channelDispatch(opts.asset), signedCommand);

      const result = { ...signedCommand, accepted: true, timestamp: new Date().toISOString() };

      if (json) {
        printJson(result);
        return;
      }

      console.log(colorSuccess("Dispatch command signed and published"));
      console.log();
      console.log(formatTable([
        ["Asset ID", result.assetId],
        ["Power (kW)", String(result.powerKw)],
        ["Duration (s)", String(result.durationSeconds)],
        ["Reason", result.reason],
        ["Signature", colorWarning(result.signature)],
        ["Status", colorSuccess("Accepted")],
      ], { header: ["Field", "Value"] }));

      await bus.disconnect();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (json) {
        printJson({ error: msg });
        return;
      }
      console.error(colorError(`Dispatch failed: ${msg}`));
    }
  });

program
  .command("telemetry")
  .description("Show latest telemetry (listens for 10 seconds)")
  .argument("[deviceId]", "device ID to filter")
  .action(async (deviceId?: string) => {
    const json = hasJson();
    try {
      const bus = new InMemoryBus();
      await bus.connect();
      const messages: unknown[] = [];

      const sub = await bus.subscribe(
        channelTelemetry(deviceId),
        (msg) => {
          messages.push(msg);
          if (!json) {
            const data = msg as Record<string, unknown>;
            console.log(formatTable([
              ["Device", String(data.deviceId ?? "?")],
              ["SOC", `${String(data.socPercent ?? "?")}%`],
              ["Power", `${String(data.powerW ?? "?")} W`],
              ["Voltage", `${String(data.voltageV ?? "?")} V`],
              ["Frequency", `${String(data.frequencyHz ?? "?")} Hz`],
              ["Temp", `${String(data.temperatureC ?? "?")} C`],
              ["Grid", String(data.isGridConnected ?? "?")],
              ["Time", String(data.timestamp ?? "?")],
            ], { header: ["Field", "Value"] }));
            console.log();
          }
        },
      );

      await new Promise((resolve) => setTimeout(resolve, 10_000));
      sub.unsubscribe();
      await bus.disconnect();

      if (json) {
        printJson(messages);
      }

      if (messages.length === 0 && !json) {
        console.log(colorWarning("No telemetry data received in 10 seconds"));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (json) {
        printJson({ error: msg });
        return;
      }
      console.error(colorError(`Telemetry error: ${msg}`));
    }
  });

const assetCmd = program
  .command("asset")
  .description("Asset management");

assetCmd
  .command("list")
  .description("List all assets")
  .action(async () => {
    const json = hasJson();
    try {
      const assets = await apiFetch<Array<{
        id: string;
        manufacturer: string;
        model: string;
        capacityKwh: number;
        nominalPowerKw: number;
      }>>("/api/v1/assets");

      if (json) {
        printJson(assets);
        return;
      }

      if (assets.length === 0) {
        console.log(colorWarning("No assets found"));
        return;
      }

      console.log(formatTable(assets.map((a) => [
        a.id,
        a.manufacturer,
        a.model,
        String(a.capacityKwh),
        String(a.nominalPowerKw),
      ]), { header: ["ID", "Manufacturer", "Model", "Capacity (kWh)", "Power (kW)"] }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (json) {
        printJson({ error: msg });
        return;
      }
      console.error(colorError(`Failed to list assets: ${msg}`));
    }
  });

const marketCmd = program
  .command("market")
  .description("Market data");

marketCmd
  .command("prices")
  .description("Show current market prices")
  .action(async () => {
    const json = hasJson();
    try {
      const prices = await apiFetch<Array<{
        timestamp: string;
        pricePerKwh: number;
        source: string;
        region?: string;
      }>>("/api/v1/market/prices");

      if (json) {
        printJson(prices);
        return;
      }

      if (prices.length === 0) {
        console.log(colorWarning("No market prices available"));
        return;
      }

      console.log(formatTable(prices.slice(0, 24).map((p) => [
        new Date(p.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        `$${p.pricePerKwh.toFixed(4)}`,
        p.region ?? "SE",
        p.source,
      ]), { header: ["Time", "Price/kWh", "Region", "Source"] }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (json) {
        printJson({ error: msg });
        return;
      }
      console.error(colorError(`Failed to fetch prices: ${msg}`));
    }
  });

program.parse();

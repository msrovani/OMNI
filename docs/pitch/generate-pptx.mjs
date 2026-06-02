import PptxGenJS from "pptxgenjs";

const p = new PptxGenJS();
p.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
p.layout = "WIDE";
p.author = "JARBAS v4.0";
p.title = "OMNI-GRID — The Cognitive Energy Infrastructure";
p.subject = "Pitch Deck — Brazilian Energy Market";

const BG_DARK = "0A0A2E";
const CYAN = "00D4FF";
const PURPLE = "7B2FF7";
const GREEN = "50FA7B";
const ORANGE = "FFB86C";
const RED = "FF5555";
const GRAY = "6272A4";

function slide(title, bg) {
  const s = p.addSlide();
  s.background = { fill: bg || BG_DARK };
  if (title) {
    s.addText(title, { x: 0.5, y: 0.3, w: 12.3, h: 0.8, fontSize: 28, color: CYAN, bold: true });
    s.addShape(p.ShapeType.rect, { x: 0.5, y: 1.1, w: 2, h: 0.06, fill: { color: PURPLE } });
  }
  return s;
}

// ===== SLIDE 1: TITLE =====
(() => {
  const s = p.addSlide();
  s.background = { fill: "05051A" };
  s.addText("⚡ OMNI-GRID", { x: 0, y: 1.5, w: 13.33, h: 1.5, fontSize: 72, color: CYAN, bold: true, align: "center", shadow: { type: "outer", blur: 15, color: CYAN, opacity: 0.3 } });
  s.addShape(p.ShapeType.rect, { x: 5, y: 3.1, w: 3.33, h: 0.06, fill: { color: PURPLE } });
  s.addText("The Cognitive Energy Infrastructure", { x: 0, y: 3.3, w: 13.33, h: 0.8, fontSize: 24, color: PURPLE, align: "center" });
  s.addText("O Sistema Operacional da Energia Elétrica", { x: 0, y: 4, w: 13.33, h: 0.6, fontSize: 16, color: GRAY, align: "center" });
  s.addText("13 REST + WS Endpoints   |   10 ESP32 Modules   |   30+ Android Screens   |   ~302 Tests   |   8 CI/CD Jobs", { x: 0.5, y: 5.5, w: 12.3, h: 0.5, fontSize: 12, color: GRAY, align: "center" });
  s.addText("JARBAS-OMNI-SOVEREIGN-INFINITY v5.1", { x: 0, y: 6.5, w: 13.33, h: 0.4, fontSize: 9, color: "333333", align: "center" });
})();

// ===== SLIDE 2: THE PROBLEM =====
(() => {
  const s = slide("🔥 O APAGÃO SILENCIOSO", "1A0000");
  const problems = [
    ["🦆 Duck Curve", "Solar oversupply at noon, demand peak at sunset — grid can't adapt"],
    ["⚡ Frequency Instability", "Renewables lack inertia — blackout risk in milliseconds"],
    ["💰 CAPEX Bottleneck", "Utilities need trillions in new substations — or Omni-Grid"],
  ];
  problems.forEach(([title, desc], i) => {
    const y = 1.5 + i * 1.5;
    s.addShape(p.ShapeType.roundRect, { x: 0.8, y, w: 5.5, h: 1.2, fill: { color: "FFFFFF", transparency: 95 }, line: { color: "FFFFFF", width: 0.5, transparency: 90 }, rectRadius: 8 });
    s.addText(title, { x: 1, y: y + 0.1, w: 5, h: 0.4, fontSize: 16, color: ORANGE, bold: true });
    s.addText(desc, { x: 1, y: y + 0.5, w: 5, h: 0.5, fontSize: 11, color: "CCCCCC" });
  });
  s.addText("$2T annual global electricity spend — yet the grid can't handle EVs + solar", { x: 0.5, y: 6.5, w: 12.3, h: 0.5, fontSize: 10, color: GRAY, align: "center" });
})();

// ===== SLIDE 3: SOLUTION OVERVIEW =====
(() => {
  const s = slide("🧠 A SOLUÇÃO: OMNI-GRID", "001A00");
  const cards = [
    ["📡 PDE Engine", "Holt-Winters + Kalman\nMonte Carlo 10k scenarios\nCCEE/ONS Live Data"],
    ["📦 Omni-Box Hybrid", "Android + ESP32-S3\n5-transport fallback chain\nShadow Autonomous Mode"],
    ["📊 Dashboard", "3 profiles (Ind/Res/Solar)\nWebSocket Real-time\nPWA + Multi-idioma"],
  ];
  cards.forEach(([t, desc], i) => {
    const x = 0.8 + i * 4.2;
    s.addShape(p.ShapeType.roundRect, { x, y: 1.8, w: 3.8, h: 4, fill: { color: "FFFFFF", transparency: 95 }, line: { color: CYAN, width: 1, transparency: 80 }, rectRadius: 10 });
    s.addText(t, { x: x + 0.2, y: 2.1, w: 3.4, h: 0.5, fontSize: 18, color: CYAN, bold: true, align: "center" });
    s.addText(desc, { x: x + 0.2, y: 3, w: 3.4, h: 2.5, fontSize: 13, color: "CCCCCC", align: "center", lineSpacing: 18 });
  });
  s.addText("Não somos concorrentes — somos Redutores de CAPEX para as distribuidoras", { x: 0.5, y: 6.3, w: 12.3, h: 0.5, fontSize: 12, color: ORANGE, align: "center" });
})();

// ===== SLIDE 4: PDE ENGINE DETAIL =====
(() => {
  const s = slide("🧮 PREDICTIVE DISPATCH ENGINE", "0A0A2E");
  // Left column
  s.addText("📈 Forecast Engine    ✅ IMPLEMENTED", { x: 0.8, y: 1.5, w: 5.5, h: 0.4, fontSize: 14, color: GREEN, bold: true });
  const feats = ["Holt-Winters Triple Exponential Smoothing", "Kalman Filter for real-time correction", "Seasonal Naive Fallback (MAE < 5%)", "🔜 Transformers + LSTM (Roadmap, MAE < 2%)"];
  feats.forEach((f, i) => s.addText(`  ${f}`, { x: 1, y: 2.1 + i * 0.45, w: 5, h: 0.4, fontSize: 11, color: i < 3 ? GREEN : ORANGE }));
  s.addText("🎲 Stochastic Optimizer    ✅ IMPLEMENTED", { x: 0.8, y: 4.2, w: 5.5, h: 0.4, fontSize: 14, color: GREEN, bold: true });
  const opts = ["Monte Carlo with 10,000 price paths", "PLD price band simulation per submercado", "SoH degradation cost: 0.001%/h of dispatch"];
  opts.forEach((f, i) => s.addText(`  ${f}`, { x: 1, y: 4.8 + i * 0.45, w: 5, h: 0.4, fontSize: 11, color: GREEN }));
  // Right column
  s.addText("📡 Live Data Collectors    ✅ IMPLEMENTED", { x: 7, y: 1.5, w: 5.5, h: 0.4, fontSize: 14, color: GREEN, bold: true });
  const cols = [
    ["CCEE", "PLD Horário 2021-2026\nJSON API → R$/kWh"],
    ["ONS", "Curva de Carga\nCSV → LoadRecord"],
    ["ANEEL SIGA", "Geração\nCSV → GenerationAsset[]"],
  ];
  cols.forEach(([t, d], i) => {
    s.addShape(p.ShapeType.roundRect, { x: 7.2, y: 2.1 + i * 1.2, w: 5, h: 0.9, fill: { color: "FFFFFF", transparency: 95 }, line: { color: PURPLE, width: 0.5, transparency: 80 }, rectRadius: 5 });
    s.addText(t, { x: 7.4, y: 2.15 + i * 1.2, w: 4.6, h: 0.3, fontSize: 12, color: PURPLE, bold: true });
    s.addText(d, { x: 7.4, y: 2.45 + i * 1.2, w: 4.6, h: 0.5, fontSize: 10, color: "CCCCCC" });
  });
  s.addText("Loss Function: ℒ = α·Profit − β·BatteryDegradation − γ·GridInstability", { x: 0.5, y: 6.5, w: 12.3, h: 0.4, fontSize: 11, color: GRAY, align: "center" });
})();

// ===== SLIDE 5: OMNIBOX HARDWARE =====
(() => {
  const s = slide("📦 OMNI-BOX: EDGE GATEWAY", "1A1A2E");
  // Android column
  s.addText("🤖 Android App (47 tasks)", { x: 0.8, y: 1.5, w: 5.5, h: 0.4, fontSize: 16, color: CYAN, bold: true });
  const androidFeats = [
    "Kiosk/DPC — Device Owner, PIN SHA-256",
    "ConnectionManager — 5-transport fallback",
    "TelemetryDatabase — SQLite store-and-forward",
    "MeterReader — CameraX + OCR meter reading",
    "OmniBoxFcmService — FCM push (4 types)",
    "PowerManager — 4 battery profiles",
    "TimeFallback — NTP→GPS→Cellular→Uptime",
    "OmniBoxViewModel — StateFlow UI state",
  ];
  androidFeats.forEach((f, i) => s.addText(`  ${f}`, { x: 1, y: 2.1 + i * 0.45, w: 5, h: 0.4, fontSize: 10, color: "CCCCCC" }));
  // ESP32 column
  s.addText("⚙️ ESP32-S3 Co-Proc (10 modules)", { x: 7, y: 1.5, w: 5.5, h: 0.4, fontSize: 16, color: RED, bold: true });
  const espFeats = [
    "Modbus RTU/TCP — Port 502, 8 registers",
    "CAN Bus 2.0 — JBD/Daly/JK @ 250kbps",
    "BLE GATT — UUID 4f4d4e49..., 3 chars",
    "WiFi AP — Omni-Box-AP + REST endpoints",
    "IEC 61850-9-2LE — SV multicast port 6000",
    "Safety IEEE 1547 — Trip <100ms, auto-reclose",
    "Shadow Mode — RTC buffer 60 entries",
    "OTA — ArduinoOTA + HTTP binary update",
  ];
  espFeats.forEach((f, i) => s.addText(`  ${f}`, { x: 7.2, y: 2.1 + i * 0.45, w: 5, h: 0.4, fontSize: 10, color: "CCCCCC" }));
  s.addText("Fallback: CDC → BLE → WiFi → USB → Offline   |   TelemetryFrame 34B @ 115200 baud   |   HW Watchdog GPIO47 @ 1s", { x: 0.5, y: 6.5, w: 12.3, h: 0.4, fontSize: 10, color: GRAY, align: "center" });
})();

// ===== SLIDE 6: RUST + SECURITY =====
(() => {
  const s = slide("🦀 RUST CORE + CYBER-FORTRESS", "1A0000");
  // Rust
  s.addText("Rust Crate (1,066 lines)    ✅ IMPLEMENTED", { x: 0.8, y: 1.5, w: 5.5, h: 0.4, fontSize: 14, color: ORANGE, bold: true });
  const rustMods = [
    "lib.rs — Core state machine + exports",
    "jni_bridge.rs — 13 JNI functions for Android",
    "shadow.rs — RTC shadow engine",
    "safety.rs — IEEE 1547 thresholds",
    "protocol.rs — Modbus, CAN, IEC 61850",
    "drivers/ — can.rs, iec61850.rs, modbus.rs",
    "28 inline tests + 23 integration tests",
  ];
  rustMods.forEach((f, i) => s.addText(`  ${f}`, { x: 1, y: 2.1 + i * 0.45, w: 5, h: 0.4, fontSize: 11, color: "CCCCCC" }));
  // Security
  s.addText("🛡️ Security Layers", { x: 7, y: 1.5, w: 5.5, h: 0.4, fontSize: 14, color: GREEN, bold: true });
  const secItems = [
    ["✅", "mTLS X.509 certs per device", GREEN],
    ["✅", "SHA-256 PIN verification", GREEN],
    ["✅", "JWT HMAC-SHA256 with RBAC", GREEN],
    ["✅", "Zero Trust Architecture", GREEN],
    ["🔜", "Blockchain dispatch audit trail", ORANGE],
    ["🔜", "Rate limiting + DoS protection", ORANGE],
  ];
  secItems.forEach(([icon, text, color], i) => s.addText(`${icon} ${text}`, { x: 7.2, y: 2.1 + i * 0.55, w: 5, h: 0.4, fontSize: 11, color }));
  // RBAC
  s.addText("👤 RBAC Roles", { x: 7, y: 5.5, w: 5.5, h: 0.4, fontSize: 14, color: PURPLE, bold: true });
  const roles = ["admin — Full access", "operator — Dispatch + telemetry", "viewer — Read-only", "device — Edge telemetry", "api_client — External API"];
  roles.forEach((r, i) => s.addText(`  ${r}`, { x: 7.2, y: 6 + i * 0.3, w: 5, h: 0.3, fontSize: 10, color: "CCCCCC" }));
})();

// ===== SLIDE 7: API GATEWAY =====
(() => {
  const s = slide("🔌 API GATEWAY — FASTIFY :3000", "001A1A");
  const routes = [
    ["GET", "/health", "No auth", GREEN],
    ["POST", "/auth/login", "No auth", ORANGE],
    ["GET", "/auth/me", "JWT", GREEN],
    ["WS", "/ws?token=", "JWT", PURPLE],
    ["POST", "/api/v1/pde/forecast", "JWT", ORANGE],
    ["POST", "/api/v1/pde/optimize", "JWT", ORANGE],
    ["POST", "/api/v1/pde/dispatch/execute", "No hook", RED],
    ["GET", "/api/v1/pde/dispatch/history", "JWT", GREEN],
    ["GET", "/api/v1/market/prices", "JWT", GREEN],
    ["GET", "/api/v1/market/submercados", "JWT", GREEN],
    ["GET", "/api/v1/market/regulatory", "JWT", GREEN],
    ["POST", "/api/v1/edge/telemetry", "JWT", ORANGE],
    ["GET", "/api/v1/telemetry/latest", "JWT", GREEN],
  ];
  // Header
  const cols = ["Method", "Route", "Auth", ""];
  const colW = [1.2, 7, 2, 0];
  s.addText("Method   Route                                                         Auth", { x: 0.8, y: 1.5, w: 11, h: 0.4, fontSize: 11, color: GRAY, bold: true, fontFace: "Courier New" });
  routes.forEach(([method, route, auth, color], i) => {
    const y = 2 + i * 0.35;
    s.addText(method, { x: 0.8, y, w: 1.2, h: 0.3, fontSize: 10, color, bold: true, fontFace: "Courier New" });
    s.addText(route, { x: 2.2, y, w: 7, h: 0.3, fontSize: 10, color: "FFFFFF", fontFace: "Courier New" });
    s.addText(auth, { x: 9.5, y, w: 2, h: 0.3, fontSize: 10, color: GRAY, fontFace: "Courier New" });
  });
  s.addText("Seed users: admin / operator / viewer / device-sim-001", { x: 0.5, y: 6.8, w: 12.3, h: 0.3, fontSize: 9, color: GRAY, align: "center" });
})();

// ===== SLIDE 8: MARKET + FINANCIALS =====
(() => {
  const s = slide("💰 UNIT ECONOMICS", "1A1A00");
  // Left: Industrial
  s.addShape(p.ShapeType.roundRect, { x: 0.8, y: 1.5, w: 5.5, h: 4.5, fill: { color: "FFFFFF", transparency: 95 }, line: { color: ORANGE, width: 1, transparency: 70 }, rectRadius: 8 });
  s.addText("Industrial 100kWh", { x: 1, y: 1.7, w: 5, h: 0.4, fontSize: 16, color: ORANGE, bold: true, align: "center" });
  const indItems = [
    ["Arbitrage (80kWh × R$0.60)", "R$ 1,440/mo"],
    ["Peak Shaving (success fee 30%)", "R$ 1,500/mo"],
    ["Ancillary Services", "R$ 500/mo"],
    ["Total MRR/unit", "R$ 3,440/mo"],
    ["Payback (R$150k CAPEX)", "3.6 years"],
    ["LTV (12yr)", "R$ 240k"],
  ];
  indItems.forEach(([label, val], i) => {
    const y = 2.3 + i * 0.55;
    s.addText(label, { x: 1.2, y, w: 3, h: 0.4, fontSize: 11, color: "CCCCCC" });
    s.addText(val, { x: 4.2, y, w: 2, h: 0.4, fontSize: 11, color: i < 3 ? GREEN : ORANGE, bold: i >= 3, align: "right" });
  });
  // Right: Utility
  s.addShape(p.ShapeType.roundRect, { x: 7, y: 1.5, w: 5.5, h: 4.5, fill: { color: "FFFFFF", transparency: 95 }, line: { color: CYAN, width: 1, transparency: 70 }, rectRadius: 8 });
  s.addText("Utility Scale 1MWh", { x: 7.2, y: 1.7, w: 5, h: 0.4, fontSize: 16, color: CYAN, bold: true, align: "center" });
  const utilItems = [
    ["Gross Annual Revenue", "US$ 180-250k"],
    ["O&M Cost", "US$ 15k"],
    ["CAC (B2B SaaS)", "US$ 30k"],
    ["LTV (12 years)", "US$ 2.5M"],
    ["LTV/CAC Ratio", "> 80x"],
    ["Gross Margin", "85%+"],
  ];
  utilItems.forEach(([label, val], i) => {
    const y = 2.3 + i * 0.55;
    s.addText(label, { x: 7.4, y, w: 3, h: 0.4, fontSize: 11, color: "CCCCCC" });
    s.addText(val, { x: 10.4, y, w: 2, h: 0.4, fontSize: 11, color: GREEN, bold: i >= 3, align: "right" });
  });
  // MRR projection line
  s.addShape(p.ShapeType.roundRect, { x: 3, y: 6.2, w: 7.3, h: 0.5, fill: { color: PURPLE, transparency: 80 }, rectRadius: 5 });
  s.addText("Break-even M14   |   MRR M12: R$ 340k   |   100 units deployed   |   MRR M9→M12: 5x growth", { x: 3, y: 6.2, w: 7.3, h: 0.5, fontSize: 11, color: "FFFFFF", align: "center" });
})();

// ===== SLIDE 9: BRAZILIAN MARKET =====
(() => {
  const s = slide("🇧🇷 BRAZILIAN ENERGY MARKET", "002010");
  // Submercados table
  s.addText("4 Submercados PLD", { x: 0.8, y: 1.5, w: 5.5, h: 0.4, fontSize: 14, color: CYAN, bold: true });
  const smHeader = [["Submercado", "Estados", "Peso", "Fator"]];
  const smRows = [
    ["SE/CO", "SP,RJ,MG,ES,DF,GO,MT,MS", "~60%", "1.0"],
    ["Sul", "PR,SC,RS", "~15%", "0.95"],
    ["Nordeste", "BA,PE,CE,RN,PB,AL,SE,PI,MA", "~15%", "0.85"],
    ["Norte", "PA,AM,RO,AC,RR,AP,TO", "~10%", "1.15"],
  ];
  s.addTable([...smHeader, ...smRows], {
    x: 0.8, y: 2, w: 5.5,
    colW: [1.2, 2.5, 0.8, 0.8],
    fontSize: 10, color: "FFFFFF",
    border: { type: "solid", color: "333333", pt: 0.5 },
    rowH: 0.4, align: "center",
    autoPage: false,
  });
  s.addText("PLD: Piso R$ 69,07  |  Teto R$ 599,31/MWh", { x: 0.8, y: 4, w: 5.5, h: 0.3, fontSize: 10, color: GRAY });
  s.addText("Bandeira: Verde (seca) | Amarela +R$18,85 | Vermelha +R$44,63 / +R$78,77", { x: 0.8, y: 4.3, w: 5.5, h: 0.3, fontSize: 10, color: GRAY });

  // Utilities + Traders
  s.addText("11 Utilities + 5 Traders", { x: 7, y: 1.5, w: 5.5, h: 0.4, fontSize: 14, color: GREEN, bold: true });
  const utils = "Enel SP  •  CEMIG  •  CPFL  •  Light  •  EDP  •  Copel  •  Celesc  •  Coelba  •  Neoenergia PE  •  Equatorial PA  •  Energisa MT";
  s.addText(utils, { x: 7, y: 2.1, w: 5.5, h: 0.8, fontSize: 10, color: "CCCCCC", lineSpacing: 16 });
  s.addText("Traders: Tradener  •  Comerc  •  Ecom Energia  •  Safira  •  Delta Energia", { x: 7, y: 3, w: 5.5, h: 0.4, fontSize: 10, color: "CCCCCC" });

  // PLD Price Bands
  s.addText("PLD Price Simulation Bands (BRT)", { x: 7, y: 3.8, w: 5.5, h: 0.4, fontSize: 14, color: ORANGE, bold: true });
  const bands = [
    ["Madrugada", "23h-5h", "R$ 69-149"],
    ["Entre-ponta", "6h-9h / 21h-22h", "R$ 100-200"],
    ["Comercial", "10h-17h", "R$ 200-349"],
    ["Ponta", "18h-20h", "R$ 300-549"],
  ];
  s.addTable([["Período", "Horário", "R$/MWh"], ...bands], {
    x: 7, y: 4.3, w: 5.5,
    colW: [1.8, 2, 1.5],
    fontSize: 10, color: "FFFFFF",
    border: { type: "solid", color: "333333", pt: 0.5 },
    rowH: 0.35, align: "center",
    autoPage: false,
  });
})();

// ===== SLIDE 10: IMPLEMENTATION STATUS =====
(() => {
  const s = slide("⚙️ IMPLEMENTATION STATUS", "0A0A2E");
  const modules = [
    ["PDE Engine (Forecast + Optimize)", 100, GREEN],
    ["Live Data Collectors (CCEE/ONS/SIGA)", 100, GREEN],
    ["API Gateway (13 routes + WS)", 100, GREEN],
    ["ESP32 Firmware (10 modules)", 100, GREEN],
    ["Android App (DPC + bridges)", 100, GREEN],
    ["Rust Crate (state machine + JNI)", 100, GREEN],
    ["Dashboard (3 profiles + PWA)", 100, GREEN],
    ["CI/CD Pipeline (8 jobs)", 100, GREEN],
    ["Market Connect (PLD + utilities)", 100, GREEN],
    ["V2G Fleet Integration", 15, ORANGE],
    ["ONS Ancillary Services", 10, ORANGE],
    ["ACL Free Market Trading License", 5, RED],
    ["Blockchain Audit Trail", 0, RED],
    ["Texas/Australia Expansion", 0, RED],
  ];
  modules.forEach(([name, pct, color], i) => {
    const y = 1.5 + i * 0.38;
    s.addText(name, { x: 0.8, y, w: 5.5, h: 0.3, fontSize: 10, color: "FFFFFF" });
    s.addShape(p.ShapeType.roundRect, { x: 6.5, y: y + 0.05, w: 5, h: 0.25, fill: { color: "333333" }, rectRadius: 4 });
    s.addShape(p.ShapeType.roundRect, { x: 6.5, y: y + 0.05, w: 5 * pct / 100, h: 0.25, fill: { color }, rectRadius: 4 });
    s.addText(`${pct}%`, { x: 11.7, y, w: 0.8, h: 0.3, fontSize: 10, color, bold: true, align: "right" });
  });
  s.addText("~302 tests across all packages   |   All 4 sprints complete   |   All 47 edge tasks done", { x: 0.5, y: 6.8, w: 12.3, h: 0.3, fontSize: 10, color: GREEN, align: "center" });
})();

// ===== SLIDE 11: ROADMAP =====
(() => {
  const s = slide("🗺️ 36-MONTH ROADMAP", "1A0A00");
  const phases = [
    { title: "🔥 Year 1 — Ignition", color: ORANGE, pct: 100, items: ["✅ PDE Engine + Collectors", "✅ Omni-Box + Android App", "✅ Dashboard + API Gateway", "✅ CI/CD Pipeline", "🎯 10 industrial sites", "👥 Team: 12 engineers"] },
    { title: "🚀 Year 2 — Blitzscaling", color: PURPLE, pct: 15, items: ["🔜 V2G Fleet Integration", "🔜 ACL Trading License", "🔜 ONS Ancillary Services", "🎯 500MWh under mgmt", "👥 Team: 100", "💰 Series A/B"] },
    { title: "🏆 Year 3 — Dominance", color: GREEN, pct: 0, items: ["🌎 Texas/Australia", "🎯 2GWh under mgmt", "💰 ARR US$ 150M", "📈 IPO NASDAQ", "💵 > $1.5B valuation", "👥 Team: 500+"] },
  ];
  phases.forEach((phase, col) => {
    const x = 0.8 + col * 4.2;
    s.addShape(p.ShapeType.roundRect, { x, y: 1.5, w: 3.8, h: 5.5, fill: { color: "FFFFFF", transparency: 95 }, line: { color: phase.color, width: 1.5, transparency: 50 }, rectRadius: 10 });
    s.addText(phase.title, { x: x + 0.2, y: 1.7, w: 3.4, h: 0.4, fontSize: 14, color: phase.color, bold: true, align: "center" });
    s.addShape(p.ShapeType.roundRect, { x: x + 0.5, y: 2.2, w: 2.8, h: 0.2, fill: { color: "333333" }, rectRadius: 3 });
    s.addShape(p.ShapeType.roundRect, { x: x + 0.5, y: 2.2, w: 2.8 * phase.pct / 100, h: 0.2, fill: { color: phase.color }, rectRadius: 3 });
    phase.items.forEach((item, i) => s.addText(item, { x: x + 0.3, y: 2.6 + i * 0.5, w: 3.2, h: 0.4, fontSize: 10, color: "CCCCCC" }));
  });
})();

// ===== SLIDE 12: EXIT STRATEGY =====
(() => {
  const s = slide("🎯 EXIT STRATEGY", "05051A");
  const exits = [
    ["🛢️ Big Oil", "Shell, BP, Equinor — Hydrocarbon → Electron"],
    ["☁️ Big Tech", "Amazon, Google, Microsoft — Data center load"],
    ["🚗 EV Giants", "Tesla, BYD, VW — Software verticalization"],
    ["📈 IPO NASDAQ", "First data-driven utility — > US$ 1.5B"],
  ];
  exits.forEach(([title, desc], i) => {
    const x = 0.8 + (i % 2) * 6.2;
    const y = 1.5 + Math.floor(i / 2) * 2.2;
    s.addShape(p.ShapeType.roundRect, { x, y, w: 5.5, h: 1.7, fill: { color: "FFFFFF", transparency: 95 }, line: { color: CYAN, width: 1, transparency: 80 }, rectRadius: 10 });
    s.addText(title, { x: x + 0.3, y: y + 0.2, w: 4.9, h: 0.5, fontSize: 20, color: CYAN, bold: true });
    s.addText(desc, { x: x + 0.3, y: y + 0.8, w: 4.9, h: 0.5, fontSize: 13, color: "CCCCCC" });
  });
  s.addText("\"O bilhão não é o fim — é o combustível.\"", { x: 0, y: 6, w: 13.33, h: 0.6, fontSize: 18, color: GREEN, align: "center", shadow: { type: "outer", blur: 10, color: GREEN, opacity: 0.3 } });
  s.addText("JARBAS v4.0  |  Arquiteto de Sistemas Soberanos", { x: 0, y: 6.7, w: 13.33, h: 0.4, fontSize: 10, color: GRAY, align: "center" });
})();

// SAVE
await p.writeFile({ fileName: "C:\\Users\\Public\\OMNI\\docs\\pitch\\OMNI-GRID-Pitch-Deck.pptx" });
console.log("✅ PPTX generated: OMNI-GRID-Pitch-Deck.pptx");

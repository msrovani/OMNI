import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";

const doc = new PDFDocument({
  size: "A4",
  layout: "landscape",
  info: {
    Title: "OMNI-GRID — The Cognitive Energy Infrastructure",
    Author: "JARBAS v4.0",
    Subject: "Pitch Deck - Brazilian Energy Market",
  },
});

doc.pipe(createWriteStream("C:\\Users\\Public\\OMNI\\docs\\pitch\\OMNI-GRID-Pitch-Deck.pdf"));

const W = 842, H = 595;
const CYAN = "#00D4FF", PURPLE = "#7B2FF7", GREEN = "#50FA7B", ORANGE = "#FFB86C", RED = "#FF5555", GRAY = "#6272A4";

function bg(color) {
  doc.rect(0, 0, W, H).fill(color || "#0A0A2E");
}

function title(text) {
  doc.fillColor(CYAN).fontSize(24).font("Helvetica-Bold").text(text, 40, 30);
  doc.rect(40, 58, 100, 3).fillColor(PURPLE).fill();
}

function kpi(text, x, y, w, h, color) {
  doc.roundedRect(x, y, w, h, 6).fillOpacity(0.05).fillColor("#FFFFFF").fillOpacity(1);
  doc.strokeColor(color || CYAN).lineWidth(0.5).stroke();
  doc.fillColor(color || CYAN).fontSize(10).font("Helvetica").text(text, x + 8, y + 6, { width: w - 16, align: "center" });
}

// ===== PAGE 1: TITLE =====
(() => {
  bg("#05051A");
  doc.fillColor(CYAN).fontSize(60).font("Helvetica-Bold").text("⚡ OMNI-GRID", 0, 180, { align: "center" });
  doc.rect(W / 2 - 80, 260, 160, 3).fillColor(PURPLE).fill();
  doc.fillColor(PURPLE).fontSize(22).font("Helvetica").text("The Cognitive Energy Infrastructure", 0, 285, { align: "center" });
  doc.fillColor(GRAY).fontSize(13).text("O Sistema Operacional da Energia Elétrica", 0, 320, { align: "center" });
  doc.fillColor(GRAY).fontSize(10).text("13 REST + WS Endpoints   |   10 ESP32 Modules   |   30+ Android Screens   |   ~302 Tests   |   8 CI/CD Jobs", 0, 400, { align: "center" });
  doc.fillColor("#444444").fontSize(8).text("JARBAS-OMNI-SOVEREIGN-INFINITY v5.1", 0, 540, { align: "center" });
  doc.addPage();
})();

// ===== PAGE 2: THE PROBLEM =====
(() => {
  bg("#1A0000");
  title("🔥 O APAGÃO SILENCIOSO");
  const problems = [
    "🦆 Duck Curve — Solar oversupply at noon, demand peak at sunset. Grid can't adapt.",
    "⚡ Frequency Instability — Renewables lack physical inertia. Blackout risk in milliseconds.",
    "💰 CAPEX Bottleneck — Utilities need trillions in new substations. Or they use Omni-Grid.",
  ];
  problems.forEach((p, i) => {
    doc.fillColor(ORANGE).fontSize(14).font("Helvetica-Bold").text(p.split(" — ")[0], 50, 100 + i * 70);
    doc.fillColor("#CCCCCC").fontSize(11).font("Helvetica").text(p.split(" — ")[1] || "", 50, 125 + i * 70, { width: 500 });
  });
  doc.fillColor(GRAY).fontSize(10).text("$2T annual global electricity spend — yet the grid can't handle EVs + solar", 0, 500, { align: "center" });
  doc.addPage();
})();

// ===== PAGE 3: SOLUTION =====
(() => {
  bg("#001A00");
  title("🧠 A SOLUÇÃO: OMNI-GRID");
  const cards = [
    ["📡 PDE Engine", "Holt-Winters + Kalman\nMonte Carlo 10k scenarios\nCCEE/ONS Live Data"],
    ["📦 Omni-Box Hybrid", "Android + ESP32-S3\n5-transport fallback chain\nShadow Autonomous Mode"],
    ["📊 Dashboard", "3 profiles (Ind/Res/Solar)\nWebSocket Real-time\nPWA + Multi-idioma"],
  ];
  cards.forEach(([t, desc], i) => {
    const x = 50 + i * 250;
    doc.roundedRect(x, 100, 230, 200, 10).fillOpacity(0.05).fillColor("#FFFFFF").fillOpacity(1);
    doc.strokeColor(CYAN).lineWidth(1).stroke();
    doc.fillColor(CYAN).fontSize(16).font("Helvetica-Bold").text(t, x + 10, 120, { align: "center", width: 210 });
    doc.fillColor("#CCCCCC").fontSize(12).font("Helvetica").text(desc, x + 10, 170, { align: "center", width: 210, lineGap: 6 });
  });
  doc.fillColor(ORANGE).fontSize(12).text("Não somos concorrentes — somos Redutores de CAPEX para as distribuidoras", 0, 400, { align: "center" });
  doc.addPage();
})();

// ===== PAGE 4: PDE ENGINE =====
(() => {
  bg("#0A0A2E");
  title("🧮 PREDICTIVE DISPATCH ENGINE");

  doc.fillColor(GREEN).fontSize(13).font("Helvetica-Bold").text("📈 Forecast Engine    ✅ IMPLEMENTED", 40, 90);
  const feats = ["  Holt-Winters Triple Exponential Smoothing", "  Kalman Filter for real-time correction", "  Seasonal Naive Fallback (MAE < 5%)", "  🔜 Transformers + LSTM (Roadmap)"];
  feats.forEach((f, i) => doc.fillColor(i < 3 ? GREEN : ORANGE).fontSize(10).font("Helvetica").text(f, 50, 120 + i * 22));

  doc.fillColor(GREEN).fontSize(13).font("Helvetica-Bold").text("🎲 Stochastic Optimizer    ✅ IMPLEMENTED", 40, 230);
  const opts = ["  Monte Carlo with 10,000 price paths", "  PLD price band simulation per submercado", "  SoH degradation cost: 0.001%/h of dispatch"];
  opts.forEach((f, i) => doc.fillColor(GREEN).fontSize(10).font("Helvetica").text(f, 50, 260 + i * 22));

  doc.fillColor(CYAN).fontSize(13).font("Helvetica-Bold").text("📡 Live Data Collectors    ✅ IMPLEMENTED", 400, 90);
  const collectors = [
    ["CCEE — PLD 2021-2026", "JSON API → pricePerKwh (R$/kWh)"],
    ["ONS — Curva de Carga", "CSV → LoadRecord per submercado"],
    ["ANEEL SIGA — Geração", "CSV → SigaGenerationAsset[]"],
  ];
  collectors.forEach(([t, d], i) => {
    doc.roundedRect(410, 120 + i * 65, 380, 50, 6).fillOpacity(0.05).fillColor("#FFFFFF").fillOpacity(1).strokeColor(PURPLE).lineWidth(0.5).stroke();
    doc.fillColor(PURPLE).fontSize(11).font("Helvetica-Bold").text(t, 420, 128 + i * 65);
    doc.fillColor("#CCCCCC").fontSize(10).font("Helvetica").text(d, 420, 148 + i * 65);
  });

  doc.fillColor(GRAY).fontSize(10).text("Loss: ℒ = α·Profit − β·BatteryDegradation − γ·GridInstability", 40, 500);
  doc.addPage();
})();

// ===== PAGE 5: OMNIBOX =====
(() => {
  bg("#1A1A2E");
  title("📦 OMNI-BOX: EDGE GATEWAY");

  doc.fillColor(CYAN).fontSize(14).font("Helvetica-Bold").text("🤖 Android App (47 tasks)", 40, 90);
  const android = [
    "Kiosk/DPC — Device Owner, PIN SHA-256", "ConnectionManager — 5-transport fallback",
    "TelemetryDatabase — SQLite store-and-forward", "MeterReader — CameraX + OCR",
    "OmniBoxFcmService — FCM push (4 types)", "PowerManager — 4 battery profiles",
    "TimeFallback — NTP→GPS→Cellular→Uptime", "OmniBoxViewModel — StateFlow UI",
  ];
  android.forEach((f, i) => doc.fillColor("#CCCCCC").fontSize(9).font("Helvetica").text(`  ${f}`, 50, 120 + i * 20));

  doc.fillColor(RED).fontSize(14).font("Helvetica-Bold").text("⚙️ ESP32-S3 Co-Proc (10 modules)", 400, 90);
  const esp = [
    "Modbus RTU/TCP — Port 502, 8 regs", "CAN Bus 2.0 — JBD/Daly/JK @ 250kbps",
    "BLE GATT — UUID 4f4d4e49..., 3 chars", "WiFi AP — Omni-Box-AP + REST APIs",
    "IEC 61850-9-2LE — SV multicast port 6000", "Safety IEEE 1547 — Trip <100ms",
    "Shadow Mode — RTC buffer 60 entries", "OTA — ArduinoOTA + HTTP binary",
  ];
  esp.forEach((f, i) => doc.fillColor("#CCCCCC").fontSize(9).font("Helvetica").text(`  ${f}`, 410, 120 + i * 20));

  doc.fillColor(GRAY).fontSize(9).text("Fallback: CDC → BLE → WiFi → USB → Offline   |   TelemetryFrame 34B @ 115200 baud   |   HW Watchdog GPIO47 @ 1s", 40, 520);
  doc.addPage();
})();

// ===== PAGE 6: RUST + SECURITY =====
(() => {
  bg("#1A0000");
  title("🦀 RUST CORE + CYBER-FORTRESS");

  doc.fillColor(ORANGE).fontSize(14).font("Helvetica-Bold").text("Rust Crate (1,066 lines)    ✅", 40, 90);
  const rust = ["lib.rs — Core state machine", "jni_bridge.rs — 13 JNI functions", "shadow.rs — RTC shadow engine", "safety.rs — IEEE 1547", "28 inline + 23 integration tests"];
  rust.forEach((f, i) => doc.fillColor("#CCCCCC").fontSize(10).font("Helvetica").text(`  ${f}`, 50, 120 + i * 22));

  doc.fillColor(GREEN).fontSize(14).font("Helvetica-Bold").text("🛡️ Security Layers", 400, 90);
  const sec = [
    ["✅ mTLS X.509 certs per device", GREEN], ["✅ SHA-256 PIN verification", GREEN],
    ["✅ JWT HMAC-SHA256 with RBAC", GREEN], ["✅ Zero Trust Architecture", GREEN],
    ["🔜 Blockchain audit trail", ORANGE], ["🔜 Rate limiting + DoS", ORANGE],
  ];
  sec.forEach(([t, c], i) => doc.fillColor(c).fontSize(10).font("Helvetica").text(t, 410, 120 + i * 22));

  doc.fillColor(PURPLE).fontSize(12).font("Helvetica-Bold").text("👤 RBAC: admin · operator · viewer · device · api_client", 40, 500);
  doc.addPage();
})();

// ===== PAGE 7: API ROUTES =====
(() => {
  bg("#001A1A");
  title("🔌 API GATEWAY — FASTIFY :3000");
  const routes = [
    ["GET", "/health", "No auth"],
    ["POST", "/auth/login", "No auth"],
    ["GET", "/auth/me", "JWT"],
    ["WS", "/ws?token=", "JWT"],
    ["POST", "/api/v1/pde/forecast", "JWT"],
    ["POST", "/api/v1/pde/optimize", "JWT"],
    ["POST", "/api/v1/pde/dispatch/execute", "No hook"],
    ["GET", "/api/v1/pde/dispatch/history", "JWT"],
    ["GET", "/api/v1/market/prices", "JWT"],
    ["GET", "/api/v1/market/submercados", "JWT"],
    ["GET", "/api/v1/market/regulatory", "JWT"],
    ["POST", "/api/v1/edge/telemetry", "JWT"],
    ["GET", "/api/v1/telemetry/latest", "JWT"],
  ];
  doc.fontSize(10).font("Helvetica-Bold").fillColor(GRAY).text("Method      Route                                          Auth", 40, 90);
  routes.forEach(([method, route, auth], i) => {
    const y = 115 + i * 22;
    doc.fontSize(9).font("Courier").fillColor(method === "POST" || method === "WS" ? ORANGE : GREEN).text(method, 40, y);
    doc.fillColor("#FFFFFF").text(route, 120, y);
    doc.fillColor(GRAY).text(auth, 500, y);
  });
  doc.fillColor(GRAY).fontSize(8).text("Seed users: admin / operator / viewer / device-sim-001", 40, 520);
  doc.addPage();
})();

// ===== PAGE 8: FINANCIALS =====
(() => {
  bg("#1A1A00");
  title("💰 UNIT ECONOMICS");

  doc.fillColor(ORANGE).fontSize(16).font("Helvetica-Bold").text("Industrial 100kWh", 50, 90);
  const indItems = [["Arbitrage (80kWh × R$0.60)", "R$ 1,440/mo"], ["Peak Shaving (30%)", "R$ 1,500/mo"], ["Ancillary Services", "R$ 500/mo"], ["Total MRR", "R$ 3,440/mo"], ["Payback", "3.6 years"], ["LTV (12yr)", "R$ 240k"]];
  indItems.forEach(([label, val], i) => {
    doc.fillColor("#CCCCCC").fontSize(11).font("Helvetica").text(label, 60, 125 + i * 25);
    doc.fillColor(i < 3 ? GREEN : ORANGE).fontSize(11).font("Helvetica-Bold").text(val, 280, 125 + i * 25);
  });

  doc.fillColor(CYAN).fontSize(16).font("Helvetica-Bold").text("Utility Scale 1MWh", 420, 90);
  const utilItems = [["Revenue", "US$ 180-250k/yr"], ["O&M Cost", "US$ 15k/yr"], ["CAC", "US$ 30k"], ["LTV (12yr)", "US$ 2.5M"], ["LTV/CAC", "> 80x"], ["Gross Margin", "85%+"]];
  utilItems.forEach(([label, val], i) => {
    doc.fillColor("#CCCCCC").fontSize(11).font("Helvetica").text(label, 430, 125 + i * 25);
    doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold").text(val, 650, 125 + i * 25);
  });

  doc.roundedRect(100, 450, 600, 40, 8).fillOpacity(0.1).fillColor(PURPLE).fillOpacity(1);
  doc.fillColor("#FFFFFF").fontSize(12).font("Helvetica-Bold").text("Break-even M14   |   MRR M12: R$ 340k   |   100 units   |   5x growth M9→M12", 100, 460, { align: "center" });
  doc.addPage();
})();

// ===== PAGE 9: BRAZIL =====
(() => {
  bg("#002010");
  title("🇧🇷 BRAZILIAN ENERGY MARKET");

  doc.fillColor(CYAN).fontSize(14).font("Helvetica-Bold").text("4 Submercados PLD", 40, 90);
  const smData = [
    ["SE/CO", "SP,RJ,MG,ES,DF,GO,MT,MS", "~60%"],
    ["Sul", "PR,SC,RS", "~15%"],
    ["Nordeste", "BA,PE,CE,RN,PB,AL,SE,PI,MA", "~15%"],
    ["Norte", "PA,AM,RO,AC,RR,AP,TO", "~10%"],
  ];
  smData.forEach(([name, states, pct], i) => {
    doc.fillColor(ORANGE).fontSize(11).font("Helvetica-Bold").text(name, 50, 120 + i * 25);
    doc.fillColor("#CCCCCC").fontSize(9).font("Helvetica").text(states, 120, 120 + i * 25, { width: 250 });
    doc.fillColor(GREEN).fontSize(11).text(pct, 400, 120 + i * 25);
  });

  doc.fillColor(GREEN).fontSize(14).font("Helvetica-Bold").text("11 Utilities + 5 Traders", 420, 90);
  doc.fillColor("#CCCCCC").fontSize(9).font("Helvetica").text("Enel SP · CEMIG · CPFL · Light · EDP · Copel · Celesc · Coelba · Neoenergia PE · Equatorial PA · Energisa MT", 430, 120, { width: 350 });
  doc.fillColor("#CCCCCC").fontSize(9).font("Helvetica").text("Traders: Tradener · Comerc · Ecom Energia · Safira · Delta Energia", 430, 170, { width: 350 });

  doc.fillColor(ORANGE).fontSize(12).font("Helvetica-Bold").text("PLD: Piso R$ 69,07  |  Teto R$ 599,31/MWh", 40, 350);
  doc.fillColor(GRAY).fontSize(10).font("Helvetica").text("Bandeira: Verde (seca) | Amarela +R$18,85 | Vermelha +R$44,63 / +R$78,77", 40, 375);

  doc.addPage();
})();

// ===== PAGE 10: IMPLEMENTATION + ROADMAP =====
(() => {
  bg("#0A0A2E");
  title("⚙️ IMPLEMENTATION STATUS + ROADMAP");

  const items = [
    ["PDE Engine", 100, GREEN], ["API Gateway", 100, GREEN], ["ESP32 Firmware", 100, GREEN],
    ["Android App", 100, GREEN], ["Rust Crate", 100, GREEN], ["Dashboard", 100, GREEN],
    ["CI/CD", 100, GREEN], ["Market Connect", 100, GREEN],
    ["V2G Integration", 15, ORANGE], ["ONS Ancillary", 10, ORANGE], ["ACL License", 5, RED],
    ["Blockchain", 0, RED], ["Intl Expansion", 0, RED],
  ];
  items.forEach(([name, pct, c], i) => {
    const y = 90 + i * 25;
    doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica").text(name, 50, y);
    doc.roundedRect(180, y + 2, 250, 12, 6).fillOpacity(0.1).fillColor("#FFFFFF").fillOpacity(1);
    doc.roundedRect(180, y + 2, 250 * pct / 100, 12, 6).fillOpacity(1).fillColor(c).fill();
    doc.fillColor(c).fontSize(9).font("Helvetica-Bold").text(`${pct}%`, 450, y);
  });

  doc.fillColor(GREEN).fontSize(10).text("~302 tests   |   All 4 sprints complete   |   47 edge tasks done", 50, 500);
  doc.addPage();
})();

// ===== PAGE 11: EXIT =====
(() => {
  bg("#05051A");
  title("🎯 EXIT STRATEGY");
  const exits = [
    ["🛢️ Big Oil", "Shell, BP, Equinor — Hydrocarbon to electron transition"],
    ["☁️ Big Tech", "Amazon, Google, Microsoft — Data center load management"],
    ["🚗 EV Giants", "Tesla, BYD, VW — Software verticalization on batteries"],
    ["📈 IPO NASDAQ", "First data-driven utility — valued at > US$ 1.5 billion"],
  ];
  exits.forEach(([title, desc], i) => {
    const x = 50 + (i % 2) * 400, y = 100 + Math.floor(i / 2) * 150;
    doc.roundedRect(x, y, 360, 120, 10).fillOpacity(0.05).fillColor("#FFFFFF").fillOpacity(1).strokeColor(CYAN).lineWidth(1).stroke();
    doc.fillColor(CYAN).fontSize(22).font("Helvetica-Bold").text(title, x + 15, y + 20);
    doc.fillColor("#CCCCCC").fontSize(13).font("Helvetica").text(desc, x + 15, y + 60, { width: 330 });
  });
  doc.fillColor(GREEN).fontSize(16).font("Helvetica-Bold").text("\"O bilhão não é o fim — é o combustível.\"", 0, 480, { align: "center" });
  doc.fillColor(GRAY).fontSize(9).text("JARBAS v4.0  |  Arquiteto de Sistemas Soberanos", 0, 530, { align: "center" });
})();

doc.end();
console.log("✅ PDF generated: OMNI-GRID-Pitch-Deck.pdf");

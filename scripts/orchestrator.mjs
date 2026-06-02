#!/usr/bin/env node

import { spawn } from 'child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, watchFile } from 'fs';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOG_DIR = join(ROOT, 'logs');
const PID_FILE = join(LOG_DIR, 'orchestrator.pid');
const CHILDREN_FILE = join(LOG_DIR, 'children.json');

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const SERVICES = [
  { name: 'api-gateway',    color: COLORS.cyan,  cmd: 'npm', args: ['run','dev','-w','@omni-grid/api-gateway'],      port: 3000 },
  { name: 'omni-cloud',    color: COLORS.blue,  cmd: 'npm', args: ['run','dev','-w','@omni-grid/omni-cloud'],      port: 4000 },
  { name: 'market-connect', color: COLORS.green, cmd: 'npm', args: ['run','dev','-w','@omni-grid/market-connect'],  port: null },
  { name: 'simulator',     color: COLORS.yellow, cmd: 'npx', args: ['tsx','edge/omni-box-simulator/src/index.ts'],  port: null },
];

const SERVICE_MAP = new Map(SERVICES.map(s => [s.name, s]));

function writeLog(serviceName, message) {
  const ts = new Date().toISOString();
  const name = serviceName || 'orchestrator';
  appendFileSync(join(LOG_DIR, `${name}.log`), `[${ts}] ${message}\n`);
}

function print(serviceName, message) {
  const service = serviceName ? SERVICE_MAP.get(serviceName) : null;
  const prefix = service ? `[${service.name}]` : '[orchestrator]';
  const color = service ? service.color : COLORS.gray;
  console.log(`${color}${prefix}${COLORS.reset} ${message}`);
  writeLog(serviceName, `${prefix} ${message}`);
}

function saveChildPids() {
  const pids = {};
  for (const [name, proc] of children) {
    if (proc && proc.pid) pids[name] = proc.pid;
  }
  writeFileSync(CHILDREN_FILE, JSON.stringify(pids, null, 2));
}

function readChildPids() {
  if (!existsSync(CHILDREN_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CHILDREN_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function readPid() {
  if (!existsSync(PID_FILE)) return null;
  try {
    return parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10);
  } catch {
    return null;
  }
}

function checkHealth(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode }));
    });
    req.on('error', () => resolve({ ok: false, status: null }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: null }); });
  });
}

const children = new Map();
const restarts = new Map();
let healthCache = {};

function spawnService(service) {
  const child = spawn(service.cmd, service.args, {
    cwd: ROOT,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  children.set(service.name, child);
  saveChildPids();

  const rlOut = createInterface({ input: child.stdout });
  rlOut.on('line', (line) => {
    if (line.trim()) print(service.name, line);
  });

  const rlErr = createInterface({ input: child.stderr });
  rlErr.on('line', (line) => {
    if (line.trim()) print(service.name, line);
  });

  const count = restarts.get(service.name) || 0;
  restarts.set(service.name, count);

  child.on('exit', (code, signal) => {
    children.delete(service.name);
    const attempts = restarts.get(service.name) || 0;
    if (attempts < 3 && signal !== 'SIGTERM' && code !== 0) {
      restarts.set(service.name, attempts + 1);
      print(service.name, `Crashed (code=${code}, signal=${signal}), restarting (${attempts + 1}/3)...`);
      spawnService(service);
    } else if (attempts >= 3) {
      print(service.name, `Crashed (code=${code}, signal=${signal}), max restarts (3) reached`);
    }
  });
}

async function getStatuses() {
  const result = [];
  for (const service of SERVICES) {
    const child = children.get(service.name);
    const running = child && !child.killed && child.exitCode === null;
    let healthy = false;
    if (running && service.port) {
      const h = await checkHealth(`http://127.0.0.1:${service.port}/health`);
      healthy = h.ok;
    } else if (running) {
      healthy = true;
    }
    healthCache[service.name] = healthy;
    result.push({ ...service, running, healthy });
  }
  return result;
}

function printStatusTable(statuses) {
  const padName = Math.max(...SERVICES.map(s => s.name.length)) + 1;
  const lines = [];
  lines.push('┌─────────────────────────────────────┐');
  lines.push('│           OMNI-GRID STATUS          │');
  lines.push('├─────────────────────────────────────┤');
  for (const s of statuses) {
    const name = s.name.padEnd(padName);
    const port = s.port ? `:${s.port}` : '     ';
    const icon = s.healthy ? `${COLORS.green}✅${COLORS.reset}` : `${COLORS.red}❌${COLORS.reset}`;
    const label = s.healthy ? 'Running' : 'Down';
    lines.push(`│ ${name} ${port}  ${icon} ${label}${' '.repeat(8 - label.length)}│`);
  }
  lines.push('└─────────────────────────────────────┘');
  console.log('\n' + lines.join('\n') + '\n');
}

async function cmdStart() {
  if (existsSync(PID_FILE)) {
    const pid = readPid();
    if (pid) {
      try {
        process.kill(pid, 0);
        console.log('Orchestrator is already running (PID: ' + pid + ')');
        process.exit(1);
      } catch {
        unlinkSync(PID_FILE);
      }
    } else {
      unlinkSync(PID_FILE);
    }
  }

  writeFileSync(PID_FILE, String(process.pid));

  for (const service of SERVICES) {
    print(null, `Starting ${service.name}...`);
    spawnService(service);
  }

  setInterval(async () => {
    const result = await checkHealth('http://127.0.0.1:3000/health');
    healthCache['api-gateway'] = result.ok;
  }, 5000);

  setInterval(async () => {
    const statuses = await getStatuses();
    printStatusTable(statuses);
  }, 15000);

  async function shutdown() {
    print(null, 'Shutting down gracefully...');
    for (const [name, child] of children) {
      if (child && !child.killed && child.exitCode === null) {
        print(null, `Stopping ${name}...`);
        child.kill();
      }
    }
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
    if (existsSync(CHILDREN_FILE)) unlinkSync(CHILDREN_FILE);
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  if (process.platform === 'win32') process.on('SIGBREAK', shutdown);

  print(null, `Orchestrator started (PID: ${process.pid})`);
  print(null, `Log directory: ${LOG_DIR}`);
  print(null, 'Press Ctrl+C to stop all services');
}

async function cmdStop() {
  const childPids = readChildPids();
  for (const [name, pid] of Object.entries(childPids)) {
    try {
      process.kill(pid);
      print(null, `Stopped ${name} (PID: ${pid})`);
    } catch {
      print(null, `${name} not running (PID: ${pid})`);
    }
  }
  if (existsSync(CHILDREN_FILE)) unlinkSync(CHILDREN_FILE);

  const pid = readPid();
  if (pid) {
    try {
      process.kill(pid);
      print(null, `Stopped orchestrator (PID: ${pid})`);
    } catch {
      print(null, 'Orchestrator not running');
    }
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
  } else {
    print(null, 'No orchestrator PID file found');
  }
}

async function cmdRestart() {
  await cmdStop();
  await cmdStart();
}

async function cmdStatus() {
  const pid = readPid();
  let orchestratorRunning = false;
  if (pid) {
    try {
      process.kill(pid, 0);
      orchestratorRunning = true;
    } catch {
      orchestratorRunning = false;
    }
  }

  const childPids = readChildPids();
  const statuses = [];
  for (const service of SERVICES) {
    const cPid = childPids[service.name] || null;
    let running = false;
    if (cPid) {
      try {
        process.kill(cPid, 0);
        running = true;
      } catch {
        running = false;
      }
    }

    let healthy = false;
    if (service.port) {
      const h = await checkHealth(`http://127.0.0.1:${service.port}/health`);
      healthy = h.ok;
    } else {
      healthy = running;
    }
    statuses.push({ ...service, running, healthy });
  }
  printStatusTable(statuses);
}

async function cmdLogs(serviceName) {
  if (serviceName && !SERVICE_MAP.has(serviceName)) {
    console.error(`Unknown service: ${serviceName}. Available: ${SERVICES.map(s => s.name).join(', ')}`);
    process.exit(1);
  }

  const names = serviceName ? [serviceName] : SERVICES.map(s => s.name);
  const streams = [];

  for (const name of names) {
    const logFile = join(LOG_DIR, `${name}.log`);
    if (!existsSync(logFile)) {
      console.log(`[${name}] No log file yet`);
      continue;
    }

    const content = readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const tail = lines.slice(-20);
    for (const line of tail) {
      console.log(`${COLORS.gray}[${name}]${COLORS.reset} ${line.replace(/^\[[^\]]+\]\s*/, '')}`);
    }

    let lastSize = Buffer.byteLength(content, 'utf8');
    watchFile(logFile, { interval: 500 }, () => {
      try {
        const newContent = readFileSync(logFile, 'utf8');
        const newBytes = Buffer.byteLength(newContent, 'utf8');
        if (newBytes > lastSize) {
          const extra = newContent.slice(lastSize);
          for (const l of extra.split('\n').filter(Boolean)) {
            const service = SERVICE_MAP.get(name);
            const color = service ? service.color : COLORS.gray;
            console.log(`${color}[${name}]${COLORS.reset} ${l.replace(/^\[[^\]]+\]\s*/, '')}`);
          }
          lastSize = newBytes;
        }
      } catch {}
    });
  }
}

async function main() {
  const command = process.argv[2] || 'start';
  const arg = process.argv[3] || null;

  switch (command) {
    case 'start':
      await cmdStart();
      break;
    case 'stop':
      await cmdStop();
      break;
    case 'restart':
      await cmdRestart();
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'logs':
      await cmdLogs(arg);
      break;
    default:
      console.log(`Usage: node scripts/orchestrator.mjs [command]`);
      console.log(`Commands: start, stop, restart, status, logs [service]`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

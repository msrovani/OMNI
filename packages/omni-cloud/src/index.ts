import { createServer, type Socket } from "node:net";

interface TelemetrySample {
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

interface DeviceRecord {
  deviceId: string;
  firmwareVersion: string;
  lastSeen: string;
  isConnected: boolean;
  shadowMode: boolean;
  activeProtocols: string[];
  telemetry: TelemetrySample[];
}

class OmniCloudService {
  private devices = new Map<string, DeviceRecord>();

  registerDevice(
    deviceId: string,
    firmwareVersion = "1.0.0"
  ): DeviceRecord {
    const record: DeviceRecord = {
      deviceId,
      firmwareVersion,
      lastSeen: new Date().toISOString(),
      isConnected: true,
      shadowMode: false,
      activeProtocols: ["modbus", "can"],
      telemetry: [],
    };
    this.devices.set(deviceId, record);
    return record;
  }

  ingestTelemetry(sample: TelemetrySample): void {
    let device = this.devices.get(sample.deviceId);
    if (!device) {
      device = this.registerDevice(sample.deviceId);
    }
    device.lastSeen = new Date().toISOString();
    device.isConnected = true;
    device.telemetry.push(sample);
    if (device.telemetry.length > 5000) {
      device.telemetry = device.telemetry.slice(-5000);
    }
  }

  getDevice(deviceId: string): DeviceRecord | undefined {
    return this.devices.get(deviceId);
  }

  listDevices(): DeviceRecord[] {
    return Array.from(this.devices.values());
  }

  getDeviceCount(): number {
    return this.devices.size;
  }

  getTotalTelemetrySamples(): number {
    let total = 0;
    for (const device of this.devices.values()) {
      total += device.telemetry.length;
    }
    return total;
  }
}

const service = new OmniCloudService();
const PORT = parseInt(process.env["PORT"] ?? "4000", 10);

const server = createServer((socket: Socket) => {
  socket.on("data", (data: Buffer) => {
    try {
      const sample: TelemetrySample = JSON.parse(data.toString());
      service.ingestTelemetry(sample);
      socket.write(
        JSON.stringify({ accepted: true, deviceId: sample.deviceId }) + "\n"
      );
    } catch {
      socket.write(
        JSON.stringify({ accepted: false, error: "invalid payload" }) + "\n"
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`Omni-Cloud Edge Gateway listening on port ${PORT}`);
  console.log(`Devices registered: ${service.getDeviceCount()}`);
});

export { OmniCloudService };

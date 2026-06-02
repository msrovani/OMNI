#!/usr/bin/env python3
"""
Omni-Box Device Simulator
Emulates an edge device sending telemetry and receiving dispatch commands.
"""
import asyncio
import json
import random
import os
from datetime import datetime, timezone

TELEMETRY_INTERVAL = 5
CLOUD_GW_URL = os.getenv("CLOUD_GW_URL", "http://localhost:50053")
DEVICE_ID = os.getenv("DEVICE_ID", "sim-001")


class OmniBoxSimulator:
    def __init__(self, device_id: str):
        self.device_id = device_id
        self.soc = 50.0
        self.soh = 99.5
        self.temperature = 25.0
        self.is_charging = False
        self.power_w = 0.0

    def generate_telemetry(self) -> dict:
        self.soc += random.uniform(-0.5, 0.5) if not self.is_charging else random.uniform(0.5, 1.5)
        self.soc = max(10.0, min(95.0, self.soc))
        self.temperature += random.uniform(-0.2, 0.2)
        self.soh -= random.uniform(0.0001, 0.0005)

        return {
            "device_id": self.device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "voltage_v": round(400.0 + random.uniform(-5, 5), 2),
            "current_a": round(random.uniform(-50, 50), 2),
            "frequency_hz": round(60.0 + random.uniform(-0.05, 0.05), 3),
            "soc_percent": round(self.soc, 2),
            "soh_percent": round(self.soh, 2),
            "temperature_c": round(self.temperature, 2),
            "power_w": round(self.power_w + random.uniform(-100, 100), 2),
            "is_grid_connected": True,
        }

    async def run(self):
        print(f"[OMNI-BOX {self.device_id}] Starting simulation...")
        while True:
            telemetry = self.generate_telemetry()
            print(f"[{telemetry['timestamp']}] SoC={telemetry['soc_percent']}% "
                  f"| Power={telemetry['power_w']}W | Temp={telemetry['temperature_c']}C")
            await asyncio.sleep(TELEMETRY_INTERVAL)


async def main():
    device_id = os.getenv("DEVICE_ID", "sim-001")
    simulator = OmniBoxSimulator(device_id)
    await simulator.run()


if __name__ == "__main__":
    asyncio.run(main())

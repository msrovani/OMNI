import asyncio
from typing import Optional
from datetime import datetime
from dataclasses import dataclass


@dataclass
class TelemetrySample:
    device_id: str
    timestamp: datetime
    voltage_v: float
    current_a: float
    frequency_hz: float
    soc_percent: float
    soh_percent: float
    temperature_c: float
    power_w: float
    is_grid_connected: bool


class TelemetryClient:
    def __init__(self, nats_url: str = "nats://localhost:4222"):
        self.nats_url = nats_url
        self._nc = None

    async def connect(self):
        import nats
        self._nc = await nats.connect(self.nats_url)

    async def subscribe_telemetry(self, asset_id: str, callback):
        if not self._nc:
            await self.connect()
        await self._nc.subscribe(
            f"telemetry.{asset_id}",
            cb=lambda msg: callback(self._parse_sample(msg.data))
        )

    async def send_command(self, asset_id: str, power_kw: float):
        if not self._nc:
            await self.connect()
        await self._nc.publish(
            f"dispatch.{asset_id}",
            f'{{"power_kw": {power_kw}}}'.encode()
        )

    def _parse_sample(self, data: bytes) -> TelemetrySample:
        import json
        payload = json.loads(data)
        return TelemetrySample(
            device_id=payload["device_id"],
            timestamp=datetime.fromisoformat(payload["timestamp"]),
            voltage_v=payload["voltage_v"],
            current_a=payload["current_a"],
            frequency_hz=payload["frequency_hz"],
            soc_percent=payload["soc_percent"],
            soh_percent=payload["soh_percent"],
            temperature_c=payload["temperature_c"],
            power_w=payload["power_w"],
            is_grid_connected=payload["is_grid_connected"],
        )

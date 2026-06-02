import asyncio
import random
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum


class Submercado(Enum):
    SE_CO = "SE_CO"
    S = "S"
    NE = "NE"
    N = "N"


SUBMERCADO_NOMES = {
    Submercado.SE_CO: "Sudeste/Centro-Oeste",
    Submercado.S: "Sul",
    Submercado.NE: "Nordeste",
    Submercado.N: "Norte",
}

PISO_PLD = 69.07
TETO_PLD = 599.31

SUBMERCADO_FACTOR = {
    Submercado.SE_CO: 1.0,
    Submercado.S: 0.95,
    Submercado.NE: 0.85,
    Submercado.N: 1.15,
}


@dataclass
class PricePoint:
    timestamp: datetime
    preco_por_mwh: float
    preco_por_kwh: float
    submercado: Submercado
    fonte: str
    moeda: str = "BRL"


def _simular_pld(submercado: Submercado, hora_br: int) -> float:
    if hora_br < 6:
        base = PISO_PLD + random.random() * 80
    elif 18 <= hora_br < 21:
        base = 300 + random.random() * 250
    elif 10 <= hora_br < 17:
        base = 200 + random.random() * 150
    else:
        base = 100 + random.random() * 100

    factor = SUBMERCADO_FACTOR.get(submercado, 1.0)
    noise = (random.random() - 0.5) * 60
    price = max(PISO_PLD, min(TETO_PLD, base * factor + noise))
    return round(price, 2)


class MarketDataClient:
    def __init__(self):
        self._cache: Dict[tuple, List[PricePoint]] = {}

    async def fetch_pld_prices(
        self,
        start: datetime,
        end: datetime,
        submercado: Submercado = Submercado.SE_CO,
    ) -> List[PricePoint]:
        cache_key = (submercado.value, start, end)
        if cache_key in self._cache:
            return self._cache[cache_key]

        prices: List[PricePoint] = []
        current = start
        while current < end:
            hora_br = (current.hour - 3 + 24) % 24
            preco_mwh = _simular_pld(submercado, hora_br)
            prices.append(PricePoint(
                timestamp=current,
                preco_por_mwh=preco_mwh,
                preco_por_kwh=round(preco_mwh / 1000, 6),
                submercado=submercado,
                fonte=f"CCEE_PLD_SIMULATED_{submercado.value}",
            ))
            current += timedelta(minutes=15)

        self._cache[cache_key] = prices
        return prices

    async def fetch_all_submercados(
        self, start: datetime, end: datetime
    ) -> Dict[Submercado, List[PricePoint]]:
        result = {}
        for sm in Submercado:
            result[sm] = await self.fetch_pld_prices(start, end, sm)
        return result

    def clear_cache(self):
        self._cache.clear()

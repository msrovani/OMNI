import numpy as np
from typing import List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class OptimizationObjective(Enum):
    PROFIT = "OPTIMIZE_PROFIT"
    BATTERY_LIFE = "OPTIMIZE_BATTERY_LIFE"
    GRID_STABILITY = "OPTIMIZE_GRID_STABILITY"
    BALANCED = "OPTIMIZE_BALANCED"


class Submercado(Enum):
    SE_CO = "SE_CO"
    S = "S"
    NE = "NE"
    N = "N"


@dataclass
class DispatchAction:
    asset_id: str
    power_kw: float
    duration_seconds: int
    reason: str
    submercado: Optional[Submercado] = None


@dataclass
class AssetSpec:
    id: str
    capacity_kwh: float
    nominal_power_kw: float
    cycle_life: int
    replacement_cost: float
    min_soc: float = 0.2
    max_soc: float = 0.95
    submercado: Optional[Submercado] = None


class StochasticOptimizer:
    def __init__(self, num_scenarios: int = 10_000_000):
        self.num_scenarios = num_scenarios

    def simulate_price_scenarios(
        self, base_price: float, volatility: float, horizon: int = 96
    ) -> np.ndarray:
        returns = np.random.normal(0, volatility, (self.num_scenarios, horizon))
        paths = base_price * np.exp(np.cumsum(returns, axis=1))
        return paths

    def optimize(
        self,
        assets: List[AssetSpec],
        price_paths: np.ndarray,
        objective: OptimizationObjective = OptimizationObjective.BALANCED,
        submercado: Optional[Submercado] = None,
    ) -> Optional[DispatchAction]:
        best_action = None
        best_score = -np.inf

        for asset in assets:
            for hour in range(min(price_paths.shape[1] - 1, 96)):
                buy_price = float(price_paths[:, hour].mean())
                sell_price = float(price_paths[:, hour + 1].mean())
                spread = sell_price - buy_price

                profit = spread * asset.capacity_kwh * 0.8
                degradation = self._estimate_degradation(
                    asset, abs(spread)
                )
                stability_penalty = 0.0

                if objective == OptimizationObjective.PROFIT:
                    score = profit
                elif objective == OptimizationObjective.BATTERY_LIFE:
                    score = profit - 2.0 * degradation
                elif objective == OptimizationObjective.GRID_STABILITY:
                    score = profit - stability_penalty
                else:
                    score = profit - 0.5 * degradation

                if score > best_score:
                    best_score = score
                    best_action = DispatchAction(
                        asset_id=asset.id,
                        power_kw=asset.nominal_power_kw,
                        duration_seconds=3600,
                        reason="arbitrage",
                        submercado=submercado or asset.submercado,
                    )

        return best_action

    def _estimate_degradation(self, asset: AssetSpec, dod_percent: float) -> float:
        return (dod_percent / 100.0) * (
            asset.replacement_cost / max(asset.cycle_life, 1)
        )

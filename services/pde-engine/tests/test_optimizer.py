import pytest
import numpy as np
from pde.core.optimizer import (
    StochasticOptimizer, AssetSpec, DispatchAction, OptimizationObjective,
)


def test_price_simulation_shape():
    opt = StochasticOptimizer(num_scenarios=1000)
    paths = opt.simulate_price_scenarios(base_price=0.35, volatility=0.15, horizon=96)
    assert paths.shape == (1000, 96)
    assert paths.min() > 0


def test_optimize_returns_action():
    opt = StochasticOptimizer(num_scenarios=100)
    assets = [
        AssetSpec(
            id="bat-001", capacity_kwh=100, nominal_power_kw=50,
            cycle_life=6000, replacement_cost=50000,
        )
    ]
    prices = opt.simulate_price_scenarios(0.35, 0.15, horizon=96)
    action = opt.optimize(assets, prices)
    assert action is None or isinstance(action, DispatchAction)


def test_optimize_profit_objective():
    opt = StochasticOptimizer(num_scenarios=100)
    assets = [
        AssetSpec(
            id="bat-001", capacity_kwh=100, nominal_power_kw=50,
            cycle_life=6000, replacement_cost=50000,
        )
    ]
    prices = opt.simulate_price_scenarios(0.35, 0.15, horizon=96)
    action = opt.optimize(assets, prices, OptimizationObjective.PROFIT)
    if action:
        assert action.reason == "arbitrage"


def test_degradation_estimate():
    opt = StochasticOptimizer()
    asset = AssetSpec(
        id="bat-001", capacity_kwh=100, nominal_power_kw=50,
        cycle_life=6000, replacement_cost=100000,
    )
    cost = opt._estimate_degradation(asset, dod_percent=10.0)
    expected = (10.0 / 100.0) * (100000 / 6000)
    assert abs(cost - expected) < 0.01

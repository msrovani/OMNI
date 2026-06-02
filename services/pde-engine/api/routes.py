from fastapi import APIRouter, Query
from pde.core.optimizer import StochasticOptimizer, OptimizationObjective, Submercado, AssetSpec
from pde.core.dispatch import DispatchOrchestrator
from pde.core.forecast import ForecastEngine
from pde.infrastructure.market import MarketDataClient, SUBMERCADO_NOMES
from datetime import datetime
from typing import Optional

router = APIRouter()
forecast_engine = ForecastEngine()
optimizer = StochasticOptimizer()
dispatcher = DispatchOrchestrator()
market = MarketDataClient()


@router.get("/status")
async def status():
    return {
        "servico": "PDE Engine",
        "versao": "1.0.0",
        "mercado": "Brasil",
        "moeda": "BRL",
        "unidade": "R$/MWh",
        "submercados": [{"codigo": sm.value, "nome": nome} for sm, nome in SUBMERCADO_NOMES.items()],
        "pld": {
            "piso": 69.07,
            "teto": 599.31,
        },
    }


@router.get("/market/submercados")
async def listar_submercados():
    return [
        {"codigo": sm.value, "nome": nome}
        for sm, nome in SUBMERCADO_NOMES.items()
    ]


@router.get("/market/precos")
async def obter_precos(
    submercado: Submercado = Submercado.SE_CO,
    inicio: Optional[datetime] = None,
    fim: Optional[datetime] = None,
):
    s = inicio or datetime.now()
    e = fim or datetime.now()
    prices = await market.fetch_pld_prices(s, e, submercado)
    return [
        {
            "timestamp": p.timestamp.isoformat(),
            "preco_por_mwh": p.preco_por_mwh,
            "preco_por_kwh": p.preco_por_kwh,
            "submercado": p.submercado.value,
            "fonte": p.fonte,
            "moeda": p.moeda,
        }
        for p in prices
    ]


@router.post("/optimize")
async def optimizar(
    asset_ids: list[str],
    objective: OptimizationObjective = OptimizationObjective.BALANCED,
    submercado: Submercado = Submercado.SE_CO,
):
    assets = [AssetSpec(id=aid, capacity_kwh=100, nominal_power_kw=50,
                        cycle_life=6000, replacement_cost=50000,
                        submercado=submercado)
              for aid in asset_ids]
    prices = await market.fetch_pld_prices(datetime.now(), datetime.now(), submercado)
    base_price = prices[0].preco_por_mwh if prices else 300.0
    paths = optimizer.simulate_price_scenarios(base_price, 0.15)
    action = optimizer.optimize(assets, paths, objective, submercado)
    return {
        "comando": {
            "asset_id": action.asset_id,
            "power_kw": action.power_kw,
            "duration_seconds": action.duration_seconds,
            "reason": action.reason,
            "submercado": action.submercado.value if action.submercado else None,
        } if action else None,
        "submercado": submercado.value,
        "moeda": "BRL",
    }

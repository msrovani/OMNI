from fastapi import FastAPI
from pde.api.routes import router
from pde.core.forecast import ForecastEngine
from pde.core.optimizer import StochasticOptimizer
from pde.core.dispatch import DispatchOrchestrator
from pde.infrastructure.telemetry import TelemetryClient
from pde.infrastructure.market import MarketDataClient, SUBMERCADO_NOMES

app = FastAPI(title="PDE Engine — OMNI Grid Brasil", version="1.0.0")

forecast_engine = ForecastEngine()
optimizer = StochasticOptimizer()
dispatcher = DispatchOrchestrator()
telemetry = TelemetryClient()
market = MarketDataClient()

app.include_router(router, prefix="/api/v1/pde")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "servico": "pde-engine",
        "versao": "1.0.0",
        "mercado": "Brasil",
        "moeda": "BRL",
        "submercados": [sm.value for sm in SUBMERCADO_NOMES],
    }

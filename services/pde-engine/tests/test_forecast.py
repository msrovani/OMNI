import pytest
import torch
import pandas as pd
import numpy as np
from pde.core.forecast import ForecastEngine, TimeSeriesTransformer


def test_transformer_forward():
    model = TimeSeriesTransformer(d_model=64, nhead=4, num_layers=2)
    x = torch.randn(2, 96, 12)
    y = model(x)
    assert y.shape == (2, 1)


def test_forecast_engine_predict():
    engine = ForecastEngine()
    features = torch.randn(1, 96, 12)
    result = engine.predict(features)
    assert isinstance(result, float)


def test_forecast_series_shape():
    engine = ForecastEngine()
    df = pd.DataFrame(np.random.randn(100, 12))
    preds = engine.predict_series(df, horizon=10)
    assert len(preds) == 10
    assert all(isinstance(p, float) for p in preds)

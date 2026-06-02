import torch
import torch.nn as nn
import pandas as pd
import numpy as np
from typing import List, Optional
from datetime import datetime, timedelta


class TimeSeriesTransformer(nn.Module):
    def __init__(self, d_model: int = 256, nhead: int = 8, num_layers: int = 6):
        super().__init__()
        self.embedding = nn.Linear(12, d_model)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            batch_first=True,
            dim_feedforward=1024,
            dropout=0.1,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.output = nn.Linear(d_model, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.embedding(x)
        x = self.transformer(x)
        return self.output(x[:, -1, :])


class ForecastEngine:
    def __init__(self, model_path: Optional[str] = None):
        self.model = TimeSeriesTransformer()
        if model_path:
            self.model.load_state_dict(torch.load(model_path))
        self.model.eval()

    def predict(self, features: torch.Tensor) -> float:
        with torch.no_grad():
            return self.model(features).item()

    def predict_series(
        self, historical: pd.DataFrame, horizon: int = 96
    ) -> List[float]:
        predictions = []
        window = torch.tensor(
            historical.values[-96:], dtype=torch.float32
        ).unsqueeze(0)
        for _ in range(horizon):
            pred = self.predict(window)
            predictions.append(pred)
            new_row = torch.cat(
                [window[:, 1:, :], torch.tensor([[[pred]]])], dim=1
            )
            window = new_row
        return predictions

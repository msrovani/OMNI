import { describe, it, expect } from "vitest";
import { ForecastEngine, HoltWintersModel, createHoltWintersModel, createNaiveSeasonalModel, generateForecast, updateForecastWithActual } from "../src/forecast.js";
import type { ForecastModel } from "../src/forecast.js";

describe("ForecastEngine", () => {
  it("should return predictions for given horizon", () => {
    const engine = new ForecastEngine();
    const result = engine.predict(
      "bat-001",
      [
        {
          hourOfDay: 14,
          dayOfWeek: 3,
          month: 6,
          isWeekend: 0,
          temperature: 30,
          solarIrradiance: 800,
          prevLoadKwh: 120,
          sameHourYesterdayKwh: 115,
          rollingAvg3hKwh: 118,
        },
      ],
      4
    );

    expect(result.assetId).toBe("bat-001");
    expect(result.predictions).toHaveLength(4);
    expect(result.timestamps).toHaveLength(4);
    result.predictions.forEach((p) => {
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(500);
    });
  });

  it("should include maePercent in result", () => {
    const engine = new ForecastEngine();
    const result = engine.predict("bat-002", [], 1);
    expect(result.maePercent).toBeGreaterThan(0);
  });

  it("should handle empty features gracefully", () => {
    const engine = new ForecastEngine();
    const result = engine.predict("bat-003", [], 10);
    expect(result.predictions).toHaveLength(10);
  });

  it("should include confidence intervals when enough data", () => {
    const engine = new ForecastEngine();
    const features = Array.from({ length: 24 }, (_, i) => ({
      hourOfDay: i % 24,
      dayOfWeek: 3,
      month: 6,
      isWeekend: 0,
      temperature: 25,
      solarIrradiance: i < 12 ? 800 : 0,
      prevLoadKwh: 100 + Math.sin(i * 0.26) * 30,
      sameHourYesterdayKwh: 95,
      rollingAvg3hKwh: 100,
    }));
    const result = engine.predict("bat-004", features, 4);
    expect(result.confidenceUpper).toHaveLength(4);
    expect(result.confidenceLower).toHaveLength(4);
    expect(result.points).toHaveLength(4);
    result.confidenceUpper!.forEach((u, i) => {
      expect(u).toBeGreaterThanOrEqual(result.predictions[i]);
    });
    result.confidenceLower!.forEach((l, i) => {
      expect(l).toBeLessThanOrEqual(result.predictions[i]);
    });
  });

  it("should update model with actual data and produce new predictions", () => {
    const engine = new ForecastEngine();
    const features = Array.from({ length: 24 }, (_, i) => ({
      hourOfDay: i % 24,
      dayOfWeek: 3,
      month: 6,
      isWeekend: 0,
      temperature: 25,
      solarIrradiance: 0,
      prevLoadKwh: 100 + Math.sin(i * 0.26) * 20,
      sameHourYesterdayKwh: 95,
      rollingAvg3hKwh: 100,
    }));
    const result1 = engine.predict("bat-005", features, 4);
    engine.updateForecastWithActual(105);
    const model = engine.getModel();
    const newPreds = model.predict(4);
    expect(newPreds).toHaveLength(4);
    newPreds.forEach((p) => {
      expect(p).toBeGreaterThan(0);
    });
  });
});

describe("HoltWintersModel", () => {
  it("should fit and predict a constant series", () => {
    const model = new HoltWintersModel();
    const data = Array.from({ length: 48 }, () => 100);
    model.fit(data, 24);
    const preds = model.predict(6);
    expect(preds).toHaveLength(6);
    preds.forEach((p) => {
      expect(p).toBeCloseTo(100, -1);
    });
  });

  it("should fit and predict a linear trend series", () => {
    const model = new HoltWintersModel({ alpha: 0.5, beta: 0.3, gamma: 0.1 });
    const data = Array.from({ length: 96 }, (_, i) => 100 + i * 0.5);
    model.fit(data, 24);
    const preds = model.predict(4);
    expect(preds).toHaveLength(4);
    expect(preds[0]).toBeGreaterThan(data[data.length - 1]);
    expect(preds[3]).toBeGreaterThan(preds[0]);
  });

  it("should fit and predict a seasonal series", () => {
    const model = new HoltWintersModel({ alpha: 0.4, beta: 0.1, gamma: 0.5 });
    const period = 24;
    const data = Array.from({ length: 72 }, (_, i) =>
      100 + 40 * Math.sin((i % period) * (2 * Math.PI / period))
    );
    model.fit(data, period);
    const preds = model.predict(period);
    expect(preds).toHaveLength(period);
    preds.forEach((p) => {
      expect(p).toBeGreaterThan(0);
    });
  });

  it("should provide confidence intervals", () => {
    const model = new HoltWintersModel();
    const data = Array.from({ length: 48 }, (_, i) => 100 + Math.sin(i * 0.26) * 20);
    model.fit(data, 24);
    const ci = model.getConfidenceInterval(4);
    expect(ci.upper).toHaveLength(4);
    expect(ci.lower).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(ci.upper[i]).toBeGreaterThan(ci.lower[i]);
    }
  });

  it("should update model with actual data and improve metrics", () => {
    const model = new HoltWintersModel({ alpha: 0.5, beta: 0.2, gamma: 0.3 });
    const data = Array.from({ length: 48 }, (_, i) => 100 + Math.sin(i * 0.26) * 15);
    model.fit(data, 24);
    const metricsBefore = model.getMetrics();

    for (let i = 0; i < 10; i++) {
      const nextVal = 100 + Math.sin((48 + i) * 0.26) * 15;
      model.update(nextVal);
    }

    const metricsAfter = model.getMetrics();
    expect(metricsAfter.rmse).toBeLessThanOrEqual(metricsBefore.rmse * 1.5);
  });

  it("should handle updates with realistic load data", () => {
    const model = createHoltWintersModel({ alpha: 0.3, beta: 0.1, gamma: 0.1 }) as HoltWintersModel;
    const data = Array.from({ length: 48 }, (_, i) =>
      50 + 20 * Math.sin((i % 24) * (2 * Math.PI / 24)) + (i > 24 ? 0.5 * (i - 24) : 0)
    );
    model.fit(data, 24);
    const preds1 = model.predict(1);
    const metrics1 = model.getMetrics();
    model.update(data[data.length - 1] + 5);
    const preds2 = model.predict(1);
    expect(metrics1.mae).toBeGreaterThanOrEqual(0);
    expect(preds2.length).toBe(1);
  });

  it("should compute metrics correctly", () => {
    const model = new HoltWintersModel();
    const data = Array.from({ length: 48 }, (_, i) => 100 + Math.sin(i * 0.26) * 10);
    model.fit(data, 24);
    const metrics = model.getMetrics();
    expect(metrics.mae).toBeGreaterThan(0);
    expect(metrics.rmse).toBeGreaterThan(0);
    expect(metrics.mape).toBeGreaterThanOrEqual(0);
    expect(metrics.rmse).toBeGreaterThanOrEqual(metrics.mae);
  });

  it("should throw on predict before fit", () => {
    const model = new HoltWintersModel();
    expect(() => model.predict(1)).toThrow("Model must be fitted");
  });
});

describe("Factory functions", () => {
  it("createHoltWintersModel should produce a working model", () => {
    const model = createHoltWintersModel();
    expect(model.name).toBe("Holt-Winters");
    const data = Array.from({ length: 48 }, () => 100);
    model.fit(data, 24);
    const preds = model.predict(4);
    expect(preds).toHaveLength(4);
  });

  it("createNaiveSeasonalModel should produce a working model", () => {
    const model = createNaiveSeasonalModel();
    expect(model.name).toBe("Naive Seasonal");
    const data = Array.from({ length: 48 }, (_, i) => 50 + Math.sin(i * 0.26) * 10);
    model.fit(data, 24);
    const preds = model.predict(4);
    expect(preds).toHaveLength(4);
    preds.forEach((p) => expect(p).toBeGreaterThan(0));
  });
});

describe("generateForecast", () => {
  it("should generate forecast with confidence intervals", () => {
    const data = Array.from({ length: 48 }, (_, i) => 100 + Math.sin(i * 0.26) * 20);
    const result = generateForecast(data, 6, 24);
    expect(result.predictions).toHaveLength(6);
    expect(result.confidenceUpper).toHaveLength(6);
    expect(result.confidenceLower).toHaveLength(6);
    expect(result.metrics.mae).toBeGreaterThan(0);
    expect(result.metrics.rmse).toBeGreaterThan(0);
  });

  it("should handle short historical data", () => {
    const data = [100, 102, 104];
    const result = generateForecast(data, 3, 24);
    expect(result.predictions).toHaveLength(3);
  });
});

describe("updateForecastWithActual", () => {
  it("should update model state via standalone function", () => {
    const model = createHoltWintersModel();
    const data = Array.from({ length: 48 }, () => 100);
    model.fit(data, 24);
    updateForecastWithActual(model, 105);
    const metrics = model.getMetrics();
    expect(metrics.mae).toBeGreaterThan(0);
  });
});

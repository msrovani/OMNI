class KalmanFilter {
    state = 0;
    covariance = 1;
    processNoise;
    measurementNoise;
    constructor(processNoise = 0.01, measurementNoise = 0.1) {
        this.processNoise = processNoise;
        this.measurementNoise = measurementNoise;
    }
    predict() {
        this.covariance += this.processNoise;
        return this.state;
    }
    update(measurement) {
        const gain = this.covariance / (this.covariance + this.measurementNoise);
        this.state += gain * (measurement - this.state);
        this.covariance = (1 - gain) * this.covariance;
    }
    getStd() {
        return Math.sqrt(this.covariance);
    }
    reset() {
        this.state = 0;
        this.covariance = 1;
    }
}
export class HoltWintersModel {
    name = "Holt-Winters";
    alpha;
    beta;
    gamma;
    period = 24;
    level = 0;
    trend = 0;
    seasonal = [];
    fitted = false;
    lastIdx = -1;
    errorHistory = [];
    kalman;
    constructor(options) {
        this.alpha = options?.alpha ?? 0.3;
        this.beta = options?.beta ?? 0.1;
        this.gamma = options?.gamma ?? 0.1;
        this.kalman = new KalmanFilter();
    }
    fit(historical, period = 24) {
        this.period = period;
        this.errorHistory = [];
        this.kalman.reset();
        const n = historical.length;
        if (n < 2) {
            this.level = n > 0 ? historical[0] : 50;
            this.trend = 0;
            this.seasonal = new Array(period).fill(0);
            this.fitted = true;
            this.lastIdx = 0;
            return;
        }
        const p = Math.min(period, n);
        let levelSum = 0;
        for (let i = 0; i < p; i++)
            levelSum += historical[i];
        this.level = levelSum / p;
        if (n >= p * 2) {
            let trendSum = 0;
            for (let i = 0; i < p; i++)
                trendSum += (historical[i + p] - historical[i]) / p;
            this.trend = trendSum / p;
        }
        else {
            this.trend = 0;
        }
        this.seasonal = [];
        for (let i = 0; i < p; i++) {
            const detrended = historical[i] - (this.level + (i + 1) * this.trend);
            this.seasonal.push(detrended);
        }
        while (this.seasonal.length < period)
            this.seasonal.push(0);
        for (let i = 0; i < n; i++) {
            const sIdx = i % period;
            const forecast = Math.max(0, this.level + this.trend + this.seasonal[sIdx]);
            const actual = historical[i];
            this.errorHistory.push(actual - forecast);
            const newLevel = this.alpha * (actual - this.seasonal[sIdx]) + (1 - this.alpha) * (this.level + this.trend);
            const newTrend = this.beta * (newLevel - this.level) + (1 - this.beta) * this.trend;
            const newSeasonal = this.gamma * (actual - newLevel) + (1 - this.gamma) * this.seasonal[sIdx];
            this.level = newLevel;
            this.trend = newTrend;
            this.seasonal[sIdx] = newSeasonal;
            this.lastIdx = sIdx;
        }
        this.fitted = true;
    }
    predict(steps) {
        if (!this.fitted)
            throw new Error("Model must be fitted before predicting");
        const kalmanError = this.kalman.predict();
        const result = [];
        for (let i = 1; i <= steps; i++) {
            const sIdx = (this.lastIdx + i) % this.period;
            const pred = Math.max(0, this.level + i * this.trend + this.seasonal[sIdx] + kalmanError);
            result.push(pred);
        }
        return result;
    }
    update(actual) {
        if (!this.fitted)
            return;
        const sIdx = (this.lastIdx + 1) % this.period;
        const predicted = Math.max(0, this.level + this.trend + this.seasonal[sIdx]);
        const error = actual - predicted;
        this.kalman.update(error);
        this.errorHistory.push(error);
        const newLevel = this.alpha * (actual - this.seasonal[sIdx]) + (1 - this.alpha) * (this.level + this.trend);
        const newTrend = this.beta * (newLevel - this.level) + (1 - this.beta) * this.trend;
        const newSeasonal = this.gamma * (actual - newLevel) + (1 - this.gamma) * this.seasonal[sIdx];
        this.level = newLevel;
        this.trend = newTrend;
        this.seasonal[sIdx] = newSeasonal;
        this.lastIdx = sIdx;
    }
    getConfidenceInterval(steps) {
        const preds = this.predict(steps);
        const sigma = this.errorHistory.length > 0
            ? Math.sqrt(this.errorHistory.reduce((s, e) => s + e * e, 0) / this.errorHistory.length)
            : 10;
        const z = 1.96;
        return {
            upper: preds.map((p) => p + z * sigma),
            lower: preds.map((p) => Math.max(0, p - z * sigma)),
        };
    }
    getMetrics() {
        const n = this.errorHistory.length;
        if (n === 0)
            return { mae: 0, rmse: 0, mape: 0 };
        const errors = this.errorHistory;
        let sumAbs = 0, sumSq = 0, sumAbsPct = 0;
        for (let i = 0; i < n; i++) {
            const e = errors[i];
            sumAbs += Math.abs(e);
            sumSq += e * e;
        }
        const mae = sumAbs / n;
        const rmse = Math.sqrt(sumSq / n);
        const histLen = this.errorHistory.length;
        const start = Math.max(0, histLen - n);
        for (let i = 0; i < n; i++) {
            const actual = 50;
            if (actual > 0)
                sumAbsPct += Math.abs(errors[i] / actual);
        }
        const mape = n > 0 ? (sumAbsPct / n) * 100 : 0;
        return { mae, rmse, mape };
    }
}
export function createHoltWintersModel(options) {
    return new HoltWintersModel(options);
}
class SimpleNaiveModel {
    name = "Naive Seasonal";
    history = [];
    period = 24;
    errors = [];
    fit(historical, period = 24) {
        this.history = [...historical];
        this.period = period;
        this.errors = [];
    }
    predict(steps) {
        if (this.history.length === 0)
            return new Array(steps).fill(50);
        const result = [];
        for (let i = 0; i < steps; i++) {
            const idx = this.history.length - this.period + (i % this.period);
            const val = idx >= 0 && idx < this.history.length ? this.history[idx] : this.history[this.history.length - 1];
            result.push(val);
        }
        return result;
    }
    update(actual) {
        const last = this.history.length > 0 ? this.history[this.history.length - 1] : 50;
        this.errors.push(actual - last);
        this.history.push(actual);
    }
    getConfidenceInterval(steps) {
        const preds = this.predict(steps);
        const sigma = this.errors.length > 0
            ? Math.sqrt(this.errors.reduce((s, e) => s + e * e, 0) / this.errors.length)
            : 10;
        return {
            upper: preds.map((p) => p + 1.96 * sigma),
            lower: preds.map((p) => Math.max(0, p - 1.96 * sigma)),
        };
    }
    getMetrics() {
        const n = this.errors.length;
        if (n === 0)
            return { mae: 0, rmse: 0, mape: 0 };
        let sumAbs = 0, sumSq = 0;
        for (const e of this.errors) {
            sumAbs += Math.abs(e);
            sumSq += e * e;
        }
        return { mae: sumAbs / n, rmse: Math.sqrt(sumSq / n), mape: 0 };
    }
}
export function createNaiveSeasonalModel() {
    return new SimpleNaiveModel();
}
export class ForecastEngine {
    hwModel;
    constructor() {
        this.hwModel = new HoltWintersModel();
    }
    predict(assetId, features, horizon) {
        const now = new Date();
        let predictions;
        let confidenceUpper;
        let confidenceLower;
        const loadHistory = features.map((f) => f.prevLoadKwh);
        if (features.length >= 4) {
            this.hwModel.fit(loadHistory, 24);
            predictions = this.hwModel.predict(horizon);
            const ci = this.hwModel.getConfidenceInterval(horizon);
            confidenceUpper = ci.upper;
            confidenceLower = ci.lower;
        }
        else {
            const model = new SeasonalNaiveModel();
            if (features.length === 0) {
                const defaultFeat = {
                    hourOfDay: 12, dayOfWeek: 3, month: 6, isWeekend: 0,
                    temperature: 25, solarIrradiance: 500, prevLoadKwh: 50,
                    sameHourYesterdayKwh: 48, rollingAvg3hKwh: 49,
                };
                predictions = Array.from({ length: horizon }, () => model.forecast(defaultFeat));
            }
            else {
                predictions = Array.from({ length: horizon }, (_, i) => {
                    const feat = features[i] ?? features[features.length - 1];
                    return model.forecast(feat);
                });
            }
        }
        const timestamps = Array.from({ length: horizon }, (_, i) => new Date(now.getTime() + i * 15 * 60_000));
        const points = timestamps.map((ts, i) => ({
            hour: ts.getHours(),
            loadKw: predictions[i],
            upperBound: confidenceUpper?.[i],
            lowerBound: confidenceLower?.[i],
            isForecast: true,
        }));
        const mae = features.length > 1
            ? this.computeMae(features, predictions)
            : 1.5;
        return {
            assetId,
            predictions,
            timestamps,
            maePercent: mae,
            points,
            confidenceUpper,
            confidenceLower,
        };
    }
    updateForecastWithActual(actualLoad) {
        this.hwModel.update(actualLoad);
    }
    getModel() {
        return this.hwModel;
    }
    computeMae(features, predictions) {
        const actuals = features.map((f) => f.prevLoadKwh);
        const n = Math.min(actuals.length, predictions.length);
        if (n === 0)
            return 100;
        const sum = actuals
            .slice(0, n)
            .reduce((acc, a, i) => acc + Math.abs(a - predictions[i]), 0);
        const mean = actuals.reduce((a, b) => a + b, 0) / n;
        return mean > 0 ? (sum / n / mean) * 100 : 100;
    }
}
class SeasonalNaiveModel {
    forecast(features) {
        const baseLoad = 50;
        const hourFactor = this.hourlyFactor(features.hourOfDay);
        const weekendFactor = features.isWeekend ? 0.7 : 1.0;
        const tempFactor = 1 + (features.temperature - 25) * 0.005;
        const solarFactor = Math.max(0, 1 - features.solarIrradiance * 0.001);
        const prediction = baseLoad * hourFactor * weekendFactor * tempFactor * solarFactor;
        if (features.sameHourYesterdayKwh > 0) {
            return prediction * 0.3 + features.sameHourYesterdayKwh * 0.7;
        }
        return prediction;
    }
    hourlyFactor(hour) {
        if (hour >= 0 && hour < 6)
            return 0.4;
        if (hour >= 6 && hour < 9)
            return 0.7;
        if (hour >= 9 && hour < 12)
            return 0.9;
        if (hour >= 12 && hour < 14)
            return 0.6;
        if (hour >= 14 && hour < 18)
            return 0.8;
        if (hour >= 18 && hour < 22)
            return 1.0;
        return 0.6;
    }
}
export function generateForecast(historical, horizon, period = 24) {
    const model = new HoltWintersModel();
    model.fit(historical, period);
    const predictions = model.predict(horizon);
    const ci = model.getConfidenceInterval(horizon);
    const metrics = model.getMetrics();
    return { predictions, confidenceUpper: ci.upper, confidenceLower: ci.lower, metrics };
}
export function updateForecastWithActual(model, actual) {
    model.update(actual);
}
//# sourceMappingURL=forecast.js.map
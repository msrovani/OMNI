export const PLD_SUBMARKETS = ["SE_CO", "S", "NE", "N"];
const PISO_PLD = 69.07;
const TETO_PLD = 599.31;
function simulatePldPrice(submercado, hour) {
    const brtHour = hour;
    let base;
    if (brtHour < 6) {
        base = PISO_PLD + Math.random() * 80;
    }
    else if (brtHour >= 18 && brtHour < 21) {
        base = 300 + Math.random() * 250;
    }
    else if (brtHour >= 10 && brtHour < 17) {
        base = 200 + Math.random() * 150;
    }
    else {
        base = 100 + Math.random() * 100;
    }
    const factor = {
        SE_CO: 1.0,
        S: 0.95,
        NE: 0.85 + Math.random() * 0.15,
        N: 1.1 + Math.random() * 0.2,
    };
    const noise = (Math.random() - 0.5) * 60;
    const price = Math.max(PISO_PLD, Math.min(TETO_PLD, base * (factor[submercado] ?? 1) + noise));
    return Math.round(price * 100) / 100;
}
export class MarketDataClient {
    cache = new Map();
    async fetchPldPrices(start, end, simulate = true, submercado = "SE_CO") {
        const key = `${submercado}-${start.toISOString()}-${end.toISOString()}`;
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const prices = [];
        const current = new Date(start);
        while (current < end) {
            const brtHour = (current.getUTCHours() - 3 + 24) % 24;
            let price;
            if (simulate) {
                price = simulatePldPrice(submercado, brtHour);
            }
            else {
                const base = brtHour >= 10 && brtHour < 17 ? 0.35 : 0.55;
                const noise = (Math.random() - 0.5) * 0.2;
                price = Math.max(0.05, base + noise);
            }
            prices.push({
                timestamp: new Date(current),
                pricePerKwh: simulate ? price / 1000 : price,
                source: simulate ? `CCEE_PLD_SIMULATED_${submercado}` : "CCEE_PLD_LIVE",
                submercado,
                currency: "BRL",
            });
            current.setUTCMinutes(current.getUTCMinutes() + 15);
        }
        this.cache.set(key, prices);
        if (this.cache.size > 10) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey)
                this.cache.delete(firstKey);
        }
        return prices;
    }
    async fetchAllSubmarkets(start, end, simulate = true) {
        const result = new Map();
        for (const sm of PLD_SUBMARKETS) {
            const prices = await this.fetchPldPrices(start, end, simulate, sm);
            result.set(sm, prices);
        }
        return result;
    }
    clearCache() {
        this.cache.clear();
    }
}
//# sourceMappingURL=market-data.js.map
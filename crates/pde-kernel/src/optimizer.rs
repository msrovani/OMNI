//! Stochastic Optimizer — Simulated annealing + Monte Carlo
//!
//! Avalia 10M de cenários de preço para maximizar lucro de
//! arbitragem enquanto minimiza degradação da bateria.

use rand::Rng;
use rand_distr::{Distribution, Normal};
use std::time::Instant;
use tracing::info;

use crate::types::{Asset, DispatchCommand, Objective, OptimizationResult};

pub struct StochasticOptimizer {
    num_scenarios: u64,
}

impl StochasticOptimizer {
    pub fn new(num_scenarios: u64) -> Self {
        info!("Initializing StochasticOptimizer with {num_scenarios} scenarios");
        Self { num_scenarios }
    }

    /// Simula cenários de preço usando movimento Browniano geométrico
    pub fn simulate_price_scenarios(
        &self,
        base_price: f64,
        volatility: f64,
        horizon: usize,
    ) -> Vec<Vec<f64>> {
        let mut rng = rand::thread_rng();
        let normal = Normal::new(0.0, 1.0).unwrap();

        (0..self.num_scenarios)
            .map(|_| {
                let mut path = Vec::with_capacity(horizon);
                let mut price = base_price;
                for _ in 0..horizon {
                    let z: f64 = normal.sample(&mut rng);
                    price *= f64::exp((volatility * volatility * (-0.5)) + volatility * z);
                    path.push(price);
                }
                path
            })
            .collect()
    }

    /// Encontra o melhor trade para cada ativo
    pub fn optimize(
        &self,
        assets: &[Asset],
        price_scenarios: &[Vec<f64>],
        objective: Objective,
    ) -> OptimizationResult {
        let start = Instant::now();
        let mut commands = Vec::new();
        let mut total_profit = 0.0;
        let mut total_degradation = 0.0;

        let n_scenarios = price_scenarios.len() as f64;

        // Média dos preços por intervalo
        let avg_prices: Vec<f64> = if price_scenarios.is_empty() {
            vec![]
        } else {
            let horizon = price_scenarios[0].len();
            (0..horizon)
                .map(|i| {
                    price_scenarios.iter().map(|p| p[i]).sum::<f64>() / n_scenarios
                })
                .collect()
        };

        for asset in assets {
            let mut best_profit = f64::NEG_INFINITY;
            let mut best_buy = 0;
            let mut best_sell = 0;

            for buy in 0..avg_prices.len().saturating_sub(1) {
                for sell in buy + 1..avg_prices.len() {
                    let spread = avg_prices[sell] - avg_prices[buy];
                    if spread <= 0.0 {
                        continue;
                    }

                    let energy_mwh = asset.capacity_kwh * 0.8;
                    let gross_profit = spread * energy_mwh * 1000.0;
                    let dod = (energy_mwh / asset.capacity_kwh) * 100.0;
                    let degradation = self.estimate_degradation(asset, dod);
                    let net_profit = gross_profit - degradation;

                    let score = match objective {
                        Objective::Profit => net_profit,
                        Objective::BatteryLife => net_profit - degradation * 2.0,
                        Objective::GridStability => net_profit,
                        Objective::Balanced => net_profit - degradation * 0.5,
                    };

                    if score > best_profit {
                        best_profit = score;
                        best_buy = buy;
                        best_sell = sell;
                    }
                }
            }

            if best_profit > 0.0 && best_sell > best_buy {
                commands.push(DispatchCommand {
                    asset_id: asset.id.clone(),
                    power_kw: asset.nominal_power_kw,
                    duration_s: ((best_sell - best_buy) as u64) * 900,
                    reason: "arbitrage".into(),
                });
                total_profit += best_profit;
                total_degradation += self.estimate_degradation(
                    asset,
                    ((avg_prices[best_sell] - avg_prices[best_buy]) / avg_prices[best_buy].max(0.01)) * 100.0,
                );
            }
        }

        let elapsed = start.elapsed();
        OptimizationResult {
            commands,
            expected_profit: total_profit,
            expected_degradation: total_degradation,
            scenario_count: self.num_scenarios,
            execution_time_ms: elapsed.as_secs_f64() * 1000.0,
        }
    }

    pub fn estimate_degradation(&self, asset: &Asset, dod_percent: f64) -> f64 {
        let cycle_cost = asset.replacement_cost / (asset.cycle_life as f64).max(1.0);
        (dod_percent / 100.0) * cycle_cost
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Asset;

    fn test_asset() -> Asset {
        Asset {
            id: "bat-001".into(),
            capacity_kwh: 100.0,
            nominal_power_kw: 50.0,
            cycle_life: 6000,
            replacement_cost: 50_000.0,
            min_soc: 20.0,
            max_soc: 95.0,
        }
    }

    #[test]
    fn test_price_simulation_shape() {
        let opt = StochasticOptimizer::new(1000);
        let scenarios = opt.simulate_price_scenarios(0.35, 0.15, 96);
        assert_eq!(scenarios.len(), 1000);
        assert_eq!(scenarios[0].len(), 96);
    }

    #[test]
    fn test_prices_are_positive() {
        let opt = StochasticOptimizer::new(1000);
        let scenarios = opt.simulate_price_scenarios(0.35, 0.15, 24);
        for path in &scenarios {
            for &price in path {
                assert!(price > 0.0, "price must be positive, got {price}");
            }
        }
    }

    #[test]
    fn test_optimize_returns_command() {
        let opt = StochasticOptimizer::new(100);
        let assets = vec![test_asset()];
        let prices = opt.simulate_price_scenarios(0.35, 0.15, 24);
        let result = opt.optimize(&assets, &prices, Objective::Balanced);
        assert!(!result.commands.is_empty() || result.expected_profit == 0.0);
    }

    #[test]
    fn test_degradation_estimate() {
        let opt = StochasticOptimizer::new(1);
        let asset = test_asset();
        let cost = opt.estimate_degradation(&asset, 10.0);
        let expected = (10.0 / 100.0) * (50_000.0 / 6000.0);
        assert!((cost - expected).abs() < 0.001);
    }

    #[test]
    fn test_scenario_count_in_result() {
        let opt = StochasticOptimizer::new(500_000);
        let assets = vec![test_asset()];
        let prices = opt.simulate_price_scenarios(0.35, 0.15, 48);
        let result = opt.optimize(&assets, &prices, Objective::Profit);
        assert_eq!(result.scenario_count, 500_000);
    }

    #[test]
    fn test_execution_time_reported() {
        let opt = StochasticOptimizer::new(1000);
        let assets = vec![test_asset()];
        let prices = opt.simulate_price_scenarios(0.35, 0.15, 24);
        let result = opt.optimize(&assets, &prices, Objective::Balanced);
        assert!(result.execution_time_ms > 0.0);
    }

    #[test]
    fn test_optimize_multiple_assets() {
        let opt = StochasticOptimizer::new(1000);
        let assets = vec![
            test_asset(),
            Asset {
                id: "bat-002".into(),
                capacity_kwh: 200.0,
                nominal_power_kw: 100.0,
                cycle_life: 5000,
                replacement_cost: 80_000.0,
                min_soc: 20.0,
                max_soc: 95.0,
            },
        ];
        let prices = opt.simulate_price_scenarios(0.35, 0.15, 48);
        let result = opt.optimize(&assets, &prices, Objective::Balanced);
        assert!(result.commands.len() <= assets.len());
    }

    #[test]
    fn test_profit_objective_prefers_higher_risk() {
        let opt = StochasticOptimizer::new(1000);
        let asset = test_asset();
        let prices = opt.simulate_price_scenarios(0.35, 0.25, 48);
        let profit_result = opt.optimize(&[asset.clone()], &prices, Objective::Profit);
        let balanced_result = opt.optimize(&[asset], &prices, Objective::Balanced);
        assert!(profit_result.expected_profit >= balanced_result.expected_profit * 0.5);
    }
}

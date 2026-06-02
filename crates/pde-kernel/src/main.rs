//! PDE Kernel — Motor de Otimização Estocástica
//!
//! CRITICAL — Núcleo computacional do Predictive Dispatch Engine.
//! Simula 10M de cenários de preço por hora para encontrar
//! o despacho ótimo de cada ativo.
//!
//! Implementado em Rust nativo para performance máxima.

pub mod optimizer;
pub mod types;

use optimizer::StochasticOptimizer;

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();

    let opt = StochasticOptimizer::new(10_000_000);
    let assets = vec![
        types::Asset {
            id: "bat-001".into(),
            capacity_kwh: 100.0,
            nominal_power_kw: 50.0,
            cycle_life: 6000,
            replacement_cost: 50_000.0,
            min_soc: 20.0,
            max_soc: 95.0,
        },
    ];

    let prices = opt.simulate_price_scenarios(0.35, 0.15, 96);
    let result = opt.optimize(&assets, &prices, types::Objective::Balanced);

    tracing::info!(
        "Optimization complete — {} scenarios, {} commands, profit=${:.2}",
        result.scenario_count,
        result.commands.len(),
        result.expected_profit,
    );
}

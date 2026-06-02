//! PDE Kernel — Tipos compartilhados

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: String,
    pub capacity_kwh: f64,
    pub nominal_power_kw: f64,
    pub cycle_life: u64,
    pub replacement_cost: f64,
    pub min_soc: f64,
    pub max_soc: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricePoint {
    pub timestamp_s: u64,
    pub price_per_kwh: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchCommand {
    pub asset_id: String,
    pub power_kw: f64,
    pub duration_s: u64,
    pub reason: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Objective {
    Profit,
    BatteryLife,
    GridStability,
    Balanced,
}

#[derive(Debug, Clone)]
pub struct OptimizationResult {
    pub commands: Vec<DispatchCommand>,
    pub expected_profit: f64,
    pub expected_degradation: f64,
    pub scenario_count: u64,
    pub execution_time_ms: f64,
}

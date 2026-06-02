use criterion::{black_box, criterion_group, criterion_main, Criterion};
use pde_kernel::optimizer::StochasticOptimizer;
use pde_kernel::types::{Asset, Objective};

fn bench_optimize(c: &mut Criterion) {
    let opt = StochasticOptimizer::new(10_000);
    let assets = vec![Asset {
        id: "bat-001".into(),
        capacity_kwh: 100.0,
        nominal_power_kw: 50.0,
        cycle_life: 6000,
        replacement_cost: 50_000.0,
        min_soc: 20.0,
        max_soc: 95.0,
    }];

    c.bench_function("optimize_10k_scenarios", |b| {
        b.iter(|| {
            let prices = opt.simulate_price_scenarios(0.35, 0.15, 48);
            let result = opt.optimize(black_box(&assets), black_box(&prices), Objective::Balanced);
            black_box(result)
        })
    });
}

criterion_group!(benches, bench_optimize);
criterion_main!(benches);

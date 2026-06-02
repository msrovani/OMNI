use omni_box_fw::*;
use omni_box_fw::shadow::{ShadowEngine, ShadowCommand};
use omni_box_fw::safety::{GridSafetyCheck, SafetyStatus};

// ─── Lifecycle ───

#[test]
fn test_full_lifecycle_commissioning_to_normal() {
    let mut fw = OmniBoxFirmware::new(0x4F4D);
    assert_eq!(fw.mode, DeviceMode::Commissioning);
    fw.mode = DeviceMode::Normal;
    let r = fw.tick(1.0);
    assert_eq!(r.mode, DeviceMode::Normal);
}

#[test]
fn test_shadow_activates_on_grid_loss_and_persists() {
    let mut fw = OmniBoxFirmware::new(1);
    fw.mode = DeviceMode::Normal;
    fw.grid_connected = false;
    let r = fw.tick(1.0);
    assert_eq!(r.mode, DeviceMode::ShadowAutonomous);
    assert!(r.shadow_active);

    // Once shadow, stays shadow until explicitly cleared
    fw.grid_connected = true;
    let r = fw.tick(1.0);
    assert_eq!(r.mode, DeviceMode::ShadowAutonomous);
}

#[test]
fn test_soc_bounds_after_multiple_ticks() {
    let mut fw = OmniBoxFirmware::new(1);
    fw.mode = DeviceMode::Normal;
    for _ in 0..1000 {
        fw.tick(0.1);
    }
    assert!(fw.soc >= 0.0 && fw.soc <= 100.0);
}

// ─── Dispatch ───

#[test]
fn test_dispatch_increments_count() {
    let mut fw = OmniBoxFirmware::new(1);
    fw.mode = DeviceMode::Normal;
    fw.soc = 80.0;
    let cmd = DispatchCommand { asset_id: 1, power_kw: 25.0, duration_s: 3600, reason: DispatchReason::PeakShave };
    assert!(fw.apply_dispatch(&cmd).is_ok());
    assert_eq!(fw.dispatch_count, 1);
}

#[test]
fn test_multiple_dispatches_affect_soh() {
    let mut fw = OmniBoxFirmware::new(1);
    fw.mode = DeviceMode::Normal;
    fw.soc = 80.0;
    let initial_soh = fw.soh;
    for _ in 0..10 {
        let cmd = DispatchCommand { asset_id: 1, power_kw: 10.0, duration_s: 3600, reason: DispatchReason::Arbitrage };
        fw.apply_dispatch(&cmd).unwrap();
    }
    assert!(fw.soh < initial_soh);
    assert_eq!(fw.dispatch_count, 10);
}

#[test]
fn test_emergency_dispatch_rejected() {
    let mut fw = OmniBoxFirmware::new(1);
    fw.mode = DeviceMode::EmergencyStop;
    let cmd = DispatchCommand { asset_id: 1, power_kw: 10.0, duration_s: 3600, reason: DispatchReason::V2G };
    assert_eq!(fw.apply_dispatch(&cmd), Err(DispatchError::EmergencyStop));
}

#[test]
fn test_dispatch_power_above_max_rejected() {
    let mut fw = OmniBoxFirmware::new(1);
    fw.mode = DeviceMode::Normal;
    let cmd = DispatchCommand { asset_id: 1, power_kw: 9999.0, duration_s: 3600, reason: DispatchReason::Ancillary };
    assert_eq!(fw.apply_dispatch(&cmd), Err(DispatchError::PowerLimit(9999.0)));
}

// ─── Shadow Engine ───

#[test]
fn test_shadow_engine_min_soc_triggers_halt() {
    let mut engine = ShadowEngine::new(20.0, 50.0, true, 100.0, 0.5);
    let cmd = engine.evaluate(15.0, true, DeviceMode::Normal);
    assert_eq!(cmd, ShadowCommand::HaltDischarge);
}

#[test]
fn test_shadow_engine_normal_soc_no_action() {
    let mut engine = ShadowEngine::new(20.0, 50.0, true, 100.0, 0.5);
    let cmd = engine.evaluate(75.0, true, DeviceMode::Normal);
    assert_eq!(cmd, ShadowCommand::Normal);
}

#[test]
fn test_shadow_engine_grid_loss_disconnect() {
    let mut engine = ShadowEngine::new(20.0, 50.0, true, 100.0, 0.5);
    let cmd = engine.evaluate(50.0, false, DeviceMode::Normal);
    assert_eq!(cmd, ShadowCommand::DisconnectFromGrid);
}

#[test]
fn test_shadow_engine_critical_soc_emergency_charge() {
    let mut engine = ShadowEngine::new(20.0, 50.0, true, 100.0, 0.5);
    let cmd = engine.evaluate(5.0, true, DeviceMode::Normal);
    assert_eq!(cmd, ShadowCommand::EmergencyCharge);
}

#[test]
fn test_shadow_engine_recovers_after_soc_above_min() {
    let mut engine = ShadowEngine::new(20.0, 50.0, true, 100.0, 0.5);
    engine.evaluate(15.0, true, DeviceMode::Normal);
    let cmd = engine.evaluate(25.0, true, DeviceMode::Normal);
    assert_eq!(cmd, ShadowCommand::Normal);
}

#[test]
fn test_shadow_validate_dispatch_power_limit() {
    let engine = ShadowEngine::new(20.0, 50.0, true, 60.0, 0.5);
    assert!(engine.validate_dispatch(100.0, 80.0, true).is_err());
    assert!(engine.validate_dispatch(25.0, 80.0, true).is_ok());
}

#[test]
fn test_shadow_validate_dispatch_soc_limit() {
    let engine = ShadowEngine::new(20.0, 50.0, true, 60.0, 0.5);
    assert!(engine.validate_dispatch(25.0, 15.0, true).is_err());
    assert!(engine.validate_dispatch(25.0, 15.0, false).is_ok());
}

// ─── Safety ───

#[test]
fn test_safety_voltage_within_tolerance() {
    let safety = GridSafetyCheck::new(220.0, 60.0);
    assert_eq!(safety.evaluate(220.0, 60.0, 50.0), SafetyStatus::Normal);
}

#[test]
fn test_safety_undervoltage_trips() {
    let safety = GridSafetyCheck::new(220.0, 60.0);
    assert_eq!(safety.evaluate(150.0, 60.0, 50.0), SafetyStatus::Critical);
}

#[test]
fn test_safety_overvoltage_trips() {
    let safety = GridSafetyCheck::new(220.0, 60.0);
    assert_eq!(safety.evaluate(260.0, 60.0, 50.0), SafetyStatus::Critical);
}

#[test]
fn test_safety_frequency_out_of_range_warns() {
    let safety = GridSafetyCheck::new(220.0, 60.0);
    assert_eq!(safety.evaluate(220.0, 58.0, 50.0), SafetyStatus::Warning);
}

#[test]
fn test_safety_overcurrent_trips() {
    let safety = GridSafetyCheck::new(220.0, 60.0);
    assert_eq!(safety.evaluate(220.0, 60.0, 150.0), SafetyStatus::Critical);
}

#[test]
fn test_safety_current_just_below_limit() {
    let safety = GridSafetyCheck::new(220.0, 60.0);
    assert_eq!(safety.evaluate(220.0, 60.0, 99.0), SafetyStatus::Normal);
}

// ─── Protocol ───

#[test]
fn test_telemetry_snapshot_round_trip() {
    let snap = TelemetrySnapshot {
        device_id: 0x4F4D,
        timestamp_s: 12345,
        voltage_v: 220.0,
        current_a: 15.5,
        frequency_hz: 60.0,
        soc_percent: 73.2,
        soh_percent: 98.5,
        temperature_c: 28.3,
        power_w: 3410.0,
        is_grid_connected: true,
        mode: DeviceMode::Normal,
    };
    let json = serde_json::to_string(&snap).unwrap();
    let deser: TelemetrySnapshot = serde_json::from_str(&json).unwrap();
    assert_eq!(snap.device_id, deser.device_id);
    assert!((snap.soc_percent - deser.soc_percent).abs() < 0.001);
    assert_eq!(snap.mode, deser.mode);
}

#[test]
fn test_dispatch_command_round_trip() {
    let cmd = DispatchCommand { asset_id: 42, power_kw: 12.5, duration_s: 7200, reason: DispatchReason::PeakShave };
    let json = serde_json::to_string(&cmd).unwrap();
    let deser: DispatchCommand = serde_json::from_str(&json).unwrap();
    assert_eq!(cmd.asset_id, deser.asset_id);
    assert_eq!(cmd.reason, deser.reason);
}

#[test]
fn test_dispatch_reason_variants() {
    let reasons = vec![
        DispatchReason::Arbitrage,
        DispatchReason::PeakShave,
        DispatchReason::Ancillary,
        DispatchReason::V2G,
        DispatchReason::Emergency,
    ];
    for r in &reasons {
        let json = serde_json::to_string(r).unwrap();
        let deser: DispatchReason = serde_json::from_str(&json).unwrap();
        assert_eq!(*r, deser);
    }
}

// ─── Firmware utilities ───

#[test]
fn test_power_from_soc_linear() {
    let mut fw = OmniBoxFirmware::new(1);
    fw.soc = 100.0;
    let p100 = fw.power_from_soc();
    fw.soc = 50.0;
    let p50 = fw.power_from_soc();
    assert!((p100 - p50 * 2.0).abs() < 0.001);
}

#[test]
fn test_estimate_current_positive() {
    let mut fw = OmniBoxFirmware::new(1);
    fw.soc = 100.0;
    let i = fw.estimate_current();
    assert!(i > 0.0);
}

#[test]
fn test_uptime_increases_with_ticks() {
    let mut fw = OmniBoxFirmware::new(1);
    assert_eq!(fw.uptime_s, 0);
    fw.tick(5.0);
    assert_eq!(fw.uptime_s, 5);
    fw.tick(3.0);
    assert_eq!(fw.uptime_s, 8);
}

#[test]
fn test_error_count_increments_on_shadow_transition() {
    let mut fw = OmniBoxFirmware::new(1);
    fw.mode = DeviceMode::Normal;
    fw.grid_connected = false;
    fw.tick(1.0);
    assert_eq!(fw.error_count, 1);
}

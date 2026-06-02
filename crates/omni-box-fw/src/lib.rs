//! Omni-Box Firmware — Biblioteca principal
//!
//! Compila como:
//!   - Shared library (.so) para Android NDK (cdylib)
//!   - Static library para ESP32 / Cortex-M (lib)
//!   - Binário standalone para testes em x86_64
//!
//! Uso cross-compilation:
//!   cargo ndk -t arm64-v8a -o ../../edge/android-app/app/src/main/jniLibs build --release
//!   cargo build --target thumbv7em-none-eabi --features no_std --release

#![cfg_attr(feature = "no_std", no_std)]

use core::cmp::Ordering;
use serde::{Deserialize, Serialize};

pub mod shadow;
pub mod protocol;
pub mod safety;
pub mod drivers;

#[cfg(target_os = "android")]
pub mod jni_bridge;

// ─── Core Types ───

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum DeviceMode {
    Normal,
    ShadowAutonomous,
    EmergencyStop,
    Commissioning,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct TelemetrySnapshot {
    pub device_id: u32,
    pub timestamp_s: u64,
    pub voltage_v: f32,
    pub current_a: f32,
    pub frequency_hz: f32,
    pub soc_percent: f32,
    pub soh_percent: f32,
    pub temperature_c: f32,
    pub power_w: f32,
    pub is_grid_connected: bool,
    pub mode: DeviceMode,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct DispatchCommand {
    pub asset_id: u32,
    pub power_kw: f32,
    pub duration_s: u32,
    pub reason: DispatchReason,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum DispatchReason {
    Arbitrage,
    PeakShave,
    Ancillary,
    V2G,
    Emergency,
}

// ─── Firmware State Machine ───

pub struct OmniBoxFirmware {
    pub device_id: u32,
    pub mode: DeviceMode,
    pub soc: f32,
    pub soh: f32,
    pub grid_connected: bool,
    pub shadow: shadow::ShadowEngine,
    pub uptime_s: u64,
    pub dispatch_count: u32,
    pub error_count: u32,
}

impl OmniBoxFirmware {
    pub fn new(device_id: u32) -> Self {
        Self {
            device_id,
            mode: DeviceMode::Commissioning,
            soc: 50.0,
            soh: 100.0,
            grid_connected: true,
            shadow: shadow::ShadowEngine::new(
                20.0, 50.0, true, 60.0, 0.5,
            ),
            uptime_s: 0,
            dispatch_count: 0,
            error_count: 0,
        }
    }

    pub fn tick(&mut self, dt_s: f32) -> TickResult {
        self.uptime_s += dt_s as u64;
        if !self.grid_connected && self.mode != DeviceMode::ShadowAutonomous {
            self.mode = DeviceMode::ShadowAutonomous;
            self.error_count += 1;
        }
        let shadow_cmd = self.shadow.evaluate(self.soc, self.grid_connected, self.mode);
        match shadow_cmd {
            shadow::ShadowCommand::Normal => {}
            shadow::ShadowCommand::HaltDischarge => {
                self.mode = DeviceMode::EmergencyStop;
            }
            shadow::ShadowCommand::DisconnectFromGrid => {
                self.mode = DeviceMode::EmergencyStop;
                self.grid_connected = false;
            }
            shadow::ShadowCommand::EmergencyCharge => {}
        }
        TickResult {
            mode: self.mode,
            soc: self.soc,
            grid_connected: self.grid_connected,
            shadow_active: self.mode == DeviceMode::ShadowAutonomous,
        }
    }

    pub fn apply_dispatch(&mut self, cmd: &DispatchCommand) -> Result<(), DispatchError> {
        if self.mode == DeviceMode::EmergencyStop {
            return Err(DispatchError::EmergencyStop);
        }
        if cmd.power_kw > self.shadow.max_power_kw {
            return Err(DispatchError::PowerLimit(cmd.power_kw));
        }
        if cmd.reason == DispatchReason::Arbitrage && self.soc <= self.shadow.min_soc {
            return Err(DispatchError::SocTooLow(self.soc));
        }
        self.dispatch_count += 1;
        self.soh = (self.soh - 0.001 * (cmd.duration_s as f32 / 3600.0)).max(80.0);
        Ok(())
    }

    pub fn power_from_soc(&self) -> f32 {
        (self.soc / 100.0) * self.shadow.max_power_kw * 1000.0
    }

    pub fn estimate_current(&self) -> f32 {
        self.power_from_soc() / 220.0
    }
}

#[derive(Debug)]
pub struct TickResult {
    pub mode: DeviceMode,
    pub soc: f32,
    pub grid_connected: bool,
    pub shadow_active: bool,
}

#[derive(Debug, PartialEq)]
pub enum DispatchError {
    EmergencyStop,
    PowerLimit(f32),
    SocTooLow(f32),
    NotConnected,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_firmware_starts_in_commissioning() {
        let fw = OmniBoxFirmware::new(1);
        assert_eq!(fw.mode, DeviceMode::Commissioning);
    }

    #[test]
    fn test_shadow_activates_on_grid_loss() {
        let mut fw = OmniBoxFirmware::new(1);
        fw.mode = DeviceMode::Normal;
        fw.grid_connected = false;
        let result = fw.tick(0.1);
        assert_eq!(result.mode, DeviceMode::ShadowAutonomous);
        assert!(result.shadow_active);
    }

    #[test]
    fn test_dispatch_rejected_in_emergency() {
        let mut fw = OmniBoxFirmware::new(1);
        fw.mode = DeviceMode::EmergencyStop;
        let cmd = DispatchCommand {
            asset_id: 1, power_kw: 10.0, duration_s: 3600, reason: DispatchReason::Arbitrage,
        };
        assert_eq!(fw.apply_dispatch(&cmd), Err(DispatchError::EmergencyStop));
    }

    #[test]
    fn test_dispatch_rejected_when_soc_too_low() {
        let mut fw = OmniBoxFirmware::new(1);
        fw.mode = DeviceMode::Normal;
        fw.soc = 5.0;
        let cmd = DispatchCommand {
            asset_id: 1, power_kw: 50.0, duration_s: 3600, reason: DispatchReason::PeakShave,
        };
        assert_eq!(fw.apply_dispatch(&cmd), Err(DispatchError::SocTooLow(5.0)));
    }

    #[test]
    fn test_dispatch_rejected_when_power_exceeds_limit() {
        let mut fw = OmniBoxFirmware::new(1);
        fw.mode = DeviceMode::Normal;
        fw.soc = 80.0;
        let cmd = DispatchCommand {
            asset_id: 1, power_kw: 999.0, duration_s: 3600, reason: DispatchReason::Arbitrage,
        };
        assert_eq!(fw.apply_dispatch(&cmd), Err(DispatchError::PowerLimit(999.0)));
    }

    #[test]
    fn test_normal_dispatch_accepted() {
        let mut fw = OmniBoxFirmware::new(1);
        fw.mode = DeviceMode::Normal;
        fw.soc = 80.0;
        let cmd = DispatchCommand {
            asset_id: 1, power_kw: 25.0, duration_s: 3600, reason: DispatchReason::Arbitrage,
        };
        assert!(fw.apply_dispatch(&cmd).is_ok());
        assert_eq!(fw.dispatch_count, 1);
    }

    #[test]
    fn test_estimate_current() {
        let fw = OmniBoxFirmware::new(1);
        let i = fw.estimate_current();
        assert!(i > 0.0);
    }
}

//! JNI Bridge — Android NDK entry point
//!
//! Compiles to libomni_box_fw.so for aarch64-linux-android / armv7-linux-androideabi.
//! Called from Kotlin via System.loadLibrary("omni_box_fw").
//!
//! Cross-compile:
//!   cargo build --target aarch64-linux-android --release
//!   cargo build --target armv7-linux-androideabi --release
//!
//! Prereqs:
//!   rustup target add aarch64-linux-android armv7-linux-androideabi
//!   cargo install cargo-ndk
//!   cargo ndk -t arm64-v8a -o ../android-app/app/src/main/jniLibs build --release

#![cfg(target_os = "android")]

use jni::objects::{JClass, JString, JValue};
use jni::sys::{jfloat, jint, jlong, jboolean, jstring};
use jni::JNIEnv;

use crate::{DeviceMode, OmniBoxFirmware, DispatchCommand, DispatchReason, TelemetrySnapshot};

// ─── Global singleton — one OmniBox instance per process ───

use std::sync::Mutex;
use std::ptr::addr_of_mut;

static mut FW: Mutex<Option<OmniBoxFirmware>> = Mutex::new(None);

fn with_fw<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&mut OmniBoxFirmware) -> R,
{
    unsafe {
        let mut guard = FW.lock().map_err(|e| e.to_string())?;
        let fw = guard.as_mut().ok_or("OmniBoxFirmware not initialised")?;
        Ok(f(fw))
    }
}

// ─── Exported JNI functions ───

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_init(
    mut env: JNIEnv,
    _class: JClass,
    device_id: jint,
) -> jboolean {
    let fw = OmniBoxFirmware::new(device_id as u32);
    unsafe {
        let mut guard = FW.lock().unwrap();
        *guard = Some(fw);
    }
    1
}

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_tick(
    mut env: JNIEnv,
    _class: JClass,
    dt_s: jfloat,
) -> jboolean {
    with_fw(|fw| {
        let result = fw.tick(dt_s as f32);
        // Result is communicated back via getter methods
    }).is_ok() as jboolean
}

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_getMode(
    mut env: JNIEnv,
    _class: JClass,
) -> jint {
    with_fw(|fw| match fw.mode {
        DeviceMode::Normal => 0,
        DeviceMode::ShadowAutonomous => 1,
        DeviceMode::EmergencyStop => 2,
        DeviceMode::Commissioning => 3,
    }).unwrap_or(3) // Commissioning if error
}

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_getSoc(
    mut env: JNIEnv,
    _class: JClass,
) -> jfloat {
    with_fw(|fw| fw.soc).unwrap_or(0.0)
}

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_getSoh(
    mut env: JNIEnv,
    _class: JClass,
) -> jfloat {
    with_fw(|fw| fw.soh).unwrap_or(100.0)
}

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_isGridConnected(
    mut env: JNIEnv,
    _class: JClass,
) -> jboolean {
    (with_fw(|fw| fw.grid_connected).unwrap_or(false)) as jboolean
}

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_setGridConnected(
    mut env: JNIEnv,
    _class: JClass,
    connected: jboolean,
) {
    let _ = with_fw(|fw| {
        fw.grid_connected = connected != 0;
    });
}

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_setSoC(
    mut env: JNIEnv,
    _class: JClass,
    soc: jfloat,
) {
    let _ = with_fw(|fw| {
        fw.soc = soc;
    });
}

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_applyDispatch(
    mut env: JNIEnv,
    _class: JClass,
    asset_id: jint,
    power_kw: jfloat,
    duration_s: jint,
    reason: jint,
) -> jint {
    let reason_enum = match reason {
        0 => DispatchReason::Arbitrage,
        1 => DispatchReason::PeakShave,
        2 => DispatchReason::Ancillary,
        3 => DispatchReason::V2G,
        4 => DispatchReason::Emergency,
        _ => DispatchReason::Arbitrage,
    };
    let cmd = DispatchCommand {
        asset_id: asset_id as u32,
        power_kw,
        duration_s: duration_s as u32,
        reason: reason_enum,
    };
    with_fw(|fw| match fw.apply_dispatch(&cmd) {
        Ok(()) => 0i32,
        Err(crate::DispatchError::EmergencyStop) => -1,
        Err(crate::DispatchError::PowerLimit(p)) => -2,
        Err(crate::DispatchError::SocTooLow(s)) => -3,
        Err(crate::DispatchError::NotConnected) => -4,
    }).unwrap_or(-99)
}

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_getUptime(
    mut env: JNIEnv,
    _class: JClass,
) -> jlong {
    with_fw(|fw| fw.uptime_s as i64).unwrap_or(0)
}

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_getDispatchCount(
    mut env: JNIEnv,
    _class: JClass,
) -> jint {
    with_fw(|fw| fw.dispatch_count as i32).unwrap_or(0)
}

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_getErrorCount(
    mut env: JNIEnv,
    _class: JClass,
) -> jint {
    with_fw(|fw| fw.error_count as i32).unwrap_or(0)
}

// ─── Telemetry JSON export ───

#[no_mangle]
pub extern "system" fn Java_com_omnigrid_omnibox_OmniBoxNative_getTelemetryJson(
    mut env: JNIEnv,
    _class: JClass,
) -> jstring {
    let json = with_fw(|fw| {
        let snapshot = TelemetrySnapshot {
            device_id: fw.device_id,
            timestamp_s: fw.uptime_s,
            voltage_v: 220.0,       // would come from ADC in real firmware
            current_a: fw.estimate_current(),
            frequency_hz: 60.0,
            soc_percent: fw.soc,
            soh_percent: fw.soh,
            temperature_c: 28.0,
            power_w: fw.power_from_soc(),
            is_grid_connected: fw.grid_connected,
            mode: fw.mode,
        };
        serde_json::to_string(&snapshot).unwrap_or_else(|_| "{}".to_string())
    }).unwrap_or_else(|| "{}".to_string());

    env.new_string(&json)
        .expect("Failed to create Java string")
        .into_raw()
}

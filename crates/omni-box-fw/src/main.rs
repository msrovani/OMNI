//! Omni-Box Firmware — Entry point (standalone binary)
//!
//! For embedded targets (no_std), this is replaced by target-specific
//! startup code (cortex-m-rt, ESP-IDF, etc.).
//! For Android NDK, the entry point is jni_bridge.rs (JNI_OnLoad).

#![cfg(not(feature = "no_std"))]

fn main() {
    println!("Omni-Box Firmware v{}", env!("CARGO_PKG_VERSION"));
    println!("Running as standalone binary (x86_64 testing).");
    println!("For Android: compile with cargo-ndk for arm64-v8a target.");
    println!("For ESP32: compile with --target xtensa-esp32-espidf --features no_std.");
}

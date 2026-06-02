package com.omnigrid.omnibox

/**
 * JNI bridge to libomni_box_fw.so (Rust firmware).
 *
 * Build native library:
 *   cargo ndk -t arm64-v8a -o app/src/main/jniLibs build --release
 */
class OmniBoxNative(private val deviceId: Int) {

    companion object {
        init {
            System.loadLibrary("omni_box_fw")
        }
    }

    /** Initialise firmware state machine */
    external fun init(deviceId: Int): Boolean
    fun init() = init(deviceId)

    /** Advance one tick (dt in seconds) */
    external fun tick(dt_s: Float): Boolean

    /** Current device mode: 0=Normal, 1=Shadow, 2=Emergency, 3=Commissioning */
    external fun getMode(): Int

    /** State of Charge 0–100% */
    external fun getSoc(): Float

    /** State of Health 0–100% */
    external fun getSoh(): Float

    /** Is grid connected? */
    external fun isGridConnected(): Boolean

    /** Set grid connection state */
    external fun setGridConnected(connected: Boolean)

    /** Set SoC (from BMS reading) */
    external fun setSoC(soc: Float)

    /** Apply dispatch command. Returns 0=OK, negative=error code */
    external fun applyDispatch(assetId: Int, powerKw: Float, durationS: Int, reason: Int): Int

    /** Uptime in seconds */
    external fun getUptime(): Long

    /** Number of dispatches executed */
    external fun getDispatchCount(): Int

    /** Number of errors logged */
    external fun getErrorCount(): Int

    /** Get full telemetry as JSON string */
    external fun getTelemetryJson(): String

    // ─── Kotlin-friendly wrappers ───

    val mode: DeviceMode get() = DeviceMode.fromCode(getMode())
    val soc: Float get() = getSoc()
    val soh: Float get() = getSoh()
    val gridConnected: Boolean get() = isGridConnected()
    val uptimeSeconds: Long get() = getUptime()
    val dispatchCount: Int get() = getDispatchCount()
    val errorCount: Int get() = getErrorCount()
    val telemetryJson: String get() = getTelemetryJson()
}

enum class DeviceMode(val code: Int, val displayName: String) {
    Normal(0, "Normal"),
    ShadowAutonomous(1, "Sombra"),
    EmergencyStop(2, "Emergência"),
    Commissioning(3, "Comissionamento");

    companion object {
        fun fromCode(code: Int) = entries.firstOrNull { it.code == code } ?: Commissioning
    }
}

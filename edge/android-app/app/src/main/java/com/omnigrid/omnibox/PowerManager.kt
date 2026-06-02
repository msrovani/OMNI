package com.omnigrid.omnibox

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.util.Log

enum class PowerProfile(val displayName: String, val pollIntervalMs: Long, val enableCloud: Boolean, val enableBle: Boolean, val enableUsb: Boolean, val enableScreen: Boolean) {
    Performance("Performance", 5000, true, true, true, true),
    Balanced("Balanced", 15000, true, false, true, false),
    PowerSave("Economia", 60000, false, false, true, false),
    Critical("Crítico", 300000, false, false, false, false),
}

class PowerManager(private val context: Context) {
    private var currentProfile: PowerProfile = PowerProfile.Balanced
    private var batteryPct: Int = 50
    private var isCharging: Boolean = false
    private var listener: ((PowerProfile) -> Unit)? = null

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctxt: Context, intent: Intent) {
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)

            isCharging = plugged != 0
            if (level >= 0 && scale > 0) {
                batteryPct = level * 100 / scale
            }
            updateProfile()
        }
    }

    fun init(callback: ((PowerProfile) -> Unit)? = null) {
        listener = callback
        val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        context.registerReceiver(batteryReceiver, filter)
    }

    private fun updateProfile() {
        val old = currentProfile
        currentProfile = when {
            isCharging -> PowerProfile.Performance
            batteryPct >= 50 -> PowerProfile.Balanced
            batteryPct >= 20 -> PowerProfile.PowerSave
            else -> PowerProfile.Critical
        }
        if (old != currentProfile) {
            Log.i(TAG, "Battery: ${batteryPct}% charging=$isCharging -> ${currentProfile.displayName}")
            listener?.invoke(currentProfile)
        }
    }

    fun getProfile(): PowerProfile = currentProfile
    fun getBatteryPercent(): Int = batteryPct
    fun isDeviceCharging(): Boolean = isCharging

    fun shutdown() {
        try { context.unregisterReceiver(batteryReceiver) } catch (_: Exception) {}
    }

    companion object {
        private const val TAG = "OmniBoxPower"
    }
}

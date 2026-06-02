package com.omnigrid.omnibox

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.UserManager
import android.util.Log
import android.widget.Toast

class DevicePolicyController(private val context: Context) {
    private val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val adminComponent = ComponentName(context, OmniBoxAdminReceiver::class.java)

    val isDeviceOwner: Boolean
        get() = dpm.isDeviceOwnerApp(context.packageName)

    val isLockTaskPermitted: Boolean
        get() = dpm.isLockTaskPermitted(context.packageName)

    fun setKioskPackages(vararg packages: String) {
        if (!isDeviceOwner) return
        try {
            dpm.setLockTaskPackages(adminComponent, packages)
            Log.i(TAG, "Kiosk packages set: ${packages.joinToString()}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set kiosk packages", e)
        }
    }

    fun startLockTask(activity: android.app.Activity) {
        if (isDeviceOwner) {
            activity.startLockTask()
            Log.i(TAG, "Lock task started")
        }
    }

    fun stopLockTask(activity: android.app.Activity) {
        try {
            activity.stopLockTask()
        } catch (_: Exception) {}
    }

    fun lockScreen() {
        if (isDeviceOwner) {
            dpm.lockNow()
        }
    }

    fun wipeDevice(flags: Int = DevicePolicyManager.WIPE_EXTERNAL_STORAGE) {
        if (isDeviceOwner) {
            dpm.wipeData(flags)
        }
    }

    fun disableCamera(disabled: Boolean) {
        if (!isDeviceOwner) return
        dpm.setCameraDisabled(adminComponent, disabled)
    }

    fun setKeyguardDisabled(disabled: Boolean) {
        if (!isDeviceOwner) return
        dpm.setKeyguardDisabled(adminComponent, disabled)
    }

    fun setStatusBarDisabled(disabled: Boolean) {
        if (!isDeviceOwner) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            dpm.setStatusBarDisabled(adminComponent, disabled)
        }
    }

    // ─── Admin Receiver ───

    class OmniBoxAdminReceiver : DeviceAdminReceiver() {
        override fun onEnabled(context: Context, intent: Intent) {
            Log.i(TAG, "Device admin enabled")
        }
        override fun onDisabled(context: Context, intent: Intent) {
            Log.i(TAG, "Device admin disabled")
        }
        override fun onLockTaskModeEntering(context: Context, intent: Intent, pin: String) {
            Log.i(TAG, "Kiosk mode entered: $pin")
        }
        override fun onLockTaskModeExiting(context: Context, intent: Intent) {
            Log.i(TAG, "Kiosk mode exited")
        }
    }

    companion object {
        private const val TAG = "OmniBoxDPC"
    }
}

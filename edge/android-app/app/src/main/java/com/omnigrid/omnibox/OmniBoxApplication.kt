package com.omnigrid.omnibox

import android.app.Application
import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.os.Build
import android.util.Log

class OmniBoxApplication : Application() {
    lateinit var nativeBridge: OmniBoxNative
        private set
    lateinit var connectionManager: ConnectionManager
        private set

    override fun onCreate() {
        super.onCreate()
        nativeBridge = OmniBoxNative(deviceId = 0x4F4D4E49)
        nativeBridge.init()
        connectionManager = ConnectionManager(this)
        connectionManager.init(nativeBridge)
        schedulePeriodicJob()
        Log.i(TAG, "Omni-Box Native Bridge initialised, device=0x${nativeBridge.deviceId.toString(16)}")
    }

    private fun schedulePeriodicJob() {
        val scheduler = getSystemService(JOB_SCHEDULER_SERVICE) as? JobScheduler ?: return
        val existing = scheduler.allPendingJobs.any { it.id == TelemetryJobService.JOB_ID }
        if (existing) return

        val job = JobInfo.Builder(
            TelemetryJobService.JOB_ID,
            ComponentName(this, TelemetryJobService::class.java)
        ).apply {
            setPeriodic(TelemetryJobService.INTERVAL_MS)
            setPersisted(true)
            setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                setRequiresBatteryNotLow(false)
            }
        }.build()

        if (scheduler.schedule(job) == JobScheduler.RESULT_SUCCESS) {
            Log.i(TAG, "Periodic job scheduled every 15min")
        } else {
            Log.w(TAG, "Job schedule failed")
        }
    }

    companion object {
        private const val TAG = "OmniBoxApp"
    }
}

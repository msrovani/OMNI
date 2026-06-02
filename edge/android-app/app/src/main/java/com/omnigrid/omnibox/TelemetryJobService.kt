package com.omnigrid.omnibox

import android.app.job.JobParameters
import android.app.job.JobService
import android.os.Build
import android.util.Log
import kotlinx.coroutines.*

class TelemetryJobService : JobService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var job: Job? = null

    override fun onStartJob(params: JobParameters): Boolean {
        Log.d(TAG, "Job started (periodic wake-up)")
        job = scope.launch {
            try {
                val app = application as OmniBoxApplication
                val native = app.nativeBridge
                native.tick(5.0f)
                val json = native.telemetryJson
                val db = TelemetryDatabase(this@TelemetryJobService)
                db.enqueueTelemetry(json)
                Log.i(TAG, "Job: telemetry captured, queue=${db.getQueueSize()}")
            } catch (e: Exception) {
                Log.e(TAG, "Job failed", e)
            } finally {
                jobFinished(params, false)
            }
        }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        job?.cancel()
        return true
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "OmniBoxJob"
        const val JOB_ID = 0x4F4D
        const val INTERVAL_MS = 15 * 60 * 1000L // 15 min
    }
}

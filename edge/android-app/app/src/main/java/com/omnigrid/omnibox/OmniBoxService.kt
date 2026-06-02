package com.omnigrid.omnibox

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import kotlinx.coroutines.*

class OmniBoxService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())

        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "OmniBox:TelemetryLock")
        wakeLock?.acquire(30 * 60 * 1000L)

        Log.i(TAG, "Omni-Box Service started")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        scope.launch { telemetryLoop() }
        return START_STICKY
    }

    private suspend fun telemetryLoop() {
        val app = application as OmniBoxApplication
        val native = app.nativeBridge
        val conn = app.connectionManager

        while (isActive) {
            try {
                native.tick(5.0f)

                val transport = conn.getActiveTransport()
                if (transport == Transport.None) {
                    delay(30000)
                    continue
                }

                updateNotification(native, transport)
            } catch (e: Exception) {
                Log.e(TAG, "Telemetry loop error", e)
            }
            delay(5000)
        }
    }

    private fun updateNotification(native: OmniBoxNative, transport: Transport) {
        val notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Omni-Box [${transport.displayName}]")
            .setContentText("SoC: ${"%.1f".format(native.soc)}% | ${native.dispatchCount} dispatches")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build()
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIFICATION_ID, notification)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        wakeLock?.release()
        (application as OmniBoxApplication).connectionManager.shutdown()
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Omni-Box Telemetry",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Telemetria do Omni-Box embarcado"
                setShowBadge(false)
            }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Omni-Box Ativo")
            .setContentText("Coletando telemetria...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "OmniBoxService"
        private const val CHANNEL_ID = "omni_box_telemetry"
        private const val NOTIFICATION_ID = 1001
    }
}

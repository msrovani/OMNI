package com.omnigrid.omnibox

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Serviço FCM para notificações push.
 *
 * Recebe mensagens do Firebase Cloud Messaging:
 *   - dispatch: novo comando de despacho
 *   - alert: alerta de segurança/modoperação
 *   - ota: atualização de firmware disponível
 *   - info: informação geral
 *
 * Manifest requerido (já adicionado no AndroidManifest.xml):
 *   <service android:name=".OmniBoxFcmService"
 *            android:exported="false">
 *     <intent-filter>
 *       <action android:name="com.google.firebase.MESSAGING_EVENT"/>
 *     </intent-filter>
 *   </service>
 *
 * Dependência (adicionar no build.gradle.kts):
 *   implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
 *   implementation("com.google.firebase:firebase-messaging-ktx")
 *   implementation("com.google.firebase:firebase-analytics")
 *   implementation("com.google.firebase:firebase-crashlytics")
 */

class OmniBoxFcmService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "OmniBoxFCM"
        private const val CHANNEL_ID = "omni_box_push"
        private const val CHANNEL_NAME = "Omni-Box Notificações"
        private const val CHANNEL_DESC = "Notificações push do sistema Omni-Box"
        private const val NOTIFICATION_ID_BASE = 2000

        /** Envia token FCM para o backend */
        fun sendTokenToServer(context: Context, token: String) {
            Log.i(TAG, "FCM token registrado no backend: ${token.take(16)}...")
            // Em produção: enviar via CloudClient para /api/v1/devices/{id}/fcm-token
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.i(TAG, "Novo FCM token: ${token.take(16)}...")
        sendTokenToServer(this, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        val type = data["type"] ?: "info"
        val title = data["title"] ?: "Omni-Box"
        val body = data["body"] ?: "Notificação do sistema"

        Log.d(TAG, "FCM: type=$type title=$title body=$body")

        createNotificationChannel()

        when (type) {
            "dispatch" -> showDispatchNotification(title, body, data)
            "alert" -> showAlertNotification(title, body)
            "ota" -> showOtaNotification(title, body, data["url"] ?: "")
            else -> showInfoNotification(title, body)
        }
    }

    private fun showDispatchNotification(title: String, body: String, data: Map<String, String>) {
        val intent = Intent(this, KioskActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("fcm_dispatch", true)
            putExtra("asset_id", data["asset_id"]?.toIntOrNull() ?: 0)
            putExtra("power_kw", data["power_kw"]?.toFloatOrNull() ?: 0f)
            putExtra("duration_s", data["duration_s"]?.toIntOrNull() ?: 3600)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .build()

        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID_BASE + 1, notification)
    }

    private fun showAlertNotification(title: String, body: String) {
        val intent = Intent(this, KioskActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 1, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("⚠ $title")
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_ERROR)
            .setVibrate(longArrayOf(0, 500, 200, 500))
            .build()

        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID_BASE + 2, notification)
    }

    private fun showOtaNotification(title: String, body: String, url: String) {
        // Abre Intent para OTA
        val intent = Intent(this, OmniBoxService::class.java).apply {
            putExtra("ota_url", url)
        }
        val pendingIntent = PendingIntent.getService(
            this, 2, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_upload)
            .setContentTitle("⬇ $title")
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setProgress(0, 0, true) // indeterminate
            .build()

        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID_BASE + 3, notification)
    }

    private fun showInfoNotification(title: String, body: String) {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setAutoCancel(true)
            .build()

        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID_BASE, notification)
    }

    private fun createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = CHANNEL_DESC
                enableVibration(true)
                setShowBadge(true)
            }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }
}

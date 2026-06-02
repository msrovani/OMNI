package com.omnigrid.omnibox

import android.content.Context
import android.net.wifi.WifiManager
import android.util.Log
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.InetAddress
import java.net.Socket
import java.util.concurrent.TimeUnit

/**
 * WiFi direct client for ESP32 co-processor.
 *
 * Connects to the ESP32's WiFi AP ("Omni-Box-AP") and communicates
 * via its REST API (telemetry, dispatch) or TCP socket.
 *
 * Falls back through:
 *   1. Try to find ESP32 on current LAN (mDNS / IP scan / configured IP)
 *   2. Connect to "Omni-Box-AP" WiFi network
 *   3. Direct TCP to 192.168.4.1 (default ESP32 AP IP)
 */
class LocalEsp32Client(private val context: Context) {
    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private var baseUrl = "http://192.168.4.1" // default ESP32 AP IP
    private var connected = false

    companion object {
        private const val TAG = "OmniBoxWiFi"
        private const val ESP_AP_SSID = "Omni-Box-AP"
        private const val ESP_AP_IP = "192.168.4.1"
        private const val MDNS_HOST = "omni-box.local"
    }

    data class Esp32Telemetry(
        @SerializedName("device_id") val deviceId: Long = 0,
        val uptime: Long = 0,
        val voltage: Float = 0f,
        val current: Float = 0f,
        val frequency: Float = 0f,
        val soc: Float = 50f,
        val temperature: Float = 25f,
        val power: Float = 0f,
        val grid: Boolean = true,
        val safety: Int = 0,
    )

    /**
     * Discover and connect to ESP32 via WiFi.
     * Returns true if we can reach it.
     */
    suspend fun connect(): Boolean = withContext(Dispatchers.IO) {
        val wifi = context.getSystemService(Context.WIFI_SERVICE) as WifiManager

        // Strategy 1: already on ESP32's AP network
        val ssid = wifi.connectionInfo?.ssid?.trim('"') ?: ""
        if (ssid == ESP_AP_SSID) {
            baseUrl = "http://$ESP_AP_IP"
            if (healthCheck()) {
                connected = true
                Log.i(TAG, "Connected via ESP32 AP: $baseUrl")
                return@withContext true
            }
        }

        // Strategy 2: try via mDNS on current network
        try {
            val addr = InetAddress.getByName(MDNS_HOST)
            baseUrl = "http://${addr.hostAddress}"
            if (healthCheck()) {
                connected = true
                Log.i(TAG, "Connected via mDNS: $baseUrl")
                return@withContext true
            }
        } catch (_: Exception) {}

        // Strategy 3: connect to ESP32 AP
        try {
            val netId = wifi.addNetwork(
                android.net.wifi.WifiConfiguration().apply {
                    SSID = "\"$ESP_AP_SSID\""
                    allowedKeyManagement.set(android.net.wifi.WifiConfiguration.KeyMgmt.NONE)
                }
            )
            if (netId >= 0) {
                wifi.disconnect()
                wifi.enableNetwork(netId, true)
                wifi.reconnect()
                // Wait for connection
                Thread.sleep(2000)
                baseUrl = "http://$ESP_AP_IP"
                if (healthCheck()) {
                    connected = true
                    Log.i(TAG, "Connected via ESP32 AP (new connect): $baseUrl")
                    return@withContext true
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "WiFi AP connect failed", e)
        }

        connected = false
        Log.w(TAG, "ESP32 not reachable via WiFi")
        false
    }

    /** Fetch latest telemetry from ESP32 REST API */
    suspend fun readTelemetry(): Esp32Telemetry? = withContext(Dispatchers.IO) {
        if (!connected) return@withContext null
        try {
            val request = Request.Builder()
                .url("$baseUrl/telemetry")
                .get()
                .build()
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return@withContext null
            val body = response.body?.string() ?: return@withContext null
            gson.fromJson(body, Esp32Telemetry::class.java)
        } catch (e: Exception) {
            Log.w(TAG, "Telemetry fetch failed", e)
            null
        }
    }

    /** Send dispatch command via REST API */
    suspend fun sendDispatch(assetId: Int, powerKw: Float, durationS: Int, reason: Int): Boolean {
        if (!connected) return false
        return withContext(Dispatchers.IO) {
            try {
                val payload = ByteBuffer.allocate(13).apply {
                    order(java.nio.ByteOrder.LITTLE_ENDIAN)
                    putInt(assetId)
                    putFloat(powerKw)
                    putInt(durationS)
                    put(reason.toByte())
                }.array()

                val request = Request.Builder()
                    .url("$baseUrl/dispatch")
                    .post(payload.toRequestBody("application/octet-stream".toMediaType()))
                    .build()
                val response = client.newCall(request).execute()
                response.isSuccessful
            } catch (e: Exception) {
                Log.e(TAG, "Dispatch failed via WiFi", e)
                false
            }
        }
    }

    private fun healthCheck(): Boolean {
        return try {
            val request = Request.Builder()
                .url("$baseUrl/health")
                .get()
                .build()
            val response = client.newCall(request).execute()
            response.isSuccessful
        } catch (e: Exception) {
            false
        }
    }

    fun isConnected(): Boolean = connected

    fun disconnect() {
        connected = false
        client.dispatcher.executorService.shutdown()
    }
}

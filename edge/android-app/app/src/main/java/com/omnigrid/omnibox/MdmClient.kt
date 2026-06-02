package com.omnigrid.omnibox

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.os.Build
import android.util.Log
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class MdmPolicy(
    val allowCamera: Boolean = true,
    val allowStatusBar: Boolean = false,
    val allowKeyguard: Boolean = false,
    val kioskPackages: List<String> = listOf(),
    val lockTaskEnabled: Boolean = true,
    val wifiConfig: MdmWifiConfig? = null,
    val updateIntervalMs: Long = 300000,
)

data class MdmWifiConfig(
    val ssid: String = "",
    val password: String = "",
    val isHidden: Boolean = false,
)

class MdmClient(private val context: Context) {
    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private var baseUrl = "https://mdm.omnigrid.local/api/v1"
    private var deviceId = ""

    fun init(deviceToken: String, mdmUrl: String? = null) {
        if (mdmUrl != null) baseUrl = mdmUrl
        deviceId = android.provider.Settings.Secure.getString(
            context.contentResolver, android.provider.Settings.Secure.ANDROID_ID
        )
        Log.i(TAG, "MDM client ready for device $deviceId")
    }

    fun fetchPolicy(): MdmPolicy? {
        val request = Request.Builder()
            .url("$baseUrl/devices/$deviceId/policy")
            .header("Accept", "application/json")
            .get()
            .build()

        return try {
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return null
            val body = response.body?.string() ?: return null
            gson.fromJson(body, MdmPolicy::class.java)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch MDM policy", e)
            null
        }
    }

    fun applyPolicy(policy: MdmPolicy, dpm: DevicePolicyManager, admin: ComponentName) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            dpm.setStatusBarDisabled(admin, !policy.allowStatusBar)
        }
        dpm.setKeyguardDisabled(admin, !policy.allowKeyguard)
        dpm.setCameraDisabled(admin, !policy.allowCamera)

        if (policy.kioskPackages.isNotEmpty()) {
            dpm.setLockTaskPackages(admin, policy.kioskPackages.toTypedArray())
        }

        if (policy.wifiConfig != null && policy.wifiConfig.ssid.isNotEmpty()) {
            configureWifi(policy.wifiConfig)
        }

        Log.i(TAG, "MDM policy applied: ${gson.toJson(policy)}")
    }

    fun reportHealth(status: String, soc: Float, transport: String) {
        val payload = gson.toJson(mapOf(
            "deviceId" to deviceId,
            "status" to status,
            "soc" to soc,
            "transport" to transport,
            "timestamp" to System.currentTimeMillis(),
        ))

        val request = Request.Builder()
            .url("$baseUrl/devices/$deviceId/health")
            .post(payload.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {}
            override fun onResponse(call: Call, response: Response) {
                response.close()
            }
        })
    }

    private fun configureWifi(config: MdmWifiConfig) {
        val wifi = context.getSystemService(Context.WIFI_SERVICE) as android.net.wifi.WifiManager
        val conf = android.net.wifi.WifiConfiguration().apply {
            SSID = "\"${config.ssid}\""
            preSharedKey = "\"${config.password}\""
            hiddenSSID = config.isHidden
            allowedKeyManagement.set(android.net.wifi.WifiConfiguration.KeyMgmt.WPA_PSK)
        }
        wifi.addNetwork(conf)
        wifi.saveConfiguration()
        wifi.reconnect()
        Log.i(TAG, "WiFi configured: ${config.ssid}")
    }

    companion object {
        private const val TAG = "OmniBoxMDM"
    }
}

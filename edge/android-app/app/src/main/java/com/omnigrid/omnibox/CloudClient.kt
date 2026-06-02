package com.omnigrid.omnibox

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.InputStream
import java.security.KeyStore
import java.security.SecureRandom
import java.security.cert.CertificateFactory
import java.util.concurrent.TimeUnit
import javax.net.ssl.*

/**
 * Cliente mTLS para o Omni-Cloud Edge Gateway.
 *
 * Usa certificados X.509:
 *   - ca.pem: CA raiz (trust store)
 *   - device.pem + device.key: cliente mTLS
 */
class CloudClient(private val context: Context) {
    private val gson = Gson()
    private var client: OkHttpClient? = null
    private var baseUrl = "https://10.0.0.1:8443" // default edge gateway

    data class DispatchResponse(
        val assetId: Int = 0,
        val powerKw: Float = 0f,
        val durationS: Int = 0,
        val reason: Int = 0,
    )

    fun connect() {
        try {
            // Carrega trust store (CA)
            val caCert = loadCert("ca.pem")
            val trustStore = KeyStore.getInstance(KeyStore.getDefaultType()).apply {
                load(null, null)
                setCertificateEntry("ca", caCert)
            }
            val trustManagerFactory = TrustManagerFactory.getInstance("X.509").apply {
                init(trustStore)
            }

            // Carrega client certificate
            val clientCert = loadCert("device.pem")
            val clientKey = loadPrivateKey("device.key")
            val keyStore = KeyStore.getInstance("PKCS12").apply {
                load(null, null)
                setKeyEntry("client", clientKey, null, arrayOf(clientCert))
            }
            val keyManagerFactory = KeyManagerFactory.getInstance("X.509").apply {
                init(keyStore, null)
            }

            val sslContext = SSLContext.getInstance("TLSv1.3").apply {
                init(
                    keyManagerFactory.keyManagers,
                    trustManagerFactory.trustManagers,
                    SecureRandom(),
                )
            }

            client = OkHttpClient.Builder()
                .sslSocketFactory(sslContext.socketFactory, trustManagerFactory.trustManagers.first() as X509TrustManager)
                .hostnameVerifier { _, _ -> true } // dev only
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build()

            Log.i(TAG, "mTLS client ready")
        } catch (e: Exception) {
            Log.e(TAG, "mTLS init failed", e)
        }
    }

    /** Send telemetry JSON to cloud */
    fun sendTelemetry(json: String) {
        client ?: return
        val request = Request.Builder()
            .url("$baseUrl/api/v1/edge/telemetry")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()
        client?.newCall(request)?.enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.w(TAG, "Telemetry send failed", e)
            }
            override fun onResponse(call: Call, response: Response) {
                response.close()
            }
        })
    }

    /** Poll for pending dispatch commands */
    fun pollDispatch(): DispatchResponse? {
        client ?: return null
        val request = Request.Builder()
            .url("$baseUrl/api/v1/edge/dispatch/pending")
            .get()
            .build()
        return try {
            val response = client?.newCall(request)?.execute() ?: return null
            if (!response.isSuccessful) return null
            val body = response.body?.string() ?: return null
            gson.fromJson(body, DispatchResponse::class.java)
        } catch (e: Exception) {
            null
        }
    }

    private fun loadCert(name: String): java.security.cert.X509Certificate {
        val certFactory = CertificateFactory.getInstance("X.509")
        val stream: InputStream = context.assets.open(name)
        return certFactory.generateCertificate(stream) as java.security.cert.X509Certificate
    }

    private fun loadPrivateKey(name: String): java.security.PrivateKey {
        val stream: InputStream = context.assets.open(name)
        val pem = stream.bufferedReader().readText()
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replace("\\s".toRegex(), "")
        val encoded = android.util.Base64.decode(pem, android.util.Base64.DEFAULT)
        val keyFactory = java.security.KeyFactory.getInstance("EC")
        return keyFactory.generatePrivate(java.security.spec.PKCS8EncodedKeySpec(encoded))
    }

    fun disconnect() {
        client?.dispatcher?.executorService?.shutdown()
        client = null
    }

    companion object {
        private const val TAG = "OmniBoxCloud"
    }
}

package com.omnigrid.omnibox

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import java.io.*

enum class Transport(val priority: Int) {
    UsbCdc(0),
    Ble(1),
    WiFi(2),
    UsbDirect(3),
    None(4);
    val displayName: String get() = name
}

/**
 * Connection manager with fallback chain:
 *
 *   USB CDC (ESP32)   → primary: binary TelemetryFrame protocol
 *   BLE (ESP32 GATT)  → fallback 1: BLE read telemetry characteristic
 *   WiFi (ESP32 AP)   → fallback 2: REST API over WiFi direct
 *   USB Direct (Inv)  → fallback 3: Modbus RTU direct to inverter (no ESP32)
 *   None              → offline: queue to SQLite
 */
class ConnectionManager(private val context: Context) {
    private val cdcBridge = Esp32CdcBridge(context)
    private val bleBridge = Esp32BleBridge(context)
    private val wifiClient = LocalEsp32Client(context)
    private val usbBridge = UsbSerialBridge(context)
    private val db = TelemetryDatabase(context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private var activeTransport: Transport = Transport.None
    private var native: OmniBoxNative? = null

    fun init(nativeBridge: OmniBoxNative) {
        native = nativeBridge
        startFallbackChain()
    }

    private fun startFallbackChain() {
        scope.launch {
            // Try each transport in priority order until one succeeds
            if (tryCdc()) return@launch
            if (tryBle()) return@launch
            if (tryWiFi()) return@launch
            if (tryUsbDirect()) return@launch
            enterOfflineMode()
        }
    }

    // ─── Transport attempts ───

    private suspend fun tryCdc(): Boolean {
        try {
            if (cdcBridge.connect()) {
                activeTransport = Transport.UsbCdc
                Log.i(TAG, "Transport: USB CDC (ESP32 binary protocol)")
                scope.launch { cdcLoop() }
                return true
            }
        } catch (e: Exception) {
            Log.w(TAG, "CDC connect failed", e)
        }
        return false
    }

    private suspend fun tryBle(): Boolean {
        try {
            val telem = bleBridge.readTelemetry()
            if (telem != null) {
                activeTransport = Transport.Ble
                Log.i(TAG, "Transport: BLE (ESP32 GATT)")
                scope.launch { bleLoop() }
                return true
            }
        } catch (e: Exception) {
            Log.w(TAG, "BLE connect failed", e)
        }
        return false
    }

    private suspend fun tryWiFi(): Boolean {
        try {
            if (wifiClient.connect()) {
                activeTransport = Transport.WiFi
                Log.i(TAG, "Transport: WiFi (ESP32 AP REST)")
                scope.launch { wifiLoop() }
                return true
            }
        } catch (e: Exception) {
            Log.w(TAG, "WiFi connect failed", e)
        }
        return false
    }

    private suspend fun tryUsbDirect(): Boolean {
        try {
            if (usbBridge.connectDirect()) {
                activeTransport = Transport.UsbDirect
                Log.i(TAG, "Transport: USB Direct (Modbus RTU)")
                scope.launch { usbDirectLoop() }
                return true
            }
        } catch (e: Exception) {
            Log.w(TAG, "USB direct connect failed", e)
        }
        return false
    }

    private fun enterOfflineMode() {
        activeTransport = Transport.None
        Log.w(TAG, "No transport — offline mode, buffering to SQLite")
        scope.launch { offlineLoop() }
    }

    // ─── Transport loops ───

    private suspend fun cdcLoop() {
        while (isActive) {
            try {
                val telem = cdcBridge.readTelemetry()
                if (telem != null) {
                    native?.setSoC(telem.socPercent)
                    native?.setGridConnected(telem.gridConnected)
                    cloudSend(native?.telemetryJson ?: "{}")
                }
            } catch (e: Exception) {
                Log.w(TAG, "CDC loop error — trying fallback", e)
                cdcBridge.close()
                if (tryBle()) return
                if (tryWiFi()) return
                if (tryUsbDirect()) return
                enterOfflineMode()
                return
            }
            delay(5000)
        }
    }

    private suspend fun bleLoop() {
        while (isActive) {
            try {
                val telem = bleBridge.readTelemetry()
                if (telem != null) {
                    native?.setSoC(telem.socPercent)
                    native?.setGridConnected(telem.gridConnected)
                    cloudSend(native?.telemetryJson ?: "{}")
                }
                val dispatch = cloudPoll()
                if (dispatch != null) {
                    bleBridge.sendDispatch(dispatch.assetId, dispatch.powerKw,
                        dispatch.durationS, dispatch.reason)
                    db.logDispatch(dispatch.assetId, dispatch.powerKw,
                        dispatch.durationS.toLong(), dispatch.reason, 0)
                }
            } catch (e: Exception) {
                Log.w(TAG, "BLE loop error — trying fallback", e)
                bleBridge.close()
                if (tryWiFi()) return
                if (tryUsbDirect()) return
                enterOfflineMode()
                return
            }
            delay(5000)
        }
    }

    private suspend fun wifiLoop() {
        while (isActive) {
            try {
                val telem = wifiClient.readTelemetry()
                if (telem != null) {
                    native?.setSoC(telem.soc)
                    native?.setGridConnected(telem.grid)
                    cloudSend(native?.telemetryJson ?: "{}")
                }
            } catch (e: Exception) {
                Log.w(TAG, "WiFi loop error — trying fallback", e)
                wifiClient.disconnect()
                if (tryUsbDirect()) return
                enterOfflineMode()
                return
            }
            delay(5000)
        }
    }

    private suspend fun usbDirectLoop() {
        while (isActive) {
            try {
                val inv = usbBridge.readInverter()
                if (inv != null) {
                    native?.setGridConnected(inv.gridConnected)
                    db.enqueueTelemetry(native?.telemetryJson ?: "{}")
                }
            } catch (e: Exception) {
                Log.w(TAG, "USB direct failed — offline", e)
                enterOfflineMode()
                return
            }
            delay(5000)
        }
    }

    private suspend fun offlineLoop() {
        while (isActive) {
            try {
                native?.tick(5.0f)
                db.enqueueTelemetry(native?.telemetryJson ?: "{}")
                if (db.getQueueSize() > 100) {
                    Log.w(TAG, "Queue overflow: ${db.getQueueSize()} entries")
                }
                // Periodically retry transports
                if (tryCdc()) return
                if (tryBle()) return
                if (tryWiFi()) return
            } catch (_: Exception) {}
            delay(30000)
        }
    }

    // ─── Cloud helpers ───

    private fun cloudSend(json: String) {
        // Best-effort cloud send; falls back to SQLite queue
        try {
            // In production, this sends via CloudClient
            db.enqueueTelemetry(json)
        } catch (_: Exception) {}
    }

    private fun cloudPoll(): CloudClient.DispatchResponse? {
        return null // Polling implemented in Sprint 2 with proper CloudClient integration
    }

    fun getActiveTransport(): Transport = activeTransport

    fun shutdown() {
        scope.cancel()
        cdcBridge.close()
        bleBridge.close()
        wifiClient.disconnect()
        usbBridge.close()
    }

    companion object {
        private const val TAG = "OmniBoxConnMgr"
    }
}

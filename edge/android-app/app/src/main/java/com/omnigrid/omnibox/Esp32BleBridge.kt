package com.omnigrid.omnibox

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.util.Log
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.suspendCancellableCoroutine
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID
import kotlin.coroutines.resume

/**
 * BLE GATT client for ESP32 co-processor.
 *
 * Scans for "Omni-Box" advertisement, connects to GATT service,
 * reads telemetry from the telemetry characteristic (notify).
 */
class Esp32BleBridge(private val context: Context) {
    private val adapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()
    private var gatt: BluetoothGatt? = null
    private var bleScanning = false

    companion object {
        private const val TAG = "OmniBoxEspBle"
        val SERVICE_UUID = UUID.fromString("4f4d4e49-424f-5800-0000-000000000000")
        val TELEMETRY_UUID = UUID.fromString("4f4d4e49-0001-5800-0000-000000000001")
        val DISPATCH_UUID = UUID.fromString("4f4d4e49-0002-5800-0000-000000000002")
        val COMMAND_UUID = UUID.fromString("4f4d4e49-0003-5800-0000-000000000003")

        // TelemetryFrame struct layout (34 bytes packed)
        private const val TELEM_DEVICE_ID_OFF = 0
        private const val TELEM_TIMESTAMP_OFF = 4
        private const val TELEM_VOLTAGE_OFF = 8
        private const val TELEM_CURRENT_OFF = 12
        private const val TELEM_FREQ_OFF = 16
        private const val TELEM_SOC_OFF = 20
        private const val TELEM_TEMP_OFF = 24
        private const val TELEM_POWER_OFF = 28
        private const val TELEM_GRID_OFF = 32
        private const val TELEM_SAFETY_OFF = 33
        private const val TELEM_SIZE = 34

        // DispatchCommand struct layout (13 bytes packed)
        private const val DISPATCH_ASSET_OFF = 0
        private const val DISPATCH_POWER_OFF = 4
        private const val DISPATCH_DUR_OFF = 8
        private const val DISPATCH_REASON_OFF = 12
        private const val DISPATCH_SIZE = 13
    }

    data class Esp32Telemetry(
        val deviceId: Long,
        val timestampS: Long,
        val voltageV: Float,
        val currentA: Float,
        val frequencyHz: Float,
        val socPercent: Float,
        val temperatureC: Float,
        val powerW: Float,
        val gridConnected: Boolean,
        val safetyStatus: Int,
    )

    /** Scan for ESP32 BLE, connect, and read telemetry */
    suspend fun readTelemetry(): Esp32Telemetry? {
        if (adapter == null || !adapter.isEnabled) return null

        if (gatt != null && isConnected()) {
            return readFromGatt()
        }

        val device = scanForEsp32() ?: return null
        return connectAndRead(device)
    }

    /** Write dispatch command to ESP32 via BLE */
    suspend fun sendDispatch(assetId: Int, powerKw: Float, durationS: Int, reason: Int): Boolean {
        val ch = findChar(COMMAND_UUID) ?: return false
        val buf = ByteBuffer.allocate(DISPATCH_SIZE).apply {
            order(ByteOrder.LITTLE_ENDIAN)
            putInt(assetId)
            putFloat(powerKw)
            putInt(durationS)
            put(reason.toByte())
        }
        ch.value = buf.array()
        return gatt?.writeCharacteristic(ch) ?: false
    }

    private suspend fun scanForEsp32(): BluetoothDevice? = suspendCancellableCoroutine { cont ->
        if (bleScanning) { cont.resume(null); return@suspendCancellableCoroutine }

        val scanner = adapter?.bluetoothLeScanner
        if (scanner == null) { cont.resume(null); return@suspendCancellableCoroutine }

        val filters = listOf(
            ScanFilter.Builder().setServiceUuid(
                android.os.ParcelUuid(SERVICE_UUID)
            ).build()
        )
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setReportDelay(0)
            .build()

        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                scanner.stopScan(this)
                bleScanning = false
                cont.resume(result.device)
            }
            override fun onScanFailed(errorCode: Int) {
                bleScanning = false
                cont.resume(null)
            }
        }

        bleScanning = true
        scanner.startScan(filters, settings, callback)

        cont.invokeOnCancellation {
            scanner.stopScan(callback)
            bleScanning = false
        }
    }

    private suspend fun connectAndRead(device: BluetoothDevice): Esp32Telemetry? {
        return suspendCancellableCoroutine { cont ->
            val callback = object : BluetoothGattCallback() {
                override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        g.discoverServices()
                    } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                        cont.resume(null)
                    }
                }

                override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
                    this@Esp32BleBridge.gatt = g
                    val svc = g.getService(SERVICE_UUID)
                    if (svc == null) { cont.resume(null); return }
                    val ch = svc.getCharacteristic(TELEMETRY_UUID)
                    if (ch == null) { cont.resume(null); return }
                    g.setCharacteristicNotification(ch, true)
                    g.readCharacteristic(ch)
                }

                override fun onCharacteristicRead(
                    g: BluetoothGatt, ch: BluetoothGattCharacteristic, status: Int
                ) {
                    val data = ch.value ?: run { cont.resume(null); return }
                    cont.resume(parseTelemetry(data))
                }

                override fun onCharacteristicChanged(
                    g: BluetoothGatt, ch: BluetoothGattCharacteristic
                ) {
                    // Notify not used for initial read; handled by onCharacteristicRead
                }
            }
            device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
        }
    }

    private suspend fun readFromGatt(): Esp32Telemetry? {
        val ch = findChar(TELEMETRY_UUID) ?: return null
        val data = ch.value
        if (data != null && data.size >= TELEM_SIZE) return parseTelemetry(data)
        return null
    }

    private fun findChar(uuid: UUID): BluetoothGattCharacteristic? {
        val svc = gatt?.getService(SERVICE_UUID) ?: return null
        return svc.getCharacteristic(uuid)
    }

    private fun parseTelemetry(data: ByteArray): Esp32Telemetry? {
        if (data.size < TELEM_SIZE) return null
        val buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        return Esp32Telemetry(
            deviceId = buf.getInt(TELEM_DEVICE_ID_OFF).toLong() and 0xFFFFFFFFL,
            timestampS = buf.getInt(TELEM_TIMESTAMP_OFF).toLong() and 0xFFFFFFFFL,
            voltageV = buf.getFloat(TELEM_VOLTAGE_OFF),
            currentA = buf.getFloat(TELEM_CURRENT_OFF),
            frequencyHz = buf.getFloat(TELEM_FREQ_OFF),
            socPercent = buf.getFloat(TELEM_SOC_OFF),
            temperatureC = buf.getFloat(TELEM_TEMP_OFF),
            powerW = buf.getFloat(TELEM_POWER_OFF),
            gridConnected = data[TELEM_GRID_OFF] != 0.toByte(),
            safetyStatus = data[TELEM_SAFETY_OFF].toInt() and 0xFF,
        )
    }

    private fun isConnected(): Boolean {
        return gatt?.services?.any { it.uuid == SERVICE_UUID } == true
    }

    fun close() {
        try {
            gatt?.disconnect()
            gatt?.close()
        } catch (_: Exception) {}
        gatt = null
    }
}

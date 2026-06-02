package com.omnigrid.omnibox

import android.content.Context
import android.hardware.usb.UsbManager
import com.hoho.android.usbserial.driver.UsbSerialProber
import com.hoho.android.usbserial.driver.UsbSerialPort
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.*
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * USB CDC bridge for ESP32 co-processor binary protocol.
 *
 * Unlike UsbSerialBridge (which speaks Modbus RTU directly to an inverter),
 * this bridge speaks the Omni-Box binary protocol:
 *   - ESP32 pushes TelemetryFrame (34 bytes) every 100ms
 *   - Android sends DispatchCommand (13 bytes) to control dispatch
 *
 * Protocol framing:
 *   - TelemetryFrame: 34-byte binary struct (little-endian)
 *   - DispatchCommand: 13-byte binary struct (little-endian)
 *   - Serial debug strings from ESP32 are ignored (filtered by size)
 */
class Esp32CdcBridge(private val context: Context) {
    private var port: UsbSerialPort? = null
    private var readBuffer = ByteArray(256)
    private var pendingData = ByteArrayOutputStream()

    // TelemetryFrame layout (34 bytes packed, little-endian)
    companion object {
        private const val TAG = "OmniBoxCdc"
        private const val TELEM_SIZE = 34
        private const val DISPATCH_SIZE = 13
        private const val BAUD_RATE = 115200
        private const val TIMEOUT_MS = 2000
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

    /** Connect to ESP32 via USB CDC (first available USB-serial device) */
    suspend fun connect(): Boolean = withContext(Dispatchers.IO) {
        try {
            val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
            val available = UsbSerialProber.getDefaultProber().findAllDrivers(usbManager)
            if (available.isEmpty()) return@withContext false

            val driver = available.first()
            if (!usbManager.hasPermission(driver.device)) return@withContext false

            val connection = usbManager.openDevice(driver.device)
            port = driver.ports.first().also {
                it.open(connection)
                it.setParameters(BAUD_RATE, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
                it.setDTR(true)
                it.setRTS(true)
            }
            pendingData.reset()
            Log.i(TAG, "ESP32 CDC connected at $BAUD_RATE baud")
            true
        } catch (e: Exception) {
            Log.e(TAG, "CDC connect failed", e)
            false
        }
    }

    /**
     * Read the latest TelemetryFrame from the CDC stream.
     *
     * The ESP32 pushes frames every 100ms. We read all available bytes,
     * find the last complete 34-byte frame, and parse it.
     * Incomplete frames or debug strings are discarded.
     */
    suspend fun readTelemetry(): Esp32Telemetry? = withContext(Dispatchers.IO) {
        val p = port ?: return@withContext null
        try {
            val available = p.read(readBuffer, TIMEOUT_MS)
            if (available <= 0) return@withContext null

            pendingData.write(readBuffer, 0, available)
            val allData = pendingData.toByteArray()

            // Find the last complete 34-byte frame in the stream
            // ESP32 sends frames at 100ms; we want the latest one
            val frames = mutableListOf<ByteArray>()
            var i = 0
            while (i + TELEM_SIZE <= allData.size) {
                frames.add(allData.copyOfRange(i, i + TELEM_SIZE))
                i += TELEM_SIZE
            }

            // Keep leftover bytes
            pendingData.reset()
            if (i < allData.size) {
                pendingData.write(allData, i, allData.size - i)
            }

            if (frames.isEmpty()) return@withContext null
            parseTelemetry(frames.last())
        } catch (e: Exception) {
            Log.w(TAG, "CDC read error", e)
            null
        }
    }

    /** Send dispatch command to ESP32 */
    suspend fun sendDispatch(assetId: Int, powerKw: Float, durationS: Int, reason: Int): Boolean {
        val p = port ?: return false
        return withContext(Dispatchers.IO) {
            try {
                val buf = ByteBuffer.allocate(DISPATCH_SIZE).apply {
                    order(ByteOrder.LITTLE_ENDIAN)
                    putInt(assetId)
                    putFloat(powerKw)
                    putInt(durationS)
                    put(reason.toByte())
                }
                p.write(buf.array(), TIMEOUT_MS)
                Log.i(TAG, "Dispatch sent: asset=$assetId power=${powerKw}kW")
                true
            } catch (e: Exception) {
                Log.e(TAG, "Dispatch send failed", e)
                false
            }
        }
    }

    private fun parseTelemetry(data: ByteArray): Esp32Telemetry? {
        if (data.size < TELEM_SIZE) return null
        val buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        return Esp32Telemetry(
            deviceId = buf.getInt(0).toLong() and 0xFFFFFFFFL,
            timestampS = buf.getInt(4).toLong() and 0xFFFFFFFFL,
            voltageV = buf.getFloat(8),
            currentA = buf.getFloat(12),
            frequencyHz = buf.getFloat(16),
            socPercent = buf.getFloat(20),
            temperatureC = buf.getFloat(24),
            powerW = buf.getFloat(28),
            gridConnected = data[32] != 0.toByte(),
            safetyStatus = data[33].toInt() and 0xFF,
        )
    }

    fun isConnected(): Boolean = port?.isOpen == true

    fun close() {
        try {
            port?.close()
        } catch (_: Exception) {}
        port = null
        pendingData.reset()
    }
}

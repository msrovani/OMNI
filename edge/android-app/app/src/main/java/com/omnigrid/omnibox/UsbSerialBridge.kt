package com.omnigrid.omnibox

import android.content.Context
import android.hardware.usb.UsbManager
import com.hoho.android.usbserial.driver.UsbSerialProber
import com.hoho.android.usbserial.driver.UsbSerialPort
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * USB-to-Serial bridge para Modbus RTU com o inversor.
 *
 * Protocolo:
 *   - Baud: 9600/19200/115200
 *   - Data: 8 bits, Parity: None, Stop: 1
 *   - Modbus RTU via USB-OTG (FTDI / CH340 / CP210x)
 */
class UsbSerialBridge(private val context: Context) {
    private var port: UsbSerialPort? = null

    data class InverterData(
        val gridConnected: Boolean,
        val voltageV: Float,
        val currentA: Float,
        val powerW: Float,
        val frequencyHz: Float,
        val temperatureC: Float,
    )

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
                it.setParameters(9600, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    /** Read inverter registers via Modbus RTU */
    suspend fun readInverter(): InverterData? = withContext(Dispatchers.IO) {
        val p = port ?: return@withContext null
        try {
            // Modbus FC03: Read Holding Registers
            val request = byteArrayOf(
                0x01,           // slave address
                0x03,           // function code
                0x00, 0x00,     // start address
                0x00, 0x0A,     // quantity (10 registers)
            )
            // Append CRC-16 (Modbus)
            val crc = crc16Modbus(request)
            val buf = request + byteArrayOf((crc and 0xFF).toByte(), (crc shr 8).toByte())

            p.write(buf, 1000)

            // Read response: 1 addr + 1 func + 1 count + 20 data + 2 crc = 25 bytes
            val resp = ByteArray(25)
            val read = p.read(resp, 2000)

            if (read < 25) return@withContext null

            // Parse registers (big-endian)
            val v = ((resp[3].toInt() and 0xFF) shl 8) or (resp[4].toInt() and 0xFF)
            val i = ((resp[5].toInt() and 0xFF) shl 8) or (resp[6].toInt() and 0xFF)
            val f = ((resp[7].toInt() and 0xFF) shl 8) or (resp[8].toInt() and 0xFF)
            val t = ((resp[9].toInt() and 0xFF) shl 8) or (resp[10].toInt() and 0xFF)

            InverterData(
                gridConnected = true,
                voltageV = v * 0.1f,
                currentA = i * 0.1f,
                powerW = v * i * 0.01f,
                frequencyHz = f * 0.01f,
                temperatureC = t * 0.1f,
            )
        } catch (e: Exception) {
            null
        }
    }

    /** Connect in direct Modbus RTU mode (bypass ESP32) */
    suspend fun connectDirect(): Boolean = connect()

    fun close() {
        try { port?.close() } catch (_: Exception) {}
        port = null
    }

    companion object {
        fun crc16Modbus(data: ByteArray): Int {
            var crc = 0xFFFF
            for (b in data) {
                crc = crc xor (b.toInt() and 0xFF)
                for (i in 0 until 8) {
                    crc = if ((crc and 0x0001) != 0) {
                        (crc shr 1) xor 0xA001
                    } else {
                        crc shr 1
                    }
                }
            }
            return crc
        }
    }
}

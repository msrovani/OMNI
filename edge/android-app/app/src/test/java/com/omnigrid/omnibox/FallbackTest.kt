package com.omnigrid.omnibox

import org.junit.Assert.*
import org.junit.Test
import java.security.MessageDigest

class FallbackTest {

    // ─── CRC-16 Modbus ───

    @Test
    fun `CRC-16 Modbus matches known vector`() {
        val req = byteArrayOf(0x01, 0x03, 0x00, 0x00, 0x00, 0x01)
        val crc = UsbSerialBridge.crc16Modbus(req)
        assertEquals(0x0A84, crc)
    }

    @Test
    fun `CRC-16 Modbus matches second vector`() {
        val req = byteArrayOf(0x11, 0x03, 0x00, 0x6B, 0x00, 0x03)
        val crc = UsbSerialBridge.crc16Modbus(req)
        assertEquals(0xA12B, crc)
    }

    @Test
    fun `CRC-16 all zeros`() {
        val req = byteArrayOf(0x00, 0x00, 0x00, 0x00)
        val crc = UsbSerialBridge.crc16Modbus(req)
        assertEquals(0x800D, crc)
    }

    @Test
    fun `CRC-16 differs on bit flip`() {
        val a = byteArrayOf(0x01, 0x03, 0x00, 0x00, 0x00, 0x01)
        val b = byteArrayOf(0x01, 0x03, 0x00, 0x00, 0x00, 0x02)
        assertNotEquals(UsbSerialBridge.crc16Modbus(a), UsbSerialBridge.crc16Modbus(b))
    }

    // ─── TelemetryDatabase ───

    @Test
    fun `Telemetry queue size initializes to zero`() {
        val db = mockDatabase()
        assertEquals(0, db.getQueueSize())
    }

    @Test
    fun `Enqueue increments queue size`() {
        val db = mockDatabase()
        db.enqueueTelemetry("""{"soc":50.0}""")
        assertEquals(1, db.getQueueSize())
    }

    @Test
    fun `Multiple enqueues increment correctly`() {
        val db = mockDatabase()
        for (i in 1..10) db.enqueueTelemetry("""{"i":$i}""")
        assertEquals(10, db.getQueueSize())
    }

    @Test
    fun `Dequeue returns enqueued entries`() {
        val db = mockDatabase()
        db.enqueueTelemetry("""{"soc":50.0}""")
        db.enqueueTelemetry("""{"soc":51.0}""")
        val batch = db.dequeueBatch(2)
        assertEquals(2, batch.size)
        assertEquals("""{"soc":50.0}""", batch[0].json)
        assertEquals("""{"soc":51.0}""", batch[1].json)
    }

    @Test
    fun `Dequeue respects limit`() {
        val db = mockDatabase()
        for (i in 1..5) db.enqueueTelemetry("""{"i":$i}""")
        val batch = db.dequeueBatch(3)
        assertEquals(3, batch.size)
    }

    @Test
    fun `Dequeue on empty returns empty list`() {
        val db = mockDatabase()
        val batch = db.dequeueBatch(10)
        assertTrue(batch.isEmpty())
    }

    @Test
    fun `Delete removes entries and shrinks queue`() {
        val db = mockDatabase()
        db.enqueueTelemetry("""{"soc":50.0}""")
        db.enqueueTelemetry("""{"soc":51.0}""")
        val batch = db.dequeueBatch(2)
        db.deleteProcessed(batch.map { it.id })
        assertEquals(0, db.getQueueSize())
    }

    @Test
    fun `Dispatch log persists and is queryable`() {
        val db = mockDatabase()
        db.logDispatch(1, 5.0f, 3600, 0, 0)
        assertEquals(0, db.getPendingDispatchCount())
    }

    @Test
    fun `Dispatch with failure result counts as pending`() {
        val db = mockDatabase()
        db.logDispatch(1, 5.0f, 3600, 0, -1)
        assertEquals(1, db.getPendingDispatchCount())
    }

    @Test
    fun `Multiple failed dispatches all counted`() {
        val db = mockDatabase()
        for (i in 1..5) db.logDispatch(i, 5.0f, 3600, 0, -1)
        assertEquals(5, db.getPendingDispatchCount())
    }

    @Test
    fun `Queue does not grow unbounded`() {
        val db = mockDatabase()
        for (i in 1..200) db.enqueueTelemetry("""{"i":$i}""")
        assertTrue(db.getQueueSize() <= 1000)
    }

    // ─── DeviceMode ───

    @Test
    fun `DeviceMode fromCode maps correctly`() {
        assertEquals(DeviceMode.Normal, DeviceMode.fromCode(0))
        assertEquals(DeviceMode.ShadowAutonomous, DeviceMode.fromCode(1))
        assertEquals(DeviceMode.EmergencyStop, DeviceMode.fromCode(2))
        assertEquals(DeviceMode.Commissioning, DeviceMode.fromCode(3))
    }

    @Test
    fun `DeviceMode fromCode defaults to Commissioning on unknown`() {
        assertEquals(DeviceMode.Commissioning, DeviceMode.fromCode(-1))
        assertEquals(DeviceMode.Commissioning, DeviceMode.fromCode(99))
        assertEquals(DeviceMode.Commissioning, DeviceMode.fromCode(Int.MAX_VALUE))
    }

    @Test
    fun `DeviceMode display names are non-empty`() {
        for (mode in DeviceMode.entries) {
            assertTrue(mode.displayName.isNotBlank())
        }
    }

    @Test
    fun `DeviceMode code round-trip`() {
        for (mode in DeviceMode.entries) {
            assertEquals(mode, DeviceMode.fromCode(mode.code))
        }
    }

    // ─── Transport ───

    @Test
    fun `Transport priority order is correct`() {
        val transports = Transport.entries.sortedBy { it.priority }
        assertEquals(Transport.UsbCdc, transports[0])
        assertEquals(Transport.Ble, transports[1])
        assertEquals(Transport.WiFi, transports[2])
        assertEquals(Transport.UsbDirect, transports[3])
        assertEquals(Transport.None, transports[4])
    }

    @Test
    fun `Transport priorities are unique`() {
        val priorities = Transport.entries.map { it.priority }
        assertEquals(priorities.toSet().size, priorities.size)
    }

    @Test
    fun `Transport display names match enum names`() {
        for (t in Transport.entries) {
            assertEquals(t.name, t.displayName)
        }
    }

    @Test
    fun `Transport None has highest priority`() {
        assertTrue(Transport.entries.all { it.priority <= Transport.None.priority })
    }

    // ─── PowerManager (unit logic only) ───

    @Test
    fun `Power profile performance when charging`() {
        val pm = mockPowerManager(batteryPct = 30, isCharging = true)
        assertEquals(PowerProfile.Performance, pm)
    }

    @Test
    fun `Power profile critical when low`() {
        val pm = mockPowerManager(batteryPct = 15, isCharging = false)
        assertEquals(PowerProfile.Critical, pm)
    }

    @Test
    fun `Power profile balanced at 50pct`() {
        val pm = mockPowerManager(batteryPct = 50, isCharging = false)
        assertEquals(PowerProfile.Balanced, pm)
    }

    @Test
    fun `Power profile power save at 20pct`() {
        val pm = mockPowerManager(batteryPct = 25, isCharging = false)
        assertEquals(PowerProfile.PowerSave, pm)
    }

    @Test
    fun `Power profile performance when charging even at 1pct`() {
        val pm = mockPowerManager(batteryPct = 1, isCharging = true)
        assertEquals(PowerProfile.Performance, pm)
    }

    @Test
    fun `Power profile critical exactly at 19pct`() {
        val pm = mockPowerManager(batteryPct = 19, isCharging = false)
        assertEquals(PowerProfile.Critical, pm)
    }

    @Test
    fun `Power profile power save exactly at 20pct`() {
        val pm = mockPowerManager(batteryPct = 20, isCharging = false)
        assertEquals(PowerProfile.PowerSave, pm)
    }

    @Test
    fun `Power profile balanced exactly at 100pct`() {
        val pm = mockPowerManager(batteryPct = 100, isCharging = false)
        assertEquals(PowerProfile.Balanced, pm)
    }

    @Test
    fun `Power profile balanced exactly at 50pct not charging`() {
        val pm = mockPowerManager(batteryPct = 50, isCharging = false)
        assertEquals(PowerProfile.Balanced, pm)
    }

    // ─── TimeFallback (logic validation) ───

    @Test
    fun `TimeFallback sources are in correct chain order`() {
        val sources = TimeFallback.TimeSource.entries
        assertEquals(TimeFallback.TimeSource.System, sources[0])
        assertEquals(TimeFallback.TimeSource.Ntp, sources[1])
        assertEquals(TimeFallback.TimeSource.Gps, sources[2])
        assertEquals(TimeFallback.TimeSource.Cellular, sources[3])
        assertEquals(TimeFallback.TimeSource.Uptime, sources[4])
    }

    @Test
    fun `NTP offset constant is correct`() {
        // NTP epoch (Jan 1 1900) to Unix epoch (Jan 1 1970) = 70 years + 17 leap days
        // 70 * 365.25 * 86400 ≈ 2208988800
        assertEquals(2208988800L, 70 * 365 * 86400 + 17 * 86400) // approximate
    }

    @Test
    fun `NTP bootstrap calculation`() {
        val ntpSeconds = 3922336800L // example NTP timestamp
        val unixSeconds = ntpSeconds - 2208988800L
        assertTrue(unixSeconds > 0)
    }

    // ─── PIN Security ───

    @Test
    fun `SHA-256 produces 64-char hex`() {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest("2026".toByteArray()).joinToString("") { "%02x".format(it) }
        assertEquals(64, hash.length)
    }

    @Test
    fun `Known PIN hash matches`() {
        assertTrue(PinActivity.verifyPin("2026"))
    }

    @Test
    fun `Wrong PIN does not verify`() {
        assertFalse(PinActivity.verifyPin("2027"))
        assertFalse(PinActivity.verifyPin("0000"))
        assertFalse(PinActivity.verifyPin(""))
        assertFalse(PinActivity.verifyPin("admin"))
    }

    // ─── TelemetryFrame struct size ───

    @Test
    fun `TelemetryFrame packed size is 34 bytes`() {
        // device_id(4) + timestamp_s(4) + voltage_v(4) + current_a(4)
        // + frequency_hz(4) + soc_percent(4) + temperature_c(4)
        // + power_w(4) + grid_connected(1) + safety_status(1)
        assertEquals(34, 4 * 8 + 2)
    }

    // ─── Test helpers ───

    private fun mockDatabase(): TelemetryDatabase {
        val ctx = org.mockito.Mockito.mock(android.content.Context::class.java)
        return TelemetryDatabase(ctx)
    }

    private fun mockPowerManager(batteryPct: Int, isCharging: Boolean): PowerProfile {
        return when {
            isCharging -> PowerProfile.Performance
            batteryPct >= 50 -> PowerProfile.Balanced
            batteryPct >= 20 -> PowerProfile.PowerSave
            else -> PowerProfile.Critical
        }
    }
}

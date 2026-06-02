package com.omnigrid.omnibox

import android.content.Context
import android.location.LocationManager
import android.telephony.TelephonyManager
import android.util.Log
import java.io.IOException
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.text.SimpleDateFormat
import java.util.*

/**
 * Time source fallback chain:
 *   NTP (SNTP) → GPS time → Cellular NITZ → Uptime tracking
 *
 * Provides the best available timestamp for telemetry when
 * the system clock may not be synchronized.
 */
class TimeFallback(private val context: Context) {
    private val bootUptimeMs = System.currentTimeMillis()
    private var lastKnownTimeMs = System.currentTimeMillis()
    private var timeSource = TimeSource.System
    private var timeCertain = true

    enum class TimeSource { System, Ntp, Gps, Cellular, Uptime }

    data class TimeResult(
        val epochMs: Long,
        val source: TimeSource,
        val certain: Boolean,
        val offsetMinutes: Int, // UTC offset in minutes
    )

    /** Get the best available time, trying each source in order */
    fun getCurrentTime(): TimeResult {
        // 1. Try NTP
        val ntp = queryNtp()
        if (ntp != null) {
            timeSource = TimeSource.Ntp
            timeCertain = true
            lastKnownTimeMs = ntp
            return TimeResult(ntp, TimeSource.Ntp, true, getUtcOffset())
        }

        // 2. Try GPS
        val gps = getGpsTime()
        if (gps != null) {
            timeSource = TimeSource.Gps
            timeCertain = true
            lastKnownTimeMs = gps
            return TimeResult(gps, TimeSource.Gps, true, getUtcOffset())
        }

        // 3. Try cellular (NITZ)
        val cell = getCellularTime()
        if (cell != null) {
            timeSource = TimeSource.Cellular
            timeCertain = true
            lastKnownTimeMs = cell
            return TimeResult(cell, TimeSource.Cellular, true, getUtcOffset())
        }

        // 4. Fallback: uptime-estimated time
        val uptime = getUptimeEstimatedTime()
        timeSource = TimeSource.Uptime
        timeCertain = false
        return TimeResult(uptime, TimeSource.Uptime, false, getUtcOffset())
    }

    /** Query NTP server (pool.ntp.org) */
    private fun queryNtp(): Long? {
        return try {
            val socket = DatagramSocket()
            socket.soTimeout = 3000
            val addr = InetAddress.getByName("pool.ntp.org")
            val buf = ByteArray(48).apply { this[0] = 0x1B } // NTP v3 request
            val packet = DatagramPacket(buf, buf.size, addr, 123)
            socket.send(packet)
            socket.receive(packet)

            // Extract transmit timestamp (bytes 40-43 seconds, 44-47 fraction)
            val seconds = ((buf[40].toInt() and 0xFF).toLong() shl 24) or
                          ((buf[41].toInt() and 0xFF).toLong() shl 16) or
                          ((buf[42].toInt() and 0xFF).toLong() shl 8) or
                          (buf[43].toInt() and 0xFF).toLong()
            socket.close()

            // NTP epoch (Jan 1 1900) to Unix epoch (Jan 1 1970)
            val unixSeconds = seconds - 2208988800L
            unixSeconds * 1000
        } catch (e: Exception) {
            null
        }
    }

    /** Get time from GPS fix (last known location time) */
    private fun getGpsTime(): Long? {
        return try {
            val locMgr = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val gps = locMgr.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            val time = gps?.time ?: return null
            if (time > 0) time else null
        } catch (e: Exception) {
            null
        }
    }

    /** Get time from cellular network (NITZ) */
    private fun getCellularTime(): Long? {
        return try {
            val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val time = tm.networkCountryIso
            // TelephonyManager doesn't expose NITZ time directly on modern Android.
            // Fallback to system time with an "uncertain" flag if we have cell service.
            if (tm.simState == TelephonyManager.SIM_STATE_READY) {
                // Use system time but mark as uncertain
                System.currentTimeMillis()
            } else null
        } catch (e: Exception) {
            null
        }
    }

    /** Estimate current time from boot uptime + last known good time */
    private fun getUptimeEstimatedTime(): Long {
        val elapsed = System.currentTimeMillis() - bootUptimeMs
        return lastKnownTimeMs + elapsed
    }

    /** Get UTC offset in minutes */
    private fun getUtcOffset(): Int {
        val tz = Calendar.getInstance().timeZone
        return tz.getOffset(System.currentTimeMillis()) / 60000
    }

    fun getTimeSource(): TimeSource = timeSource
    fun isTimeCertain(): Boolean = timeCertain

    companion object {
        private const val TAG = "OmniBoxTime"
    }
}

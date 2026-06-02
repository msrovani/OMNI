package com.omnigrid.omnibox

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log

class TelemetryDatabase(context: Context) : SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS telemetry_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp_s INTEGER NOT NULL,
                telemetry_json TEXT NOT NULL,
                retry_count INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s','now'))
            )
        """)
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS dispatch_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER NOT NULL,
                power_kw REAL NOT NULL,
                duration_s INTEGER NOT NULL,
                reason INTEGER NOT NULL,
                result INTEGER NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s','now'))
            )
        """)
        db.execSQL("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_created 
            ON telemetry_queue(created_at)
        """)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS telemetry_queue")
        db.execSQL("DROP TABLE IF EXISTS dispatch_log")
        onCreate(db)
    }

    fun enqueueTelemetry(json: String) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("timestamp_s", System.currentTimeMillis() / 1000)
            put("telemetry_json", json)
        }
        db.insert("telemetry_queue", null, values)
        Log.d(TAG, "Telemetry enqueued (queue size: ${getQueueSize()})")
    }

    fun dequeueBatch(limit: Int = 10): List<TelemEntry> {
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT id, telemetry_json FROM telemetry_queue ORDER BY id ASC LIMIT ?",
            arrayOf(limit.toString())
        )
        val entries = mutableListOf<TelemEntry>()
        while (cursor.moveToNext()) {
            entries.add(TelemEntry(
                id = cursor.getLong(0),
                json = cursor.getString(1)
            ))
        }
        cursor.close()
        return entries
    }

    fun deleteProcessed(ids: List<Long>) {
        if (ids.isEmpty()) return
        val db = writableDatabase
        val placeholders = ids.joinToString(",") { "?" }
        db.execSQL("DELETE FROM telemetry_queue WHERE id IN ($placeholders)", ids.toTypedArray())
    }

    fun logDispatch(assetId: Int, powerKw: Float, durationS: Int, reason: Int, result: Int) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("asset_id", assetId)
            put("power_kw", powerKw.toDouble())
            put("duration_s", durationS)
            put("reason", reason)
            put("result", result)
        }
        db.insert("dispatch_log", null, values)
    }

    fun getQueueSize(): Int {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT COUNT(*) FROM telemetry_queue", null)
        cursor.moveToFirst()
        val count = cursor.getInt(0)
        cursor.close()
        return count
    }

    fun getPendingDispatchCount(): Int {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT COUNT(*) FROM dispatch_log WHERE result < 0", null)
        cursor.moveToFirst()
        val count = cursor.getInt(0)
        cursor.close()
        return count
    }

    data class TelemEntry(val id: Long, val json: String)

    companion object {
        private const val TAG = "OmniBoxDB"
        private const val DB_NAME = "omnibox_telemetry.db"
        private const val DB_VERSION = 1
    }
}

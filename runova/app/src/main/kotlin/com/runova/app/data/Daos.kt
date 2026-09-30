package com.runova.app.data

import android.content.ContentValues
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import com.runova.app.state.InboxEntry
import com.runova.app.ui.model.InboxKind
import com.runova.core.geo.LatLng
import com.runova.core.geo.PolylineCodec
import com.runova.core.model.RunRecord
import com.runova.core.progress.XpAward
import com.runova.core.tracking.RunTracker
import com.runova.core.tracking.TrackPoint
import java.time.LocalDate

// ------------------------------------------------------------------------------ cursor helpers

private fun Cursor.idx(col: String) = getColumnIndexOrThrow(col)
internal fun Cursor.long(col: String): Long = getLong(idx(col))
internal fun Cursor.int(col: String): Int = getInt(idx(col))
internal fun Cursor.double(col: String): Double = getDouble(idx(col))
internal fun Cursor.string(col: String): String = getString(idx(col))
internal fun Cursor.stringOrNull(col: String): String? = idx(col).let { if (isNull(it)) null else getString(it) }
internal fun Cursor.intOrNull(col: String): Int? = idx(col).let { if (isNull(it)) null else getInt(it) }
internal fun Cursor.doubleOrNull(col: String): Double? = idx(col).let { if (isNull(it)) null else getDouble(it) }
internal fun Cursor.floatOrNull(col: String): Float? = idx(col).let { if (isNull(it)) null else getFloat(it) }
internal fun Cursor.bool(col: String): Boolean = getInt(idx(col)) != 0

internal inline fun <T> SQLiteDatabase.queryList(sql: String, args: Array<String>? = null, map: (Cursor) -> T): List<T> =
    rawQuery(sql, args).use { c ->
        val out = ArrayList<T>(c.count)
        while (c.moveToNext()) out.add(map(c))
        out
    }

internal inline fun <T> SQLiteDatabase.inTransaction(block: SQLiteDatabase.() -> T): T {
    beginTransaction()
    try {
        val result = block()
        setTransactionSuccessful()
        return result
    } finally {
        endTransaction()
    }
}

// ------------------------------------------------------------------------------ routes

/** Route segments as space-separated encoded polylines (the codec never emits spaces). */
object RouteCodec {
    fun encode(segments: List<List<LatLng>>): String = segments.filter { it.size >= 2 }.joinToString(" ") { PolylineCodec.encode(it) }
    fun decode(s: String?): List<List<LatLng>> =
        s?.split(' ')?.filter { it.isNotEmpty() }?.map { PolylineCodec.decode(it) }?.filter { it.size >= 2 }.orEmpty()
}

data class PhotoRow(val id: Long, val runId: Long, val path: String, val takenMs: Long, val lat: Double?, val lng: Double?)

/** A run in progress as persisted for crash recovery. */
data class LiveRow(
    val startWallMs: Long,
    val updatedMs: Long,
    val paused: Boolean,
    val checkpoint: RunTracker.Checkpoint,
    val points: List<TrackPoint>,
    val photos: List<PhotoRow>,
)

// ------------------------------------------------------------------------------ runs

object RunDao {
    fun insert(db: SQLiteDatabase, r: RunRecord, route: String?): Long = db.insertOrThrow(
        "runs", null,
        ContentValues().apply {
            put("start_ms", r.startTimeMs)
            put("end_ms", r.endTimeMs)
            put("moving_ms", r.movingTimeMs)
            put("distance_m", r.distanceM)
            put("calories", r.calories)
            put("steps", r.steps)
            put("steps_estimated", if (r.stepsEstimated) 1 else 0)
            put("elev_gain", r.elevationGainM)
            put("elev_loss", r.elevationLossM)
            put("max_speed", r.maxSpeedMps)
            put("avg_hr", r.avgHeartRate)
            put("max_hr", r.maxHeartRate)
            put("xp", r.xpEarned)
            put("title", r.title)
            put("route", route)
        },
    )

    fun setXp(db: SQLiteDatabase, runId: Long, xp: Int) {
        db.update("runs", ContentValues().apply { put("xp", xp) }, "id = ?", arrayOf(runId.toString()))
    }

    fun all(db: SQLiteDatabase): List<RunRecord> = db.queryList("SELECT * FROM runs ORDER BY start_ms DESC") { it.toRun() }

    fun byId(db: SQLiteDatabase, id: Long): RunRecord? = db.queryList("SELECT * FROM runs WHERE id = ?", arrayOf(id.toString())) { it.toRun() }.firstOrNull()

    fun routes(db: SQLiteDatabase): Map<Long, List<List<LatLng>>> =
        db.queryList("SELECT id, route FROM runs") { it.long("id") to RouteCodec.decode(it.stringOrNull("route")) }.toMap()

    private fun Cursor.toRun() = RunRecord(
        id = long("id"),
        startTimeMs = long("start_ms"),
        endTimeMs = long("end_ms"),
        movingTimeMs = long("moving_ms"),
        distanceM = double("distance_m"),
        calories = double("calories"),
        steps = intOrNull("steps"),
        stepsEstimated = bool("steps_estimated"),
        elevationGainM = double("elev_gain"),
        elevationLossM = double("elev_loss"),
        maxSpeedMps = double("max_speed"),
        avgHeartRate = intOrNull("avg_hr"),
        maxHeartRate = intOrNull("max_hr"),
        xpEarned = int("xp"),
        title = stringOrNull("title"),
    )

    fun insertPoints(db: SQLiteDatabase, table: String, runId: Long?, points: List<TrackPoint>, firstSeq: Int) {
        val cols = if (runId != null) "run_id, " else ""
        val marks = if (runId != null) "?, " else ""
        val stmt = db.compileStatement(
            "INSERT OR REPLACE INTO $table (${cols}seq, wall_ms, lat, lng, alt, acc, speed, segment, distance_m, moving_ms, hr) " +
                "VALUES (${marks}?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        stmt.use { s ->
            points.forEachIndexed { i, p ->
                s.clearBindings()
                var k = 1
                if (runId != null) s.bindLong(k++, runId)
                s.bindLong(k++, (firstSeq + i).toLong())
                s.bindLong(k++, p.wallTimeMs)
                s.bindDouble(k++, p.lat)
                s.bindDouble(k++, p.lng)
                if (p.altitude != null) s.bindDouble(k++, p.altitude!!) else s.bindNull(k++)
                if (p.accuracy != null) s.bindDouble(k++, p.accuracy!!.toDouble()) else s.bindNull(k++)
                if (p.speed != null) s.bindDouble(k++, p.speed!!.toDouble()) else s.bindNull(k++)
                s.bindLong(k++, p.segment.toLong())
                s.bindDouble(k++, p.distanceM)
                s.bindLong(k++, p.movingTimeMs)
                if (p.heartRate != null) s.bindLong(k, p.heartRate!!.toLong()) else s.bindNull(k)
                s.executeInsert()
            }
        }
    }

    fun points(db: SQLiteDatabase, runId: Long): List<TrackPoint> =
        db.queryList("SELECT * FROM points WHERE run_id = ? ORDER BY seq", arrayOf(runId.toString())) { it.toPoint() }

    fun livePoints(db: SQLiteDatabase): List<TrackPoint> = db.queryList("SELECT * FROM live_points ORDER BY seq") { it.toPoint() }

    private fun Cursor.toPoint() = TrackPoint(
        wallTimeMs = long("wall_ms"),
        lat = double("lat"),
        lng = double("lng"),
        altitude = doubleOrNull("alt"),
        accuracy = floatOrNull("acc"),
        speed = floatOrNull("speed"),
        segment = int("segment"),
        distanceM = double("distance_m"),
        movingTimeMs = long("moving_ms"),
        heartRate = intOrNull("hr"),
    )

    fun insertPhoto(db: SQLiteDatabase, table: String, runId: Long?, path: String, takenMs: Long, lat: Double?, lng: Double?): Long =
        db.insertOrThrow(
            table, null,
            ContentValues().apply {
                if (runId != null) put("run_id", runId)
                put("path", path)
                put("taken_ms", takenMs)
                put("lat", lat)
                put("lng", lng)
            },
        )

    fun photos(db: SQLiteDatabase, runId: Long): List<PhotoRow> =
        db.queryList("SELECT * FROM photos WHERE run_id = ? ORDER BY taken_ms", arrayOf(runId.toString())) { it.toPhoto(runId) }

    fun allPhotoPaths(db: SQLiteDatabase): List<String> =
        db.queryList("SELECT path FROM photos UNION ALL SELECT path FROM live_photos") { it.string("path") }

    fun livePhotos(db: SQLiteDatabase): List<PhotoRow> = db.queryList("SELECT * FROM live_photos ORDER BY taken_ms") { it.toPhoto(0) }

    private fun Cursor.toPhoto(runId: Long) = PhotoRow(long("id"), runId, string("path"), long("taken_ms"), doubleOrNull("lat"), doubleOrNull("lng"))

    fun delete(db: SQLiteDatabase, runId: Long) {
        val args = arrayOf(runId.toString())
        db.delete("points", "run_id = ?", args)
        db.delete("photos", "run_id = ?", args)
        db.delete("runs", "id = ?", args)
    }

    // -------------------------------------------------------------------------- live run

    fun saveLive(db: SQLiteDatabase, startWallMs: Long, paused: Boolean, cp: RunTracker.Checkpoint, newPoints: List<TrackPoint>, firstSeq: Int) {
        db.insertWithOnConflict(
            "live_run", null,
            ContentValues().apply {
                put("id", 1)
                put("start_wall", startWallMs)
                put("updated_ms", System.currentTimeMillis())
                put("paused", if (paused) 1 else 0)
                put("moving_ms", cp.movingTimeMs)
                put("distance_m", cp.distanceM)
                put("calories", cp.calories)
                put("elev_gain", cp.elevationGainM)
                put("elev_loss", cp.elevationLossM)
                put("max_speed", cp.maxSpeedMps)
                put("sensor_steps", cp.sensorSteps)
                put("has_step_sensor", if (cp.hasStepSensor) 1 else 0)
                put("hr_sum", cp.hrSum)
                put("hr_count", cp.hrCount)
                put("max_hr", cp.maxHeartRate)
            },
            SQLiteDatabase.CONFLICT_REPLACE,
        )
        if (newPoints.isNotEmpty()) insertPoints(db, "live_points", null, newPoints, firstSeq)
    }

    fun loadLive(db: SQLiteDatabase): LiveRow? {
        val row = db.queryList("SELECT * FROM live_run WHERE id = 1") { c ->
            Triple(
                c.long("start_wall"),
                c.long("updated_ms") to c.bool("paused"),
                RunTracker.Checkpoint(
                    movingTimeMs = c.long("moving_ms"),
                    distanceM = c.double("distance_m"),
                    calories = c.double("calories"),
                    elevationGainM = c.double("elev_gain"),
                    elevationLossM = c.double("elev_loss"),
                    maxSpeedMps = c.double("max_speed"),
                    sensorSteps = c.int("sensor_steps"),
                    hasStepSensor = c.bool("has_step_sensor"),
                    hrSum = c.long("hr_sum"),
                    hrCount = c.int("hr_count"),
                    maxHeartRate = c.intOrNull("max_hr"),
                ),
            )
        }.firstOrNull() ?: return null
        return LiveRow(row.first, row.second.first, row.second.second, row.third, livePoints(db), livePhotos(db))
    }

    fun clearLive(db: SQLiteDatabase) {
        db.delete("live_run", null, null)
        db.delete("live_points", null, null)
        db.delete("live_photos", null, null)
    }
}

// ------------------------------------------------------------------------------ progression

object ProgressDao {
    fun totalXp(db: SQLiteDatabase): Long =
        db.queryList("SELECT COALESCE(SUM(amount), 0) AS total FROM xp_events") { it.long("total") }.first()

    fun addXp(db: SQLiteDatabase, award: XpAward, ts: Long, runId: Long?) {
        db.insertOrThrow(
            "xp_events", null,
            ContentValues().apply {
                put("ts", ts)
                put("amount", award.amount)
                put("label", award.label)
                put("kind", award.kind.name)
                put("ref", award.ref)
                put("run_id", runId)
            },
        )
    }

    /** Achievement id to (unlock time, acknowledged). */
    fun achievements(db: SQLiteDatabase): Map<String, Pair<Long, Boolean>> =
        db.queryList("SELECT * FROM achievements") { it.string("id") to (it.long("unlocked_ms") to it.bool("acknowledged")) }.toMap()

    /** False when the achievement was already unlocked. */
    fun unlock(db: SQLiteDatabase, id: String, ts: Long): Boolean = db.insertWithOnConflict(
        "achievements", null,
        ContentValues().apply {
            put("id", id)
            put("unlocked_ms", ts)
            put("acknowledged", 0)
        },
        SQLiteDatabase.CONFLICT_IGNORE,
    ) != -1L

    fun acknowledge(db: SQLiteDatabase, ids: Collection<String>) {
        for (id in ids) db.update("achievements", ContentValues().apply { put("acknowledged", 1) }, "id = ?", arrayOf(id))
    }

    fun goalKeys(db: SQLiteDatabase): Set<String> = db.queryList("SELECT key FROM goal_awards") { it.string("key") }.toSet()

    /** False when the goal was already paid out. */
    fun addGoalKey(db: SQLiteDatabase, key: String, ts: Long): Boolean =
        db.insertWithOnConflict("goal_awards", null, ContentValues().apply { put("key", key); put("ts", ts) }, SQLiteDatabase.CONFLICT_IGNORE) != -1L

    fun inbox(db: SQLiteDatabase, limit: Int = 100): List<InboxEntry> =
        db.queryList("SELECT * FROM inbox ORDER BY ts DESC, id DESC LIMIT $limit") { c ->
            InboxEntry(
                id = c.long("id"),
                timeMs = c.long("ts"),
                kind = runCatching { InboxKind.valueOf(c.string("kind")) }.getOrDefault(InboxKind.TIP),
                title = c.string("title"),
                body = c.string("body"),
                read = c.bool("read"),
                ref = c.stringOrNull("ref"),
            )
        }

    fun addInbox(db: SQLiteDatabase, kind: InboxKind, title: String, body: String, ts: Long, ref: String?): Long = db.insertOrThrow(
        "inbox", null,
        ContentValues().apply {
            put("ts", ts)
            put("kind", kind.name)
            put("title", title)
            put("body", body)
            put("read", 0)
            put("ref", ref)
        },
    )

    fun markRead(db: SQLiteDatabase, id: Long?) {
        val values = ContentValues().apply { put("read", 1) }
        if (id == null) db.update("inbox", values, "read = 0", null) else db.update("inbox", values, "id = ?", arrayOf(id.toString()))
    }
}

// ------------------------------------------------------------------------------ steps & chat

object StepsDao {
    fun all(db: SQLiteDatabase): Map<LocalDate, Int> =
        db.queryList("SELECT day, steps FROM daily_steps") { LocalDate.parse(it.string("day")) to it.int("steps") }.toMap()

    fun add(db: SQLiteDatabase, day: LocalDate, delta: Int) {
        if (delta <= 0) return
        // Update-then-insert instead of UPSERT, which needs SQLite 3.24 (Android 11+).
        db.inTransaction {
            val updated = compileStatement("UPDATE daily_steps SET steps = steps + ? WHERE day = ?").use { s ->
                s.bindLong(1, delta.toLong())
                s.bindString(2, day.toString())
                s.executeUpdateDelete()
            }
            if (updated == 0) insertOrThrow("daily_steps", null, ContentValues().apply { put("day", day.toString()); put("steps", delta) })
        }
    }
}

data class ChatRow(val id: Long, val ts: Long, val fromUser: Boolean, val text: String)

object ChatDao {
    fun recent(db: SQLiteDatabase, limit: Int = 200): List<ChatRow> =
        db.queryList("SELECT * FROM (SELECT * FROM chat ORDER BY id DESC LIMIT $limit) ORDER BY id") { c ->
            ChatRow(c.long("id"), c.long("ts"), c.bool("from_user"), c.string("text"))
        }

    fun add(db: SQLiteDatabase, fromUser: Boolean, text: String, ts: Long): Long = db.insertOrThrow(
        "chat", null,
        ContentValues().apply {
            put("ts", ts)
            put("from_user", if (fromUser) 1 else 0)
            put("text", text)
        },
    )

    fun clear(db: SQLiteDatabase) {
        db.delete("chat", null, null)
    }
}

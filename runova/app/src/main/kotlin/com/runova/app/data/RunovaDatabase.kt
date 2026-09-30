package com.runova.app.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * Local SQLite database. Everything the user records stays on the device.
 *
 * - `runs`, `points`, `photos`: finished runs and their GPS tracks
 * - `live_run`, `live_points`, `live_photos`: the run in progress, checkpointed every few
 *   seconds so it can be recovered after the process dies
 * - `xp_events`, `achievements`, `goal_awards`, `inbox`: progression
 * - `daily_steps`, `chat`: step-counter history and the coach conversation
 */
class RunovaDatabase(context: Context) : SQLiteOpenHelper(context, NAME, null, VERSION) {

    override fun onConfigure(db: SQLiteDatabase) {
        db.enableWriteAheadLogging()
        db.setForeignKeyConstraintsEnabled(false)
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_ms INTEGER NOT NULL,
                end_ms INTEGER NOT NULL,
                moving_ms INTEGER NOT NULL,
                distance_m REAL NOT NULL,
                calories REAL NOT NULL,
                steps INTEGER,
                steps_estimated INTEGER NOT NULL DEFAULT 0,
                elev_gain REAL NOT NULL DEFAULT 0,
                elev_loss REAL NOT NULL DEFAULT 0,
                max_speed REAL NOT NULL DEFAULT 0,
                avg_hr INTEGER,
                max_hr INTEGER,
                xp INTEGER NOT NULL DEFAULT 0,
                title TEXT,
                route TEXT
            )""",
        )
        db.execSQL("CREATE INDEX runs_start ON runs(start_ms)")
        db.execSQL(pointsTable("points", withRunId = true))
        db.execSQL(
            """CREATE TABLE photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                path TEXT NOT NULL,
                taken_ms INTEGER NOT NULL,
                lat REAL,
                lng REAL
            )""",
        )
        db.execSQL("CREATE INDEX photos_run ON photos(run_id)")
        db.execSQL(
            """CREATE TABLE live_run (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                start_wall INTEGER NOT NULL,
                updated_ms INTEGER NOT NULL,
                paused INTEGER NOT NULL,
                moving_ms INTEGER NOT NULL,
                distance_m REAL NOT NULL,
                calories REAL NOT NULL,
                elev_gain REAL NOT NULL,
                elev_loss REAL NOT NULL,
                max_speed REAL NOT NULL,
                sensor_steps INTEGER NOT NULL,
                has_step_sensor INTEGER NOT NULL,
                hr_sum INTEGER NOT NULL,
                hr_count INTEGER NOT NULL,
                max_hr INTEGER
            )""",
        )
        db.execSQL(pointsTable("live_points", withRunId = false))
        db.execSQL(
            """CREATE TABLE live_photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                taken_ms INTEGER NOT NULL,
                lat REAL,
                lng REAL
            )""",
        )
        db.execSQL(
            """CREATE TABLE xp_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                label TEXT NOT NULL,
                kind TEXT NOT NULL,
                ref TEXT,
                run_id INTEGER
            )""",
        )
        db.execSQL("CREATE TABLE achievements (id TEXT PRIMARY KEY, unlocked_ms INTEGER NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0)")
        db.execSQL("CREATE TABLE goal_awards (key TEXT PRIMARY KEY, ts INTEGER NOT NULL)")
        db.execSQL(
            """CREATE TABLE inbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts INTEGER NOT NULL,
                kind TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                read INTEGER NOT NULL DEFAULT 0,
                ref TEXT
            )""",
        )
        db.execSQL("CREATE TABLE daily_steps (day TEXT PRIMARY KEY, steps INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE chat (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, from_user INTEGER NOT NULL, text TEXT NOT NULL)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Version 1 is the first schema; future migrations go here, step by step.
    }

    private fun pointsTable(name: String, withRunId: Boolean): String {
        val runId = if (withRunId) "run_id INTEGER NOT NULL," else ""
        val key = if (withRunId) "PRIMARY KEY (run_id, seq)" else "PRIMARY KEY (seq)"
        return """CREATE TABLE $name (
            $runId
            seq INTEGER NOT NULL,
            wall_ms INTEGER NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            alt REAL,
            acc REAL,
            speed REAL,
            segment INTEGER NOT NULL,
            distance_m REAL NOT NULL,
            moving_ms INTEGER NOT NULL,
            hr INTEGER,
            $key
        )"""
    }

    companion object {
        const val NAME = "runova.db"
        const val VERSION = 1
    }
}

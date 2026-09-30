package com.runova.app.data

import android.app.Application
import android.database.sqlite.SQLiteDatabase
import com.runova.app.state.AppData
import com.runova.app.state.AppSettings
import com.runova.app.state.InboxEntry
import com.runova.app.state.ProgressState
import com.runova.app.state.UiEnv
import com.runova.app.state.UiMapper
import com.runova.app.ui.model.InboxKind
import com.runova.core.format.Fmt
import com.runova.core.geo.LatLng
import com.runova.core.model.RunRecord
import com.runova.core.progress.Levels
import com.runova.core.progress.Rewards
import com.runova.core.progress.RewardsCalculator
import com.runova.core.progress.XpKind
import com.runova.core.tracking.RunSummary
import com.runova.core.tracking.RunTracker
import com.runova.core.tracking.TrackPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.time.LocalDate

/** A finished run together with everything it earned. */
data class FinishedRun(val run: RunRecord, val rewards: Rewards)

private data class Stored(
    val runs: List<RunRecord> = emptyList(),
    val routes: Map<Long, List<List<LatLng>>> = emptyMap(),
    val steps: Map<LocalDate, Int> = emptyMap(),
    val progress: ProgressState = ProgressState(),
    val inbox: List<InboxEntry> = emptyList(),
)

/**
 * Single source of truth for persisted data. Reads are cached in memory as [data]; every
 * database access runs on one serial dispatcher, so writes never interleave.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AppRepository(
    private val app: Application,
    private val database: RunovaDatabase,
    val settings: SettingsStore,
    scope: CoroutineScope,
) {
    val io = Dispatchers.IO.limitedParallelism(1)
    private val db: SQLiteDatabase get() = database.writableDatabase

    private val stored = MutableStateFlow(Stored())
    private val loadedState = MutableStateFlow(false)
    val loaded: StateFlow<Boolean> = loadedState.asStateFlow()

    val data: StateFlow<AppData> = combine(stored, settings.flow) { s, st -> compose(s, st) }
        .stateIn(scope, SharingStarted.Eagerly, compose(stored.value, settings.load()))

    init {
        scope.launch(io) {
            stored.value = readAll()
            loadedState.value = true
        }
    }

    private fun compose(s: Stored, settings: AppSettings) = AppData(settings, s.runs, s.steps, s.progress, s.inbox, s.routes)

    /** Current data, read synchronously (safe on [io] right after a write). */
    fun snapshot(): AppData = compose(stored.value, settings.load())

    private fun readAll(): Stored {
        val achievements = ProgressDao.achievements(db)
        return Stored(
            runs = RunDao.all(db),
            routes = RunDao.routes(db),
            steps = StepsDao.all(db),
            progress = ProgressState(
                totalXp = ProgressDao.totalXp(db),
                unlocked = achievements.mapValues { it.value.first },
                acknowledged = achievements.filterValues { it.second }.keys,
                awardedGoalKeys = ProgressDao.goalKeys(db),
            ),
            inbox = ProgressDao.inbox(db),
        )
    }

    private fun reload() {
        stored.value = readAll()
    }

    fun updateSettings(transform: (AppSettings) -> AppSettings): AppSettings = settings.update(transform)

    // ---------------------------------------------------------------- runs

    suspend fun run(id: Long): RunRecord? = withContext(io) { RunDao.byId(db, id) }

    suspend fun points(runId: Long): List<TrackPoint> = withContext(io) { RunDao.points(db, runId) }

    suspend fun photos(runId: Long): List<PhotoRow> = withContext(io) { RunDao.photos(db, runId) }

    /** Stores a finished run, pays out its rewards and clears the recovery checkpoint. */
    suspend fun saveRun(summary: RunSummary, points: List<TrackPoint>, photos: List<PhotoRow>): FinishedRun = withContext(io) {
        val env = UiEnv.system()
        val now = System.currentTimeMillis()
        val record = RunRecord(
            id = 0,
            startTimeMs = summary.startWallTimeMs,
            endTimeMs = summary.endWallTimeMs,
            movingTimeMs = summary.movingTimeMs,
            distanceM = summary.distanceM,
            calories = summary.calories,
            steps = summary.steps,
            stepsEstimated = summary.stepsEstimated,
            elevationGainM = summary.elevationGainM,
            elevationLossM = summary.elevationLossM,
            maxSpeedMps = summary.maxSpeedMps,
            avgHeartRate = summary.avgHeartRate,
            maxHeartRate = summary.maxHeartRate,
            xpEarned = 0,
            title = UiMapper.runTitle(summary.startWallTimeMs, env),
        )
        val finished = db.inTransaction {
            val id = RunDao.insert(this, record, RouteCodec.encode(UiMapper.thumbnailRoute(points)))
            RunDao.insertPoints(this, "points", id, points, 0)
            photos.forEach { RunDao.insertPhoto(this, "photos", id, it.path, it.takenMs, it.lat, it.lng) }
            RunDao.clearLive(this)
            val saved = record.copy(id = id)
            val before = snapshot()
            val rewards = RewardsCalculator.forRun(saved, UiMapper.rewardsInput(before.copy(runs = listOf(saved) + before.runs), env))
            val paid = applyRewards(this, rewards, now, runId = id)
            RunDao.setXp(this, id, paid.xpGained.toInt())
            val units = before.settings.units
            ProgressDao.addInbox(
                this, InboxKind.RUN,
                "${saved.title}: ${Fmt.distance(saved.distanceM, units)}",
                "${Fmt.durationCompact(saved.movingTimeMs)} • ${Fmt.pace(saved.avgPaceSecPerKm, units)} ${Fmt.paceUnit(units)} • +${paid.xpGained} XP",
                now, "run:$id",
            )
            FinishedRun(saved.copy(xpEarned = paid.xpGained.toInt()), paid)
        }
        reload()
        finished
    }

    /**
     * Writes [rewards] to the ledger. Goals and achievements that were already paid (a
     * concurrent evaluation) are dropped. Returns what was actually paid.
     */
    private fun applyRewards(db: SQLiteDatabase, rewards: Rewards, now: Long, runId: Long?): Rewards {
        val paid = rewards.awards.filter { award ->
            when (award.kind) {
                XpKind.GOAL -> award.ref != null && ProgressDao.addGoalKey(db, award.ref!!, now)
                XpKind.ACHIEVEMENT -> award.ref != null && ProgressDao.unlock(db, award.ref!!, now)
                else -> true
            }
        }
        paid.forEach { ProgressDao.addXp(db, it, now, runId) }
        val result = rewards.copy(
            awards = paid,
            goals = rewards.goals.filter { g -> paid.any { it.ref == g.key } },
            achievements = rewards.achievements.filter { a -> paid.any { it.ref == a.id } },
        )
        for (g in result.goals) {
            ProgressDao.addInbox(db, InboxKind.GOAL, "${g.label} complete", "Goal reached. +${g.xp} XP", now, "goal:${g.key}")
        }
        for (a in result.achievements) {
            ProgressDao.addInbox(db, InboxKind.ACHIEVEMENT, "Achievement unlocked: ${a.title}", "${a.unlockText} +${a.xp} XP", now, "achievement:${a.id}")
        }
        if (result.leveledUp) {
            val after = result.levelAfter
            ProgressDao.addInbox(
                db, InboxKind.LEVEL,
                "Level up! You're now Level ${after.level}",
                "${Levels.title(after.level)} — ${Fmt.integer(after.xpToNext)} XP to Level ${after.level + 1}.",
                now, null,
            )
        }
        return result
    }

    /** Pays out rewards that are due without a run (e.g. a step goal reached by walking). */
    suspend fun settlePendingRewards(): Rewards? = withContext(io) {
        if (!loadedState.value) return@withContext null
        val rewards = RewardsCalculator.pending(UiMapper.rewardsInput(snapshot(), UiEnv.system()))
        if (rewards.isEmpty) return@withContext null
        val paid = db.inTransaction { applyRewards(this, rewards, System.currentTimeMillis(), runId = null) }
        reload()
        paid.takeUnless { it.isEmpty }
    }

    suspend fun deleteRun(id: Long) = withContext(io) {
        val photos = RunDao.photos(db, id)
        db.inTransaction { RunDao.delete(this, id) }
        photos.forEach { File(it.path).delete() }
        reload()
    }

    /** Removes every run, all progress, files, settings and the API key's ciphertext. */
    suspend fun deleteEverything() = withContext(io) {
        db.inTransaction {
            for (table in TABLES) delete(table, null, null)
        }
        File(app.filesDir, "photos").deleteRecursively()
        File(app.filesDir, AVATAR_FILE).delete()
        File(app.cacheDir, "shared").deleteRecursively()
        settings.reset()
        settings.resetInternal()
        reload()
    }

    // ---------------------------------------------------------------- progress & inbox

    suspend fun acknowledgeAchievements(ids: Collection<String>) = withContext(io) {
        if (ids.isEmpty()) return@withContext
        ProgressDao.acknowledge(db, ids)
        reload()
    }

    suspend fun markInboxRead(id: Long? = null) = withContext(io) {
        ProgressDao.markRead(db, id)
        reload()
    }

    // ---------------------------------------------------------------- steps

    suspend fun addSteps(day: LocalDate, delta: Int) = withContext(io) {
        if (delta <= 0) return@withContext
        StepsDao.add(db, day, delta)
        reload()
    }

    // ---------------------------------------------------------------- live run checkpoint

    suspend fun saveLive(startWallMs: Long, paused: Boolean, checkpoint: RunTracker.Checkpoint, newPoints: List<TrackPoint>, firstSeq: Int) =
        withContext(io) { db.inTransaction { RunDao.saveLive(this, startWallMs, paused, checkpoint, newPoints, firstSeq) } }

    suspend fun loadLive(): LiveRow? = withContext(io) { RunDao.loadLive(db) }

    suspend fun clearLive() = withContext(io) {
        val photos = RunDao.livePhotos(db)
        db.inTransaction { RunDao.clearLive(this) }
        photos.forEach { File(it.path).delete() }
    }

    suspend fun addLivePhoto(path: String, takenMs: Long, lat: Double?, lng: Double?): PhotoRow = withContext(io) {
        val id = RunDao.insertPhoto(db, "live_photos", null, path, takenMs, lat, lng)
        PhotoRow(id, 0, path, takenMs, lat, lng)
    }

    // ---------------------------------------------------------------- coach chat

    suspend fun chat(): List<ChatRow> = withContext(io) { ChatDao.recent(db) }

    suspend fun addChat(fromUser: Boolean, text: String): ChatRow = withContext(io) {
        val ts = System.currentTimeMillis()
        ChatRow(ChatDao.add(db, fromUser, text, ts), ts, fromUser, text)
    }

    suspend fun clearChat() = withContext(io) { ChatDao.clear(db) }

    companion object {
        const val AVATAR_FILE = "avatar.jpg"
        private val TABLES = listOf(
            "runs", "points", "photos", "live_run", "live_points", "live_photos",
            "xp_events", "achievements", "goal_awards", "inbox", "daily_steps", "chat",
        )
    }
}

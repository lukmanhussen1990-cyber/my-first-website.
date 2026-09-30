package com.runova.core.coach

import com.runova.core.format.Fmt
import com.runova.core.model.BodyProfile
import com.runova.core.model.GoalMetric
import com.runova.core.model.Goals
import com.runova.core.model.RunRecord
import com.runova.core.model.UnitSystem
import com.runova.core.progress.AchievementProgress
import com.runova.core.progress.LevelProgress
import com.runova.core.progress.Levels
import com.runova.core.stats.DayActivity
import com.runova.core.stats.GoalProgress
import com.runova.core.stats.StatsCalculator
import com.runova.core.stats.StatsRange
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

enum class InsightKind { GOAL, TREND, SUGGESTION, RECOVERY, STREAK, LEVEL, ACHIEVEMENT, WELCOME }

data class CoachInsight(val kind: InsightKind, val text: String, val priority: Int)

/** Everything the coach knows about the user at a point in time. */
data class CoachSnapshot(
    val now: LocalDateTime,
    val zone: ZoneId,
    val name: String,
    val units: UnitSystem,
    val profile: BodyProfile,
    val goals: Goals,
    /** Finished runs, any order. */
    val runs: List<RunRecord>,
    val today: DayActivity,
    val daily: List<GoalProgress>,
    val weekly: List<GoalProgress>,
    val monthly: List<GoalProgress>,
    val currentStreak: Int,
    val longestStreak: Int,
    val level: LevelProgress,
    val achievements: List<AchievementProgress>,
    val firstDayOfWeek: DayOfWeek = DayOfWeek.MONDAY,
)

/**
 * Offline, rule-based coach. It produces short insight cards and answers free-text questions
 * with intent matching over the user's own data. It never needs a network connection.
 */
object CoachEngine {

    private fun GoalProgress?.orZero(metric: GoalMetric) = this ?: GoalProgress(metric, 0.0, 0.0)

    private fun List<GoalProgress>.of(metric: GoalMetric) = firstOrNull { it.metric == metric }.orZero(metric)

    private fun dist(meters: Double, s: CoachSnapshot) = Fmt.distanceSpoken(meters, s.units)

    private fun sortedRuns(s: CoachSnapshot) = s.runs.sortedByDescending { it.startTimeMs }

    private fun weekPace(s: CoachSnapshot, weeksAgo: Long): Double? {
        val anchor = StatsCalculator.shift(StatsRange.WEEK, s.now.toLocalDate(), -weeksAgo)
        val stats = StatsCalculator.compute(StatsRange.WEEK, anchor, s.runs.filter { it.distanceM >= 1000 }, s.zone, Locale.US, s.firstDayOfWeek)
        return stats.avgPaceSecPerKm
    }

    /** Suggested distance for the next run in meters, based on recent runs. */
    fun suggestedDistanceM(s: CoachSnapshot): Double {
        val recent = sortedRuns(s).take(5).filter { it.distanceM >= 500 }
        if (recent.isEmpty()) return if (s.units == UnitSystem.METRIC) 3000.0 else 3218.688
        val avg = recent.sumOf { it.distanceM } / recent.size
        val unit = if (s.units == UnitSystem.METRIC) 1000.0 else 1609.344
        val target = (avg * 1.1 / unit * 2).roundToInt() / 2.0 * unit
        return target.coerceIn(2 * unit, 25 * unit)
    }

    private fun consecutiveDaysUpToToday(s: CoachSnapshot): Int {
        val days = s.runs.map { Instant.ofEpochMilli(it.startTimeMs).atZone(s.zone).toLocalDate() }.toSet()
        var d = s.now.toLocalDate()
        var n = 0
        while (d in days) { n++; d = d.minusDays(1) }
        return n
    }

    fun insights(s: CoachSnapshot): List<CoachInsight> {
        val out = ArrayList<CoachInsight>()
        val runs = sortedRuns(s)
        if (runs.isEmpty()) {
            out.add(CoachInsight(InsightKind.WELCOME, "Welcome to RUNOVA, ${s.name}! Start with an easy ${dist(suggestedDistanceM(s), s)} run to set your baseline.", 100))
            out.add(CoachInsight(InsightKind.GOAL, "Your daily goal is ${dist(s.goals.daily.distanceKm * 1000, s)}. Every step counts — even a brisk walk moves the ring.", 60))
            out.add(CoachInsight(InsightKind.RECOVERY, "Remember to warm up for 5 minutes and stay hydrated before your first run.", 10))
            return out
        }

        // Daily distance goal
        val dayDist = s.daily.of(GoalMetric.DISTANCE)
        if (dayDist.target > 0) {
            val remaining = dayDist.remaining * 1000
            when {
                dayDist.isComplete -> out.add(CoachInsight(InsightKind.GOAL, "Daily distance goal complete — ${dist(dayDist.current * 1000, s)} today. Amazing work! 🎉", 90))
                dayDist.current > 0 -> out.add(CoachInsight(InsightKind.GOAL, "You're ${dist(remaining, s)} away from your daily goal. Keep going! 🔥", 95))
                else -> out.add(CoachInsight(InsightKind.GOAL, "No run yet today. A ${dist(remaining, s)} run would complete your daily goal.", 70))
            }
        }

        // Pace trend week over week
        val thisWeek = weekPace(s, 0)
        val lastWeek = weekPace(s, 1)
        if (thisWeek != null && lastWeek != null) {
            val change = (lastWeek - thisWeek) / lastWeek
            if (change >= 0.02) {
                out.add(CoachInsight(InsightKind.TREND, "Your pace improved by ${(change * 100).roundToInt()}% compared to last week. Great progress!", 85))
            } else if (change <= -0.05) {
                out.add(CoachInsight(InsightKind.TREND, "Your pace is ${(abs(change) * 100).roundToInt()}% slower than last week. That's fine on easy days — add some strides to build speed.", 40))
            } else {
                out.add(CoachInsight(InsightKind.TREND, "Your pace is steady at ${Fmt.pace(thisWeek, s.units)} ${Fmt.paceUnit(s.units)} this week. Consistency builds endurance.", 35))
            }
        }

        // Weekly distance goal
        val week = s.weekly.of(GoalMetric.DISTANCE)
        if (week.target > 0) {
            val today = s.now.toLocalDate()
            val weekStart = StatsCalculator.rangeStart(StatsRange.WEEK, today, s.firstDayOfWeek)
            val daysLeft = (weekStart.plusDays(7).toEpochDay() - today.toEpochDay()).toInt()
            if (week.isComplete) {
                out.add(CoachInsight(InsightKind.GOAL, "Weekly goal reached: ${dist(week.current * 1000, s)} so far this week! 🏆", 80))
            } else {
                val dayWord = if (daysLeft == 1) "day" else "days"
                out.add(CoachInsight(InsightKind.GOAL, "You need another ${dist(week.remaining * 1000, s)} to complete your weekly goal — $daysLeft $dayWord left.", 75))
            }
        }

        // Suggestion / recovery
        val consecutive = consecutiveDaysUpToToday(s)
        if (consecutive >= 5) {
            out.add(CoachInsight(InsightKind.RECOVERY, "You've run $consecutive days in a row. Consider an easy recovery run or a rest day tomorrow.", 88))
        } else {
            out.add(CoachInsight(InsightKind.SUGGESTION, "Based on your activity, try a ${dist(suggestedDistanceM(s), s)} run tomorrow.", 65))
        }

        // Streak
        if (s.currentStreak >= 2) {
            val ranToday = s.today.runs > 0
            val text = if (ranToday) "🔥 ${s.currentStreak}-day streak! You're on fire — see you tomorrow."
            else "🔥 You're on a ${s.currentStreak}-day streak. Run today to keep it alive!"
            out.add(CoachInsight(InsightKind.STREAK, text, if (ranToday) 55 else 92))
        }

        // Level
        if (s.level.xpToNext in 1..600) {
            out.add(CoachInsight(InsightKind.LEVEL, "Only ${s.level.xpToNext} XP to reach Level ${s.level.level + 1}. One more run should do it!", 60))
        }

        // Closest achievement
        s.achievements.filter { !it.isUnlocked && !it.isComplete && it.fraction >= 0.5f }
            .maxByOrNull { it.fraction }
            ?.let { a ->
                out.add(CoachInsight(InsightKind.ACHIEVEMENT, "You're ${(a.fraction * 100).roundToInt()}% of the way to “${a.def.title}”. ${a.def.description}", 50))
            }

        out.add(CoachInsight(InsightKind.RECOVERY, recoveryTip(s), 20))
        return out.sortedByDescending { it.priority }
    }

    private val tips = listOf(
        "Remember to stay hydrated and get enough sleep for better recovery.",
        "Easy runs should feel conversational — most of your weekly volume belongs there.",
        "Increase your weekly distance by no more than about 10% to stay injury-free.",
        "A 5-minute warm-up walk or jog prepares your muscles and joints for faster running.",
        "Refuel within an hour after longer runs: some carbohydrates plus protein.",
    )

    private fun recoveryTip(s: CoachSnapshot): String = tips[(s.now.dayOfYear) % tips.size]

    // ------------------------------------------------------------------ Q & A

    fun answer(question: String, s: CoachSnapshot): String {
        val q = question.lowercase(Locale.ROOT).trim()
        if (q.isEmpty()) return "Ask me anything about your runs, goals or training!"
        val runs = sortedRuns(s)
        fun has(vararg words: String) = words.any { q.contains(it) }

        return when {
            has("hello", "hi ", "hey", "good morning", "good evening") || q == "hi" ->
                "Hey ${s.name}! 👋 ${insights(s).firstOrNull()?.text ?: "Ready for a run?"}"

            has("help", "what can you", "how do you work") ->
                "I analyse your runs offline. Ask me things like “How far did I run this week?”, “What's my best pace?”, " +
                    "“How is my streak?”, “Suggest a workout” or “Tips for recovery”."

            has("streak") ->
                if (s.currentStreak > 0) "You're on a ${s.currentStreak}-day streak (longest: ${s.longestStreak} days). " +
                    (if (s.today.runs > 0) "Today already counts — great job!" else "Run today to keep it alive!")
                else "No active streak right now — your longest was ${s.longestStreak} days. A short run today starts a new one!"

            has("level", "xp", "experience") ->
                "You're Level ${s.level.level} (${Levels.title(s.level.level)}) with ${Fmt.integer(s.level.totalXp, Locale.US)} XP. " +
                    "${Fmt.integer(s.level.xpToNext, Locale.US)} XP to go until Level ${s.level.level + 1}."

            has("achievement", "badge", "unlock") -> {
                val unlocked = s.achievements.count { it.isUnlocked }
                val next = s.achievements.filter { !it.isUnlocked }.maxByOrNull { it.fraction }
                "You've unlocked $unlocked of ${s.achievements.size} achievements." +
                    (next?.let { " Closest next: “${it.def.title}” (${(it.fraction * 100).roundToInt()}%) — ${it.def.description}" } ?: " You've collected them all! 🏆")
            }

            has("calorie", "kcal", "burn") -> {
                val week = s.weekly.of(GoalMetric.CALORIES)
                "Today you've burned about ${Fmt.calories(s.today.calories, Locale.US)} kcal and ${Fmt.calories(week.current, Locale.US)} kcal this week. " +
                    "These are estimates based on your weight, speed and elevation (ACSM equations)."
            }

            has("step") -> {
                val week = s.weekly.of(GoalMetric.STEPS)
                "You've taken ${Fmt.integer(s.today.steps, Locale.US)} steps today" +
                    (if (s.today.stepsEstimated) " (estimated from your runs)" else "") +
                    " and ${Fmt.integer(week.current.roundToInt(), Locale.US)} this week. Daily goal: ${Fmt.integer(s.goals.daily.steps, Locale.US)}."
            }

            has("longest", "farthest", "furthest", "biggest") -> {
                val r = runs.maxByOrNull { it.distanceM }
                if (r == null) "You haven't recorded a run yet." else
                    "Your longest run is ${dist(r.distanceM, s)} on ${date(r, s)} in ${Fmt.durationWords(r.movingTimeMs)}."
            }

            has("pace", "speed", "fast", "faster", "quick") -> {
                val best = runs.filter { it.distanceM >= 1000 }.minByOrNull { it.avgPaceSecPerKm ?: Double.MAX_VALUE }
                val recent = runs.filter { it.distanceM >= 1000 }.take(5)
                if (best == null) "Run at least 1 km and I'll start analysing your pace." else {
                    val recentPace = recent.sumOf { it.movingTimeMs } / 1000.0 / (recent.sumOf { it.distanceM } / 1000.0)
                    "Your best average pace is ${Fmt.pace(best.avgPaceSecPerKm, s.units)} ${Fmt.paceUnit(s.units)} (${date(best, s)}). " +
                        "Recent average: ${Fmt.pace(recentPace, s.units)} ${Fmt.paceUnit(s.units)}. " +
                        "To get faster, add one session of 6 × 400 m at a hard effort with 90 s easy jogging between."
                }
            }

            has("today") -> {
                val d = s.daily
                "Today: ${dist(s.today.distanceM, s)}, ${Fmt.integer(s.today.steps, Locale.US)} steps, ${s.today.activeMinutes} active minutes and ~${Fmt.calories(s.today.calories, Locale.US)} kcal. " +
                    "Daily goals complete: ${d.count { it.isComplete }}/${d.size}."
            }

            has("month") -> {
                val m = s.monthly.of(GoalMetric.DISTANCE)
                val count = runsInRange(s, StatsRange.MONTH)
                "This month you've run ${dist(m.current * 1000, s)} over $count ${if (count == 1) "run" else "runs"}. " +
                    if (m.isComplete) "Monthly goal complete! 🎉" else "${dist(m.remaining * 1000, s)} to go for your monthly goal."
            }

            has("week", "far", "distance", "how much", "km", "mile") -> {
                val w = s.weekly.of(GoalMetric.DISTANCE)
                val count = runsInRange(s, StatsRange.WEEK)
                "This week you've run ${dist(w.current * 1000, s)} over $count ${if (count == 1) "run" else "runs"}. " +
                    if (w.isComplete) "Weekly goal complete! 🏆" else "You need another ${dist(w.remaining * 1000, s)} to hit your weekly goal."
            }

            has("total", "all time", "lifetime", "overall", "ever") -> {
                val total = runs.sumOf { it.distanceM }
                "All time: ${runs.size} runs, ${dist(total, s)}, ${Fmt.durationWords(runs.sumOf { it.movingTimeMs })} of running and ~${Fmt.calories(runs.sumOf { it.calories }, Locale.US)} kcal."
            }

            has("goal") -> {
                val d = s.daily
                val lines = d.joinToString("; ") { g -> "${label(g.metric)} ${(g.fraction * 100).roundToInt()}%" }
                "Daily goal progress — $lines. Tap “Set New Goal” on the Goals screen to adjust your targets."
            }

            has("plan", "workout", "suggest", "tomorrow", "train", "should i run", "next run") -> {
                val consecutive = consecutiveDaysUpToToday(s)
                if (consecutive >= 5) "You've run $consecutive days in a row — take an easy 20-minute recovery jog or a full rest day tomorrow."
                else "Try a ${dist(suggestedDistanceM(s), s)} run tomorrow: 10 minutes easy, then 4 × 3 minutes at a comfortably hard pace with 2 minutes easy between, and a 5-minute cool-down."
            }

            has("water", "hydrat", "drink") ->
                "Drink regularly through the day; for runs over an hour, take a few sips every 15–20 minutes and consider electrolytes when it's hot."

            has("sleep", "recover", "rest", "sore", "tired") ->
                "Recovery is where fitness is built: aim for 7–9 hours of sleep, keep easy days easy, and schedule at least one rest day per week. " +
                    "If soreness lasts more than a few days, ease off."

            has("eat", "food", "nutrition", "carb", "protein", "diet") ->
                "Eat a light, carb-rich snack 1–2 hours before running, and refuel with carbohydrates plus ~20 g of protein within an hour after longer efforts."

            has("stretch", "warm", "injur", "pain", "knee", "shin") ->
                "Warm up with 5 minutes of easy jogging and dynamic moves (leg swings, high knees). Stretch gently afterwards. " +
                    "Sharp or persistent pain is a signal to stop and see a health professional."

            has("motivat", "lazy", "bored", "can't", "cant") ->
                "Start small: put your shoes on and go for 10 minutes. Most of the time you'll keep going — and your streak and XP will thank you! 💪"

            else ->
                "I'm your offline coach, so I work best with questions about your runs, pace, goals, streaks and training. " +
                    "Try “How far did I run this week?” or “Suggest a workout”."
        }
    }

    private fun label(m: GoalMetric) = when (m) {
        GoalMetric.CALORIES -> "Calories"
        GoalMetric.DISTANCE -> "Distance"
        GoalMetric.STEPS -> "Steps"
        GoalMetric.ACTIVE_MINUTES -> "Active time"
    }

    private fun runsInRange(s: CoachSnapshot, range: StatsRange): Int {
        val stats = StatsCalculator.compute(range, s.now.toLocalDate(), s.runs, s.zone, Locale.US, s.firstDayOfWeek)
        return stats.runs
    }

    private val dateFmt = DateTimeFormatter.ofPattern("EEE d MMM", Locale.US)

    private fun date(r: RunRecord, s: CoachSnapshot) = Instant.ofEpochMilli(r.startTimeMs).atZone(s.zone).format(dateFmt)

    /**
     * Compact, factual summary of the user's data, used as grounding context when an external
     * language model is configured.
     */
    fun contextSummary(s: CoachSnapshot): String {
        val sb = StringBuilder()
        val u = s.units
        sb.append("Runner: ${s.name}. Units: ${if (u == UnitSystem.METRIC) "metric (km)" else "imperial (miles)"}.\n")
        sb.append("Body: ${s.profile.weightKg.roundToInt()} kg, ${s.profile.heightCm.roundToInt()} cm")
        s.profile.age?.let { sb.append(", age $it") }
        sb.append(".\nNow: ${s.now.format(DateTimeFormatter.ofPattern("EEEE d MMMM yyyy HH:mm", Locale.US))}.\n")
        sb.append("Level ${s.level.level} (${Levels.title(s.level.level)}), ${s.level.totalXp} XP, ${s.level.xpToNext} XP to next level.\n")
        sb.append("Current streak ${s.currentStreak} days, longest ${s.longestStreak} days.\n")
        fun goals(title: String, list: List<GoalProgress>) {
            sb.append("$title goals: ")
            sb.append(list.joinToString(", ") { g ->
                val cur = if (g.metric == GoalMetric.DISTANCE) Fmt.distanceSpoken(g.current * 1000, u) else g.current.roundToInt().toString()
                val tgt = if (g.metric == GoalMetric.DISTANCE) Fmt.distanceSpoken(g.target * 1000, u) else g.target.roundToInt().toString()
                "${label(g.metric)} $cur / $tgt"
            })
            sb.append(".\n")
        }
        goals("Daily", s.daily)
        goals("Weekly", s.weekly)
        goals("Monthly", s.monthly)
        val runs = sortedRuns(s)
        sb.append("Total: ${runs.size} runs, ${Fmt.distanceSpoken(runs.sumOf { it.distanceM }, u)}.\n")
        if (runs.isNotEmpty()) {
            sb.append("Recent runs (newest first):\n")
            for (r in runs.take(12)) {
                sb.append("- ${date(r, s)}: ${Fmt.distance(r.distanceM, u)}, ${Fmt.durationCompact(r.movingTimeMs)}, pace ${Fmt.pace(r.avgPaceSecPerKm, u)}${Fmt.paceUnit(u)}, ~${r.calories.roundToInt()} kcal (estimated)")
                if (r.elevationGainM >= 1) sb.append(", +${r.elevationGainM.roundToInt()} m")
                r.avgHeartRate?.let { sb.append(", avg HR $it bpm") }
                sb.append("\n")
            }
        }
        val unlocked = s.achievements.filter { it.isUnlocked }.joinToString(", ") { it.def.title }
        sb.append("Achievements unlocked: ${unlocked.ifEmpty { "none yet" }}.\n")
        val next = s.achievements.filter { !it.isUnlocked }.sortedByDescending { it.fraction }.take(3)
        if (next.isNotEmpty()) sb.append("Closest next: ${next.joinToString(", ") { "${it.def.title} ${(it.fraction * 100).roundToInt()}%" }}.\n")
        return sb.toString()
    }

    /** Largest remaining daily goal, as a fraction; used to decide which ring to highlight. */
    fun overallDailyProgress(daily: List<GoalProgress>): Float {
        if (daily.isEmpty()) return 0f
        return (daily.sumOf { it.fraction.toDouble() } / daily.size).toFloat()
    }
}

package com.imran.examcountdown.data

import android.content.Context
import android.content.SharedPreferences
import com.imran.examcountdown.core.CheckItem
import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.Elective
import com.imran.examcountdown.core.Exam
import com.imran.examcountdown.core.FocusMode
import com.imran.examcountdown.core.FocusState
import com.imran.examcountdown.core.MilLanguage
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.core.Profile
import com.imran.examcountdown.core.ReminderSettings
import com.imran.examcountdown.core.Subject
import com.imran.examcountdown.core.ThemeMode
import com.imran.examcountdown.core.Timetable
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeParseException

/**
 * Everything the app remembers, kept in SharedPreferences on the phone. Nothing leaves
 * the device. Cheap to create: Android caches the underlying preferences file.
 */
class Store(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    var setupDone: Boolean
        get() = prefs.getBoolean(K_SETUP, false)
        set(value) = prefs.edit().putBoolean(K_SETUP, value).apply()

    var profile: Profile
        get() {
            val d = Profile()
            return Profile(
                name = string(K_NAME, d.name),
                school = string(K_SCHOOL, d.school),
                className = string(K_CLASS, d.className),
                roll = string(K_ROLL, d.roll),
                hall = string(K_HALL, d.hall),
                examination = string(K_EXAMINATION, d.examination),
            )
        }
        set(p) = prefs.edit()
            .putString(K_NAME, p.name.trim())
            .putString(K_SCHOOL, p.school.trim())
            .putString(K_CLASS, p.className.trim())
            .putString(K_ROLL, p.roll.trim())
            .putString(K_HALL, p.hall.trim())
            .putString(K_EXAMINATION, p.examination.trim())
            .apply()

    var choices: Choices
        get() = Choices(
            mil = enumOrNull<MilLanguage>(prefs.getString(K_MIL, null)),
            elective = enumOrNull<Elective>(prefs.getString(K_ELECTIVE, null)),
        )
        set(c) = prefs.edit().putString(K_MIL, c.mil?.name).putString(K_ELECTIVE, c.elective?.name).apply()

    /** The timetable, including any edits. Always one entry per subject. */
    var exams: List<Exam>
        get() = decodeExams(prefs.getString(K_EXAMS, null))
        set(value) = prefs.edit().putString(K_EXAMS, encodeExams(value)).apply()

    /** Keys of exams Imran marked as finished (see [Exam.key]). */
    var markedDone: Set<String>
        get() = HashSet(prefs.getStringSet(K_MARKED_DONE, emptySet()) ?: emptySet())
        set(value) = prefs.edit().putStringSet(K_MARKED_DONE, HashSet(value)).apply()

    var reminders: ReminderSettings
        get() = ReminderSettings(
            enabled = prefs.getBoolean(K_REM_ON, false),
            dayBefore = prefs.getBoolean(K_REM_DAY, true),
            hourBefore = prefs.getBoolean(K_REM_HOUR, true),
            focusAlerts = prefs.getBoolean(K_REM_FOCUS, false),
            armedAt = prefs.getLong(K_REM_ARMED, 0L),
        )
        set(r) = prefs.edit()
            .putBoolean(K_REM_ON, r.enabled)
            .putBoolean(K_REM_DAY, r.dayBefore)
            .putBoolean(K_REM_HOUR, r.hourBefore)
            .putBoolean(K_REM_FOCUS, r.focusAlerts)
            .putLong(K_REM_ARMED, r.armedAt)
            .apply()

    /** Reminder keys already shown, so none is shown twice. */
    var delivered: Set<String>
        get() = HashSet(prefs.getStringSet(K_DELIVERED, emptySet()) ?: emptySet())
        set(value) = prefs.edit().putStringSet(K_DELIVERED, HashSet(value)).apply()

    var motion: MotionPref
        get() = enumOrNull<MotionPref>(prefs.getString(K_MOTION, null)) ?: MotionPref.SYSTEM
        set(value) = prefs.edit().putString(K_MOTION, value.name).apply()

    var focus: FocusState
        get() = decodeFocus(prefs.getString(K_FOCUS, null))
        set(value) = prefs.edit().putString(K_FOCUS, encodeFocus(value)).apply()

    var theme: ThemeMode
        get() = enumOrNull<ThemeMode>(prefs.getString(K_THEME, null)) ?: ThemeMode.SYSTEM
        set(value) = prefs.edit().putString(K_THEME, value.name).apply()

    /** Play the school-logo opening on cold launch. */
    var introEnabled: Boolean
        get() = prefs.getBoolean(K_INTRO, true)
        set(value) = prefs.edit().putBoolean(K_INTRO, value).apply()

    var haptics: Boolean
        get() = prefs.getBoolean(K_HAPTICS, true)
        set(value) = prefs.edit().putBoolean(K_HAPTICS, value).apply()

    /** Changes whenever the profile photo is saved or removed; 0 means no photo. */
    var avatarVersion: Long
        get() = prefs.getLong(K_AVATAR, 0L)
        set(value) = prefs.edit().putLong(K_AVATAR, value).apply()

    fun checklist(key: String, defaults: List<String>): List<CheckItem> {
        val json = prefs.getString(K_CHECKLIST + key, null)
            ?: return defaults.mapIndexed { i, text -> CheckItem(i + 1L, text) }
        return decodeItems(json)
    }

    fun saveChecklist(key: String, items: List<CheckItem>) =
        prefs.edit().putString(K_CHECKLIST + key, encodeItems(items)).apply()

    fun resetChecklist(key: String) = prefs.edit().remove(K_CHECKLIST + key).apply()

    /** Wipes everything, including the profile and checklists. */
    fun resetAll() {
        prefs.edit().clear().commit()
    }

    private fun string(key: String, fallback: String): String = prefs.getString(key, null) ?: fallback

    companion object {
        private const val FILE = "imran_exam_countdown"
        private const val K_SETUP = "setup_done"
        private const val K_NAME = "profile_name"
        private const val K_SCHOOL = "profile_school"
        private const val K_CLASS = "profile_class"
        private const val K_ROLL = "profile_roll"
        private const val K_HALL = "profile_hall"
        private const val K_EXAMINATION = "profile_examination"
        private const val K_MIL = "choice_mil"
        private const val K_ELECTIVE = "choice_elective"
        private const val K_EXAMS = "exams_v1"
        private const val K_MARKED_DONE = "marked_done"
        private const val K_REM_ON = "reminders_on"
        private const val K_REM_DAY = "reminders_day_before"
        private const val K_REM_HOUR = "reminders_hour_before"
        private const val K_REM_FOCUS = "reminders_focus"
        private const val K_REM_ARMED = "reminders_armed_at"
        private const val K_DELIVERED = "reminders_delivered"
        private const val K_MOTION = "motion"
        private const val K_FOCUS = "focus_v1"
        private const val K_CHECKLIST = "checklist_v1:"
        private const val K_THEME = "theme"
        private const val K_INTRO = "intro_enabled"
        private const val K_HAPTICS = "haptics"
        private const val K_AVATAR = "avatar_version"

        fun encodeExams(list: List<Exam>): String {
            val array = JSONArray()
            for (e in list) {
                array.put(
                    JSONObject()
                        .put("subject", e.subject.name)
                        .put("date", e.date.toString())
                        .put("start", e.start.toString())
                        .put("minutes", e.durationMinutes ?: JSONObject.NULL),
                )
            }
            return array.toString()
        }

        /** Falls back to the official timetable for anything missing or unreadable. */
        fun decodeExams(json: String?): List<Exam> {
            if (json == null) return Timetable.DEFAULT
            val parsed = HashMap<Subject, Exam>()
            try {
                val array = JSONArray(json)
                for (i in 0 until array.length()) {
                    val o = array.optJSONObject(i) ?: continue
                    val subject = enumOrNull<Subject>(o.optString("subject")) ?: continue
                    try {
                        parsed[subject] = Exam(
                            subject = subject,
                            date = LocalDate.parse(o.getString("date")),
                            start = LocalTime.parse(o.getString("start")),
                            durationMinutes = if (o.isNull("minutes")) null else o.getInt("minutes"),
                        )
                    } catch (e: DateTimeParseException) {
                        // Keep the official entry for this subject.
                    }
                }
            } catch (e: JSONException) {
                return Timetable.DEFAULT
            }
            return Subject.entries.map { parsed[it] ?: Timetable.default(it) }
        }

        fun encodeFocus(s: FocusState): String = JSONObject()
            .put("mode", s.mode.name)
            .put("running", s.running)
            .put("endWall", s.endWall)
            .put("endElapsed", s.endElapsed)
            .put("boot", s.boot)
            .put("remaining", s.remaining)
            .put("finished", s.finished?.name ?: JSONObject.NULL)
            .put("sessionsToday", s.sessionsToday)
            .put("sessionsDay", s.sessionsDay)
            .toString()

        fun decodeFocus(json: String?): FocusState {
            if (json == null) return FocusState()
            return try {
                val o = JSONObject(json)
                val mode = enumOrNull<FocusMode>(o.optString("mode")) ?: FocusMode.FOCUS
                FocusState(
                    mode = mode,
                    running = o.optBoolean("running", false),
                    endWall = o.optLong("endWall", 0L),
                    endElapsed = o.optLong("endElapsed", 0L),
                    boot = o.optInt("boot", -1),
                    remaining = o.optLong("remaining", mode.durationMs).coerceIn(0L, mode.durationMs),
                    finished = if (o.isNull("finished")) null else enumOrNull<FocusMode>(o.optString("finished")),
                    sessionsToday = o.optInt("sessionsToday", 0),
                    sessionsDay = o.optLong("sessionsDay", -1L),
                )
            } catch (e: JSONException) {
                FocusState()
            }
        }

        fun encodeItems(items: List<CheckItem>): String {
            val array = JSONArray()
            for (item in items) {
                array.put(JSONObject().put("id", item.id).put("text", item.text).put("done", item.done))
            }
            return array.toString()
        }

        fun decodeItems(json: String): List<CheckItem> = try {
            val array = JSONArray(json)
            (0 until array.length()).mapNotNull { i ->
                array.optJSONObject(i)?.let { CheckItem(it.optLong("id"), it.optString("text"), it.optBoolean("done")) }
            }
        } catch (e: JSONException) {
            emptyList()
        }

        private inline fun <reified T : Enum<T>> enumOrNull(name: String?): T? =
            if (name == null) null else enumValues<T>().firstOrNull { it.name == name }
    }
}

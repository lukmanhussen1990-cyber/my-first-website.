package com.imran.examcountdown.ui.screens

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.imran.examcountdown.MainActivity
import com.imran.examcountdown.R
import com.imran.examcountdown.core.Elective
import com.imran.examcountdown.core.Exam
import com.imran.examcountdown.core.Formats
import com.imran.examcountdown.core.MilLanguage
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.core.Profile
import com.imran.examcountdown.core.Subject
import com.imran.examcountdown.core.Timetable
import com.imran.examcountdown.notify.Notifier
import com.imran.examcountdown.ui.Dialogs
import com.imran.examcountdown.ui.Dialogs.actions
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.MotionPolicy
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.caps
import com.imran.examcountdown.ui.column
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.icon
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.row
import com.imran.examcountdown.ui.text
import com.imran.examcountdown.ui.update
import com.imran.examcountdown.ui.widgets.ButtonStyle
import com.imran.examcountdown.ui.widgets.SegmentedControl
import com.imran.examcountdown.ui.widgets.ToggleView
import com.imran.examcountdown.ui.widgets.pillButton

class SettingsScreen(host: MainActivity) : Screen(host) {

    private val scroll = ScrollView(ctx).apply {
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
    }
    override val root: View get() = scroll
    private val content = ctx.column()

    // Profile
    private val avatar = ctx.text("", 20f, Palette.WHITE, Fonts.semibold) {
        gravity = Gravity.CENTER
        background = Shapes.ovalGradient(Palette.ACCENT_GRADIENT)
    }
    private val profileName = ctx.text("", 20f, Palette.TEXT, Fonts.semibold)
    private val profileSchool = ctx.text("", 14f, Palette.TEXT_2)
    private val profileValues = HashMap<String, TextView>()

    // Subjects
    private val milControl = SegmentedControl(ctx, MilLanguage.entries.map { it.label })
    private val electiveControl = SegmentedControl(ctx, Elective.entries.map { it.shortLabel })

    // Schedule
    private val scheduleList = ctx.column()

    // Reminders
    private val remindersToggle = ToggleView(ctx)
    private val dayToggle = ToggleView(ctx)
    private val hourToggle = ToggleView(ctx)
    private val focusToggle = ToggleView(ctx)
    private val subToggles = ctx.column()
    private val permissionNote = ctx.text("", 13.5f, Palette.AMBER) { setLineSpacing(0f, 1.3f) }
    private val openSettingsButton = ctx.pillButton("Open notification settings", R.drawable.ic_bell, ButtonStyle.SECONDARY) {
        host.openNotificationSettings()
    }

    // Motion
    private val motionControl = SegmentedControl(ctx, MotionPref.entries.map { it.label })
    private val motionNote = ctx.text("", 13.5f, Palette.TEXT_3) { setLineSpacing(0f, 1.3f) }

    private val versionText = ctx.text("", 14f, Palette.TEXT_2)

    init {
        scroll.addView(content, FrameLayout.LayoutParams(MATCH, WRAP))
        content.addView(ctx.text("Settings", 30f, Palette.TEXT, Fonts.bold), lp { topMargin = ctx.dp(10) })
        content.addView(ctx.text("Everything stays on this phone.", 14.5f, Palette.TEXT_2), lp { topMargin = ctx.dp(6) })

        content.addView(section("Profile"), lp { topMargin = ctx.dp(22) })
        content.addView(profileCard(), lp { topMargin = ctx.dp(10) })

        content.addView(section("Subjects"), lp { topMargin = ctx.dp(24) })
        content.addView(subjectsCard(), lp { topMargin = ctx.dp(10) })

        content.addView(section("Exam schedule"), lp { topMargin = ctx.dp(24) })
        content.addView(scheduleCard(), lp { topMargin = ctx.dp(10) })

        content.addView(section("Reminders"), lp { topMargin = ctx.dp(24) })
        content.addView(remindersCard(), lp { topMargin = ctx.dp(10) })

        content.addView(section("Motion"), lp { topMargin = ctx.dp(24) })
        content.addView(motionCard(), lp { topMargin = ctx.dp(10) })

        content.addView(section("About"), lp { topMargin = ctx.dp(24) })
        content.addView(aboutCard(), lp { topMargin = ctx.dp(10) })
    }

    private fun section(title: String): View = ctx.caps(title, Palette.TEXT_3, 12f)

    // ---------------------------------------------------------------- profile

    private fun profileCard(): View = ctx.card(padding = 0) {
        addView(ctx.row {
            setPadding(dp(18), dp(18), dp(18), dp(14))
            addView(avatar, lp(dp(56), dp(56)))
            addView(ctx.column {
                addView(profileName)
                addView(profileSchool, lp { topMargin = dp(4) })
            }, lp(0, WRAP, 1f) { marginStart = dp(14) })
        })
        addView(divider())
        profileField("Name", R.drawable.ic_person) { p -> p.name }
        profileField("School", R.drawable.ic_school) { p -> p.school }
        profileField("Class", R.drawable.ic_study) { p -> p.className }
        profileField("Roll number", R.drawable.ic_flag) { p -> p.roll }
        profileField("Examination hall", R.drawable.ic_hall) { p -> p.hall }
        profileField("Examination", R.drawable.ic_calendar) { p -> p.examination }
    }

    private fun LinearLayout.profileField(label: String, iconRes: Int, read: (Profile) -> String) {
        val value = ctx.text("", 16f, Palette.TEXT)
        profileValues[label] = value
        addView(ctx.row {
            minimumHeight = dp(60)
            setPadding(dp(18), dp(10), dp(12), dp(10))
            background = Shapes.ripple(ctx, null, 0)
            addView(ctx.icon(iconRes, Palette.TEXT_3, 20))
            addView(ctx.column {
                addView(ctx.text(label, 12.5f, Palette.TEXT_3, Fonts.medium))
                addView(value, lp { topMargin = dp(3) })
            }, lp(0, WRAP, 1f) { marginStart = dp(16) })
            addView(ctx.icon(R.drawable.ic_edit, Palette.TEXT_3, 18))
            setOnClickListener { editField(label, read) }
        })
    }

    private fun editField(label: String, read: (Profile) -> String) {
        val profile = host.data.profile
        val type = if (label == "Roll number" || label == "Examination hall") {
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
        } else {
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS
        }
        Dialogs.editText(host, label, read(profile), inputType = type) { value ->
            val updated = when (label) {
                "Name" -> profile.copy(name = value)
                "School" -> profile.copy(school = value)
                "Class" -> profile.copy(className = value)
                "Roll number" -> profile.copy(roll = value)
                "Examination hall" -> profile.copy(hall = value)
                else -> profile.copy(examination = value)
            }
            host.updateProfile(updated)
            refresh()
        }
    }

    // ---------------------------------------------------------------- subjects

    private fun subjectsCard(): View = ctx.card {
        addView(ctx.row {
            addView(ctx.icon(R.drawable.ic_language, Palette.CYAN, 20))
            addView(ctx.text("MIL paper", 16f, Palette.TEXT, Fonts.semibold), lp(0, WRAP, 1f) { marginStart = dp(10) })
        })
        addView(milControl, lp { topMargin = dp(12) })
        addView(ctx.row {
            addView(ctx.icon(R.drawable.ic_sparkle, Palette.VIOLET_LIGHT, 20))
            addView(ctx.text("Elective", 16f, Palette.TEXT, Fonts.semibold), lp(0, WRAP, 1f) { marginStart = dp(10) })
        }, lp { topMargin = dp(20) })
        addView(electiveControl, lp { topMargin = dp(12) })
        milControl.onSelect = { i -> host.updateChoices(host.data.choices.copy(mil = MilLanguage.entries[i])); refresh() }
        electiveControl.onSelect = { i -> host.updateChoices(host.data.choices.copy(elective = Elective.entries[i])); refresh() }
    }

    // ---------------------------------------------------------------- schedule

    private fun scheduleCard(): View = ctx.card(padding = 0) {
        addView(ctx.text(
            "Tap an exam to change its date, start time or duration. ${Timetable.DURATION_NOTE}",
            13.5f, Palette.TEXT_3,
        ) {
            setLineSpacing(0f, 1.3f)
            setPadding(dp(18), dp(16), dp(18), dp(8))
        })
        addView(scheduleList)
        addView(divider())
        addView(ctx.row {
            minimumHeight = dp(56)
            setPadding(dp(18), dp(10), dp(18), dp(10))
            background = Shapes.ripple(ctx, null, 0)
            addView(ctx.icon(R.drawable.ic_restore, Palette.VIOLET_LIGHT, 20))
            addView(ctx.text("Reset to the official timetable", 15f, Palette.VIOLET_LIGHT, Fonts.semibold), lp(0, WRAP, 1f) { marginStart = dp(14) })
            setOnClickListener {
                Dialogs.confirm(
                    host, "Reset the timetable?",
                    "All eight exams go back to the official dates, 12:30 PM start and unconfirmed durations.",
                    "Reset",
                ) {
                    host.updateExams(Timetable.DEFAULT)
                    refresh()
                }
            }
        })
    }

    private fun renderSchedule() {
        scheduleList.removeAllViews()
        val choices = host.data.choices
        Timetable.sorted(host.data.exams).forEach { exam ->
            val edited = exam != Timetable.default(exam.subject)
            scheduleList.addView(ctx.row {
                minimumHeight = dp(64)
                setPadding(dp(18), dp(10), dp(12), dp(10))
                background = Shapes.ripple(ctx, null, 0)
                addView(ctx.column {
                    addView(ctx.row {
                        addView(ctx.text(exam.title(choices), 15.5f, Palette.TEXT, Fonts.semibold), lp(0, WRAP, 1f))
                        if (edited) addView(ctx.text("Edited", 11.5f, Palette.AMBER, Fonts.semibold) {
                            setPadding(dp(8), dp(3), dp(8), dp(3))
                            background = Shapes.rounded(ctx, 10, Palette.withAlpha(Palette.AMBER, 0.14f))
                        }, lp(WRAP, WRAP) { marginStart = dp(8) })
                    })
                    addView(ctx.text(
                        "${Formats.dateShort(exam.date)} · ${Formats.time(exam.start)} · ${Timetable.durationLabel(exam.durationMinutes)}",
                        13.5f, Palette.TEXT_2,
                    ), lp { topMargin = dp(4) })
                }, lp(0, WRAP, 1f))
                addView(ctx.icon(R.drawable.ic_chevron_right, Palette.TEXT_3, 22), lp(dp(22), dp(22)) { marginStart = dp(8) })
                setOnClickListener { editExam(exam.subject) }
            })
        }
    }

    private fun editExam(subject: Subject) {
        fun current(): Exam = host.data.exams.first { it.subject == subject }
        Dialogs.sheet(host, current().title(host.data.choices), "Changes apply straight away.") { dismiss ->
            val dateValue = ctx.text("", 16f, Palette.TEXT, Fonts.medium)
            val timeValue = ctx.text("", 16f, Palette.TEXT, Fonts.medium)
            val durationValue = ctx.text("", 16f, Palette.TEXT, Fonts.medium)
            fun render() {
                val e = current()
                dateValue.text = Formats.dateFull(e.date)
                timeValue.text = "${Formats.time(e.start)} (India time)"
                durationValue.text = Timetable.durationLabel(e.durationMinutes)
            }
            fun save(e: Exam) {
                host.updateExams(host.data.exams.map { if (it.subject == subject) e else it })
                render()
                refresh()
            }
            addView(editRow("Date", R.drawable.ic_calendar, dateValue) {
                val e = current()
                DatePickerDialog(host, R.style.Theme_ExamCountdown_Dialog, { _, y, m, d ->
                    save(e.copy(date = java.time.LocalDate.of(y, m + 1, d)))
                }, e.date.year, e.date.monthValue - 1, e.date.dayOfMonth).show()
            }, lp { topMargin = dp(16) })
            addView(editRow("Start time", R.drawable.ic_clock, timeValue) {
                val e = current()
                TimePickerDialog(host, R.style.Theme_ExamCountdown_Dialog, { _, h, min ->
                    save(e.copy(start = java.time.LocalTime.of(h, min)))
                }, e.start.hour, e.start.minute, false).show()
            }, lp { topMargin = dp(8) })
            addView(editRow("Duration", R.drawable.ic_bolt, durationValue) {
                val e = current()
                val options = Timetable.DURATION_CHOICES
                Dialogs.choice(
                    host, "Duration",
                    options.map { Timetable.durationLabel(it) },
                    options.indexOf(e.durationMinutes).coerceAtLeast(0),
                    message = "Only choose a duration once your school confirms it. ${Timetable.SESSION_NOTE}",
                ) { i -> save(e.copy(durationMinutes = options[i])) }
            }, lp { topMargin = dp(8) })
            render()
            actions(
                ctx.pillButton("Use official", R.drawable.ic_restore, ButtonStyle.GHOST) { save(Timetable.default(subject)) },
                ctx.pillButton("Done") { dismiss() },
            )
        }
    }

    private fun editRow(label: String, iconRes: Int, value: TextView, onClick: () -> Unit): View = ctx.row {
        minimumHeight = dp(60)
        setPadding(dp(14), dp(10), dp(12), dp(10))
        background = Shapes.ripple(ctx, Shapes.rounded(ctx, 16, 0x0FFFFFFF, Palette.STROKE), 16)
        addView(ctx.icon(iconRes, Palette.CYAN, 20))
        addView(ctx.column {
            addView(ctx.text(label, 12.5f, Palette.TEXT_3, Fonts.medium))
            addView(value, lp { topMargin = dp(3) })
        }, lp(0, WRAP, 1f) { marginStart = dp(14) })
        addView(ctx.icon(R.drawable.ic_chevron_right, Palette.TEXT_3, 20))
        setOnClickListener { onClick() }
    }

    // ---------------------------------------------------------------- reminders

    private fun remindersCard(): View = ctx.card(padding = 0) {
        addView(toggleRow("Exam reminders", "One day and one hour before each exam", R.drawable.ic_bell, remindersToggle))
        subToggles.addView(toggleRow("1 day before", null, null, dayToggle, indent = true))
        subToggles.addView(toggleRow("1 hour before", null, null, hourToggle, indent = true))
        addView(subToggles)
        addView(divider())
        addView(toggleRow("Focus timer alerts", "A notification when a session or break ends", R.drawable.ic_bolt, focusToggle))
        addView(ctx.column {
            setPadding(dp(18), dp(4), dp(18), dp(18))
            addView(permissionNote)
            addView(openSettingsButton, lp(WRAP, WRAP) { topMargin = dp(10) })
            addView(ctx.text(
                "Reminders work offline. To save battery, Android may deliver them a few minutes late.",
                13f, Palette.TEXT_3,
            ) { setLineSpacing(0f, 1.3f) }, lp { topMargin = dp(10) })
        })

        remindersToggle.onChange = { on ->
            host.setExamReminders(on) { refresh() }
        }
        dayToggle.onChange = { on -> host.updateReminderSettings { it.copy(dayBefore = on) }; refresh() }
        hourToggle.onChange = { on -> host.updateReminderSettings { it.copy(hourBefore = on) }; refresh() }
        focusToggle.onChange = { on ->
            host.setFocusAlerts(on) { refresh() }
        }
    }

    private fun toggleRow(title: String, subtitle: String?, iconRes: Int?, toggle: ToggleView, indent: Boolean = false): View = ctx.row {
        minimumHeight = dp(if (subtitle == null) 52 else 68)
        setPadding(dp(if (indent) 52 else 18), dp(10), dp(16), dp(10))
        if (iconRes != null) addView(ctx.icon(iconRes, Palette.CYAN, 20))
        addView(ctx.column {
            addView(ctx.text(title, if (indent) 15f else 16f, Palette.TEXT, if (indent) Fonts.regular else Fonts.semibold))
            if (subtitle != null) addView(ctx.text(subtitle, 13f, Palette.TEXT_3), lp { topMargin = dp(3) })
        }, lp(0, WRAP, 1f) { marginStart = if (iconRes != null) dp(14) else 0 })
        addView(toggle, lp(WRAP, WRAP) { marginStart = dp(12) })
        toggle.contentDescription = title
        setOnClickListener { toggle.performClick() }
    }

    // ---------------------------------------------------------------- motion & about

    private fun motionCard(): View = ctx.card {
        addView(ctx.row {
            addView(ctx.icon(R.drawable.ic_motion, Palette.CYAN, 20))
            addView(ctx.text("Reduce motion", 16f, Palette.TEXT, Fonts.semibold), lp(0, WRAP, 1f) { marginStart = dp(10) })
        })
        addView(motionControl, lp { topMargin = dp(12) })
        addView(motionNote, lp { topMargin = dp(12) })
        motionControl.onSelect = { i ->
            host.setMotion(MotionPref.entries[i])
            refresh()
        }
    }

    private fun aboutCard(): View = ctx.card {
        addView(ctx.row {
            addView(ImageView(ctx).apply { setImageResource(R.mipmap.ic_launcher) }, lp(dp(48), dp(48)))
            addView(ctx.column {
                addView(ctx.text(ctx.getString(R.string.app_name), 16.5f, Palette.TEXT, Fonts.semibold))
                addView(versionText, lp { topMargin = dp(3) })
            }, lp(0, WRAP, 1f) { marginStart = dp(14) })
        })
        addView(ctx.text(
            "Works completely offline. No account, no ads and no internet permission. " +
                "Your profile, checklists and settings are saved only on this phone.",
            14f, Palette.TEXT_2,
        ) { setLineSpacing(0f, 1.3f) }, lp { topMargin = dp(14) })
        addView(ctx.text("Font: Outfit, SIL Open Font License 1.1.", 13f, Palette.TEXT_3), lp { topMargin = dp(10) })
        addView(ctx.pillButton("Reset all data", R.drawable.ic_delete, ButtonStyle.DANGER) {
            Dialogs.confirm(
                host, "Reset everything?",
                "This clears your profile edits, subject choices, schedule edits, checklists, focus history and reminders.",
                "Reset everything", destructive = true,
            ) { host.resetAllData() }
        }, lp(WRAP, WRAP) { topMargin = dp(16) })
    }

    private fun divider(): View = View(ctx).apply {
        setBackgroundColor(Palette.STROKE)
        layoutParams = LinearLayout.LayoutParams(MATCH, 1)
    }

    private fun android.content.Context.card(padding: Int = 20, block: LinearLayout.() -> Unit): LinearLayout = column {
        background = Shapes.card(this@card, 24)
        setPadding(dp(padding), dp(padding), dp(padding), dp(padding))
        block()
    }

    // ---------------------------------------------------------------- lifecycle

    override fun onShow(first: Boolean) = refresh()

    override fun onDataChanged() {
        if (scroll.isShown) refresh()
    }

    override fun onMotionChanged() = refreshMotion()

    override fun applyInsets(top: Int, bottom: Int) {
        content.setPadding(ctx.dp(20), top + ctx.dp(8), ctx.dp(20), bottom + ctx.dp(120))
    }

    override fun nextTickDelay(now: Long): Long = 60_000L

    fun refresh() {
        val data = host.data
        val p = data.profile
        avatar.update(p.initials)
        profileName.update(p.name.ifBlank { "Your name" })
        profileSchool.update(listOf(p.school, "Class ${p.className}", "Roll ${p.roll}").filter { it.isNotBlank() }.joinToString(" · "))
        profileValues["Name"]?.update(p.name.ifBlank { "Not set" })
        profileValues["School"]?.update(p.school.ifBlank { "Not set" })
        profileValues["Class"]?.update(p.className.ifBlank { "Not set" })
        profileValues["Roll number"]?.update(p.roll.ifBlank { "Not set" })
        profileValues["Examination hall"]?.update(p.hall.ifBlank { "Not set" })
        profileValues["Examination"]?.update(p.examination.ifBlank { "Not set" })

        milControl.select(data.choices.mil?.ordinal ?: -1)
        electiveControl.select(data.choices.elective?.ordinal ?: -1)
        renderSchedule()

        val r = data.reminders
        val canPost = Notifier.canPost(ctx)
        remindersToggle.setChecked(r.enabled && canPost)
        dayToggle.setChecked(r.dayBefore)
        hourToggle.setChecked(r.hourBefore)
        focusToggle.setChecked(r.focusAlerts && canPost)
        subToggles.alpha = if (r.enabled && canPost) 1f else 0.45f
        dayToggle.isEnabled = r.enabled && canPost
        hourToggle.isEnabled = r.enabled && canPost
        val wanted = r.enabled || r.focusAlerts
        permissionNote.setVisible(wanted && !canPost)
        openSettingsButton.setVisible(wanted && !canPost)
        permissionNote.update("Notifications are turned off for this app, so reminders can’t be shown. Allow them in Android settings.")

        refreshMotion()
        versionText.update("Version ${host.versionName()} · Class VIII, Half-Yearly 2026–2027")
    }

    private fun refreshMotion() {
        val pref = host.data.motion
        motionControl.select(pref.ordinal)
        val policy: MotionPolicy = host.policy
        motionNote.update(
            when {
                pref == MotionPref.REDUCED -> "Animations are off: no particles, rolling digits or confetti."
                pref == MotionPref.FULL && !policy.ambient -> "Full motion, but Battery Saver is on, so floating particles are paused."
                pref == MotionPref.FULL -> "Full motion, even if Android’s “Remove animations” is on."
                !policy.motion -> "Following Android: “Remove animations” is on, so motion is reduced."
                !policy.ambient -> "Following Android. Battery Saver is on, so floating particles are paused."
                else -> "Following Android’s animation setting. Particles pause in Battery Saver."
            },
        )
    }
}

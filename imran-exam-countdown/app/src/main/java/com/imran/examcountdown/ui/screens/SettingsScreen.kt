package com.imran.examcountdown.ui.screens

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.text.InputType
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
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
import com.imran.examcountdown.core.ThemeMode
import com.imran.examcountdown.core.Timetable
import com.imran.examcountdown.notify.Notifier
import com.imran.examcountdown.ui.Dialogs
import com.imran.examcountdown.ui.Dialogs.actions
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.column
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.heading
import com.imran.examcountdown.ui.icon
import com.imran.examcountdown.ui.label
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.row
import com.imran.examcountdown.ui.separator
import com.imran.examcountdown.ui.text
import com.imran.examcountdown.ui.update
import com.imran.examcountdown.ui.widgets.AvatarView
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
    private val avatar = AvatarView(ctx)
    private val profileName = ctx.text("", 17f, Ui.c.text, Fonts.sansSemibold)
    private val profileValues = HashMap<String, TextView>()
    private var avatarVersion = -1L

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
    private val permissionNote = ctx.text("", 14f, Ui.c.danger) { setLineSpacing(0f, 1.3f) }
    private val openSettingsButton = ctx.pillButton("Open notification settings", R.drawable.ic_bell, ButtonStyle.SECONDARY) {
        host.openNotificationSettings()
    }

    // Appearance
    private val themeControl = SegmentedControl(ctx, ThemeMode.entries.map { it.label })
    private val introToggle = ToggleView(ctx)
    private val motionControl = SegmentedControl(ctx, MotionPref.entries.map { it.label })
    private val motionNote = ctx.text("", 13.5f, Ui.c.text3) { setLineSpacing(0f, 1.3f) }
    private val hapticsToggle = ToggleView(ctx)

    private val versionText = ctx.text("", 14f, Ui.c.text2)

    init {
        scroll.addView(content, FrameLayout.LayoutParams(MATCH, WRAP))
        content.addView(ctx.heading("Settings", 30f), lp { topMargin = ctx.dp(8) })
        content.addView(ctx.text("Everything stays on this phone.", 15f, Ui.c.text2), lp { topMargin = ctx.dp(6) })

        section("Profile")
        content.addView(profileHeader())
        content.addView(ctx.separator())
        profileField("School", R.drawable.ic_school) { it.school }
        profileField("Class", R.drawable.ic_study) { it.className }
        profileField("Roll number", R.drawable.ic_flag) { it.roll }
        profileField("Examination hall", R.drawable.ic_hall) { it.hall }
        profileField("Examination", R.drawable.ic_calendar, last = true) { it.examination }

        section("Subjects")
        content.addView(ctx.text("MIL paper", 16f, Ui.c.text, Fonts.sansSemibold), lp { topMargin = ctx.dp(4) })
        content.addView(milControl, lp { topMargin = ctx.dp(10) })
        content.addView(ctx.text("Elective", 16f, Ui.c.text, Fonts.sansSemibold), lp { topMargin = ctx.dp(18) })
        content.addView(electiveControl, lp { topMargin = ctx.dp(10) })
        milControl.onSelect = { i -> host.updateChoices(host.data.choices.copy(mil = MilLanguage.entries[i])); refresh() }
        electiveControl.onSelect = { i -> host.updateChoices(host.data.choices.copy(elective = Elective.entries[i])); refresh() }

        section("Exam schedule")
        content.addView(ctx.text(
            "Tap an exam to change its date, start time or duration. ${Timetable.DURATION_NOTE}",
            14f, Ui.c.text3,
        ) { setLineSpacing(0f, 1.3f) }, lp { bottomMargin = ctx.dp(6) })
        content.addView(scheduleList)
        content.addView(actionRow("Reset to the official timetable", R.drawable.ic_restore) {
            Dialogs.confirm(
                host, "Reset the timetable?",
                "All eight exams go back to the official dates, the 12:30 PM start and unconfirmed durations.",
                "Reset",
            ) {
                host.updateExams(Timetable.DEFAULT)
                refresh()
            }
        })

        section("Reminders")
        content.addView(toggleRow("Exam reminders", "One day and one hour before each exam", remindersToggle))
        subToggles.addView(ctx.separator())
        subToggles.addView(toggleRow("1 day before", null, dayToggle, indent = true))
        subToggles.addView(ctx.separator())
        subToggles.addView(toggleRow("1 hour before", null, hourToggle, indent = true))
        content.addView(subToggles)
        content.addView(ctx.separator())
        content.addView(toggleRow("Focus timer alerts", "A notification when a session or break ends", focusToggle))
        content.addView(permissionNote, lp { topMargin = ctx.dp(8) })
        content.addView(openSettingsButton, lp(WRAP, WRAP) { topMargin = ctx.dp(10) })
        content.addView(ctx.text(
            "Reminders work offline. To save battery, Android may deliver them a few minutes late.",
            13.5f, Ui.c.text3,
        ) { setLineSpacing(0f, 1.3f) }, lp { topMargin = ctx.dp(10) })
        remindersToggle.onChange = { on -> host.setExamReminders(on) { refresh() } }
        dayToggle.onChange = { on -> host.updateReminderSettings { it.copy(dayBefore = on) }; refresh() }
        hourToggle.onChange = { on -> host.updateReminderSettings { it.copy(hourBefore = on) }; refresh() }
        focusToggle.onChange = { on -> host.setFocusAlerts(on) { refresh() } }

        section("Appearance")
        content.addView(ctx.text("Theme", 16f, Ui.c.text, Fonts.sansSemibold), lp { topMargin = ctx.dp(4) })
        content.addView(themeControl, lp { topMargin = ctx.dp(10) })
        themeControl.onSelect = { i -> host.setTheme(ThemeMode.entries[i]) }
        content.addView(toggleRow("Opening animation", "The school logo intro when the app starts", introToggle), lp { topMargin = ctx.dp(8) })
        introToggle.onChange = { on -> host.store.introEnabled = on }
        content.addView(ctx.separator())
        content.addView(ctx.text("Reduce motion", 16f, Ui.c.text, Fonts.sansSemibold), lp { topMargin = ctx.dp(14) })
        content.addView(motionControl, lp { topMargin = ctx.dp(10) })
        content.addView(motionNote, lp { topMargin = ctx.dp(10) })
        motionControl.onSelect = { i -> host.setMotion(MotionPref.entries[i]); refresh() }
        content.addView(ctx.separator(), lp(MATCH, WRAP) { topMargin = ctx.dp(12) })
        content.addView(toggleRow("Haptic feedback", "Subtle vibration on taps and ticks", hapticsToggle))
        hapticsToggle.onChange = { on -> host.setHaptics(on) }

        section("About")
        content.addView(ctx.row {
            addView(ImageView(ctx).apply { setImageResource(R.mipmap.ic_launcher) }, lp(dp(48), dp(48)))
            addView(ctx.column {
                addView(ctx.text(ctx.getString(R.string.app_name), 16.5f, Ui.c.text, Fonts.sansSemibold))
                addView(versionText, lp { topMargin = dp(3) })
            }, lp(0, WRAP, 1f) { marginStart = dp(14) })
        }, lp { topMargin = ctx.dp(4) })
        content.addView(ctx.text(
            "Works completely offline: no account, no ads and no internet permission. Your profile, " +
                "photo, checklists and settings are saved only on this phone.",
            14.5f, Ui.c.text2,
        ) { setLineSpacing(0f, 1.3f) }, lp { topMargin = ctx.dp(14) })
        content.addView(ctx.text(
            "School emblem © Al-Ameen Academy, Badarpur. Fonts: Source Serif 4 and Source Sans 3 (SIL Open Font License 1.1).",
            13f, Ui.c.text3,
        ) { setLineSpacing(0f, 1.3f) }, lp { topMargin = ctx.dp(10) })
        content.addView(ctx.pillButton("Reset all data", R.drawable.ic_delete, ButtonStyle.DANGER) {
            Dialogs.confirm(
                host, "Reset everything?",
                "This clears your profile edits, photo, subject choices, schedule edits, checklists, focus history and reminders.",
                "Reset everything", destructive = true,
            ) { host.resetAllData() }
        }, lp(WRAP, WRAP) { topMargin = ctx.dp(18) })
    }

    private fun section(title: String) {
        content.addView(ctx.label(title, Ui.c.greenText), lp { topMargin = ctx.dp(30); bottomMargin = ctx.dp(8) })
    }

    // ---------------------------------------------------------------- profile

    private fun profileHeader(): View = ctx.row {
        minimumHeight = dp(76)
        setPadding(0, dp(10), 0, dp(10))
        background = Shapes.ripple(ctx, null, 12)
        addView(avatar, lp(dp(52), dp(52)))
        addView(ctx.column {
            addView(profileName)
            addView(ctx.text("Photo and display name", 14f, Ui.c.text3), lp { topMargin = dp(2) })
        }, lp(0, WRAP, 1f) { marginStart = dp(14) })
        addView(ctx.icon(R.drawable.ic_chevron_right, Ui.c.text3, 22))
        contentDescription = "Edit photo and display name"
        setOnClickListener { host.openProfileEditor() }
    }

    private fun profileField(label: String, iconRes: Int, last: Boolean = false, read: (Profile) -> String) {
        val value = ctx.text("", 16f, Ui.c.text)
        profileValues[label] = value
        content.addView(ctx.row {
            minimumHeight = dp(60)
            setPadding(0, dp(8), dp(4), dp(8))
            background = Shapes.ripple(ctx, null, 12)
            addView(ctx.icon(iconRes, Ui.c.text3, 20))
            addView(ctx.column {
                addView(ctx.text(label, 13f, Ui.c.text3, Fonts.sansMedium))
                addView(value, lp { topMargin = dp(2) })
            }, lp(0, WRAP, 1f) { marginStart = dp(16) })
            addView(ctx.icon(R.drawable.ic_edit, Ui.c.text3, 18))
            setOnClickListener { editField(label, read) }
        })
        if (!last) content.addView(ctx.separator())
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

    // ---------------------------------------------------------------- schedule

    private fun renderSchedule() {
        scheduleList.removeAllViews()
        val choices = host.data.choices
        Timetable.sorted(host.data.exams).forEachIndexed { i, exam ->
            if (i > 0) scheduleList.addView(ctx.separator())
            val edited = exam != Timetable.default(exam.subject)
            scheduleList.addView(ctx.row {
                minimumHeight = dp(64)
                setPadding(0, dp(10), dp(4), dp(10))
                background = Shapes.ripple(ctx, null, 12)
                addView(ctx.column {
                    addView(ctx.row {
                        addView(ctx.text(exam.title(choices), 16f, Ui.c.text, Fonts.sansSemibold), lp(0, WRAP, 1f))
                        if (edited) addView(ctx.label("Edited", Ui.c.goldText, 11f), lp(WRAP, WRAP) { marginStart = dp(8) })
                    })
                    addView(ctx.text(
                        "${Formats.dateShort(exam.date)} · ${Formats.time(exam.start)} · ${Timetable.durationLabel(exam.durationMinutes)}",
                        14f, Ui.c.text2,
                    ), lp { topMargin = dp(3) })
                }, lp(0, WRAP, 1f))
                addView(ctx.icon(R.drawable.ic_chevron_right, Ui.c.text3, 22), lp(dp(22), dp(22)) { marginStart = dp(8) })
                setOnClickListener { editExam(exam.subject) }
            })
        }
        scheduleList.addView(ctx.separator())
    }

    private fun editExam(subject: Subject) {
        fun current(): Exam = host.data.exams.first { it.subject == subject }
        Dialogs.sheet(host, current().title(host.data.choices), "Changes apply straight away.") { dismiss ->
            val dateValue = ctx.text("", 16f, Ui.c.text, Fonts.sansMedium)
            val timeValue = ctx.text("", 16f, Ui.c.text, Fonts.sansMedium)
            val durationValue = ctx.text("", 16f, Ui.c.text, Fonts.sansMedium)
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
            }, lp { topMargin = dp(14) })
            addView(ctx.separator())
            addView(editRow("Start time", R.drawable.ic_clock, timeValue) {
                val e = current()
                TimePickerDialog(host, R.style.Theme_ExamCountdown_Dialog, { _, h, min ->
                    save(e.copy(start = java.time.LocalTime.of(h, min)))
                }, e.start.hour, e.start.minute, false).show()
            })
            addView(ctx.separator())
            addView(editRow("Duration", R.drawable.ic_bolt, durationValue) {
                val e = current()
                val options = Timetable.DURATION_CHOICES
                Dialogs.choice(
                    host, "Duration",
                    options.map { Timetable.durationLabel(it) },
                    options.indexOf(e.durationMinutes).coerceAtLeast(0),
                    message = "Only choose a duration once your school confirms it. ${Timetable.SESSION_NOTE}",
                ) { i -> save(e.copy(durationMinutes = options[i])) }
            })
            render()
            actions(
                ctx.pillButton("Use official", R.drawable.ic_restore, ButtonStyle.GHOST) { save(Timetable.default(subject)) },
                ctx.pillButton("Done") { dismiss() },
            )
        }
    }

    private fun editRow(label: String, iconRes: Int, value: TextView, onClick: () -> Unit): View = ctx.row {
        minimumHeight = dp(60)
        setPadding(dp(4), dp(8), dp(4), dp(8))
        background = Shapes.ripple(ctx, null, 12)
        addView(ctx.icon(iconRes, Ui.c.greenText, 20))
        addView(ctx.column {
            addView(ctx.text(label, 13f, Ui.c.text3, Fonts.sansMedium))
            addView(value, lp { topMargin = dp(2) })
        }, lp(0, WRAP, 1f) { marginStart = dp(14) })
        addView(ctx.icon(R.drawable.ic_chevron_right, Ui.c.text3, 20))
        setOnClickListener { onClick() }
    }

    private fun actionRow(title: String, iconRes: Int, onClick: () -> Unit): View = ctx.row {
        minimumHeight = dp(56)
        setPadding(0, dp(8), 0, dp(8))
        background = Shapes.ripple(ctx, null, 12)
        addView(ctx.icon(iconRes, Ui.c.greenText, 20))
        addView(ctx.text(title, 15.5f, Ui.c.greenText, Fonts.sansSemibold), lp(0, WRAP, 1f) { marginStart = dp(14) })
        setOnClickListener { onClick() }
    }

    private fun toggleRow(title: String, subtitle: String?, toggle: ToggleView, indent: Boolean = false): View = ctx.row {
        minimumHeight = dp(if (subtitle == null) 52 else 64)
        setPadding(dp(if (indent) 18 else 0), dp(8), 0, dp(8))
        addView(ctx.column {
            addView(ctx.text(title, if (indent) 15.5f else 16f, Ui.c.text, if (indent) Fonts.sans else Fonts.sansSemibold))
            if (subtitle != null) addView(ctx.text(subtitle, 14f, Ui.c.text3), lp { topMargin = dp(2) })
        }, lp(0, WRAP, 1f))
        addView(toggle, lp(WRAP, WRAP) { marginStart = dp(12) })
        toggle.contentDescription = title
        setOnClickListener { toggle.performClick() }
    }

    // ---------------------------------------------------------------- lifecycle

    override fun onShow(first: Boolean) = refresh()

    override fun onDataChanged() {
        if (scroll.isShown) refresh()
    }

    override fun onMotionChanged() = refreshMotion()

    override fun applyInsets(top: Int, bottom: Int) {
        content.setPadding(ctx.dp(20), top + ctx.dp(8), ctx.dp(20), ctx.dp(28))
    }

    override fun nextTickDelay(now: Long): Long = 60_000L

    fun refresh() {
        val data = host.data
        val p = data.profile
        avatar.initials = p.initials
        val version = host.store.avatarVersion
        if (version != avatarVersion) {
            avatarVersion = version
            avatar.setPhoto(host.avatarBitmap(ctx.dp(52)))
        }
        profileName.update(p.name.ifBlank { "Add your name" })
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

        themeControl.select(host.store.theme.ordinal)
        introToggle.setChecked(host.store.introEnabled)
        hapticsToggle.setChecked(host.store.haptics)
        refreshMotion()
        versionText.update("Version ${host.versionName()} · Class VIII, Half-Yearly 2026–2027")
    }

    private fun refreshMotion() {
        val pref = host.data.motion
        motionControl.select(pref.ordinal)
        val policy = host.policy
        motionNote.update(
            when {
                pref == MotionPref.REDUCED -> "Movement is off: no opening animation, sliding digits or confetti. Everything still works."
                pref == MotionPref.FULL && !policy.ambient -> "Full motion. Battery Saver is on, so continuous effects are paused."
                pref == MotionPref.FULL -> "Full motion, even if Android’s “Remove animations” is on."
                !policy.motion -> "Following Android: “Remove animations” is on, so motion is reduced."
                !policy.ambient -> "Following Android. Battery Saver is on, so continuous effects are paused."
                else -> "Following Android’s animation setting."
            },
        )
    }
}

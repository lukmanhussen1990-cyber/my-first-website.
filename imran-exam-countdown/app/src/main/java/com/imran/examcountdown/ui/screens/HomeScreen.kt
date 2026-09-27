package com.imran.examcountdown.ui.screens

import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.imran.examcountdown.MainActivity
import com.imran.examcountdown.R
import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.Countdown
import com.imran.examcountdown.core.Exam
import com.imran.examcountdown.core.ExamStatus
import com.imran.examcountdown.core.Formats
import com.imran.examcountdown.core.Messages
import com.imran.examcountdown.core.Phase
import com.imran.examcountdown.core.Profile
import com.imran.examcountdown.core.Season
import com.imran.examcountdown.core.Timetable
import com.imran.examcountdown.ui.Dialogs
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.column
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.heading
import com.imran.examcountdown.ui.label
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.row
import com.imran.examcountdown.ui.separator
import com.imran.examcountdown.ui.text
import com.imran.examcountdown.ui.update
import com.imran.examcountdown.ui.widgets.AvatarView
import com.imran.examcountdown.ui.widgets.ButtonStyle
import com.imran.examcountdown.ui.widgets.CountdownView
import com.imran.examcountdown.ui.widgets.FlowRow
import com.imran.examcountdown.ui.widgets.ProgressTrack
import com.imran.examcountdown.ui.widgets.SeasonProgressView
import com.imran.examcountdown.ui.widgets.pillButton
import com.imran.examcountdown.ui.widgets.pressScale
import com.imran.examcountdown.ui.widgets.setLeadingIcon
import java.time.ZoneId

class HomeScreen(host: MainActivity) : Screen(host) {

    private enum class Mode { COUNTDOWN, FINAL_LIVE, CELEBRATE }

    private val scroll = ScrollView(ctx).apply {
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
        isFillViewport = true
    }
    override val root: View get() = scroll
    private val content = ctx.column()

    // 1. School
    /** The header emblem; the opening animation settles into it. */
    val emblem = ImageView(ctx).apply {
        setImageResource(R.drawable.emblem_small)
        contentDescription = "Al-Ameen Academy emblem"
    }
    private val schoolName = ctx.text("Al-Ameen Academy", 16f, Ui.c.text, Fonts.serif)
    private val schoolPlace = ctx.label("Badarpur · Estd. 1994", Ui.c.goldText, 10.5f)

    // 2–3. Greeting and identity
    private val greeting = ctx.heading("", 30f)
    private val identity = ctx.text("", 15f, Ui.c.text2)
    val avatar = AvatarView(ctx).apply {
        contentDescription = "Profile photo. Double tap to change."
        isClickable = true
        stateListAnimator = pressScale(this)
        setOnClickListener { host.openProfileEditor() }
    }

    // Live exam banner
    private val liveTitle = ctx.heading("It’s exam time!", 24f, Ui.c.onGreen)
    private val liveDetail = ctx.text("", 15.5f, Ui.withAlpha(Ui.c.onGreen, 0.92f), Fonts.sansMedium)
    private val liveDuration = ctx.text("", 13.5f, Ui.withAlpha(Ui.c.onGreen, 0.78f)) { setLineSpacing(0f, 1.3f) }
    private val liveButton = ctx.text("Mark as finished", 15f, Ui.c.onGreen, Fonts.sansSemibold) {
        gravity = Gravity.CENTER
        minHeight = dp(44)
        setPadding(dp(16), dp(6), dp(16), dp(6))
        background = Shapes.ripple(ctx, Shapes.rounded(ctx, 12, 0, Ui.withAlpha(Ui.c.onGreen, 0.6f), 1.5f), 12)
        setLeadingIcon(R.drawable.ic_check, 18)
        stateListAnimator = pressScale(this)
        setOnClickListener { onMarkFinished() }
    }
    private val liveCard = ctx.column {
        background = Shapes.rounded(ctx, 18, Ui.c.green)
        setPadding(dp(18), dp(16), dp(18), dp(16))
        addView(ctx.row {
            addView(View(ctx).apply { background = Shapes.oval(Ui.c.gold) }, lp(dp(8), dp(8)))
            addView(ctx.label("Exam in progress", Ui.withAlpha(Ui.c.onGreen, 0.85f), 11.5f), lp(WRAP, WRAP) { marginStart = dp(8) })
        })
        addView(liveTitle, lp { topMargin = dp(8) })
        addView(liveDetail, lp { topMargin = dp(6) })
        addView(liveDuration, lp { topMargin = dp(6) })
        addView(liveButton, lp(WRAP, WRAP) { topMargin = dp(14) })
    }
    private var liveKey: String? = null

    // 4–7. Next exam
    private val nextLabel = ctx.label("Next exam")
    private val subject = ctx.heading("", 30f)
    private val countdown = CountdownView(ctx)
    private val track = ProgressTrack(ctx)
    private val trackCaption = ctx.text("", 13f, Ui.c.text3) { setLineSpacing(0f, 1.25f) }
    private val dateItem = detail(R.drawable.ic_calendar)
    private val timeItem = detail(R.drawable.ic_clock)
    private val hallItem = detail(R.drawable.ic_hall)
    private val details = FlowRow(ctx).apply {
        addView(dateItem)
        addView(timeItem)
        addView(hallItem)
    }
    private val localNote = ctx.text("", 13f, Ui.c.text3)
    private val revise = ctx.pillButton("Revise", R.drawable.ic_study) {
        host.openChecklist((host.season.next ?: host.season.live)?.exam?.subject)
    }
    private val finalNote = ctx.text("This is your last paper. The celebration starts when it’s done.", 16f, Ui.c.text2) {
        setLineSpacing(0f, 1.3f)
    }
    private val nextSection = ctx.column()

    // Celebration
    private val celebrateTitle = ctx.heading("", 32f)
    private val celebrateBody = ctx.text("", 16f, Ui.c.text2) { setLineSpacing(0f, 1.35f) }
    private val celebrateSection = ctx.column {
        addView(ctx.label("Exam season complete", Ui.c.goldText))
        addView(celebrateTitle, lp { topMargin = dp(8) })
        addView(celebrateBody, lp { topMargin = dp(10) })
        addView(ctx.pillButton("Celebrate again", R.drawable.ic_sparkle, ButtonStyle.SECONDARY) { host.celebrate(force = true) }, lp(WRAP, WRAP) { topMargin = dp(18) })
    }

    // Message
    private val message = ctx.text("", 17f, Ui.c.text2, Fonts.serifItalic) { setLineSpacing(0f, 1.3f) }
    private var messageOffset = 0
    private val messageRow = ctx.row {
        gravity = Gravity.TOP
        addView(View(ctx).apply { background = Shapes.rounded(ctx, 2, Ui.c.gold) }, lp(dp(3), MATCH))
        addView(message, lp(0, WRAP, 1f) { marginStart = dp(14) })
        background = Shapes.ripple(ctx, null, 8)
        setPadding(0, dp(4), 0, dp(4))
        contentDescription = null
        setOnClickListener { cycleMessage() }
    }

    // 8. Progress and what's coming up
    private val progressCount = ctx.text("", 14f, Ui.c.text2, Fonts.sansMedium)
    private val progressBar = SeasonProgressView(ctx)
    private val progressCaption = ctx.text("", 13f, Ui.c.text3)
    private val upcomingLabel = ctx.label("Coming up")
    private val upcomingList = ctx.column()
    private val timetableLink = ctx.text("Full timetable", 15f, Ui.c.greenText, Fonts.sansSemibold) {
        setPadding(0, dp(12), dp(12), dp(12))
        setLeadingIcon(R.drawable.ic_timeline, 18)
        setOnClickListener { host.showTab(MainActivity.TAB_TIMETABLE) }
    }

    private var mode: Mode? = null
    private var target = 0L
    private var subjectKey = ""
    private var upcomingKey = ""
    private var spokenMinute = -1L
    private var avatarVersion = -1L
    private var entranceDone = false

    init {
        scroll.addView(content, FrameLayout.LayoutParams(MATCH, WRAP))

        content.addView(ctx.row {
            addView(emblem, lp(dp(36), dp(36)))
            addView(ctx.column {
                addView(schoolName)
                addView(schoolPlace, lp { topMargin = dp(3) })
            }, lp(0, WRAP, 1f) { marginStart = dp(12) })
        }, lp { topMargin = ctx.dp(6) })
        content.addView(ctx.separator(), lp(MATCH, WRAP) { topMargin = ctx.dp(14) })

        content.addView(ctx.row {
            addView(ctx.column {
                addView(greeting)
                addView(identity, lp { topMargin = dp(4) })
            }, lp(0, WRAP, 1f))
            addView(avatar, lp(dp(54), dp(54)) { marginStart = dp(12) })
        }, lp { topMargin = ctx.dp(18) })

        content.addView(liveCard, lp { topMargin = ctx.dp(22) })

        nextSection.addView(nextLabel)
        nextSection.addView(subject, lp { topMargin = ctx.dp(6) })
        nextSection.addView(countdown, lp { topMargin = ctx.dp(12) })
        nextSection.addView(track, lp(MATCH, ctx.dp(4)) { topMargin = ctx.dp(14) })
        nextSection.addView(trackCaption, lp { topMargin = ctx.dp(8) })
        nextSection.addView(details, lp { topMargin = ctx.dp(16) })
        nextSection.addView(localNote, lp { topMargin = ctx.dp(6) })
        nextSection.addView(finalNote, lp { topMargin = ctx.dp(4) })
        nextSection.addView(revise, lp { topMargin = ctx.dp(20) })
        content.addView(nextSection, lp { topMargin = ctx.dp(24) })
        content.addView(celebrateSection, lp { topMargin = ctx.dp(26) })

        content.addView(messageRow, lp { topMargin = ctx.dp(24) })
        content.addView(ctx.separator(), lp(MATCH, WRAP) { topMargin = ctx.dp(24) })

        content.addView(ctx.row {
            addView(ctx.label("Exam progress"), lp(0, WRAP, 1f))
            addView(progressCount)
        }, lp { topMargin = ctx.dp(20) })
        content.addView(progressBar, lp(MATCH, ctx.dp(6)) { topMargin = ctx.dp(12) })
        content.addView(progressCaption, lp { topMargin = ctx.dp(8) })
        content.addView(upcomingLabel, lp { topMargin = ctx.dp(24) })
        content.addView(upcomingList, lp { topMargin = ctx.dp(4) })
        content.addView(timetableLink, lp(WRAP, WRAP) { topMargin = ctx.dp(4) })

        onMotionChanged()
    }

    private fun detail(iconRes: Int): TextView = ctx.text("", 15f, Ui.c.text, Fonts.sansMedium) {
        gravity = Gravity.CENTER_VERTICAL
        setLeadingIcon(iconRes, 18)
        compoundDrawablePadding = dp(6)
        compoundDrawablesRelative[0]?.setTint(Ui.c.greenText)
    }

    /** Top-level blocks, in order, for the staggered entrance. */
    fun entranceViews(): List<View> = (0 until content.childCount).map { content.getChildAt(it) }.filter { it.visibility == View.VISIBLE }

    // ------------------------------------------------------------------ lifecycle

    override fun onShow(first: Boolean) {
        bindHeader(host.data.profile)
        tick(host.season)
        if (first && !host.introRunning) playEntrance()
    }

    /** Short staggered rise-in; also used when the opening animation hands over. */
    fun playEntrance() {
        if (entranceDone) return
        entranceDone = true
        staggerIn(entranceViews().filter { it !== content.getChildAt(0) }, host.policy.motion)
        if (host.policy.motion) progressBar.playReveal()
    }

    override fun onDataChanged() {
        subjectKey = ""
        upcomingKey = ""
        bindHeader(host.data.profile)
    }

    override fun onMotionChanged() {
        countdown.animateChanges = host.policy.motion
    }

    override fun applyInsets(top: Int, bottom: Int) {
        content.setPadding(ctx.dp(20), top + ctx.dp(8), ctx.dp(20), ctx.dp(20))
    }

    override fun nextTickDelay(now: Long): Long =
        if (mode == Mode.COUNTDOWN && target > now) Countdown.delayToNextTick(target, now) + 5 else 1000 - now % 1000

    // ------------------------------------------------------------------ binding

    private fun bindHeader(profile: Profile) {
        greeting.update(if (profile.firstName.isEmpty()) "Hey there" else "Hey, ${profile.firstName}")
        identity.update(listOf("Class ${profile.className}".takeIf { profile.className.isNotBlank() }, "Roll ${profile.roll}".takeIf { profile.roll.isNotBlank() })
            .filterNotNull().joinToString(" · "))
        schoolName.update(profile.school.substringBefore(",").ifBlank { "Al-Ameen Academy" })
        avatar.initials = profile.initials
        val version = host.store.avatarVersion
        if (version != avatarVersion) {
            avatarVersion = version
            avatar.setPhoto(host.avatarBitmap(ctx.dp(54)))
        }
    }

    override fun tick(season: Season) {
        val data = host.data
        val newMode = when {
            season.isOver -> Mode.CELEBRATE
            season.isFinalLive -> Mode.FINAL_LIVE
            else -> Mode.COUNTDOWN
        }
        if (newMode != mode) applyMode(newMode)
        bindLive(season, data.choices, data.profile)
        when (newMode) {
            Mode.COUNTDOWN -> bindCountdown(season, data.choices, data.profile)
            Mode.FINAL_LIVE -> Unit
            Mode.CELEBRATE -> bindCelebration(season, data.profile)
        }
        bindProgress(season, data.choices)
        message.update(Messages.pick(season, data.choices, messageOffset))
    }

    private fun applyMode(newMode: Mode) {
        val previous = mode
        mode = newMode
        subjectKey = ""
        nextSection.setVisible(newMode != Mode.CELEBRATE)
        celebrateSection.setVisible(newMode == Mode.CELEBRATE)
        val counting = newMode == Mode.COUNTDOWN
        listOf(subject, countdown, track, trackCaption, details, revise).forEach { it.setVisible(counting) }
        localNote.setVisible(false)
        finalNote.setVisible(newMode == Mode.FINAL_LIVE)
        if (newMode == Mode.FINAL_LIVE) nextLabel.update("AFTER THIS")
        // Celebrate when the final exam finishes while the app is open, or on the first
        // visit afterwards — never before the last paper is actually done.
        if (newMode == Mode.CELEBRATE && previous != Mode.CELEBRATE) scroll.post { host.celebrate(force = false) }
    }

    private fun bindCountdown(season: Season, choices: Choices, profile: Profile) {
        val next = season.next ?: return
        target = next.startMillis
        val cd = Countdown.until(target, season.now)
        countdown.set(cd)
        val base = when {
            season.live != null -> "FOLLOWING EXAM"
            season.nextIsFinal -> "FINAL EXAM"
            else -> "NEXT EXAM"
        }
        // "NEXT EXAM · MIL" above "Bengali"; ordinary subjects have no kicker.
        nextLabel.update(base + (next.exam.kicker(choices)?.let { " · ${it.uppercase()}" } ?: ""))
        track.set(season.ringFraction(), animate = !entranceDone)
        bindSubject(next, season, choices, profile)

        val minute = (target - season.now) / 60_000L
        if (minute != spokenMinute) {
            spokenMinute = minute
            nextSection.contentDescription = null
            countdown.contentDescription = "${next.exam.title(choices)} starts in ${cd.spoken()}"
        }
    }

    private fun bindSubject(next: ExamStatus, season: Season, choices: Choices, profile: Profile) {
        val exam = next.exam
        val index = season.exams.indexOf(next)
        val previous = season.exams.getOrNull(index - 1)
        val key = "${exam.key}|${exam.durationMinutes}|$choices|${profile.hall}|${previous?.exam?.key}"
        if (key == subjectKey) {
            trackCaption.update(trackText(season, previous, exam, choices))
            return
        }
        subjectKey = key
        subject.update(exam.headline(choices))
        subject.contentDescription = exam.title(choices)
        dateItem.update(Formats.dateShort(exam.date))
        timeItem.update("${Formats.time(exam.start)} IST")
        hallItem.update(if (profile.hall.isBlank()) "Hall not set" else "Hall ${profile.hall}")
        val local = Formats.startInZone(exam, ZoneId.systemDefault())
        localNote.update(if (local != null) "That’s $local where you are now." else "")
        localNote.setVisible(local != null)
        revise.text = "Revise ${exam.headline(choices)}"
        revise.setLeadingIcon(R.drawable.ic_study)
        trackCaption.update(trackText(season, previous, exam, choices))
    }

    /** Explains what the thin line measures. */
    private fun trackText(season: Season, previous: ExamStatus?, exam: Exam, choices: Choices): String {
        val percent = Math.round(season.ringFraction() * 100)
        return if (previous == null) {
            "$percent% of the final week before your first exam has passed."
        } else {
            "$percent% of the time from ${previous.exam.headline(choices)} to ${exam.headline(choices)} has passed."
        }
    }

    private fun bindLive(season: Season, choices: Choices, profile: Profile) {
        val live = season.live
        if (live == null) {
            liveCard.setVisible(false)
            liveKey = null
            return
        }
        val exam = live.exam
        val hall = if (profile.hall.isBlank()) "" else " · Hall ${profile.hall}"
        liveDetail.update("${exam.title(choices)} · started ${Formats.time(exam.start)}$hall")
        val end = exam.confirmedEndMillis
        liveDuration.update(
            if (end != null) {
                "Ends at ${Formats.time(end)} (${Timetable.durationLabel(exam.durationMinutes).lowercase()}, set in Settings)."
            } else {
                "Duration not confirmed: 3 hours for core subjects, 1½ hours for non-core. Tap below once you’ve handed in your paper."
            },
        )
        liveCard.contentDescription = "It’s exam time! ${liveDetail.text}. ${liveDuration.text}"
        if (exam.key != liveKey) {
            liveKey = exam.key
            liveCard.setVisible(true)
            if (host.policy.motion && entranceDone) {
                liveCard.alpha = 0f
                liveCard.translationY = ctx.dp(10).toFloat()
                liveCard.animate().alpha(1f).translationY(0f).setDuration(280).start()
            }
        }
    }

    private fun bindCelebration(season: Season, profile: Profile) {
        celebrateTitle.update(if (profile.firstName.isEmpty()) "You did it! 🎉" else "You did it, ${profile.firstName}! 🎉")
        celebrateBody.update("All ${season.total} exams are done. Time to relax — you’ve earned it.")
    }

    private fun bindProgress(season: Season, choices: Choices) {
        progressCount.update("${season.completed} of ${season.total} done")
        progressBar.segments = season.exams.map {
            when {
                it.phase == Phase.DONE -> SeasonProgressView.Segment.DONE
                it.phase == Phase.LIVE -> SeasonProgressView.Segment.LIVE
                it.isToday -> SeasonProgressView.Segment.TODAY
                else -> SeasonProgressView.Segment.UPCOMING
            }
        }
        val percent = Math.round(season.progress * 100)
        progressCaption.update(
            when {
                season.isOver -> "Every exam is complete."
                season.completed == 0 -> "Counted from completed exam dates. None yet — the first is ${Formats.relativeDay(season.exams.first().exam.date, season.now).lowercase()}."
                else -> "$percent% complete, counted from completed exam dates."
            },
        )
        bindUpcoming(season, choices)
    }

    /** The two timetable entries after the one being counted down to. */
    private fun bindUpcoming(season: Season, choices: Choices) {
        val anchor = season.next ?: season.live
        val start = if (anchor == null) season.exams.size else season.exams.indexOf(anchor) + 1
        val items = season.exams.drop(start).take(2)
        val key = items.joinToString { it.exam.key } + choices
        if (key == upcomingKey) return
        upcomingKey = key
        upcomingList.removeAllViews()
        upcomingLabel.setVisible(items.isNotEmpty())
        items.forEachIndexed { i, s ->
            if (i > 0) upcomingList.addView(ctx.separator())
            upcomingList.addView(upcomingRow(s.exam, choices))
        }
    }

    private fun upcomingRow(exam: Exam, choices: Choices): View = ctx.row {
        minimumHeight = dp(56)
        setPadding(0, dp(8), 0, dp(8))
        background = Shapes.ripple(ctx, null, 8)
        addView(ctx.column {
            addView(ctx.label(Formats.weekday(exam.date), Ui.c.text3, 10.5f))
            addView(ctx.text(Formats.dateShort(exam.date).substringAfter(", "), 15f, Ui.c.text, Fonts.sansSemibold), lp { topMargin = dp(2) })
        }, lp(dp(64), WRAP))
        addView(ctx.text(exam.title(choices), 16f, Ui.c.text), lp(0, WRAP, 1f) { marginStart = dp(8) })
        addView(ctx.text(Formats.time(exam.start), 14f, Ui.c.text2), lp(WRAP, WRAP) { marginStart = dp(8) })
        contentDescription = "${exam.title(choices)}, ${Formats.dateLong(exam.date)} at ${Formats.time(exam.start)}"
        setOnClickListener { host.openChecklist(exam.subject) }
    }

    private fun cycleMessage() {
        messageOffset++
        val next = Messages.pick(host.season, host.data.choices, messageOffset)
        if (!host.policy.motion) {
            message.text = next
            return
        }
        message.animate().alpha(0f).setDuration(120).withEndAction {
            message.text = next
            message.animate().alpha(1f).setDuration(200).start()
        }.start()
    }

    private fun onMarkFinished() {
        val live = host.season.live ?: return
        val title = live.exam.title(host.data.choices)
        Dialogs.confirm(
            host,
            "Finished $title?",
            "Only do this once you’ve handed in your paper. The app will then count it as done.",
            "Mark as finished",
        ) { host.markFinished(live.exam) }
    }
}

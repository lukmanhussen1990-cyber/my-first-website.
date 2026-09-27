package com.imran.examcountdown.ui.screens

import android.util.TypedValue
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
import com.imran.examcountdown.core.Formats
import com.imran.examcountdown.core.Messages
import com.imran.examcountdown.core.Phase
import com.imran.examcountdown.core.Profile
import com.imran.examcountdown.core.Season
import com.imran.examcountdown.core.Timetable
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.ui.AmbientListener
import com.imran.examcountdown.ui.Dialogs
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.caps
import com.imran.examcountdown.ui.column
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.flp
import com.imran.examcountdown.ui.icon
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.row
import com.imran.examcountdown.ui.text
import com.imran.examcountdown.ui.update
import com.imran.examcountdown.ui.widgets.ButtonStyle
import com.imran.examcountdown.ui.widgets.CountdownRingView
import com.imran.examcountdown.ui.widgets.GradientDrawableOrientation
import com.imran.examcountdown.ui.widgets.InfoTile
import com.imran.examcountdown.ui.widgets.RollingNumberView
import com.imran.examcountdown.ui.widgets.SeasonProgressView
import com.imran.examcountdown.ui.widgets.pillButton
import com.imran.examcountdown.ui.widgets.pressScale
import java.time.ZoneId
import kotlin.math.sin

class HomeScreen(host: MainActivity) : Screen(host), AmbientListener {

    private enum class Mode { COUNTDOWN, FINAL_LIVE, CELEBRATE }

    private val scroll = ScrollView(ctx).apply {
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
    }
    override val root: View get() = scroll

    private val content = ctx.column()

    // Header
    private val greeting = ctx.text("", 30f, Palette.TEXT, Fonts.bold)
    private val subtitle = ctx.text("", 14.5f, Palette.TEXT_2)
    private val avatar = ctx.text("", 16f, Palette.WHITE, Fonts.semibold) {
        gravity = Gravity.CENTER
        background = Shapes.ovalGradient(Palette.ACCENT_GRADIENT)
        contentDescription = "Profile and settings"
        setOnClickListener { host.showTab(MainActivity.TAB_SETTINGS) }
    }

    // "It's exam time!" banner
    private val liveDot = View(ctx).apply { background = Shapes.oval(Palette.WHITE) }
    private val liveTitle = ctx.text("It’s exam time!", 26f, Palette.WHITE, Fonts.bold)
    private val liveDetail = ctx.text("", 15.5f, 0xF2FFFFFF.toInt(), Fonts.medium)
    private val liveDuration = ctx.text("", 13.5f, 0xD9FFFFFF.toInt())
    private val liveButton = ctx.pillButton("Mark as finished", R.drawable.ic_check, ButtonStyle.SECONDARY) { onMarkFinished() }
    private val liveCard = ctx.column {
        background = Shapes.gradient(ctx, 28, intArrayOf(0xFF6D3BF0.toInt(), 0xFFB5459F.toInt(), 0xFF2F5BFF.toInt()))
        setPadding(dp(20), dp(18), dp(20), dp(18))
        addView(ctx.row {
            addView(liveDot, lp(dp(8), dp(8)))
            addView(ctx.caps("Live now", 0xE6FFFFFF.toInt()), lp(WRAP, WRAP) { marginStart = dp(8) })
        })
        addView(liveTitle, lp { topMargin = dp(10) })
        addView(liveDetail, lp { topMargin = dp(8) })
        addView(liveDuration, lp { topMargin = dp(8) })
        addView(liveButton, lp(WRAP, WRAP) { topMargin = dp(16) })
        visibility = View.GONE
    }
    private var liveKey: String? = null

    // Countdown hero
    private val ring = CountdownRingView(ctx)
    private val ringFrame = SquareFrame(ctx, ctx.dp(340))
    private val heroKicker = ctx.caps("Next exam in", Palette.TEXT_2, 11f)
    private val units = List(4) { RollingNumberView(ctx) }
    private val unitLabels = listOf("Days", "Hrs", "Min", "Sec").map { ctx.caps(it, Palette.TEXT_3, 10f) }
    private val separators = List(3) { ctx.text(":", 20f, Palette.TEXT_3, Fonts.light) { gravity = Gravity.CENTER } }
    private val ringDate = ctx.text("", 13f, Palette.TEXT_2, Fonts.medium)
    private val centerCountdown = ctx.column { gravity = Gravity.CENTER_HORIZONTAL }
    private val altIcon = ImageView(ctx)
    private val altTitle = ctx.text("", 24f, Palette.TEXT, Fonts.semibold) { gravity = Gravity.CENTER }
    private val altCaption = ctx.text("", 13f, Palette.TEXT_2) { gravity = Gravity.CENTER }
    private val centerAlt = ctx.column { gravity = Gravity.CENTER_HORIZONTAL }

    private val subjectKicker = ctx.caps("", Palette.VIOLET_LIGHT, 11.5f)
    private val subjectTitle = ctx.text("", 27f, Palette.TEXT, Fonts.semibold) { gravity = Gravity.CENTER }
    private val dateTile = InfoTile(ctx, R.drawable.ic_calendar, Palette.CYAN)
    private val timeTile = InfoTile(ctx, R.drawable.ic_clock, Palette.BLUE)
    private val hallTile = InfoTile(ctx, R.drawable.ic_hall, Palette.VIOLET_LIGHT)
    private val tiles = ctx.row {
        addView(dateTile, lp(0, WRAP, 1f))
        addView(timeTile, lp(0, WRAP, 1f) { marginStart = dp(8) })
        addView(hallTile, lp(0, WRAP, 1f) { marginStart = dp(8) })
    }
    private val localNote = ctx.text("", 13f, Palette.TEXT_3) { gravity = Gravity.CENTER }
    private val celebrateBody = ctx.text("", 16f, Palette.TEXT_2) {
        gravity = Gravity.CENTER
        setLineSpacing(0f, 1.3f)
    }
    private val celebrateButton = ctx.pillButton("Celebrate again", R.drawable.ic_sparkle) { host.celebrate() }
    private val heroCard = ctx.column {
        background = Shapes.card(ctx, 32)
        setPadding(dp(16), dp(14), dp(16), dp(22))
        gravity = Gravity.CENTER_HORIZONTAL
    }

    // Friendly message
    private val messageText = ctx.text("", 16f, Palette.TEXT, Fonts.medium) { setLineSpacing(0f, 1.3f) }
    private var messageOffset = 0
    private val messageCard = ctx.row {
        background = Shapes.ripple(ctx, Shapes.card(ctx, 24), 24)
        setPadding(dp(18), dp(16), dp(18), dp(16))
        gravity = Gravity.CENTER_VERTICAL
        addView(ctx.icon(R.drawable.ic_sparkle, Palette.VIOLET_LIGHT, 22))
        addView(messageText, lp(0, WRAP, 1f) { marginStart = dp(14) })
        setOnClickListener { cycleMessage() }
    }

    // Season progress
    private val progressCount = ctx.text("", 14f, Palette.TEXT_2, Fonts.medium)
    private val progressBar = SeasonProgressView(ctx)
    private val progressFoot = ctx.text("", 13.5f, Palette.TEXT_3)
    private val progressCard = ctx.column {
        background = Shapes.card(ctx, 24)
        setPadding(dp(18), dp(16), dp(18), dp(18))
        addView(ctx.row {
            addView(ctx.caps("Exam season"), lp(0, WRAP, 1f))
            addView(progressCount)
        })
        addView(progressBar, lp(MATCH, dp(12)) { topMargin = dp(14) })
        addView(progressFoot, lp { topMargin = dp(12) })
    }

    // Quick actions
    private val reviseCaption = ctx.text("", 13f, Palette.TEXT_2)
    private val actions = ctx.row {
        addView(action(R.drawable.ic_bolt, "Focus timer", ctx.text("25-minute session", 13f, Palette.TEXT_2)) {
            host.showTab(MainActivity.TAB_STUDY)
        }, lp(0, WRAP, 1f))
        addView(action(R.drawable.ic_check, "Revise", reviseCaption) {
            host.openChecklist(host.season.next?.exam?.subject ?: host.season.live?.exam?.subject)
        }, lp(0, WRAP, 1f) { marginStart = dp(12) })
    }

    private var mode: Mode? = null
    private var target = 0L
    private var subjectKey: String? = null
    private var spokenMinute = -1L
    private var introPending = true
    private var celebrated = false

    init {
        scroll.addView(content, FrameLayout.LayoutParams(MATCH, WRAP))
        content.setPadding(ctx.dp(20), 0, ctx.dp(20), 0)

        val header = ctx.row {
            addView(ctx.column {
                addView(greeting)
                addView(subtitle, lp { topMargin = dp(6) })
            }, lp(0, WRAP, 1f))
            addView(avatar, lp(dp(46), dp(46)) { marginStart = dp(12) })
        }
        content.addView(header, lp { topMargin = ctx.dp(10) })
        content.addView(liveCard, lp { topMargin = ctx.dp(20) })
        content.addView(heroCard, lp { topMargin = ctx.dp(18) })
        content.addView(messageCard, lp { topMargin = ctx.dp(14) })
        content.addView(progressCard, lp { topMargin = ctx.dp(14) })
        content.addView(actions, lp { topMargin = ctx.dp(14) })

        buildRing()
        heroCard.addView(ringFrame, lp(WRAP, WRAP))
        heroCard.addView(subjectKicker, lp(WRAP, WRAP) { topMargin = ctx.dp(4) })
        heroCard.addView(subjectTitle, lp(WRAP, WRAP) { topMargin = ctx.dp(6) })
        heroCard.addView(celebrateBody, lp { topMargin = ctx.dp(10) })
        heroCard.addView(tiles, lp { topMargin = ctx.dp(16) })
        heroCard.addView(localNote, lp(WRAP, WRAP) { topMargin = ctx.dp(10) })
        heroCard.addView(celebrateButton, lp(WRAP, WRAP) { topMargin = ctx.dp(18) })

        ring.secondsProvider = {
            val left = target - AppClock.now()
            if (left <= 0) 0f else 1f - (left % 60_000L) / 60_000f
        }
        onMotionChanged()
    }

    private fun buildRing() {
        ringFrame.addView(ring, flp(MATCH, MATCH))
        val digits = ctx.row { gravity = Gravity.TOP }
        units.forEachIndexed { i, unit ->
            if (i > 0) digits.addView(separators[i - 1], lp(WRAP, WRAP))
            digits.addView(ctx.column {
                gravity = Gravity.CENTER_HORIZONTAL
                addView(unit, lp(WRAP, WRAP))
                addView(unitLabels[i], lp(WRAP, WRAP) { topMargin = dp(2) })
            }, lp(WRAP, WRAP))
        }
        centerCountdown.addView(heroKicker, lp(WRAP, WRAP))
        centerCountdown.addView(digits, lp(WRAP, WRAP) { topMargin = ctx.dp(10) })
        centerCountdown.addView(ringDate, lp(WRAP, WRAP) { topMargin = ctx.dp(12) })
        ringFrame.addView(centerCountdown, flp(WRAP, WRAP, Gravity.CENTER))

        centerAlt.addView(altIcon, lp(ctx.dp(52), ctx.dp(52)))
        centerAlt.addView(altTitle, lp(WRAP, WRAP) { topMargin = ctx.dp(10) })
        centerAlt.addView(altCaption, lp(WRAP, WRAP) { topMargin = ctx.dp(6) })
        ringFrame.addView(centerAlt, flp(WRAP, WRAP, Gravity.CENTER))

        ringFrame.onSize = { size ->
            val digitPx = size * 0.118f
            units.forEach { it.textSizePx = digitPx }
            separators.forEach {
                it.setTextSize(TypedValue.COMPLEX_UNIT_PX, digitPx * 0.7f)
                it.setPadding(ctx.dp(3), (digitPx * 0.08f).toInt(), ctx.dp(3), 0)
            }
        }
    }

    private fun action(iconRes: Int, title: String, caption: TextView, onClick: () -> Unit): View = ctx.column {
        background = Shapes.ripple(ctx, Shapes.card(ctx, 22), 22)
        setPadding(dp(16), dp(16), dp(16), dp(16))
        addView(ctx.icon(iconRes, Palette.CYAN, 22))
        addView(ctx.text(title, 16f, Palette.TEXT, Fonts.semibold), lp { topMargin = dp(10) })
        addView(caption, lp { topMargin = dp(4) })
        caption.maxLines = 2
        stateListAnimator = pressScale(this)
        setOnClickListener { onClick() }
    }

    // ------------------------------------------------------------------ lifecycle

    override fun onShow(first: Boolean) {
        host.ambient.add(this)
        host.ambient.add(ring)
        host.ambient.add(progressBar)
        bindHeader(host.data.profile)
        tick(host.season)
        if (first && host.policy.motion) {
            progressBar.playReveal()
            listOf(heroCard, messageCard, progressCard, actions).forEachIndexed { i, v ->
                v.alpha = 0f
                v.translationY = ctx.dp(18).toFloat()
                v.animate().alpha(1f).translationY(0f).setStartDelay(60L + i * 70L).setDuration(420).start()
            }
        }
        introPending = false
    }

    override fun onHide() {
        host.ambient.remove(this)
        host.ambient.remove(ring)
        host.ambient.remove(progressBar)
    }

    override fun onDataChanged() {
        subjectKey = null
        bindHeader(host.data.profile)
    }

    override fun onMotionChanged() {
        val policy = host.policy
        units.forEach { it.animateChanges = policy.motion }
        ring.motion = policy.motion
        ring.ambient = policy.ambient
        progressBar.ambient = policy.ambient
        if (!policy.ambient) liveDot.alpha = 1f
    }

    override fun applyInsets(top: Int, bottom: Int) {
        content.setPadding(ctx.dp(20), top + ctx.dp(8), ctx.dp(20), bottom + ctx.dp(120))
    }

    override fun nextTickDelay(now: Long): Long =
        if (mode == Mode.COUNTDOWN && target > now) Countdown.delayToNextTick(target, now) + 5 else 1000 - now % 1000

    override fun onAmbientFrame(frameTimeMs: Long) {
        if (liveCard.visibility == View.VISIBLE) {
            liveDot.alpha = (0.45 + 0.55 * (0.5 + 0.5 * sin(2 * Math.PI * (frameTimeMs % 1400L) / 1400.0))).toFloat()
        }
    }

    // ------------------------------------------------------------------ updates

    private fun bindHeader(profile: Profile) {
        greeting.text = if (profile.firstName.isEmpty()) "Hey there 👋" else "Hey ${profile.firstName} 👋"
        subtitle.text = listOf(profile.examination, "Class ${profile.className}").filter { it.isNotBlank() }.joinToString(" · ")
        avatar.text = profile.initials
    }

    override fun tick(season: Season) {
        val data = host.data
        val newMode = when {
            season.isOver -> Mode.CELEBRATE
            season.isFinalLive -> Mode.FINAL_LIVE
            else -> Mode.COUNTDOWN
        }
        if (newMode != mode) applyMode(newMode)
        updateLive(season, data.choices, data.profile)
        when (newMode) {
            Mode.COUNTDOWN -> updateCountdown(season, data.choices, data.profile)
            Mode.FINAL_LIVE -> season.live?.let { bindSubject(it.exam, data.choices, data.profile, live = true) }
            Mode.CELEBRATE -> bindCelebration(season, data.profile)
        }
        updateProgress(season, data.choices)
        messageText.update(Messages.pick(season, data.choices, messageOffset))
        reviseCaption.update((season.next ?: season.live)?.exam?.title(data.choices) ?: "All subjects")
    }

    private fun applyMode(newMode: Mode) {
        val previous = mode
        mode = newMode
        subjectKey = null
        centerCountdown.setVisible(newMode == Mode.COUNTDOWN)
        centerAlt.setVisible(newMode != Mode.COUNTDOWN)
        tiles.setVisible(newMode != Mode.CELEBRATE)
        celebrateBody.setVisible(newMode == Mode.CELEBRATE)
        celebrateButton.setVisible(newMode == Mode.CELEBRATE)
        actions.setVisible(newMode != Mode.CELEBRATE)
        subjectKicker.setVisible(newMode != Mode.CELEBRATE)
        if (newMode == Mode.CELEBRATE) localNote.setVisible(false)
        when (newMode) {
            Mode.COUNTDOWN -> ring.mode = CountdownRingView.Mode.COUNTDOWN
            Mode.FINAL_LIVE -> {
                ring.mode = CountdownRingView.Mode.LIVE
                ring.setProgress(1f, animate = false)
                altIcon.setImageResource(R.drawable.ic_flag)
                altIcon.imageTintList = android.content.res.ColorStateList.valueOf(Palette.PINK)
                altTitle.text = "Final exam"
                altCaption.text = "in progress · last one!"
            }
            Mode.CELEBRATE -> {
                ring.mode = CountdownRingView.Mode.CELEBRATE
                ring.setProgress(1f, animate = false)
                altIcon.setImageResource(R.drawable.ic_trophy)
                altIcon.imageTintList = android.content.res.ColorStateList.valueOf(Palette.AMBER)
                altTitle.text = "All done!"
                altCaption.text = "Exam season complete"
                if (!celebrated) {
                    celebrated = true
                    // Celebrate when the season ends while the app is open, and on first view afterwards.
                    if (previous != null || introPending) scroll.post { host.celebrate() }
                }
            }
        }
    }

    private fun updateCountdown(season: Season, choices: Choices, profile: Profile) {
        val next = season.next ?: return
        target = next.startMillis
        val cd = Countdown.until(target, season.now)
        units[0].minDigits = if (cd.days >= 100) 3 else 2
        units[0].setValue(cd.days)
        units[1].setValue(cd.hours.toLong())
        units[2].setValue(cd.minutes.toLong())
        units[3].setValue(cd.seconds.toLong())
        ring.setProgress(season.ringFraction(), animate = introPending)
        heroKicker.update(when {
            season.live != null -> "FOLLOWING EXAM IN"
            season.nextIsFinal -> "FINAL EXAM IN"
            else -> "NEXT EXAM IN"
        })
        ringDate.update(Formats.dateShort(next.exam.date))
        bindSubject(next.exam, choices, profile, live = false)

        val minute = (target - season.now) / 60_000L
        if (minute != spokenMinute) {
            spokenMinute = minute
            heroCard.contentDescription = "${next.exam.title(choices)} starts in ${cd.spoken()}, on " +
                "${Formats.dateLong(next.exam.date)} at ${Formats.time(next.exam.start)} India time" +
                (if (profile.hall.isBlank()) "" else ", hall ${profile.hall}") + "."
        }
    }

    private fun bindSubject(exam: Exam, choices: Choices, profile: Profile, live: Boolean) {
        val key = "${exam.key}|${exam.durationMinutes}|$choices|${profile.hall}|$live"
        if (key == subjectKey) return
        subjectKey = key
        val kicker = exam.kicker(choices)
        subjectKicker.text = (if (live) "Now · " else "") + (kicker ?: "Class VIII").uppercase()
        subjectTitle.text = exam.headline(choices)
        dateTile.bind(Formats.dateShort(exam.date).substringAfter(", "), Formats.weekday(exam.date).let { dayName(it) })
        timeTile.bind(Formats.time(exam.start), "India time")
        hallTile.bind(profile.hall.ifBlank { "—" }, "Exam hall")
        val local = Formats.startInZone(exam, ZoneId.systemDefault())
        localNote.text = if (local != null) "That’s $local where you are now." else ""
        localNote.setVisible(local != null)
        if (live) {
            heroCard.contentDescription = "Final exam in progress: ${exam.title(choices)}."
        }
    }

    private fun bindCelebration(season: Season, profile: Profile) {
        val name = profile.firstName.ifEmpty { "you" }
        subjectTitle.text = if (profile.firstName.isEmpty()) "You did it! 🎉" else "You did it, $name! 🎉"
        celebrateBody.text = "All ${season.total} exams are done. Time to relax — you’ve earned it."
        heroCard.contentDescription = "${subjectTitle.text} All ${season.total} exams are done."
    }

    private fun updateLive(season: Season, choices: Choices, profile: Profile) {
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
        liveDuration.update(if (end != null) {
            "Ends at ${Formats.time(end)} — ${Timetable.durationLabel(exam.durationMinutes).lowercase()}, as set in Settings."
        } else {
            "Duration not confirmed: 3 hours for core subjects, 1½ hours for non-core. " +
                "Tap below once you’ve finished."
        })
        liveCard.contentDescription = "It’s exam time! ${liveDetail.text}. ${liveDuration.text}"
        if (exam.key != liveKey) {
            liveKey = exam.key
            liveCard.setVisible(true)
            if (host.policy.motion && !introPending) {
                liveCard.alpha = 0f
                liveCard.scaleX = 0.94f
                liveCard.scaleY = 0.94f
                liveCard.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(380).start()
            }
        }
    }

    private fun updateProgress(season: Season, choices: Choices) {
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
        val next = season.next
        progressFoot.update(
            when {
                season.isOver -> "Exam season complete. Brilliant work!"
                next != null -> "$percent% complete · Next: ${next.exam.title(choices)}, ${Formats.dateShort(next.exam.date)}"
                else -> "$percent% complete · Final exam in progress"
            },
        )
    }

    private fun cycleMessage() {
        messageOffset++
        val season = host.season
        val next = Messages.pick(season, host.data.choices, messageOffset)
        if (!host.policy.motion) {
            messageText.text = next
            return
        }
        messageText.animate().alpha(0f).setDuration(140).withEndAction {
            messageText.text = next
            messageText.animate().alpha(1f).setDuration(220).start()
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

    private fun dayName(short: String): String = when (short) {
        "Mon" -> "Monday"
        "Tue" -> "Tuesday"
        "Wed" -> "Wednesday"
        "Thu" -> "Thursday"
        "Fri" -> "Friday"
        "Sat" -> "Saturday"
        "Sun" -> "Sunday"
        else -> short
    }
}

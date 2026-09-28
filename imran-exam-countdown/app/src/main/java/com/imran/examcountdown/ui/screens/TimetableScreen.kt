package com.imran.examcountdown.ui.screens

import android.animation.ValueAnimator
import android.view.Gravity
import android.view.View
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.imran.examcountdown.MainActivity
import com.imran.examcountdown.R
import com.imran.examcountdown.core.DoneReason
import com.imran.examcountdown.core.ExamStatus
import com.imran.examcountdown.core.Formats
import com.imran.examcountdown.core.Phase
import com.imran.examcountdown.core.Season
import com.imran.examcountdown.core.SeasonCalculator
import com.imran.examcountdown.core.Timetable
import com.imran.examcountdown.ui.AmbientListener
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
import com.imran.examcountdown.ui.text
import com.imran.examcountdown.ui.update
import com.imran.examcountdown.ui.widgets.TimelineRailView
import com.imran.examcountdown.ui.widgets.setLeadingIcon
import com.imran.examcountdown.ui.widgets.statusLabel
import com.imran.examcountdown.ui.widgets.styleStatus

class TimetableScreen(host: MainActivity) : Screen(host), AmbientListener {

    private val scroll = ScrollView(ctx).apply {
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
    }
    override val root: View get() = scroll
    private val content = ctx.column()
    private val subtitle = ctx.text("", 15f, Ui.c.text2)
    private val list = ctx.column()

    private class Row(
        val view: LinearLayout,
        val rail: TimelineRailView,
        val body: LinearLayout,
        val title: TextView,
        val meta: TextView,
        val duration: TextView,
        val status: TextView,
        val weekday: TextView,
        val day: TextView,
        val month: TextView,
    ) {
        var signature = ""
    }

    private val rows = ArrayList<Row>()
    private var builtFor = ""

    init {
        scroll.addView(content, FrameLayout.LayoutParams(MATCH, WRAP))
        content.addView(ctx.heading("Timetable", 30f), lp { topMargin = ctx.dp(8) })
        content.addView(subtitle, lp { topMargin = ctx.dp(6) })
        content.addView(note(), lp { topMargin = ctx.dp(18) })
        content.addView(list, lp { topMargin = ctx.dp(22) })
        content.addView(
            ctx.text("Only dates with a Class VIII exam are listed.", 13.5f, Ui.c.text3),
            lp { topMargin = ctx.dp(10) },
        )
    }

    private fun note(): View = ctx.row {
        gravity = Gravity.TOP
        addView(View(ctx).apply { background = Shapes.rounded(ctx, 2, Ui.c.gold) }, lp(dp(3), MATCH))
        addView(ctx.column {
            addView(ctx.text("Every paper starts at 12:30 PM, India time.", 16f, Ui.c.text, Fonts.sansSemibold))
            addView(ctx.text(Timetable.SESSION_NOTE, 14.5f, Ui.c.text2), lp { topMargin = dp(4) })
            addView(ctx.text(Timetable.DURATION_NOTE, 14f, Ui.c.text3) { setLineSpacing(0f, 1.3f) }, lp { topMargin = dp(6) })
            addView(ctx.text("Set durations in Settings", 15f, Ui.c.greenText, Fonts.sansSemibold) {
                setPadding(0, dp(10), dp(12), dp(6))
                setLeadingIcon(R.drawable.ic_settings, 18)
                setOnClickListener { host.showTab(MainActivity.TAB_SETTINGS) }
            })
        }, lp(0, WRAP, 1f) { marginStart = dp(14) })
    }

    // ------------------------------------------------------------------ lifecycle

    override fun onShow(first: Boolean) {
        host.ambient.add(this)
        val data = host.data
        subtitle.update("${data.profile.examination} · Class ${data.profile.className}")
        val signature = data.exams.joinToString { it.key } + data.choices + data.profile.hall
        val rebuilt = signature != builtFor
        if (rebuilt) {
            builtFor = signature
            build(host.season)
        }
        tick(host.season)
        if ((first || rebuilt) && host.policy.motion) playEntrance() else rows.forEach { it.rail.reveal = 1f }
    }

    override fun onHide() {
        host.ambient.remove(this)
    }

    override fun onDataChanged() {
        builtFor = ""
    }

    override fun applyInsets(top: Int, bottom: Int) {
        content.setPadding(ctx.dp(20), top + ctx.dp(8), ctx.dp(20), ctx.dp(24))
    }

    override fun nextTickDelay(now: Long): Long {
        val change = SeasonCalculator.nextChange(host.data.exams, now) ?: return 60_000L
        return (change - now + 50).coerceIn(250L, 60_000L)
    }

    override fun onAmbientFrame(frameTimeMs: Long) {
        val pulse = (frameTimeMs % 2200L) / 2200f
        rows.forEach { it.rail.pulse = pulse }
    }

    // ------------------------------------------------------------------ building

    private fun build(season: Season) {
        list.removeAllViews()
        rows.clear()
        season.exams.forEachIndexed { index, status ->
            val row = makeRow(index == 0, index == season.exams.lastIndex)
            val subject = status.exam.subject
            row.view.setOnClickListener { host.openChecklist(subject) }
            rows += row
            list.addView(row.view, lp())
        }
    }

    private fun makeRow(first: Boolean, last: Boolean): Row {
        val weekday = ctx.label("", Ui.c.text3, 10.5f).apply { gravity = Gravity.CENTER }
        val day = ctx.heading("", 24f).apply { gravity = Gravity.CENTER }
        val month = ctx.label("", Ui.c.text2, 10.5f).apply { gravity = Gravity.CENTER }
        val dateColumn = ctx.column {
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dp(8), 0, 0)
            addView(weekday)
            addView(day, lp(WRAP, WRAP) { topMargin = dp(2) })
            addView(month, lp(WRAP, WRAP) { topMargin = dp(2) })
        }
        val rail = TimelineRailView(ctx).apply {
            hasTop = !first
            hasBottom = !last
            nodeY = ctx.dp(27).toFloat()
        }
        val title = ctx.text("", 17f, Ui.c.text, Fonts.sansSemibold)
        val status = ctx.statusLabel()
        val meta = ctx.text("", 14.5f, Ui.c.text2)
        val duration = ctx.text("", 13.5f, Ui.c.text3)
        val body = ctx.column {
            setPadding(0, dp(14), 0, dp(18))
            addView(title)
            addView(meta, lp { topMargin = dp(4) })
            addView(duration, lp { topMargin = dp(2) })
            addView(status, lp(WRAP, WRAP) { topMargin = dp(8) })
        }
        val view = ctx.row {
            gravity = Gravity.TOP
            background = Shapes.ripple(ctx, null, 12)
            addView(dateColumn, lp(ctx.dp(48), WRAP))
            addView(rail, lp(ctx.dp(34), MATCH))
            addView(body, lp(0, WRAP, 1f))
        }
        return Row(view, rail, body, title, meta, duration, status, weekday, day, month)
    }

    // ------------------------------------------------------------------ updates

    override fun tick(season: Season) {
        if (rows.size != season.exams.size) build(season)
        val choices = host.data.choices
        val hall = host.data.profile.hall
        season.exams.forEachIndexed { i, status ->
            val row = rows[i]
            val previous = season.exams.getOrNull(i - 1)
            val relative = Formats.relativeDay(status.exam.date, season.now)
            val signature = "${status.exam.key}|${status.phase}|${status.isToday}|${status.doneReason}|$relative|" +
                "${previous?.phase}|${status.exam.durationMinutes}|$choices|$hall"
            if (signature == row.signature) return@forEachIndexed
            row.signature = signature
            bindRow(row, status, previous, relative, hall)
        }
    }

    private fun bindRow(row: Row, status: ExamStatus, previous: ExamStatus?, relative: String, hall: String) {
        val c = Ui.c
        val exam = status.exam
        val choices = host.data.choices
        row.weekday.update(Formats.weekday(exam.date).uppercase())
        row.day.update(exam.date.dayOfMonth.toString())
        row.month.update(Formats.month(exam.date))
        row.title.update(exam.title(choices))
        row.meta.update(Formats.time(exam.start) + if (hall.isBlank()) "" else " · Hall $hall")
        val end = exam.confirmedEndMillis
        row.duration.update(
            if (end != null) "${Timetable.durationLabel(exam.durationMinutes)} · ends ${Formats.time(end)}" else "Duration not confirmed",
        )
        row.rail.topLit = previous?.phase == Phase.DONE
        row.rail.bottomLit = status.phase == Phase.DONE
        when {
            status.phase == Phase.DONE -> {
                row.rail.node = TimelineRailView.Node.DONE
                val label = if (status.doneReason == DoneReason.DATE_PASSED || status.doneReason == DoneReason.NEXT_STARTED) "Completed" else "Finished"
                row.status.styleStatus("✓ $label", c.greenText)
            }
            status.phase == Phase.LIVE -> {
                row.rail.node = TimelineRailView.Node.LIVE
                row.status.styleStatus("Exam time", c.gold, filled = true)
            }
            status.isToday -> {
                row.rail.node = TimelineRailView.Node.TODAY
                row.status.styleStatus("Today", c.goldText)
            }
            else -> {
                row.rail.node = TimelineRailView.Node.UPCOMING
                row.status.styleStatus(relative, c.text2)
            }
        }
        row.title.setTextColor(if (status.phase == Phase.DONE) c.text2 else c.text)
        row.view.contentDescription = "${exam.title(choices)}, ${Formats.dateLong(exam.date)}, " +
            "${Formats.time(exam.start)}${if (hall.isBlank()) "" else ", hall $hall"}. ${row.status.text}. " +
            "${row.duration.text}. Double tap to open its revision checklist."
        row.rail.invalidate()
    }

    private fun playEntrance() {
        staggerIn(rows.map { it.view }, motion = true)
        // Each row's rail draws itself down in step with the row rising in, and its node pops.
        rows.forEachIndexed { i, row ->
            row.rail.reveal = 0f
            ValueAnimator.ofFloat(0f, 1f).apply {
                startDelay = 60L + i * 55L
                duration = 720
                interpolator = LinearInterpolator()
                addUpdateListener { row.rail.reveal = it.animatedValue as Float }
                start()
            }
        }
    }
}

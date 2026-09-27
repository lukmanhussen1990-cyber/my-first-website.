package com.imran.examcountdown.ui.screens

import android.animation.ValueAnimator
import android.view.Gravity
import android.view.View
import android.view.animation.DecelerateInterpolator
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
import com.imran.examcountdown.ui.widgets.TimelineRailView
import com.imran.examcountdown.ui.widgets.statusPill
import com.imran.examcountdown.ui.widgets.styleStatus

class TimetableScreen(host: MainActivity) : Screen(host), AmbientListener {

    private val scroll = ScrollView(ctx).apply {
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
    }
    override val root: View get() = scroll
    private val content = ctx.column()
    private val subtitle = ctx.text("", 14.5f, Palette.TEXT_2)
    private val list = ctx.column()

    private class Row(
        val view: LinearLayout,
        val rail: TimelineRailView,
        val card: LinearLayout,
        val title: TextView,
        val meta: TextView,
        val duration: TextView,
        val status: TextView,
        val day: TextView,
        val month: TextView,
        val weekday: TextView,
    ) {
        var signature = ""
    }

    private val rows = ArrayList<Row>()
    private var builtFor = ""
    private var pulse = 0f

    init {
        scroll.addView(content, FrameLayout.LayoutParams(MATCH, WRAP))
        content.addView(ctx.text("Timetable", 30f, Palette.TEXT, Fonts.bold), lp { topMargin = ctx.dp(10) })
        content.addView(subtitle, lp { topMargin = ctx.dp(6) })
        content.addView(noteCard(), lp { topMargin = ctx.dp(18) })
        content.addView(list, lp { topMargin = ctx.dp(22) })
        content.addView(
            ctx.text("Only dates with a Class VIII exam are listed.", 13f, Palette.TEXT_3) { gravity = Gravity.CENTER },
            lp { topMargin = ctx.dp(6) },
        )
    }

    private fun noteCard(): View = ctx.column {
        background = Shapes.card(ctx, 22)
        setPadding(dp(18), dp(16), dp(18), dp(16))
        addView(ctx.row {
            addView(ctx.icon(R.drawable.ic_clock, Palette.CYAN, 20))
            addView(ctx.text("Every exam starts at 12:30 PM", 16f, Palette.TEXT, Fonts.semibold), lp(0, WRAP, 1f) { marginStart = dp(10) })
        })
        addView(ctx.text(Timetable.SESSION_NOTE, 14f, Palette.TEXT_2), lp { topMargin = dp(10) })
        addView(ctx.text(Timetable.DURATION_NOTE, 13.5f, Palette.TEXT_3) { setLineSpacing(0f, 1.3f) }, lp { topMargin = dp(6) })
        addView(ctx.text("Set durations in Settings  ›", 14f, Palette.VIOLET_LIGHT, Fonts.semibold) {
            setPadding(0, dp(10), dp(10), dp(4))
            setOnClickListener { host.showTab(MainActivity.TAB_SETTINGS) }
        }, lp(WRAP, WRAP) { topMargin = dp(2) })
    }

    // ------------------------------------------------------------------ lifecycle

    override fun onShow(first: Boolean) {
        host.ambient.add(this)
        val data = host.data
        subtitle.text = "${data.profile.examination} · Class ${data.profile.className}"
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
        content.setPadding(ctx.dp(20), top + ctx.dp(8), ctx.dp(20), bottom + ctx.dp(120))
    }

    override fun nextTickDelay(now: Long): Long {
        val change = SeasonCalculator.nextChange(host.data.exams, now) ?: return 60_000L
        return (change - now + 50).coerceIn(250L, 60_000L)
    }

    override fun onAmbientFrame(frameTimeMs: Long) {
        pulse = ((frameTimeMs % 1600L) / 1600f)
        rows.forEach { it.rail.pulse = pulse }
    }

    // ------------------------------------------------------------------ building

    private fun build(season: Season) {
        list.removeAllViews()
        rows.clear()
        season.exams.forEachIndexed { index, status ->
            val row = makeRow(index == 0, index == season.exams.lastIndex)
            val subject = status.exam.subject
            row.card.setOnClickListener { host.openChecklist(subject) }
            rows += row
            list.addView(row.view, lp())
        }
    }

    private fun makeRow(first: Boolean, last: Boolean): Row {
        val day = ctx.text("", 24f, Palette.TEXT, Fonts.semibold) { gravity = Gravity.CENTER }
        val month = ctx.caps("", Palette.TEXT_2, 11f).apply { gravity = Gravity.CENTER }
        val weekday = ctx.text("", 12.5f, Palette.TEXT_3) { gravity = Gravity.CENTER }
        val dateColumn = ctx.column {
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dp(12), 0, 0)
            addView(day)
            addView(month, lp(WRAP, WRAP) { topMargin = dp(3) })
            addView(weekday, lp(WRAP, WRAP) { topMargin = dp(2) })
        }
        val rail = TimelineRailView(ctx).apply {
            hasTop = !first
            hasBottom = !last
            nodeY = ctx.dp(30).toFloat()
        }
        val title = ctx.text("", 17f, Palette.TEXT, Fonts.semibold)
        val status = ctx.statusPill()
        val meta = ctx.text("", 14f, Palette.TEXT_2)
        val duration = ctx.text("", 13f, Palette.TEXT_3)
        val card = ctx.column {
            setPadding(dp(16), dp(14), dp(14), dp(14))
            addView(ctx.row {
                gravity = Gravity.TOP
                addView(title, lp(0, WRAP, 1f) { marginEnd = dp(8) })
                addView(status, lp(WRAP, WRAP))
            })
            addView(meta, lp { topMargin = dp(6) })
            addView(duration, lp { topMargin = dp(4) })
        }
        val view = ctx.row {
            gravity = Gravity.TOP
            addView(dateColumn, lp(ctx.dp(50), WRAP))
            addView(rail, lp(ctx.dp(40), MATCH))
            addView(card, lp(0, WRAP, 1f) { bottomMargin = ctx.dp(12) })
        }
        return Row(view, rail, card, title, meta, duration, status, day, month, weekday)
    }

    // ------------------------------------------------------------------ updates

    override fun tick(season: Season) {
        if (rows.size != season.exams.size) {
            build(season)
        }
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
        val exam = status.exam
        val choices = host.data.choices
        row.day.update(exam.date.dayOfMonth.toString())
        row.month.update(Formats.month(exam.date))
        row.weekday.update(Formats.weekday(exam.date))
        row.title.update(exam.title(choices))
        val hallText = if (hall.isBlank()) "" else " · Hall $hall"
        row.meta.update("${Formats.time(exam.start)}$hallText")
        val end = exam.confirmedEndMillis
        row.duration.update(
            if (end != null) {
                "${Timetable.durationLabel(exam.durationMinutes)} · ends ${Formats.time(end)}"
            } else {
                "Duration not confirmed"
            },
        )

        row.rail.topLit = previous?.phase == Phase.DONE
        row.rail.bottomLit = status.phase == Phase.DONE
        val highlight: Int
        when {
            status.phase == Phase.DONE -> {
                row.rail.node = TimelineRailView.Node.DONE
                val label = if (status.doneReason == DoneReason.DATE_PASSED || status.doneReason == DoneReason.NEXT_STARTED) "Completed" else "Finished"
                row.status.styleStatus("✓ $label", Palette.GREEN)
                highlight = 0
            }
            status.phase == Phase.LIVE -> {
                row.rail.node = TimelineRailView.Node.LIVE
                row.status.styleStatus("Exam time!", Palette.PINK, filled = true)
                highlight = Palette.PINK
            }
            status.isToday -> {
                row.rail.node = TimelineRailView.Node.TODAY
                row.status.styleStatus("Today", Palette.AMBER)
                highlight = Palette.AMBER
            }
            else -> {
                row.rail.node = TimelineRailView.Node.UPCOMING
                row.status.styleStatus(relative, Palette.BLUE)
                highlight = 0
            }
        }
        val fill = if (highlight != 0) Palette.withAlpha(highlight, 0.10f) else Palette.SURFACE
        val stroke = if (highlight != 0) Palette.withAlpha(highlight, 0.45f) else Palette.STROKE
        row.card.background = Shapes.ripple(ctx, Shapes.rounded(ctx, 20, fill, stroke), 20)
        row.card.alpha = if (status.phase == Phase.DONE) 0.78f else 1f
        row.card.contentDescription = "${exam.title(choices)}, ${Formats.dateLong(exam.date)}, " +
            "${Formats.time(exam.start)}${if (hall.isBlank()) "" else ", hall $hall"}. ${row.status.text}. " +
            "${row.duration.text}. Double tap to open its revision checklist."
        row.rail.invalidate()
    }

    private fun playEntrance() {
        rows.forEachIndexed { i, row ->
            row.view.alpha = 0f
            row.view.translationY = ctx.dp(16).toFloat()
            row.view.animate().alpha(1f).translationY(0f).setStartDelay(40L + i * 55L).setDuration(380).start()
            row.rail.reveal = 0f
            ValueAnimator.ofFloat(0f, 1f).apply {
                startDelay = 60L + i * 55L
                duration = 520
                interpolator = DecelerateInterpolator()
                addUpdateListener { row.rail.reveal = it.animatedValue as Float }
                start()
            }
        }
    }
}

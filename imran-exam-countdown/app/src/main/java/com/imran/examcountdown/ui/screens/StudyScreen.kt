package com.imran.examcountdown.ui.screens

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.os.Build
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.imran.examcountdown.MainActivity
import com.imran.examcountdown.R
import com.imran.examcountdown.core.CheckItem
import com.imran.examcountdown.core.Checklists
import com.imran.examcountdown.core.ExamStatus
import com.imran.examcountdown.core.FocusMode
import com.imran.examcountdown.core.FocusPhase
import com.imran.examcountdown.core.FocusState
import com.imran.examcountdown.core.FocusTimer
import com.imran.examcountdown.core.Formats
import com.imran.examcountdown.core.Phase
import com.imran.examcountdown.core.Season
import com.imran.examcountdown.core.Subject
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.ui.Dialogs
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.caps
import com.imran.examcountdown.ui.column
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.flp
import com.imran.examcountdown.ui.icon
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.row
import com.imran.examcountdown.ui.text
import com.imran.examcountdown.ui.update
import com.imran.examcountdown.ui.widgets.ButtonStyle
import com.imran.examcountdown.ui.widgets.FocusDialView
import com.imran.examcountdown.ui.widgets.RollingNumberView
import com.imran.examcountdown.ui.widgets.SegmentedControl
import com.imran.examcountdown.ui.widgets.pillButton

class StudyScreen(host: MainActivity) : Screen(host) {

    private val scroll = ScrollView(ctx).apply {
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
    }
    override val root: View get() = scroll
    private val content = ctx.column()

    // ---------------------------------------------------------------- focus timer views
    private val modeControl = SegmentedControl(ctx, listOf("Focus · 25 min", "Break · 5 min"))
    private val dial = FocusDialView(ctx)
    private val dialFrame = SquareFrame(ctx, ctx.dp(250))
    private val minutes = RollingNumberView(ctx)
    private val seconds = RollingNumberView(ctx)
    private val colon = ctx.text(":", 30f, Palette.TEXT_2, Fonts.light) { gravity = Gravity.CENTER }
    private val phaseLabel = ctx.caps("", Palette.TEXT_2, 11.5f)
    private val primary = ctx.pillButton("Start", R.drawable.ic_play) { onPrimary() }
    private val reset = ctx.pillButton("Reset", R.drawable.ic_replay, ButtonStyle.SECONDARY) { onReset() }
    private val sessions = ctx.text("", 13.5f, Palette.TEXT_3) { gravity = Gravity.CENTER }

    private var state = FocusState()
    private var lastPhase: FocusPhase? = null

    // ---------------------------------------------------------------- checklists
    private val overall = ctx.text("", 14f, Palette.TEXT_2, Fonts.medium)
    private val cardsContainer = ctx.column()
    private val cards = LinkedHashMap<Subject, ChecklistCard>()
    private var builtFor = ""
    private var expanded: Subject? = null

    init {
        scroll.addView(content, FrameLayout.LayoutParams(MATCH, WRAP))
        content.addView(ctx.text("Study", 30f, Palette.TEXT, Fonts.bold), lp { topMargin = ctx.dp(10) })
        content.addView(ctx.text("Focus timer and revision checklists", 14.5f, Palette.TEXT_2), lp { topMargin = ctx.dp(6) })
        content.addView(focusCard(), lp { topMargin = ctx.dp(18) })
        content.addView(ctx.row {
            addView(ctx.text("Revision checklists", 20f, Palette.TEXT, Fonts.semibold), lp(0, WRAP, 1f))
            addView(overall)
        }, lp { topMargin = ctx.dp(26) })
        content.addView(
            ctx.text("Tap a task to tick it off. Use the pencil to edit or delete it.", 13.5f, Palette.TEXT_3),
            lp { topMargin = ctx.dp(6) },
        )
        content.addView(cardsContainer, lp { topMargin = ctx.dp(12) })

        modeControl.onSelect = { index ->
            state = FocusTimer.select(state, FocusMode.entries[index])
            saveFocus()
        }
    }

    private fun focusCard(): View = ctx.column {
        background = Shapes.card(ctx, 28)
        setPadding(dp(18), dp(18), dp(18), dp(20))
        gravity = Gravity.CENTER_HORIZONTAL
        addView(modeControl, lp())

        dialFrame.addView(dial, flp(MATCH, MATCH))
        val center = ctx.column {
            gravity = Gravity.CENTER_HORIZONTAL
            addView(ctx.row {
                gravity = Gravity.CENTER
                addView(minutes, lp(WRAP, WRAP))
                addView(colon, lp(WRAP, WRAP))
                addView(seconds, lp(WRAP, WRAP))
            })
            addView(phaseLabel, lp(WRAP, WRAP) { topMargin = dp(6) })
        }
        dialFrame.addView(center, flp(WRAP, WRAP, Gravity.CENTER))
        dialFrame.onSize = { size ->
            val px = size * 0.2f
            minutes.textSizePx = px
            seconds.textSizePx = px
            minutes.font = Fonts.light
            seconds.font = Fonts.light
            colon.setTextSize(TypedValue.COMPLEX_UNIT_PX, px * 0.8f)
        }
        addView(dialFrame, lp(WRAP, WRAP) { topMargin = dp(14) })

        addView(ctx.row {
            gravity = Gravity.CENTER
            addView(primary, lp(0, WRAP, 1f))
            addView(reset, lp(WRAP, WRAP) { marginStart = dp(10) })
        }, lp { topMargin = dp(16) })
        addView(sessions, lp { topMargin = dp(14) })
    }

    // ---------------------------------------------------------------- lifecycle

    override fun onShow(first: Boolean) {
        state = host.store.focus
        lastPhase = null
        val data = host.data
        val signature = "${data.choices}|${data.exams.joinToString { it.key }}"
        if (signature != builtFor) {
            builtFor = signature
            buildCards()
        }
        refreshFocus(animate = false)
        updateCards(host.season)
        onMotionChanged()
    }

    override fun onDataChanged() {
        builtFor = ""
    }

    override fun onMotionChanged() {
        minutes.animateChanges = host.policy.motion
        seconds.animateChanges = host.policy.motion
        modeControl.animateChanges = host.policy.motion
    }

    override fun applyInsets(top: Int, bottom: Int) {
        content.setPadding(ctx.dp(20), top + ctx.dp(8), ctx.dp(20), bottom + ctx.dp(120))
    }

    override fun tick(season: Season) {
        refreshFocus(animate = false)
        updateCards(season)
    }

    override fun nextTickDelay(now: Long): Long {
        if (!state.running) return 1000 - now % 1000
        val left = FocusTimer.remaining(state, AppClock.moment(ctx))
        val rest = left % 1000
        return (if (rest == 0L) 1000L else rest) + 5
    }

    /** Opens the checklist for [subject] and scrolls it into view. */
    fun reveal(subject: Subject?) {
        if (subject == null) return
        if (cards.isEmpty()) onShow(false)
        expanded = subject
        cards.forEach { (s, card) -> card.setExpanded(s == subject, animate = false) }
        val card = cards[subject] ?: return
        scroll.post {
            val y = cardsContainer.top + card.view.top - ctx.dp(12)
            if (host.policy.motion) scroll.smoothScrollTo(0, y) else scroll.scrollTo(0, y)
        }
    }

    // ---------------------------------------------------------------- focus logic

    private fun refreshFocus(animate: Boolean) {
        val now = AppClock.moment(ctx)
        val settled = FocusTimer.settle(state, now, AppClock.localEpochDay())
        if (settled != state) {
            val justFinished = state.running && !settled.running
            state = settled
            host.store.focus = settled
            if (justFinished) celebrateSession()
        }
        val left = FocusTimer.remaining(state, now)
        val totalSeconds = (left + 999) / 1000
        minutes.setValue(totalSeconds / 60)
        seconds.setValue(totalSeconds % 60)
        dial.mode = state.mode
        dial.setFraction(left.toFloat() / state.mode.durationMs, animate)
        modeControl.select(state.mode.ordinal)

        val phase = FocusTimer.phase(state, now)
        phaseLabel.update(
            when (phase) {
                FocusPhase.READY -> if (state.mode == FocusMode.FOCUS) "Ready to focus" else "Ready for a break"
                FocusPhase.RUNNING -> if (state.mode == FocusMode.FOCUS) "Focusing…" else "On a break"
                FocusPhase.PAUSED -> "Paused"
                FocusPhase.FINISHED -> if (state.finished == FocusMode.BREAK) "Break over" else "Session complete!"
            },
        )
        if (phase != lastPhase) {
            lastPhase = phase
            val (label, icon) = when (phase) {
                FocusPhase.READY -> (if (state.mode == FocusMode.FOCUS) "Start focus" else "Start break") to R.drawable.ic_play
                FocusPhase.RUNNING -> "Pause" to R.drawable.ic_pause
                FocusPhase.PAUSED -> "Resume" to R.drawable.ic_play
                FocusPhase.FINISHED ->
                    if (state.finished == FocusMode.BREAK) "Start focus" to R.drawable.ic_bolt
                    else "Start 5-min break" to R.drawable.ic_coffee
            }
            primary.text = label
            setButtonIcon(primary, icon)
            reset.visibility = if (phase == FocusPhase.READY) View.GONE else View.VISIBLE
        }
        val count = state.sessionsToday
        sessions.update(
            when (count) {
                0 -> "No focus sessions yet today. You can pause any time."
                1 -> "1 focus session done today. Nice!"
                else -> "$count focus sessions done today. Great work!"
            },
        )
        dialFrame.contentDescription = "${state.mode.label} timer, ${totalSeconds / 60} minutes " +
            "${totalSeconds % 60} seconds left. ${phaseLabel.text}"
    }

    private fun onPrimary() {
        val now = AppClock.moment(ctx)
        state = when (FocusTimer.phase(state, now)) {
            FocusPhase.READY, FocusPhase.PAUSED -> FocusTimer.start(state, now)
            FocusPhase.RUNNING -> FocusTimer.pause(state, now)
            FocusPhase.FINISHED ->
                if (state.finished == FocusMode.BREAK) FocusTimer.startFocus(state, now) else FocusTimer.startBreak(state, now)
        }
        saveFocus()
    }

    private fun onReset() {
        state = FocusTimer.reset(state)
        saveFocus()
    }

    private fun saveFocus() {
        host.store.focus = state
        host.rescheduleAlarms()
        refreshFocus(animate = true)
        host.requestTick()
    }

    private fun celebrateSession() {
        val feedback = if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS
        dialFrame.performHapticFeedback(feedback)
        if (host.policy.motion) {
            dialFrame.animate().scaleX(1.05f).scaleY(1.05f).setDuration(160).withEndAction {
                dialFrame.animate().scaleX(1f).scaleY(1f).setInterpolator(OvershootInterpolator()).setDuration(320).start()
            }.start()
        }
    }

    private fun setButtonIcon(button: TextView, iconRes: Int) {
        val d = ctx.getDrawable(iconRes)?.mutate() ?: return
        d.setTintList(ColorStateList.valueOf(button.currentTextColor))
        d.setBounds(0, 0, ctx.dp(20), ctx.dp(20))
        button.setCompoundDrawablesRelative(d, null, null, null)
    }

    // ---------------------------------------------------------------- checklists

    private fun buildCards() {
        cardsContainer.removeAllViews()
        cards.clear()
        val season = host.season
        season.exams.forEach { status ->
            val card = ChecklistCard(status.exam.subject)
            cards[status.exam.subject] = card
            cardsContainer.addView(card.view, lp { bottomMargin = ctx.dp(12) })
            card.load()
            card.setExpanded(status.exam.subject == expanded, animate = false)
        }
    }

    private fun updateCards(season: Season) {
        var done = 0
        var total = 0
        season.exams.forEach { status ->
            val card = cards[status.exam.subject] ?: return@forEach
            card.bindHeader(status)
            done += card.items.count { it.done }
            total += card.items.size
        }
        overall.update("$done / $total done")
    }

    private inner class ChecklistCard(val subject: Subject) {
        val view: LinearLayout
        private val ring = MiniRing(ctx)
        private val title = ctx.text("", 16.5f, Palette.TEXT, Fonts.semibold)
        private val caption = ctx.text("", 13f, Palette.TEXT_3)
        private val chevron = ImageView(ctx).apply {
            setImageResource(R.drawable.ic_expand)
            imageTintList = ColorStateList.valueOf(Palette.TEXT_2)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        private val body = ctx.column()
        private val itemsBox = ctx.column()
        private var key = ""
        private var isExpanded = false
        private var headerSignature = ""
        var items: List<CheckItem> = emptyList()
            private set

        init {
            val header = ctx.row {
                setPadding(dp(16), dp(14), dp(12), dp(14))
                background = Shapes.ripple(ctx, null, 22)
                addView(ring, lp(dp(34), dp(34)))
                addView(ctx.column {
                    addView(title)
                    addView(caption, lp { topMargin = dp(3) })
                }, lp(0, WRAP, 1f) { marginStart = dp(14) })
                addView(chevron, lp(dp(24), dp(24)))
                setOnClickListener { toggle() }
            }
            val addRow = ctx.row {
                setPadding(dp(12), dp(12), dp(12), dp(12))
                background = Shapes.ripple(ctx, null, 14)
                addView(ctx.icon(R.drawable.ic_add, Palette.VIOLET_LIGHT, 20))
                addView(ctx.text("Add a task", 15f, Palette.VIOLET_LIGHT, Fonts.semibold), lp(0, WRAP, 1f) { marginStart = dp(12) })
                setOnClickListener { addItem() }
            }
            val restore = ctx.text("Restore suggested tasks", 13f, Palette.TEXT_3, Fonts.medium) {
                setPadding(dp(12), dp(8), dp(12), dp(8))
                setOnClickListener { restoreDefaults() }
            }
            body.setPadding(ctx.dp(8), 0, ctx.dp(8), ctx.dp(10))
            body.addView(itemsBox)
            body.addView(addRow, lp { topMargin = ctx.dp(2) })
            body.addView(restore, lp(WRAP, WRAP) { gravity = Gravity.END })
            body.visibility = View.GONE
            view = ctx.column {
                background = Shapes.card(ctx, 22)
                addView(header)
                addView(body)
            }
        }

        fun load() {
            val choices = host.data.choices
            key = Checklists.key(subject, choices)
            items = host.store.checklist(key, Checklists.defaults(subject, choices))
            renderItems()
        }

        fun bindHeader(status: ExamStatus) {
            val choices = host.data.choices
            val done = items.count { it.done }
            val timing = when {
                status.phase == Phase.DONE -> "Exam done"
                status.phase == Phase.LIVE -> "Exam in progress"
                else -> Formats.relativeDay(status.exam.date, host.season.now)
            }
            val signature = "${status.exam.key}|$choices|$done|${items.size}|$timing"
            if (signature == headerSignature) return
            headerSignature = signature
            title.text = status.exam.title(choices)
            caption.text = "${Formats.dateShort(status.exam.date)} · $timing · $done of ${items.size} done"
            ring.set(done, items.size)
            view.contentDescription = null
        }

        fun toggle() {
            setExpanded(!isExpanded, animate = true)
            if (isExpanded) expanded = subject
        }

        fun setExpanded(value: Boolean, animate: Boolean) {
            isExpanded = value
            body.visibility = if (value) View.VISIBLE else View.GONE
            val rotation = if (value) 180f else 0f
            if (animate && host.policy.motion) {
                chevron.animate().rotation(rotation).setDuration(200).start()
                if (value) {
                    body.alpha = 0f
                    body.animate().alpha(1f).setDuration(220).start()
                }
            } else {
                chevron.rotation = rotation
            }
        }

        private fun renderItems() {
            itemsBox.removeAllViews()
            items.forEach { item -> itemsBox.addView(itemRow(item)) }
        }

        private fun itemRow(item: CheckItem): View {
            val check = CheckCircle(ctx).apply { setChecked(item.done, animate = false) }
            val label = ctx.text(item.text, 15f, if (item.done) Palette.TEXT_3 else Palette.TEXT) {
                paintFlags = if (item.done) paintFlags or Paint.STRIKE_THRU_TEXT_FLAG else paintFlags and Paint.STRIKE_THRU_TEXT_FLAG.inv()
            }
            val edit = ImageView(ctx).apply {
                setImageResource(R.drawable.ic_edit)
                imageTintList = ColorStateList.valueOf(Palette.TEXT_3)
                setPadding(dp(12), dp(12), dp(12), dp(12))
                background = Shapes.ripple(ctx, null, 20)
                contentDescription = "Edit “${item.text}”"
                setOnClickListener { editItem(item) }
            }
            return ctx.row {
                minimumHeight = dp(48)
                setPadding(dp(12), dp(4), 0, dp(4))
                background = Shapes.ripple(ctx, null, 14)
                addView(check, lp(dp(24), dp(24)))
                addView(label, lp(0, WRAP, 1f) { marginStart = dp(14) })
                addView(edit, lp(dp(44), dp(44)))
                contentDescription = "${item.text}, ${if (item.done) "done" else "not done"}"
                setOnClickListener {
                    val updated = item.copy(done = !item.done)
                    check.setChecked(updated.done, animate = host.policy.motion)
                    replace(item, updated, rerender = false)
                    label.setTextColor(if (updated.done) Palette.TEXT_3 else Palette.TEXT)
                    label.paintFlags = if (updated.done) label.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG else label.paintFlags and Paint.STRIKE_THRU_TEXT_FLAG.inv()
                    contentDescription = "${item.text}, ${if (updated.done) "done" else "not done"}"
                    setOnClickListener(null)
                    // Rebuild shortly so the row captures the new state.
                    postDelayed({ renderItems() }, if (host.policy.motion) 260L else 0L)
                }
            }
        }

        private fun replace(old: CheckItem, new: CheckItem, rerender: Boolean) {
            items = items.map { if (it.id == old.id) new else it }
            save(rerender)
        }

        private fun addItem() {
            val name = title.text
            Dialogs.editText(host, "New task", "", hint = "e.g. Revise chapter 3 ($name)") { text ->
                if (text.isBlank()) return@editText
                val id = (items.maxOfOrNull { it.id } ?: 0L) + 1
                items = items + CheckItem(id, text)
                save(true)
            }
        }

        private fun editItem(item: CheckItem) {
            Dialogs.editText(host, "Edit task", item.text, onDelete = {
                items = items.filterNot { it.id == item.id }
                save(true)
            }) { text ->
                items = items.map { if (it.id == item.id) it.copy(text = text) else it }
                save(true)
            }
        }

        private fun restoreDefaults() {
            Dialogs.confirm(
                host,
                "Restore suggested tasks?",
                "This replaces the tasks for ${title.text} with the original suggestions.",
                "Restore",
            ) {
                host.store.resetChecklist(key)
                load()
                headerSignature = ""
                updateCards(host.season)
            }
        }

        private fun save(rerender: Boolean) {
            host.store.saveChecklist(key, items)
            if (rerender) renderItems()
            headerSignature = ""
            updateCards(host.season)
        }
    }

    /** Small progress ring for a checklist header. */
    private class MiniRing(context: Context) : View(context) {
        private var fraction = 0f
        private var complete = false
        private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = context.dpf(3.5f)
            color = Palette.TRACK
        }
        private val arc = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = context.dpf(3.5f)
            strokeCap = Paint.Cap.ROUND
        }
        private val label = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Palette.TEXT
            textAlign = Paint.Align.CENTER
            typeface = Fonts.semibold
            textSize = context.dpf(10.5f)
        }
        private val oval = RectF()

        init {
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        }

        fun set(done: Int, total: Int) {
            fraction = if (total == 0) 0f else done.toFloat() / total
            complete = total > 0 && done == total
            invalidate()
        }

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            val inset = track.strokeWidth
            oval.set(inset, inset, w - inset, h - inset)
            arc.shader = LinearGradient(0f, 0f, w.toFloat(), h.toFloat(), Palette.CYAN, Palette.VIOLET, Shader.TileMode.CLAMP)
        }

        override fun onDraw(canvas: Canvas) {
            canvas.drawOval(oval, track)
            if (fraction > 0f) canvas.drawArc(oval, -90f, 360f * fraction, false, arc)
            val text = if (complete) "✓" else "${Math.round(fraction * 100)}"
            val y = height / 2f - (label.descent() + label.ascent()) / 2f
            canvas.drawText(text, width / 2f, y, label)
        }
    }

    /** Round checkbox with a gradient fill and an animated tick. */
    private class CheckCircle(context: Context) : View(context) {
        private var progress = 0f
        private var animator: ValueAnimator? = null
        private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = context.dpf(2f)
            color = Palette.withAlpha(Palette.TEXT, 0.35f)
        }
        private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        private val tick = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = context.dpf(2.4f)
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            color = Palette.WHITE
        }
        private val path = Path()

        init {
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        }

        fun setChecked(checked: Boolean, animate: Boolean) {
            animator?.cancel()
            val to = if (checked) 1f else 0f
            if (!animate) {
                progress = to
                invalidate()
                return
            }
            animator = ValueAnimator.ofFloat(progress, to).apply {
                duration = 240
                interpolator = DecelerateInterpolator()
                addUpdateListener {
                    progress = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
        }

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            fill.shader = LinearGradient(0f, 0f, w.toFloat(), h.toFloat(), Palette.BLUE, Palette.VIOLET, Shader.TileMode.CLAMP)
        }

        override fun onDraw(canvas: Canvas) {
            val cx = width / 2f
            val cy = height / 2f
            val r = minOf(cx, cy) - ring.strokeWidth
            canvas.drawCircle(cx, cy, r, ring)
            if (progress <= 0f) return
            canvas.drawCircle(cx, cy, r * (0.6f + 0.4f * progress) + ring.strokeWidth / 2, fill.apply { alpha = (255 * progress).toInt() })
            path.reset()
            path.moveTo(cx - r * 0.45f, cy + r * 0.02f)
            path.lineTo(cx - r * 0.1f, cy + r * 0.36f)
            path.lineTo(cx + r * 0.48f, cy - r * 0.32f)
            tick.alpha = (255 * progress).toInt()
            canvas.drawPath(path, tick)
        }
    }
}

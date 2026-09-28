package com.imran.examcountdown.ui.screens

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.view.Gravity
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator
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
import com.imran.examcountdown.ui.AmbientListener
import com.imran.examcountdown.ui.Dialogs
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Haptics
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.Spring
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.column
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.fadeTo
import com.imran.examcountdown.ui.heading
import com.imran.examcountdown.ui.label
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.row
import com.imran.examcountdown.ui.separator
import com.imran.examcountdown.ui.spring
import com.imran.examcountdown.ui.text
import com.imran.examcountdown.ui.update
import com.imran.examcountdown.ui.window
import com.imran.examcountdown.ui.widgets.ButtonStyle
import com.imran.examcountdown.ui.widgets.ProgressTrack
import com.imran.examcountdown.ui.widgets.RollingNumberView
import com.imran.examcountdown.ui.widgets.SegmentedControl
import com.imran.examcountdown.ui.widgets.pillButton
import com.imran.examcountdown.ui.widgets.setLeadingIcon

class StudyScreen(host: MainActivity) : Screen(host), AmbientListener {

    private val scroll = ScrollView(ctx).apply {
        isVerticalScrollBarEnabled = false
        overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
    }
    override val root: View get() = scroll
    private val content = ctx.column()

    // ---------------------------------------------------------------- focus timer
    private val modeControl = SegmentedControl(ctx, listOf("Focus · 25 min", "Break · 5 min"))
    private val minutes = RollingNumberView(ctx)
    private val seconds = RollingNumberView(ctx)
    private val colon = ctx.text(":", 40f, Ui.c.text3, Fonts.serif) { gravity = Gravity.CENTER }
    private val timerRow = ctx.row {
        gravity = Gravity.BOTTOM
        addView(minutes, lp(WRAP, WRAP))
        addView(colon, lp(WRAP, WRAP))
        addView(seconds, lp(WRAP, WRAP))
    }
    private val track = ProgressTrack(ctx)
    private val phaseText = ctx.text("", 14.5f, Ui.c.text2, Fonts.sansMedium)
    private val primary = ctx.pillButton("Start focus", R.drawable.ic_play) { onPrimary() }
    private val reset = ctx.pillButton("Reset", R.drawable.ic_replay, ButtonStyle.SECONDARY) { onReset() }
    private val sessions = ctx.text("", 13.5f, Ui.c.text3)

    private var state = FocusState()
    private var lastPhase: FocusPhase? = null
    private var smoothing = false

    // ---------------------------------------------------------------- checklists
    private val overall = ctx.text("", 14f, Ui.c.text2, Fonts.sansMedium)
    private val cardsContainer = ctx.column()
    private val cards = LinkedHashMap<Subject, ChecklistCard>()
    private var builtFor = ""
    private var expanded: Subject? = null

    init {
        scroll.addView(content, FrameLayout.LayoutParams(MATCH, WRAP))
        content.addView(ctx.heading("Study", 30f), lp { topMargin = ctx.dp(8) })
        content.addView(ctx.text("Focus timer and revision checklists", 15f, Ui.c.text2), lp { topMargin = ctx.dp(6) })

        content.addView(ctx.label("Focus timer"), lp { topMargin = ctx.dp(24) })
        content.addView(modeControl, lp { topMargin = ctx.dp(12) })
        content.addView(timerRow, lp(WRAP, WRAP) { topMargin = ctx.dp(18) })
        // 16 dp tall so the glow at the head of the 4 dp line has room; same line position as before.
        content.addView(track, lp(MATCH, ctx.dp(16)) { topMargin = ctx.dp(6) })
        content.addView(phaseText, lp { topMargin = ctx.dp(10) })
        content.addView(ctx.row {
            addView(primary, lp(0, WRAP, 1f))
            addView(reset, lp(WRAP, WRAP) { marginStart = dp(10) })
        }, lp { topMargin = ctx.dp(18) })
        content.addView(sessions, lp { topMargin = ctx.dp(12) })

        content.addView(ctx.separator(), lp(MATCH, WRAP) { topMargin = ctx.dp(26) })
        content.addView(ctx.row {
            addView(ctx.label("Revision checklists"), lp(0, WRAP, 1f))
            addView(overall)
        }, lp { topMargin = ctx.dp(22) })
        content.addView(
            ctx.text("Tap a task to tick it off. Use the pencil to edit or delete it.", 14f, Ui.c.text3),
            lp { topMargin = ctx.dp(6) },
        )
        content.addView(cardsContainer, lp { topMargin = ctx.dp(8) })

        val digit = ctx.dp(60).toFloat()
        minutes.textSizePx = digit
        seconds.textSizePx = digit
        minutes.verticalGapPx = digit * 0.06f
        seconds.verticalGapPx = digit * 0.06f
        colon.setPadding(ctx.dp(4), 0, ctx.dp(4), (digit * 0.14f).toInt())
        minutes.countsDown = true
        seconds.countsDown = true

        modeControl.onSelect = { index ->
            state = FocusTimer.select(state, FocusMode.entries[index])
            saveFocus()
        }
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
        host.ambient.add(this)
        if (first && host.policy.motion) {
            staggerIn((0 until content.childCount).map { content.getChildAt(it) }.filter { it.visibility == View.VISIBLE }, motion = true)
        }
    }

    override fun onHide() {
        host.ambient.remove(this)
        colon.alpha = 1f
    }

    override fun onDataChanged() {
        builtFor = ""
    }

    override fun onMotionChanged() {
        minutes.animateChanges = host.policy.motion
        seconds.animateChanges = host.policy.motion
        modeControl.animateChanges = host.policy.motion
        smoothing = host.policy.ambient
        if (!smoothing) {
            colon.alpha = 1f
            track.shimmer = -1f
        }
    }

    override fun applyInsets(top: Int, bottom: Int) {
        content.setPadding(ctx.dp(20), top + ctx.dp(8), ctx.dp(20), ctx.dp(24))
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

    /**
     * While running: the line follows the clock every frame with a light travelling along it,
     * and the colon breathes once a second, in time with the digits.
     */
    override fun onAmbientFrame(frameTimeMs: Long) {
        if (!smoothing) return
        if (!state.running) {
            if (colon.alpha != 1f) colon.alpha = 1f
            track.shimmer = -1f
            return
        }
        val left = FocusTimer.remaining(state, AppClock.moment(ctx))
        track.set(left.toFloat() / state.mode.durationMs, animate = false)
        track.shimmer = (frameTimeMs % 2800L) / 2800f * 1.5f - 0.25f
        val beat = (left % 1000L) / 1000f
        colon.alpha = 0.35f + 0.65f * (0.5f + 0.5f * kotlin.math.cos(beat * 6.283f))
    }

    /** Opens the checklist for [subject] and scrolls it into view. */
    fun reveal(subject: Subject?) {
        if (subject == null) return
        if (cards.isEmpty()) onShow(false)
        expanded = subject
        cards.forEach { (s, card) -> card.setExpanded(s == subject, animate = false) }
        val card = cards[subject] ?: return
        scroll.post {
            val y = cardsContainer.top + card.view.top - ctx.dp(8)
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
        track.fillColor = if (state.mode == FocusMode.FOCUS) Ui.c.green else Ui.c.gold
        if (!state.running || !smoothing) track.set(left.toFloat() / state.mode.durationMs, animate)
        modeControl.select(state.mode.ordinal)

        val phase = FocusTimer.phase(state, now)
        phaseText.update(
            when (phase) {
                FocusPhase.READY -> if (state.mode == FocusMode.FOCUS) "Ready for 25 minutes of focus." else "Ready for a 5-minute break."
                FocusPhase.RUNNING -> if (state.mode == FocusMode.FOCUS) "Focusing… The line shows the time left." else "On a break. Stretch, drink some water."
                FocusPhase.PAUSED -> "Paused. Resume whenever you’re ready."
                FocusPhase.FINISHED -> if (state.finished == FocusMode.BREAK) "Break over." else "Session complete! Time for a 5-minute break."
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
            primary.setLeadingIcon(icon)
            reset.visibility = if (phase == FocusPhase.READY) View.GONE else View.VISIBLE
        }
        sessions.update(
            when (val count = state.sessionsToday) {
                0 -> "No focus sessions yet today. You can pause any time."
                1 -> "1 focus session done today. Nice!"
                else -> "$count focus sessions done today. Great work!"
            },
        )
        timerRow.contentDescription = "${state.mode.label} timer, ${totalSeconds / 60} minutes ${totalSeconds % 60} seconds left. ${phaseText.text}"
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
        Haptics.confirm(timerRow)
        if (host.policy.motion) {
            // The timer lifts a little, then settles back, as a small burst of confetti goes off.
            timerRow.pivotX = 0f
            timerRow.animate().scaleX(1.05f).scaleY(1.05f).setDuration(120).setInterpolator(Ease.out).withEndAction {
                timerRow.animate().scaleX(1f).scaleY(1f).setInterpolator(Spring(0.7f)).setDuration(280).start()
            }.start()
            host.popAt(timerRow, 1.1f)
        }
    }

    // ---------------------------------------------------------------- checklists

    private fun buildCards() {
        cardsContainer.removeAllViews()
        cards.clear()
        host.season.exams.forEachIndexed { i, status ->
            val card = ChecklistCard(status.exam.subject)
            cards[status.exam.subject] = card
            if (i > 0) cardsContainer.addView(ctx.separator())
            cardsContainer.addView(card.view, lp())
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
        private val title = ctx.text("", 16.5f, Ui.c.text, Fonts.sansSemibold)
        private val caption = ctx.text("", 13.5f, Ui.c.text3)
        private val chevron = ImageView(ctx).apply {
            setImageResource(R.drawable.ic_expand)
            imageTintList = ColorStateList.valueOf(Ui.c.text2)
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
                minimumHeight = dp(64)
                setPadding(0, dp(10), dp(4), dp(10))
                background = Shapes.ripple(ctx, null, 12)
                addView(ring, lp(dp(32), dp(32)))
                addView(ctx.column {
                    addView(title)
                    addView(caption, lp { topMargin = dp(2) })
                }, lp(0, WRAP, 1f) { marginStart = dp(14) })
                addView(chevron, lp(dp(24), dp(24)))
                setOnClickListener { toggle() }
            }
            val addRow = ctx.text("Add a task", 15f, Ui.c.greenText, Fonts.sansSemibold) {
                gravity = Gravity.CENTER_VERTICAL
                minHeight = dp(48)
                setPadding(dp(2), 0, dp(12), 0)
                setLeadingIcon(R.drawable.ic_add, 20)
                background = Shapes.ripple(ctx, null, 12)
                setOnClickListener { addItem() }
            }
            val restore = ctx.text("Restore suggested tasks", 13.5f, Ui.c.text3, Fonts.sansMedium) {
                gravity = Gravity.CENTER_VERTICAL
                minHeight = dp(44)
                setPadding(dp(12), 0, dp(4), 0)
                setOnClickListener { restoreDefaults() }
            }
            body.setPadding(ctx.dp(46), 0, 0, ctx.dp(10))
            body.addView(itemsBox)
            body.addView(ctx.row {
                addView(addRow, lp(0, WRAP, 1f))
                addView(restore, lp(WRAP, WRAP))
            })
            body.visibility = View.GONE
            view = ctx.column {
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
            val timing = when (status.phase) {
                Phase.DONE -> "Exam done"
                Phase.LIVE -> "Exam in progress"
                Phase.UPCOMING -> Formats.relativeDay(status.exam.date, host.season.now)
            }
            val signature = "${status.exam.key}|$choices|$done|${items.size}|$timing"
            if (signature == headerSignature) return
            headerSignature = signature
            title.text = status.exam.title(choices)
            caption.text = "${Formats.dateShort(status.exam.date)} · $timing · $done of ${items.size} done"
            ring.animateChanges = host.policy.motion
            ring.set(done, items.size)
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
                chevron.animate().rotation(rotation).setDuration(220).setInterpolator(Ease.inOut).start()
                if (value) {
                    body.alpha = 0f
                    body.translationY = -ctx.dp(8).toFloat()
                    body.animate().translationY(0f).setDuration(240).setInterpolator(Ease.out).start()
                    body.fadeTo(1f, 200)
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
            val label = ctx.text(item.text, 15.5f, if (item.done) Ui.c.text3 else Ui.c.text) {
                paintFlags = if (item.done) paintFlags or Paint.STRIKE_THRU_TEXT_FLAG else paintFlags and Paint.STRIKE_THRU_TEXT_FLAG.inv()
            }
            val edit = ImageView(ctx).apply {
                setImageResource(R.drawable.ic_edit)
                imageTintList = ColorStateList.valueOf(Ui.c.text3)
                setPadding(dp(12), dp(12), dp(12), dp(12))
                background = Shapes.ripple(ctx, null, 20)
                contentDescription = "Edit “${item.text}”"
                setOnClickListener { editItem(item) }
            }
            return ctx.row {
                minimumHeight = dp(48)
                background = Shapes.ripple(ctx, null, 10)
                addView(check, lp(dp(22), dp(22)))
                addView(label, lp(0, WRAP, 1f) { marginStart = dp(14) })
                addView(edit, lp(dp(44), dp(44)))
                contentDescription = "${item.text}, ${if (item.done) "done" else "not done"}"
                setOnClickListener {
                    val updated = item.copy(done = !item.done)
                    // The tick draws itself into the box.
                    check.setChecked(updated.done, animate = host.policy.motion)
                    if (updated.done) Haptics.confirm(this) else Haptics.tap(this)
                    replace(item, updated)
                    label.setTextColor(if (updated.done) Ui.c.text3 else Ui.c.text)
                    label.paintFlags = if (updated.done) label.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG else label.paintFlags and Paint.STRIKE_THRU_TEXT_FLAG.inv()
                    contentDescription = "${item.text}, ${if (updated.done) "done" else "not done"}"
                    setOnClickListener(null)
                    // Rebuild after the tick animation so the row reflects the new state.
                    postDelayed({ renderItems() }, if (host.policy.motion) 340L else 0L)
                }
            }
        }

        private fun replace(old: CheckItem, new: CheckItem) {
            items = items.map { if (it.id == old.id) new else it }
            save(rerender = false)
        }

        private fun addItem() {
            Dialogs.editText(host, "New task", "", hint = "e.g. Revise chapter 3") { text ->
                if (text.isBlank()) return@editText
                val id = (items.maxOfOrNull { it.id } ?: 0L) + 1
                items = items + CheckItem(id, text)
                save(rerender = true)
            }
        }

        private fun editItem(item: CheckItem) {
            Dialogs.editText(host, "Edit task", item.text, onDelete = {
                items = items.filterNot { it.id == item.id }
                save(rerender = true)
            }) { text ->
                items = items.map { if (it.id == item.id) it.copy(text = text) else it }
                save(rerender = true)
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
            strokeWidth = context.dpf(3f)
        }
        private val arc = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = context.dpf(3f)
            strokeCap = Paint.Cap.ROUND
        }
        private val label = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            typeface = Fonts.sansSemibold
            textSize = context.dpf(10.5f)
        }
        private val oval = RectF()

        init {
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        }

        private var shown = -1f
        private var animator: ValueAnimator? = null

        /** Sets the ring; after the first time, it sweeps smoothly to the new amount (300 ms). */
        fun set(done: Int, total: Int) {
            fraction = if (total == 0) 0f else done.toFloat() / total
            complete = total > 0 && done == total
            animator?.cancel()
            if (shown < 0f || !isAttachedToWindow || !animateChanges) {
                shown = fraction
                invalidate()
                return
            }
            animator = ValueAnimator.ofFloat(shown, fraction).apply {
                duration = 300
                interpolator = Ease.inOut
                addUpdateListener {
                    shown = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
        }

        var animateChanges = true

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            val inset = track.strokeWidth
            oval.set(inset, inset, w - inset, h - inset)
        }

        override fun onDraw(canvas: Canvas) {
            track.color = Ui.c.track
            arc.color = if (complete) Ui.c.gold else Ui.c.green
            label.color = if (complete) Ui.c.goldText else Ui.c.text2
            canvas.drawOval(oval, track)
            val f = shown.coerceIn(0f, 1f)
            if (f > 0f) canvas.drawArc(oval, -90f, 360f * f, false, arc)
            val text = if (complete) "✓" else "${Math.round(fraction * 100)}"
            val y = height / 2f - (label.descent() + label.ascent()) / 2f
            canvas.drawText(text, width / 2f, y, label)
        }
    }

    /** Round checkbox: ticking it fills it green, then the tick draws itself into place (320 ms). */
    private class CheckCircle(context: Context) : View(context) {
        private var progress = 0f
        private var popping = false
        private var animator: ValueAnimator? = null
        private val partial = Path()
        private val measure = android.graphics.PathMeasure()
        private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = context.dpf(1.8f)
        }
        private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        private val tick = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = context.dpf(2.2f)
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
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
                popping = false
                invalidate()
                return
            }
            popping = checked
            animator = ValueAnimator.ofFloat(progress, to).apply {
                duration = if (checked) 320 else 180
                interpolator = if (checked) LinearInterpolator() else DecelerateInterpolator()
                addUpdateListener {
                    progress = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
        }

        override fun onDraw(canvas: Canvas) {
            val cx = width / 2f
            val cy = height / 2f
            val r = minOf(cx, cy) - ring.strokeWidth
            ring.color = Ui.c.text3
            canvas.drawCircle(cx, cy, r, ring)
            if (progress <= 0f) return
            // Checking: the fill grows in quickly, then the tick draws along its path.
            val grow = if (popping) Ease.cubicOut(window(progress, 0f, 0.5f)) else progress
            val drawn = if (popping) Ease.cubicOut(window(progress, 0.3f, 0.7f)) else progress
            fill.color = Ui.c.green
            fill.alpha = (255 * if (popping) window(progress, 0f, 0.3f) else progress).toInt().coerceIn(0, 255)
            canvas.drawCircle(cx, cy, (r + ring.strokeWidth / 2) * (0.55f + 0.45f * grow), fill)
            path.reset()
            path.moveTo(cx - r * 0.45f, cy + r * 0.02f)
            path.lineTo(cx - r * 0.1f, cy + r * 0.36f)
            path.lineTo(cx + r * 0.48f, cy - r * 0.32f)
            tick.color = Ui.c.onGreen
            if (drawn >= 1f) {
                canvas.drawPath(path, tick)
            } else if (drawn > 0f) {
                measure.setPath(path, false)
                partial.reset()
                measure.getSegment(0f, measure.length * drawn, partial, true)
                canvas.drawPath(partial, tick)
            }
        }
    }
}

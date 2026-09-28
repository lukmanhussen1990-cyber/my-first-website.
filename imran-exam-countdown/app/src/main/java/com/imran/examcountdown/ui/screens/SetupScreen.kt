package com.imran.examcountdown.ui.screens

import android.content.res.ColorStateList
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import com.imran.examcountdown.MainActivity
import com.imran.examcountdown.R
import com.imran.examcountdown.core.Elective
import com.imran.examcountdown.core.Formats
import com.imran.examcountdown.core.MilLanguage
import com.imran.examcountdown.core.Subject
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.fadeTo
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.column
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.flp
import com.imran.examcountdown.ui.heading
import com.imran.examcountdown.ui.icon
import com.imran.examcountdown.ui.label
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.row
import com.imran.examcountdown.ui.separator
import com.imran.examcountdown.ui.text
import com.imran.examcountdown.ui.widgets.ButtonStyle
import com.imran.examcountdown.ui.widgets.pillButton

/** Short first-run setup: welcome, MIL language, elective, and optional reminders. */
class SetupScreen(private val host: MainActivity) {

    private val ctx = host
    val root = FrameLayout(ctx).apply { setBackgroundColor(Ui.c.bg) }
    private val scroll = ScrollView(ctx).apply {
        isVerticalScrollBarEnabled = false
        isFillViewport = true
    }
    private val column = ctx.column()

    /** Header emblem; the opening animation settles into it on first launch. */
    val emblem = ImageView(ctx).apply {
        setImageResource(R.drawable.emblem_small)
        contentDescription = "Al-Ameen Academy emblem"
    }
    private val stepLabel = ctx.label("", Ui.c.text3, 11f)
    private val steps = ctx.row()
    private val page = ctx.column()
    private val footer = ctx.column()
    private val back = ImageView(ctx).apply {
        setImageResource(R.drawable.ic_back)
        imageTintList = ColorStateList.valueOf(Ui.c.text2)
        setPadding(ctx.dp(10), ctx.dp(10), ctx.dp(10), ctx.dp(10))
        background = Shapes.ripple(ctx, null, 22)
        contentDescription = "Back"
        setOnClickListener { back() }
    }

    private var step = 0
    private var mil: MilLanguage? = host.data.choices.mil
    private var elective: Elective? = host.data.choices.elective

    init {
        column.addView(ctx.row {
            addView(emblem, lp(dp(36), dp(36)))
            addView(ctx.column {
                addView(ctx.text("Al-Ameen Academy", 16f, Ui.c.text, Fonts.serif))
                addView(ctx.label("Badarpur · Estd. 1994", Ui.c.goldText, 10.5f), lp { topMargin = dp(3) })
            }, lp(0, WRAP, 1f) { marginStart = dp(12) })
            addView(stepLabel)
        })
        column.addView(ctx.separator(), lp(MATCH, WRAP) { topMargin = ctx.dp(14) })
        column.addView(ctx.row {
            addView(back, lp(dp(44), dp(44)))
            addView(steps, lp(0, WRAP, 1f) { marginStart = dp(8) })
        }, lp { topMargin = ctx.dp(8) })
        column.addView(page, lp(MATCH, 0, 1f) { topMargin = ctx.dp(4) })
        column.addView(footer, lp { topMargin = ctx.dp(20) })
        scroll.addView(column, FrameLayout.LayoutParams(MATCH, MATCH))
        root.addView(scroll, flp(MATCH, MATCH))
        render(animate = false)
    }

    fun applyInsets(top: Int, bottom: Int) {
        column.setPadding(ctx.dp(20), top + ctx.dp(8), ctx.dp(20), bottom + ctx.dp(20))
    }

    /** Handles the back button; returns false when there is no earlier step. */
    fun back(): Boolean {
        if (step == 0) return false
        step--
        render(animate = true, forward = false)
        return true
    }

    private fun next() {
        when (step) {
            1 -> host.updateChoices(host.data.choices.copy(mil = mil))
            2 -> host.updateChoices(host.data.choices.copy(elective = elective))
        }
        if (step < 3) {
            step++
            render(animate = true, forward = true)
        }
    }

    private fun render(animate: Boolean, forward: Boolean = true) {
        steps.removeAllViews()
        for (i in 0..3) {
            steps.addView(View(ctx).apply {
                background = Shapes.rounded(ctx, 2, if (i <= step) Ui.c.green else Ui.c.track)
            }, lp(0, ctx.dp(4), 1f) { if (i > 0) marginStart = ctx.dp(6) })
        }
        stepLabel.text = "STEP ${step + 1} OF 4"
        back.visibility = if (step == 0) View.INVISIBLE else View.VISIBLE

        page.removeAllViews()
        footer.removeAllViews()
        when (step) {
            0 -> welcome()
            1 -> milStep()
            2 -> electiveStep()
            else -> remindersStep()
        }
        if (animate && host.policy.motion) {
            // The new page glides in from the side of travel while its parts rise in one by one.
            val shift = ctx.dp(20).toFloat() * if (forward) 1 else -1
            page.alpha = 0f
            page.translationX = shift
            page.animate().translationX(0f).setDuration(260).setInterpolator(Ease.out).start()
            page.fadeTo(1f, 200)
            staggerIn((0 until page.childCount).map { page.getChildAt(it) }, motion = true, startDelay = 40L)
            // The step just reached fills in from the left.
            if (forward) {
                steps.getChildAt(step)?.let { bar ->
                    bar.pivotX = 0f
                    bar.scaleX = 0f
                    bar.animate().scaleX(1f).setDuration(280).setInterpolator(Ease.out).start()
                }
            }
        }
        scroll.scrollTo(0, 0)
    }

    private fun title(text: String, subtitle: String) {
        page.addView(ctx.heading(text, 30f), lp { topMargin = ctx.dp(12) })
        page.addView(ctx.text(subtitle, 16f, Ui.c.text2) { setLineSpacing(0f, 1.35f) }, lp { topMargin = ctx.dp(8) })
    }

    private fun welcome() {
        val p = host.data.profile
        title(if (p.firstName.isEmpty()) "Hey there" else "Hey, ${p.firstName}", "Let’s get your exam countdown ready. It only takes a moment.")
        val list = ctx.column()
        listOf(
            R.drawable.ic_person to p.name,
            R.drawable.ic_school to p.school,
            R.drawable.ic_study to "Class ${p.className} · Roll ${p.roll}",
            R.drawable.ic_hall to "Examination hall ${p.hall}",
            R.drawable.ic_calendar to p.examination,
        ).forEachIndexed { i, (icon, value) ->
            if (i > 0) list.addView(ctx.separator())
            list.addView(detail(icon, value))
        }
        page.addView(list, lp { topMargin = ctx.dp(20) })
        page.addView(ctx.text("You can change any of these later in Settings.", 14f, Ui.c.text3), lp { topMargin = ctx.dp(12) })
        footer.addView(ctx.pillButton("Let’s go", R.drawable.ic_forward) { next() }, lp())
    }

    private fun detail(iconRes: Int, label: String): View = ctx.row {
        minimumHeight = dp(52)
        addView(ctx.icon(iconRes, Ui.c.greenText, 20))
        addView(ctx.text(label, 16f, Ui.c.text), lp(0, WRAP, 1f) { marginStart = dp(14) })
    }

    private fun examDate(subject: Subject): String =
        Formats.dateLong(host.data.exams.first { it.subject == subject }.date)

    private fun milStep() {
        title("Your MIL paper", "Which language do you take for MIL on ${examDate(Subject.MIL)}?")
        val options = ArrayList<LinearLayout>()
        val continueButton = ctx.pillButton("Continue") { if (mil != null) next() }
        val list = ctx.column()
        MilLanguage.entries.forEachIndexed { i, lang ->
            if (i > 0) list.addView(ctx.separator())
            val option = choiceRow(lang.label, lang.nativeLabel, "MIL (${lang.label})") {
                mil = lang
                select(options, i)
                continueButton.alpha = 1f
            }
            options += option
            list.addView(option)
        }
        page.addView(list, lp { topMargin = ctx.dp(20) })
        select(options, mil?.ordinal ?: -1)
        continueButton.alpha = if (mil == null) 0.45f else 1f
        footer.addView(continueButton, lp())
    }

    private fun electiveStep() {
        title("Your elective", "Which elective do you take on ${examDate(Subject.ELECTIVE)}?")
        val options = ArrayList<LinearLayout>()
        val continueButton = ctx.pillButton("Continue") { if (elective != null) next() }
        val native = mapOf(Elective.ARABIC to "العربية")
        val list = ctx.column()
        Elective.entries.forEachIndexed { i, e ->
            if (i > 0) list.addView(ctx.separator())
            val option = choiceRow(e.label, native[e], "Elective (${e.label})") {
                elective = e
                select(options, i)
                continueButton.alpha = 1f
            }
            options += option
            list.addView(option)
        }
        page.addView(list, lp { topMargin = ctx.dp(20) })
        select(options, elective?.ordinal ?: -1)
        continueButton.alpha = if (elective == null) 0.45f else 1f
        footer.addView(continueButton, lp())
    }

    private fun remindersStep() {
        title(
            "Exam reminders?",
            "A gentle reminder one day and one hour before each exam. If you say yes, Android will ask whether the app may show notifications.",
        )
        val list = ctx.column()
        list.addView(detail(R.drawable.ic_bell, "Tomorrow: MIL — starts at 12:30 PM"))
        list.addView(ctx.separator())
        list.addView(detail(R.drawable.ic_clock, "Starts in 1 hour · Hall ${host.data.profile.hall}"))
        page.addView(list, lp { topMargin = ctx.dp(20) })
        page.addView(ctx.text("Works offline. You can switch this off any time in Settings.", 14f, Ui.c.text3), lp { topMargin = ctx.dp(12) })
        footer.addView(ctx.pillButton("Turn on reminders", R.drawable.ic_bell) {
            host.setExamReminders(true) { host.finishSetup() }
        }, lp())
        footer.addView(ctx.pillButton("Not now", style = ButtonStyle.GHOST) { host.finishSetup() }, lp { topMargin = ctx.dp(6) })
    }

    private fun choiceRow(title: String, native: String?, caption: String, onPick: () -> Unit): LinearLayout {
        val radio = View(ctx)
        return ctx.row {
            minimumHeight = dp(68)
            setPadding(dp(12), dp(10), dp(12), dp(10))
            addView(radio, lp(dp(22), dp(22)))
            addView(ctx.column {
                addView(ctx.text(title, 17.5f, Ui.c.text, Fonts.sansSemibold))
                addView(ctx.text(caption, 14f, Ui.c.text3), lp { topMargin = dp(2) })
            }, lp(0, WRAP, 1f) { marginStart = dp(16) })
            if (native != null) addView(ctx.text(native, 18f, Ui.c.text2) { gravity = Gravity.END })
            tag = radio
            contentDescription = title
            setOnClickListener { onPick() }
        }
    }

    private fun select(options: List<LinearLayout>, selected: Int) {
        options.forEachIndexed { i, row ->
            val on = i == selected
            row.background = Shapes.ripple(ctx, if (on) Shapes.rounded(ctx, 12, Ui.c.greenSoft) else null, 12)
            (row.tag as View).background = if (on) {
                Shapes.oval(Ui.c.green, Ui.withAlpha(Ui.c.green, 0.35f), ctx.dp(5))
            } else {
                Shapes.oval(0, Ui.c.text3, ctx.dp(2))
            }
            row.isSelected = on
        }
    }
}

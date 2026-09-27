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
import com.imran.examcountdown.ui.widgets.ButtonStyle
import com.imran.examcountdown.ui.widgets.pillButton
import com.imran.examcountdown.ui.widgets.pressScale

/** Short first-run setup: welcome, MIL language, elective, and optional reminders. */
class SetupScreen(private val host: MainActivity) {

    private val ctx = host
    val root = FrameLayout(ctx)
    private val scroll = ScrollView(ctx).apply {
        isVerticalScrollBarEnabled = false
        isFillViewport = true
    }
    private val page = ctx.column()
    private val dots = ctx.row { gravity = Gravity.CENTER }
    private val stepLabel = ctx.caps("", Palette.TEXT_3, 11f)
    private val back = ImageView(ctx).apply {
        setImageResource(R.drawable.ic_chevron_right)
        rotation = 180f
        imageTintList = ColorStateList.valueOf(Palette.TEXT_2)
        setPadding(ctx.dp(10), ctx.dp(10), ctx.dp(10), ctx.dp(10))
        background = Shapes.ripple(ctx, null, 22)
        contentDescription = "Back"
        setOnClickListener { back() }
    }
    private val footer = ctx.column()

    private var step = 0
    private var mil: MilLanguage? = host.data.choices.mil
    private var elective: Elective? = host.data.choices.elective
    private var insetTop = 0
    private var insetBottom = 0

    init {
        val header = ctx.row {
            addView(back, lp(dp(44), dp(44)))
            addView(dots, lp(0, WRAP, 1f))
            addView(stepLabel, lp(dp(60), WRAP) { marginEnd = dp(8) })
        }
        stepLabel.gravity = Gravity.END
        val column = ctx.column {
            addView(header, lp { topMargin = dp(4) })
            addView(page, lp(MATCH, 0, 1f) { topMargin = dp(12) })
            addView(footer, lp { topMargin = dp(16) })
        }
        scroll.addView(column, FrameLayout.LayoutParams(MATCH, MATCH))
        root.addView(scroll, flp(MATCH, MATCH))
        render(animate = false)
    }

    fun applyInsets(top: Int, bottom: Int) {
        insetTop = top
        insetBottom = bottom
        (scroll.getChildAt(0) as LinearLayout).setPadding(ctx.dp(20), top + ctx.dp(8), ctx.dp(20), bottom + ctx.dp(20))
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
        dots.removeAllViews()
        for (i in 0..3) {
            val active = i == step
            dots.addView(View(ctx).apply {
                background = if (i <= step) Shapes.gradient(ctx, 4, Palette.ACCENT_GRADIENT) else Shapes.rounded(ctx, 4, Palette.TRACK)
            }, lp(ctx.dp(if (active) 26 else 8), ctx.dp(8)) { marginEnd = ctx.dp(6) })
        }
        stepLabel.text = "Step ${step + 1} of 4"
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
            val shift = ctx.dp(28).toFloat() * if (forward) 1 else -1
            page.alpha = 0f
            page.translationX = shift
            page.animate().alpha(1f).translationX(0f).setDuration(300).start()
        }
        scroll.scrollTo(0, 0)
    }

    private fun title(text: String, subtitle: String) {
        page.addView(ctx.text(text, 30f, Palette.TEXT, Fonts.bold), lp { topMargin = ctx.dp(18) })
        page.addView(ctx.text(subtitle, 16f, Palette.TEXT_2) { setLineSpacing(0f, 1.3f) }, lp { topMargin = ctx.dp(10) })
    }

    private fun welcome() {
        val p = host.data.profile
        title(if (p.firstName.isEmpty()) "Hey there 👋" else "Hey ${p.firstName} 👋", "Let’s get your exam countdown ready. It only takes a moment.")
        val card = ctx.column {
            background = Shapes.card(ctx, 24)
            setPadding(dp(18), dp(18), dp(18), dp(18))
            addView(ctx.row {
                addView(ctx.text(p.initials, 18f, Palette.WHITE, Fonts.semibold) {
                    gravity = Gravity.CENTER
                    background = Shapes.ovalGradient(Palette.ACCENT_GRADIENT)
                }, lp(dp(52), dp(52)))
                addView(ctx.column {
                    addView(ctx.text(p.name, 19f, Palette.TEXT, Fonts.semibold))
                    addView(ctx.text(p.school, 14f, Palette.TEXT_2), lp { topMargin = dp(3) })
                }, lp(0, WRAP, 1f) { marginStart = dp(14) })
            })
            addView(detail(R.drawable.ic_study, "Class ${p.className} · Roll ${p.roll}"), lp { topMargin = dp(16) })
            addView(detail(R.drawable.ic_hall, "Examination hall ${p.hall}"), lp { topMargin = dp(10) })
            addView(detail(R.drawable.ic_calendar, p.examination), lp { topMargin = dp(10) })
        }
        page.addView(card, lp { topMargin = ctx.dp(24) })
        page.addView(ctx.text("You can change any of these later in Settings.", 13.5f, Palette.TEXT_3), lp { topMargin = ctx.dp(12) })
        footer.addView(ctx.pillButton("Let’s go", R.drawable.ic_chevron_right) { next() }, lp())
    }

    private fun examDate(subject: Subject): String =
        Formats.dateLong(host.data.exams.first { it.subject == subject }.date)

    private fun detail(iconRes: Int, label: String): View = ctx.row {
        addView(ctx.icon(iconRes, Palette.CYAN, 18))
        addView(ctx.text(label, 15f, Palette.TEXT), lp(0, WRAP, 1f) { marginStart = dp(12) })
    }

    private fun milStep() {
        title("Your MIL paper", "Which language do you take for MIL on ${examDate(Subject.MIL)}?")
        val continueButton = ctx.pillButton("Continue") { if (mil != null) next() }
        val options = ArrayList<View>()
        MilLanguage.entries.forEach { lang ->
            val card = choiceCard(lang.nativeLabel, lang.label, "MIL (${lang.label})", mil == lang) {
                mil = lang
                updateSelection(options, MilLanguage.entries.indexOf(lang))
                continueButton.alpha = 1f
            }
            options += card
            page.addView(card, lp { topMargin = ctx.dp(if (options.size == 1) 24 else 12) })
        }
        continueButton.alpha = if (mil == null) 0.45f else 1f
        footer.addView(continueButton, lp())
    }

    private fun electiveStep() {
        title("Your elective", "Which elective do you take on ${examDate(Subject.ELECTIVE)}?")
        val continueButton = ctx.pillButton("Continue") { if (elective != null) next() }
        val options = ArrayList<View>()
        val badges = mapOf(
            Elective.ADVANCED_MATHEMATICS to "∑",
            Elective.COMPUTER_SCIENCE to "</>",
            Elective.ARABIC to "ع",
        )
        Elective.entries.forEach { e ->
            val card = choiceCard(badges.getValue(e), e.label, "Elective (${e.label})", elective == e) {
                elective = e
                updateSelection(options, Elective.entries.indexOf(e))
                continueButton.alpha = 1f
            }
            options += card
            page.addView(card, lp { topMargin = ctx.dp(if (options.size == 1) 24 else 12) })
        }
        continueButton.alpha = if (elective == null) 0.45f else 1f
        footer.addView(continueButton, lp())
    }

    private fun remindersStep() {
        title("Exam reminders?", "Get a gentle reminder one day and one hour before each exam. Android will ask for permission to show notifications.")
        val card = ctx.column {
            background = Shapes.card(ctx, 24)
            setPadding(dp(18), dp(18), dp(18), dp(18))
            addView(detail(R.drawable.ic_bell, "Tomorrow: MIL — starts at 12:30 PM"))
            addView(detail(R.drawable.ic_clock, "Starts in 1 hour · Hall ${host.data.profile.hall}"), lp { topMargin = dp(12) })
            addView(ctx.text("Works offline. You can switch this off any time in Settings.", 13.5f, Palette.TEXT_3), lp { topMargin = dp(16) })
        }
        page.addView(card, lp { topMargin = ctx.dp(24) })
        footer.addView(ctx.pillButton("Turn on reminders", R.drawable.ic_bell) {
            host.setExamReminders(true) { host.finishSetup() }
        }, lp())
        footer.addView(ctx.pillButton("Not now", style = ButtonStyle.GHOST) { host.finishSetup() }, lp { topMargin = ctx.dp(8) })
    }

    private fun choiceCard(badge: String, title: String, caption: String, selected: Boolean, onPick: () -> Unit): View {
        val badgeView = ctx.text(badge, 20f, Palette.WHITE, Fonts.semibold) {
            gravity = Gravity.CENTER
            background = Shapes.ovalGradient(Palette.ACCENT_GRADIENT)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        val radio = View(ctx)
        val card = ctx.row {
            minimumHeight = dp(84)
            setPadding(dp(16), dp(14), dp(18), dp(14))
            addView(badgeView, lp(dp(52), dp(52)))
            addView(ctx.column {
                addView(ctx.text(title, 18f, Palette.TEXT, Fonts.semibold))
                addView(ctx.text(caption, 13.5f, Palette.TEXT_3), lp { topMargin = dp(3) })
            }, lp(0, WRAP, 1f) { marginStart = dp(16) })
            addView(radio, lp(dp(22), dp(22)))
            contentDescription = title
            stateListAnimator = pressScale(this)
            setOnClickListener { onPick() }
        }
        card.tag = radio
        styleChoice(card, selected)
        return card
    }

    private fun updateSelection(options: List<View>, selected: Int) {
        options.forEachIndexed { i, v -> styleChoice(v, i == selected) }
    }

    private fun styleChoice(card: View, selected: Boolean) {
        card.background = Shapes.ripple(
            ctx,
            if (selected) {
                Shapes.rounded(ctx, 24, Palette.withAlpha(Palette.BLUE, 0.16f), Palette.withAlpha(Palette.VIOLET_LIGHT, 0.8f), 2)
            } else {
                Shapes.card(ctx, 24)
            },
            24,
        )
        (card.tag as View).background = if (selected) {
            Shapes.ovalGradient(Palette.ACCENT_GRADIENT)
        } else {
            Shapes.oval(0, Palette.withAlpha(Palette.TEXT, 0.35f), ctx.dp(2))
        }
        card.isSelected = selected
    }
}

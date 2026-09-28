package com.imran.examcountdown

import android.Manifest
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.app.Activity
import android.app.UiModeManager
import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.ext.SdkExtensions
import android.provider.MediaStore
import android.provider.Settings
import android.view.View
import android.view.ViewTreeObserver
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Toast
import com.imran.examcountdown.core.AvatarFrame
import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.Exam
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.core.Profile
import com.imran.examcountdown.core.ReminderSettings
import com.imran.examcountdown.core.Season
import com.imran.examcountdown.core.SeasonCalculator
import com.imran.examcountdown.core.Subject
import com.imran.examcountdown.core.ThemeMode
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Avatar
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.notify.AppVisibility
import com.imran.examcountdown.notify.Notifier
import com.imran.examcountdown.notify.ReminderScheduler
import com.imran.examcountdown.ui.AmbientTicker
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Haptics
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.MotionPolicy
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.flp
import com.imran.examcountdown.ui.lerp
import com.imran.examcountdown.ui.spring
import com.imran.examcountdown.ui.window
import com.imran.examcountdown.ui.screens.HomeScreen
import com.imran.examcountdown.ui.screens.ProfileEditor
import com.imran.examcountdown.ui.screens.Screen
import com.imran.examcountdown.ui.screens.SettingsScreen
import com.imran.examcountdown.ui.screens.SetupScreen
import com.imran.examcountdown.ui.screens.StudyScreen
import com.imran.examcountdown.ui.screens.TimetableScreen
import com.imran.examcountdown.ui.widgets.AvatarView
import com.imran.examcountdown.ui.widgets.ConfettiView
import com.imran.examcountdown.ui.widgets.GoldRipple
import com.imran.examcountdown.ui.widgets.IntroView
import com.imran.examcountdown.ui.widgets.NavBar
import kotlin.math.roundToInt

/** Everything the screens read, loaded from [Store]. */
data class AppData(
    val profile: Profile,
    val choices: Choices,
    val exams: List<Exam>,
    val markedDone: Set<String>,
    val reminders: ReminderSettings,
    val motion: MotionPref,
    val avatarFrame: AvatarFrame,
    val frameAnimated: Boolean,
)

class MainActivity : Activity() {

    companion object {
        const val EXTRA_TAB = "com.imran.examcountdown.TAB"
        const val TAB_HOME = 0
        const val TAB_TIMETABLE = 1
        const val TAB_STUDY = 2
        const val TAB_SETTINGS = 3
        private const val STATE_TAB = "tab"
        private const val REQUEST_NOTIFICATIONS = 11
        private const val REQUEST_PHOTO = 12
        private const val TAB_MS = 240f

        /** Profile tap: the avatar springs back from its press, then flies into the profile screen. */
        private const val SPRING_BACK_MS = 150f
        private const val FLY_MS = 400f
        private const val FLY_BACK_MS = 360f
    }

    lateinit var store: Store
        private set
    lateinit var data: AppData
        private set
    lateinit var season: Season
        private set
    var policy = MotionPolicy(motion = true, ambient = true)
        private set
    val ambient = AmbientTicker()

    /** True while the opening animation is on screen. */
    var introRunning = false
        private set

    private lateinit var root: FrameLayout
    private lateinit var content: FrameLayout
    private lateinit var nav: NavBar
    private lateinit var confetti: ConfettiView
    private val screens = arrayOfNulls<Screen>(4)
    private val shownBefore = BooleanArray(4)
    private var currentTab = -1
    private var transition: ValueAnimator? = null
    private var setup: SetupScreen? = null
    private var editor: ProfileEditor? = null
    private var editorSource: AvatarView? = null
    private var profileMotion: ValueAnimator? = null
    private var flying: AvatarView? = null
    private var intro: IntroView? = null
    private var insetTop = 0
    private var insetBottom = 0
    private var resumed = false
    private var celebrated = false
    private var avatarCache: Pair<Long, Bitmap?>? = null
    private var pendingPermission: ((Boolean) -> Unit)? = null
    private val handler = Handler(Looper.getMainLooper())
    private val ticker = Runnable { tick() }
    private var powerReceiverRegistered = false
    private val powerReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) = applyMotion()
    }

    private val current: Screen? get() = if (currentTab >= 0) screens[currentTab] else null

    /** The open profile editor, if any (tests hand it a photo directly). */
    val profileEditor: ProfileEditor? get() = editor

    val currentScreen: Screen? get() = current

    /** The avatar flying between a screen and the profile editor, while it flies. */
    val flyingAvatar: AvatarView? get() = flying

    /** True while the profile screen is opening or closing. */
    val profileTransitionRunning: Boolean get() = profileMotion != null

    /**
     * Animated profile frames move only while the app is in front, continuous motion is allowed
     * (not reduced, not Battery Saver) and the frame animation is switched on.
     */
    val framesMoving: Boolean get() = resumed && policy.ambient && data.frameAnimated

    // ------------------------------------------------------------------ lifecycle

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(newBase)
        // Before Android 12 there is no per-app night mode, so apply a chosen theme here.
        if (Build.VERSION.SDK_INT < 31) {
            val night = when (Store(newBase).theme) {
                ThemeMode.LIGHT -> Configuration.UI_MODE_NIGHT_NO
                ThemeMode.DARK -> Configuration.UI_MODE_NIGHT_YES
                ThemeMode.SYSTEM -> null
            }
            if (night != null) applyOverrideConfiguration(Configuration().apply { uiMode = night })
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // The launch window is forest green (Theme.ExamCountdown.Launch); the app itself isn't.
        setTheme(R.style.Theme_ExamCountdown)
        super.onCreate(savedInstanceState)
        Fonts.init(this)
        Ui.apply(this)
        store = Store(this)
        Haptics.enabled = store.haptics
        data = loadData()
        season = SeasonCalculator.compute(data.exams, AppClock.now(), data.markedDone)
        policy = MotionPolicy.resolve(this, data.motion)
        buildViews()
        // After setContentView: the window's decor (and its insets controller) now exists.
        setupWindow()

        // The opening plays only on a cold launch (fresh process), never on rotation or when
        // returning to the app, not when a notification opens a particular tab, and not with
        // reduced motion or when it's switched off.
        val coldLaunch = !ExamCountdownApp.introHandled
        ExamCountdownApp.introHandled = true
        val playIntro = savedInstanceState == null && coldLaunch && store.introEnabled && policy.motion && !intent.hasExtra(EXTRA_TAB)
        if (Build.VERSION.SDK_INT >= 31) {
            splashScreen.setOnExitAnimationListener { view ->
                // With the opening, the launch window is identical to its first frame: remove it
                // at once. Without, fade it briefly into the app so there's no hard cut.
                if (playIntro || !policy.motion) {
                    view.remove()
                } else {
                    view.animate().alpha(0f).setDuration(180).withEndAction { view.remove() }.start()
                }
            }
        }
        updateLaunchWindow()

        // Home waits for the opening's hand-over before it rises in.
        introRunning = playIntro
        val tab = savedInstanceState?.getInt(STATE_TAB, TAB_HOME) ?: intent.getIntExtra(EXTRA_TAB, TAB_HOME)
        if (store.setupDone) showTab(tab, animate = false) else showSetup()
        if (playIntro) playIntro(replay = false)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (setup == null && intent.hasExtra(EXTRA_TAB)) showTab(intent.getIntExtra(EXTRA_TAB, TAB_HOME), animate = true)
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        AppVisibility.resumed = true
        // The app may have been in the background for hours: reload everything and recompute
        // from the current time rather than from anything cached.
        data = loadData()
        screens.forEach { it?.onDataChanged() }
        if (setup == null && !introRunning) current?.onShow(false)
        if (!powerReceiverRegistered) {
            registerReceiver(powerReceiver, IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED))
            powerReceiverRegistered = true
        }
        applyMotion()
        ReminderScheduler.onWake(this)
        tick()
    }

    override fun onPause() {
        super.onPause()
        resumed = false
        AppVisibility.resumed = false
        handler.removeCallbacks(ticker)
        // Continuous effects (drifting light, pulses, moving frames) stop in the background.
        applyMotion()
        if (powerReceiverRegistered) {
            unregisterReceiver(powerReceiver)
            powerReceiverRegistered = false
        }
    }

    override fun onDestroy() {
        profileMotion?.cancel()
        transition?.cancel()
        super.onDestroy()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt(STATE_TAB, if (currentTab >= 0) currentTab else TAB_HOME)
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onBackPressed() {
        intro?.let {
            it.skip()
            return
        }
        editor?.let {
            it.back()
            return
        }
        val s = setup
        if (s != null) {
            if (!s.back()) super.onBackPressed()
            return
        }
        if (currentTab != TAB_HOME) {
            showTab(TAB_HOME, animate = true)
            return
        }
        super.onBackPressed()
    }

    // ------------------------------------------------------------------ window & views

    private fun setupWindow() {
        // Edge to edge: screens pad themselves using the system bar insets.
        if (Build.VERSION.SDK_INT >= 30) window.setDecorFitsSystemWindows(false)
        barsOnGreen(false)
        @Suppress("DEPRECATION")
        window.statusBarColor = Color.TRANSPARENT
        // Android 8.0 can't draw dark navigation buttons, so give them a scrim on light backgrounds.
        @Suppress("DEPRECATION")
        window.navigationBarColor = if (Build.VERSION.SDK_INT < 27 && !Ui.c.dark) 0x66000000 else Color.TRANSPARENT
    }

    /** Light system-bar icons over the opening's green, dark ones over the light theme. */
    private fun barsOnGreen(green: Boolean) {
        val lightBars = !green && !Ui.c.dark
        if (Build.VERSION.SDK_INT >= 30) {
            val both = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.decorView.windowInsetsController?.setSystemBarsAppearance(if (lightBars) both else 0, both)
        } else {
            var flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            if (lightBars) {
                flags = flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                if (Build.VERSION.SDK_INT >= 27) flags = flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            }
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = flags
        }
    }

    /**
     * Android 13+ lets the app choose its next launch window: forest green when the opening will
     * play, the plain app background when it won't (so there's no green flash before the app).
     */
    private fun updateLaunchWindow() {
        if (Build.VERSION.SDK_INT < 33) return
        val opening = store.introEnabled && policy.motion
        try {
            splashScreen.setSplashScreenTheme(if (opening) R.style.Theme_ExamCountdown_Launch else R.style.Theme_ExamCountdown)
        } catch (e: RuntimeException) {
            // Not available here: the manifest's launch window is used instead.
        }
    }

    private fun buildViews() {
        root = FrameLayout(this).apply { setBackgroundColor(Ui.c.bg) }
        content = FrameLayout(this)
        nav = NavBar(
            this,
            listOf("Home", "Timetable", "Study", "Settings"),
            listOf(R.drawable.ic_home, R.drawable.ic_timeline, R.drawable.ic_study, R.drawable.ic_settings),
        ) { showTab(it, animate = true) }
        confetti = ConfettiView(this)
        // Content and navigation are stacked, so the bar can never cover anything.
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(content, LinearLayout.LayoutParams(MATCH, 0, 1f))
            addView(nav, LinearLayout.LayoutParams(MATCH, WRAP))
        }
        root.addView(column, flp(MATCH, MATCH))
        root.addView(confetti, flp(MATCH, MATCH))
        root.setOnApplyWindowInsetsListener { _, insets ->
            val top: Int
            val bottom: Int
            val left: Int
            val right: Int
            val ime: Int
            if (Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                top = bars.top
                bottom = bars.bottom
                left = bars.left
                right = bars.right
                ime = insets.getInsets(WindowInsets.Type.ime()).bottom
            } else {
                @Suppress("DEPRECATION")
                top = insets.systemWindowInsetTop
                @Suppress("DEPRECATION")
                bottom = insets.systemWindowInsetBottom
                @Suppress("DEPRECATION")
                left = insets.systemWindowInsetLeft
                @Suppress("DEPRECATION")
                right = insets.systemWindowInsetRight
                ime = 0
            }
            insetTop = top
            insetBottom = bottom
            column.setPadding(left, 0, right, 0)
            nav.setBottomInset(bottom)
            screens.forEach { it?.applyInsets(top, bottom) }
            setup?.applyInsets(top, bottom)
            editor?.applyInsets(top, maxOf(bottom, ime))
            insets
        }
        setContentView(root)
    }

    // ------------------------------------------------------------------ opening

    /**
     * Plays the opening over the current screen. [replay] is Settings → Replay opening: Home is
     * brought up underneath and rises in again at the hand-over. With reduced motion a replay is
     * a still picture that simply fades.
     */
    private fun playIntro(replay: Boolean) {
        if (intro != null) return
        val view = IntroView(this)
        intro = view
        introRunning = true
        // Settle into setup's emblem on first run, otherwise into Home's header emblem.
        view.target = { setup?.emblem ?: (screens[TAB_HOME] as? HomeScreen)?.emblem?.takeIf { currentTab == TAB_HOME } }
        // A replay brings Home up underneath, scrolled to its header, once the green covers the screen.
        view.onCovered = {
            if (replay) {
                showTab(TAB_HOME, animate = false)
                (screens[TAB_HOME] as? HomeScreen)?.scrollToTop()
            }
        }
        view.onReveal = {
            // Hand over: Home (or setup) rises in underneath the dissolving opening.
            (screens[TAB_HOME] as? HomeScreen)?.takeIf { currentTab == TAB_HOME && setup == null }?.playEntrance(again = replay)
        }
        view.onBackdropGone = { barsOnGreen(false) }
        view.onFinished = {
            intro = null
            introRunning = false
            current?.onShow(false)
            tick()
        }
        root.addView(view, flp(MATCH, MATCH))
        barsOnGreen(true)
        val still = !policy.motion
        view.post { if (still) view.playStill(fadeIn = replay) else view.play(fadeIn = replay) }
    }

    /** Settings → Replay opening. */
    fun replayIntro() {
        if (intro != null || setup != null || editor != null) return
        playIntro(replay = true)
    }

    fun setIntroEnabled(on: Boolean) {
        store.introEnabled = on
        updateLaunchWindow()
    }

    // ------------------------------------------------------------------ navigation

    fun showTab(tab: Int, animate: Boolean = true) {
        val index = tab.coerceIn(TAB_HOME, TAB_SETTINGS)
        if (setup != null) return
        val previous = current
        if (index == currentTab && previous != null) {
            previous.onShow(false)
            return
        }
        val screen = screens[index] ?: createScreen(index).also {
            screens[index] = it
            content.addView(it.root, flp(MATCH, MATCH))
            it.applyInsets(insetTop, insetBottom)
        }
        previous?.onHide()
        val direction = if (index > currentTab) 1f else -1f
        currentTab = index
        // Finish any tab change still running first: it may be hiding the screen we now want.
        transition?.end()
        val incoming = screen.root
        incoming.visibility = View.VISIBLE
        if (animate && policy.motion && previous != null) {
            slide(previous.root, incoming, direction)
        } else {
            previous?.root?.visibility = View.GONE
            rest(incoming)
        }
        nav.visibility = View.VISIBLE
        nav.select(index, animate)
        val first = !shownBefore[index]
        shownBefore[index] = true
        screen.onShow(first)
        applyMotion()
        tick()
    }

    /**
     * A short tab change (240 ms): the old tab fades out as it slips back a little, and the new
     * one fades in, gliding a few dp from the side you're heading to.
     */
    private fun slide(outgoing: View, incoming: View, direction: Float) {
        val shift = dpf(16)
        incoming.alpha = 0f
        incoming.translationX = direction * shift
        transition = ValueAnimator.ofFloat(0f, TAB_MS).apply {
            duration = TAB_MS.toLong()
            interpolator = LinearInterpolator()
            addUpdateListener {
                val ms = it.animatedValue as Float
                val o = Ease.cubicOut(window(ms, 0f, 120f))
                outgoing.alpha = 1f - o
                outgoing.translationX = -direction * dpf(8) * o
                val i = Ease.cubicOut(window(ms, 40f, TAB_MS - 40f))
                incoming.alpha = i
                incoming.translationX = direction * shift * (1f - i)
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    outgoing.visibility = View.GONE
                    rest(outgoing)
                    rest(incoming)
                    transition = null
                }
            })
            start()
        }
    }

    /** Clears any transition transform from a screen. */
    private fun rest(view: View) {
        view.alpha = 1f
        view.translationX = 0f
        view.translationY = 0f
        view.scaleX = 1f
        view.scaleY = 1f
    }

    private fun createScreen(tab: Int): Screen = when (tab) {
        TAB_TIMETABLE -> TimetableScreen(this)
        TAB_STUDY -> StudyScreen(this)
        TAB_SETTINGS -> SettingsScreen(this)
        else -> HomeScreen(this)
    }

    /** Opens the Study tab with [subject]'s checklist expanded. */
    fun openChecklist(subject: Subject?) {
        showTab(TAB_STUDY, animate = true)
        (screens[TAB_STUDY] as? StudyScreen)?.reveal(subject)
    }

    private fun showSetup() {
        val s = SetupScreen(this)
        setup = s
        root.addView(s.root, root.indexOfChild(confetti), flp(MATCH, MATCH))
        s.applyInsets(insetTop, insetBottom)
        root.requestApplyInsets()
    }

    fun finishSetup() {
        store.setupDone = true
        val s = setup ?: return
        setup = null
        showTab(TAB_HOME, animate = false)
        val view = s.root
        if (policy.motion) {
            // Setup fades away over Home as Home rises in behind it.
            view.animate().alpha(0f).scaleX(1.03f).scaleY(1.03f).setDuration(240).setInterpolator(Ease.exit)
                .withEndAction { root.removeView(view) }.start()
            (screens[TAB_HOME] as? HomeScreen)?.playEntrance()
        } else {
            root.removeView(view)
        }
    }

    // ------------------------------------------------------------------ profile screen

    /**
     * Opens the profile screen. When [from] (the avatar that was tapped) is on screen, it springs
     * back from the press, sends a thin gold ripple round its border and then expands into the
     * profile screen's large avatar; the controls fade in once it has settled. With reduced
     * motion the screen simply fades in.
     */
    fun openProfileEditor(from: AvatarView? = null) {
        if (editor != null || intro != null) return
        // A closing flight still under way finishes at once.
        profileMotion?.end()
        val e = ProfileEditor(this)
        editor = e
        editorSource = from
        root.addView(e.root, root.indexOfChild(confetti), flp(MATCH, MATCH))
        e.applyInsets(insetTop, insetBottom)
        root.requestApplyInsets()
        val source = from?.takeIf { policy.motion && it.isShown && it.width > 0 }
        if (source == null) {
            fade(e.root, show = true) {}
            return
        }
        ripple(source)
        e.prepareEnter()
        // The target is known once the profile screen has been laid out.
        onNextDraw(e.root) { if (editor === e) flyIn(e, source) }
    }

    private fun flyIn(e: ProfileEditor, source: AvatarView) {
        val from = boundsInRoot(source)
        val to = boundsInRoot(e.avatar)
        val press = boundsInRoot(source, untransformed = true)
        val fly = AvatarView(this).also { source.copyTo(it) }
        root.overlay.add(fly)
        fly.layout(from.left, from.top, from.right, from.bottom)
        flying = fly
        source.visibility = View.INVISIBLE
        val total = SPRING_BACK_MS + FLY_MS
        profileMotion = ValueAnimator.ofFloat(0f, total).apply {
            duration = total.toLong()
            interpolator = LinearInterpolator()
            addUpdateListener {
                val ms = it.animatedValue as Float
                if (ms < SPRING_BACK_MS) {
                    // Springs back from the press to its full size.
                    place(fly, from, press, spring(ms / SPRING_BACK_MS, 0.75f))
                } else {
                    val p = window(ms, SPRING_BACK_MS, FLY_MS)
                    place(fly, press, to, Ease.inOut.getInterpolation(p))
                    e.setBackdrop(Ease.cubicOut(window(p, 0f, 0.6f)))
                }
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    root.overlay.remove(fly)
                    if (flying === fly) flying = null
                    e.avatar.visibility = View.VISIBLE
                    source.visibility = View.VISIBLE
                    e.setBackdrop(1f)
                    e.revealControls()
                    profileMotion = null
                }
            })
            start()
        }
    }

    fun closeProfileEditor() {
        val e = editor ?: return
        editor = null
        currentFocus?.let { v ->
            (getSystemService(Context.INPUT_METHOD_SERVICE) as? android.view.inputmethod.InputMethodManager)
                ?.hideSoftInputFromWindow(v.windowToken, 0)
        }
        // An opening flight still under way finishes first.
        profileMotion?.end()
        val target = editorSource?.takeIf { policy.motion && it.isAttachedToWindow && it.isShown && it.width > 0 }
        editorSource = null
        current?.onShow(false)
        if (target == null) {
            fade(e.root, show = false) { root.removeView(e.root) }
            return
        }
        // The same path in reverse: the controls fade, then the avatar flies home while the
        // profile screen dissolves around it.
        e.hideControls()
        val from = boundsInRoot(e.avatar)
        val to = boundsInRoot(target)
        val fly = AvatarView(this).also {
            target.copyTo(it)
            // Starts as the frame being previewed and cross-fades to the saved one.
            it.setFrame(e.avatar.frame)
            it.setFrame(target.frame, animate = true)
        }
        root.overlay.add(fly)
        fly.layout(from.left, from.top, from.right, from.bottom)
        flying = fly
        e.avatar.visibility = View.INVISIBLE
        target.visibility = View.INVISIBLE
        profileMotion = ValueAnimator.ofFloat(0f, 1f).apply {
            startDelay = 60
            duration = FLY_BACK_MS.toLong()
            interpolator = LinearInterpolator()
            addUpdateListener {
                val p = it.animatedValue as Float
                place(fly, from, to, Ease.inOut.getInterpolation(p))
                e.setBackdrop(1f - Ease.cubicOut(window(p, 0.1f, 0.6f)))
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    root.removeView(e.root)
                    root.overlay.remove(fly)
                    if (flying === fly) flying = null
                    target.visibility = View.VISIBLE
                    profileMotion = null
                }
            })
            start()
        }
    }

    /** A thin gold ring spreading from the tapped avatar's border. */
    private fun ripple(avatar: AvatarView) {
        val b = boundsInRoot(avatar)
        val drawable = GoldRipple(b.exactCenterX(), b.exactCenterY(), b.width() / 2f, dpf(12), Ui.c.gold, dpf(1.5f))
        root.overlay.add(drawable)
        ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 420
            interpolator = LinearInterpolator()
            addUpdateListener { drawable.progress = it.animatedValue as Float }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) = root.overlay.remove(drawable)
            })
            start()
        }
    }

    /** Lays [view] out between two rectangles; always square, so the photo is never distorted. */
    private fun place(view: View, a: Rect, b: Rect, f: Float) {
        val size = lerp(a.width().toFloat(), b.width().toFloat(), f).roundToInt()
        val cx = lerp(a.exactCenterX(), b.exactCenterX(), f)
        val cy = lerp(a.exactCenterY(), b.exactCenterY(), f)
        val left = (cx - size / 2f).roundToInt()
        val top = (cy - size / 2f).roundToInt()
        view.layout(left, top, left + size, top + size)
    }

    /**
     * Where [view] is drawn, in the root's coordinates, including its own scale (a pressed
     * avatar is slightly smaller) unless [untransformed].
     */
    private fun boundsInRoot(view: View, untransformed: Boolean = false): Rect {
        val a = IntArray(2)
        val b = IntArray(2)
        root.getLocationInWindow(b)
        if (untransformed) {
            // Layout position: the centre is unaffected by a scale about the view's centre.
            view.getLocationInWindow(a)
            val cx = a[0] - b[0] + view.width * view.scaleX / 2f
            val cy = a[1] - b[1] + view.height * view.scaleY / 2f
            val half = view.width / 2f
            return Rect((cx - half).roundToInt(), (cy - half).roundToInt(), (cx + half).roundToInt(), (cy + half).roundToInt())
        }
        view.getLocationInWindow(a)
        val x = a[0] - b[0]
        val y = a[1] - b[1]
        return Rect(x, y, x + (view.width * view.scaleX).roundToInt(), y + (view.height * view.scaleY).roundToInt())
    }

    /** Runs [block] just before [view]'s next frame, once it has been laid out. */
    private fun onNextDraw(view: View, block: () -> Unit) {
        view.viewTreeObserver.addOnPreDrawListener(object : ViewTreeObserver.OnPreDrawListener {
            override fun onPreDraw(): Boolean {
                view.viewTreeObserver.removeOnPreDrawListener(this)
                block()
                return true
            }
        })
    }

    /** A plain fade (150 ms), used with reduced motion and when there's no avatar to fly. */
    private fun fade(view: View, show: Boolean, done: () -> Unit) {
        view.animate().cancel()
        view.alpha = if (show) 0f else view.alpha
        view.animate().alpha(if (show) 1f else 0f).setDuration(150).setStartDelay(0)
            .setInterpolator(if (show) Ease.out else Ease.exit).withEndAction(done).start()
    }

    /**
     * A small burst of confetti and sparks from the centre of [view] (for finishing something).
     * Skipped with reduced motion.
     */
    fun popAt(view: View, power: Float = 1f) {
        if (!policy.motion || !view.isAttachedToWindow) return
        val at = IntArray(2)
        val origin = IntArray(2)
        view.getLocationInWindow(at)
        confetti.getLocationInWindow(origin)
        confetti.burstAt(at[0] - origin[0] + view.width / 2f, at[1] - origin[1] + view.height / 2f, power)
    }

    // ------------------------------------------------------------------ profile photo & frame

    /**
     * Opens Android's photo picker (no storage permission needed). Falls back to the system
     * document picker on phones without it.
     */
    fun pickPhoto() {
        val picker = Build.VERSION.SDK_INT >= 33 ||
            (Build.VERSION.SDK_INT >= 30 && SdkExtensions.getExtensionVersion(Build.VERSION_CODES.R) >= 2)
        val intents = buildList {
            if (picker) add(Intent(MediaStore.ACTION_PICK_IMAGES).setType("image/*"))
            add(Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*"))
            add(Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*"))
        }
        for (intent in intents) {
            try {
                @Suppress("DEPRECATION")
                startActivityForResult(intent, REQUEST_PHOTO)
                return
            } catch (e: ActivityNotFoundException) {
                // Try the next picker.
            }
        }
        Toast.makeText(this, "No photo picker is available on this phone.", Toast.LENGTH_LONG).show()
    }

    @Deprecated("Framework activity result API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, result: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, result)
        if (requestCode != REQUEST_PHOTO) return
        val uri: Uri? = result?.data
        if (resultCode != RESULT_OK || uri == null) {
            editor?.onPickCancelled()
            return
        }
        handlePickedPhoto(uri)
    }

    /** Decodes off the main thread so large photos never freeze the screen. */
    fun handlePickedPhoto(uri: Uri) {
        val app = applicationContext
        Thread {
            val bitmap = Avatar.decodeForCrop(app, uri)
            handler.post { editor?.onPhotoPicked(bitmap) }
        }.start()
    }

    /** The saved profile photo at about [sizePx], cached per saved version. */
    fun avatarBitmap(sizePx: Int): Bitmap? {
        val version = store.avatarVersion
        if (version == 0L) return null
        val cached = avatarCache
        if (cached != null && cached.first == version) return cached.second
        val bitmap = Avatar.load(this, maxOf(sizePx, (dpf(150)).roundToInt()))
        avatarCache = version to bitmap
        return bitmap
    }

    fun onAvatarChanged() {
        avatarCache = null
        data = loadData()
        screens.forEach { it?.onDataChanged() }
        current?.onShow(false)
    }

    /** Saves the frame round the profile photo; Home and Settings show it straight away. */
    fun setAvatarFrame(frame: AvatarFrame) {
        store.avatarFrame = frame
        data = loadData()
        screens.forEach { it?.onDataChanged() }
    }

    /** Switches the frame animation on or off (off keeps the chosen border still). */
    fun setFrameAnimated(on: Boolean) {
        store.frameAnimated = on
        data = loadData()
        applyMotion()
    }

    // ------------------------------------------------------------------ ticking & motion

    private fun tick() {
        handler.removeCallbacks(ticker)
        val now = AppClock.now()
        season = SeasonCalculator.compute(data.exams, now, data.markedDone)
        if (setup == null) current?.tick(season)
        if (resumed) {
            val delay = if (setup != null) 1000L else current?.nextTickDelay(now) ?: 1000L
            handler.postDelayed(ticker, delay.coerceIn(16L, 60_000L))
        }
    }

    /** Runs a tick now, e.g. right after the timer was started. */
    fun requestTick() = tick()

    fun applyMotion() {
        policy = MotionPolicy.resolve(this, data.motion)
        nav.animateChanges = policy.motion
        if (resumed && policy.ambient) ambient.start() else ambient.stop()
        screens.forEach { it?.onMotionChanged() }
        editor?.refreshFrameMotion()
    }

    /**
     * Confetti after the final exam has actually finished. Plays once per launch unless
     * [force]d (the "Celebrate again" button); skipped with reduced motion.
     */
    fun celebrate(force: Boolean) {
        if (!force && celebrated) return
        celebrated = true
        if (!policy.motion) return
        Haptics.confirm(confetti)
        confetti.burst()
    }

    // ------------------------------------------------------------------ data changes

    private fun loadData() = AppData(
        profile = store.profile,
        choices = store.choices,
        exams = store.exams,
        markedDone = store.markedDone,
        reminders = store.reminders,
        motion = store.motion,
        avatarFrame = store.avatarFrame,
        frameAnimated = store.frameAnimated,
    )

    private fun changed() {
        data = loadData()
        screens.forEach { it?.onDataChanged() }
        ReminderScheduler.reschedule(this)
        tick()
    }

    fun updateProfile(profile: Profile) {
        store.profile = profile
        changed()
    }

    fun updateChoices(choices: Choices) {
        store.choices = choices
        changed()
    }

    fun updateExams(exams: List<Exam>) {
        store.exams = exams
        changed()
    }

    fun markFinished(exam: Exam) {
        store.markedDone = store.markedDone + exam.key
        changed()
    }

    fun updateReminderSettings(change: (ReminderSettings) -> ReminderSettings) {
        store.reminders = change(store.reminders)
        changed()
    }

    fun setMotion(pref: MotionPref) {
        store.motion = pref
        data = loadData()
        applyMotion()
        updateLaunchWindow()
    }

    fun setHaptics(on: Boolean) {
        store.haptics = on
        Haptics.enabled = on
    }

    /** Switches light/dark. On Android 12+ the system also uses it for the launch window. */
    fun setTheme(mode: ThemeMode) {
        if (mode == store.theme) return
        store.theme = mode
        if (Build.VERSION.SDK_INT >= 31) {
            getSystemService(UiModeManager::class.java)?.setApplicationNightMode(
                when (mode) {
                    ThemeMode.SYSTEM -> UiModeManager.MODE_NIGHT_AUTO
                    ThemeMode.LIGHT -> UiModeManager.MODE_NIGHT_NO
                    ThemeMode.DARK -> UiModeManager.MODE_NIGHT_YES
                },
            )
        }
        recreate()
    }

    fun rescheduleAlarms() = ReminderScheduler.reschedule(this)

    /** Switches exam reminders on (asking for notification permission first) or off. */
    fun setExamReminders(on: Boolean, done: () -> Unit) {
        if (!on) {
            updateReminderSettings { it.copy(enabled = false) }
            done()
            return
        }
        requestNotifications { granted ->
            if (granted) {
                // Anything that was due before this moment is skipped, not delivered late.
                updateReminderSettings { it.copy(enabled = true, armedAt = AppClock.now()) }
            }
            done()
        }
    }

    fun setFocusAlerts(on: Boolean, done: () -> Unit) {
        if (!on) {
            updateReminderSettings { it.copy(focusAlerts = false) }
            done()
            return
        }
        requestNotifications { granted ->
            if (granted) updateReminderSettings { it.copy(focusAlerts = true) }
            done()
        }
    }

    /** Asks for POST_NOTIFICATIONS only on Android 13+, and only when a reminder is switched on. */
    private fun requestNotifications(callback: (Boolean) -> Unit) {
        if (Build.VERSION.SDK_INT < 33 ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        ) {
            callback(Notifier.canPost(this))
            return
        }
        pendingPermission = callback
        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_NOTIFICATIONS) return
        val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED && Notifier.canPost(this)
        pendingPermission?.invoke(granted)
        pendingPermission = null
    }

    fun openNotificationSettings() {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        try {
            startActivity(intent)
        } catch (e: RuntimeException) {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        }
    }

    fun resetAllData() {
        Avatar.remove(this)
        store.resetAll()
        ReminderScheduler.reschedule(this)
        recreate()
    }

    fun versionName(): String = try {
        @Suppress("DEPRECATION")
        packageManager.getPackageInfo(packageName, 0).versionName ?: "1.3.0"
    } catch (e: PackageManager.NameNotFoundException) {
        "1.3.0"
    }
}

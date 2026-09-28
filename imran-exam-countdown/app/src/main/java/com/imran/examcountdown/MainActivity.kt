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
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Toast
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
import com.imran.examcountdown.ui.Blur
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Haptics
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.MotionPolicy
import com.imran.examcountdown.ui.Spring
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.flp
import com.imran.examcountdown.ui.spring
import com.imran.examcountdown.ui.window
import com.imran.examcountdown.ui.screens.HomeScreen
import com.imran.examcountdown.ui.screens.ProfileEditor
import com.imran.examcountdown.ui.screens.Screen
import com.imran.examcountdown.ui.screens.SettingsScreen
import com.imran.examcountdown.ui.screens.SetupScreen
import com.imran.examcountdown.ui.screens.StudyScreen
import com.imran.examcountdown.ui.screens.TimetableScreen
import com.imran.examcountdown.ui.widgets.ConfettiView
import com.imran.examcountdown.ui.widgets.IntroView
import com.imran.examcountdown.ui.widgets.NavBar

/** Everything the screens read, loaded from [Store]. */
data class AppData(
    val profile: Profile,
    val choices: Choices,
    val exams: List<Exam>,
    val markedDone: Set<String>,
    val reminders: ReminderSettings,
    val motion: MotionPref,
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
        private const val TRANSITION_MS = 540f
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
        if (Build.VERSION.SDK_INT >= 31) {
            // The launch window is plain background colour, identical to the intro's first
            // frame, so remove it at once: no second splash and no blank flash.
            splashScreen.setOnExitAnimationListener { it.remove() }
        }

        // The full opening plays only on a cold launch (fresh process), never on rotation or
        // when returning to the app, and not with reduced motion or when switched off.
        val coldLaunch = !ExamCountdownApp.introHandled
        ExamCountdownApp.introHandled = true
        val playIntro = savedInstanceState == null && coldLaunch && store.introEnabled && policy.motion

        val tab = savedInstanceState?.getInt(STATE_TAB, TAB_HOME) ?: intent.getIntExtra(EXTRA_TAB, TAB_HOME)
        if (store.setupDone) showTab(tab, animate = false) else showSetup()
        if (playIntro) playIntro()
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
        // Decorative animation stops while the app is in the background.
        ambient.stop()
        if (powerReceiverRegistered) {
            unregisterReceiver(powerReceiver)
            powerReceiverRegistered = false
        }
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
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            val light = if (Ui.c.dark) 0 else WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.decorView.windowInsetsController?.setSystemBarsAppearance(
                light,
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
            )
        } else {
            var flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            if (!Ui.c.dark) {
                flags = flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                if (Build.VERSION.SDK_INT >= 27) flags = flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            }
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = flags
        }
        @Suppress("DEPRECATION")
        window.statusBarColor = Color.TRANSPARENT
        // Android 8.0 can't draw dark navigation buttons, so give them a scrim on light backgrounds.
        @Suppress("DEPRECATION")
        window.navigationBarColor = if (Build.VERSION.SDK_INT < 27 && !Ui.c.dark) 0x66000000 else Color.TRANSPARENT
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

    // ------------------------------------------------------------------ intro

    private fun playIntro() {
        val view = IntroView(this)
        intro = view
        introRunning = true
        // Settle into setup's emblem on first run, otherwise into Home's header emblem.
        val target: () -> View? = { setup?.emblem ?: (screens[TAB_HOME] as? HomeScreen)?.emblem?.takeIf { currentTab == TAB_HOME } }
        target()?.visibility = View.INVISIBLE
        view.target = target
        view.onReveal = {
            // Hand over: Home (or setup) staggers in underneath the dissolving intro.
            (screens[TAB_HOME] as? HomeScreen)?.takeIf { currentTab == TAB_HOME && setup == null }?.playEntrance()
        }
        view.onFinished = {
            intro = null
            introRunning = false
            current?.onShow(false)
            tick()
        }
        root.addView(view, flp(MATCH, MATCH))
        view.post { view.play() }
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
     * Tab change, along the direction of travel: the old tab recedes (it slips back, shrinks a
     * touch and blurs as it fades) while the new one glides in from the side you're heading to.
     */
    private fun slide(outgoing: View, incoming: View, direction: Float) {
        val shift = dpf(44)
        incoming.alpha = 0f
        incoming.translationX = direction * shift
        transition = ValueAnimator.ofFloat(0f, TRANSITION_MS).apply {
            duration = TRANSITION_MS.toLong()
            interpolator = LinearInterpolator()
            addUpdateListener {
                val ms = it.animatedValue as Float
                val o = window(ms, 0f, 200f)
                outgoing.alpha = 1f - Ease.cubicOut(o)
                outgoing.translationX = -direction * shift * 0.45f * Ease.cubicIn(o)
                val shrink = 1f - 0.035f * Ease.cubicOut(o)
                outgoing.scaleX = shrink
                outgoing.scaleY = shrink
                Blur.set(outgoing, dpf(10) * o)
                val s = spring(window(ms, 50f, TRANSITION_MS - 50f), 0.82f)
                incoming.alpha = Ease.cubicOut(window(ms, 50f, 230f))
                incoming.translationX = direction * shift * (1f - s)
                val grow = 0.975f + 0.025f * s
                incoming.scaleX = grow
                incoming.scaleY = grow
                Blur.set(incoming, dpf(8) * (1f - window(ms, 50f, 220f)))
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
        Blur.set(view, 0f)
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
            // Setup zooms past the viewer and dissolves as Home rises in behind it.
            view.animate().alpha(0f).scaleX(1.06f).scaleY(1.06f).setDuration(320).setInterpolator(Ease.exit)
                .withEndAction { root.removeView(view) }.start()
            (screens[TAB_HOME] as? HomeScreen)?.playEntrance()
        } else {
            root.removeView(view)
        }
    }

    fun openProfileEditor() {
        if (editor != null) return
        val e = ProfileEditor(this)
        editor = e
        root.addView(e.root, root.indexOfChild(confetti), flp(MATCH, MATCH))
        e.applyInsets(insetTop, insetBottom)
        root.requestApplyInsets()
        if (policy.motion) {
            // Rises like a sheet and settles with a soft spring.
            val view = e.root
            view.alpha = 0f
            view.translationY = dp(56).toFloat()
            view.animate().translationY(0f).setDuration(560).setInterpolator(Spring.gentle).start()
            ValueAnimator.ofFloat(0f, 1f).apply {
                duration = 200
                addUpdateListener { view.alpha = it.animatedValue as Float }
                start()
            }
        }
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

    fun closeProfileEditor() {
        val e = editor ?: return
        editor = null
        currentFocus?.let { v ->
            (getSystemService(Context.INPUT_METHOD_SERVICE) as? android.view.inputmethod.InputMethodManager)
                ?.hideSoftInputFromWindow(v.windowToken, 0)
        }
        val view = e.root
        if (policy.motion) {
            view.animate().alpha(0f).translationY(dp(40).toFloat()).setDuration(220).setInterpolator(Ease.exit)
                .withEndAction { root.removeView(view) }.start()
        } else {
            root.removeView(view)
        }
        current?.onShow(false)
    }

    // ------------------------------------------------------------------ profile photo

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
        val bitmap = Avatar.load(this, maxOf(sizePx, dp(132)))
        avatarCache = version to bitmap
        return bitmap
    }

    fun onAvatarChanged() {
        avatarCache = null
        data = loadData()
        screens.forEach { it?.onDataChanged() }
        current?.onShow(false)
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
        packageManager.getPackageInfo(packageName, 0).versionName ?: "1.2.0"
    } catch (e: PackageManager.NameNotFoundException) {
        "1.2.0"
    }
}

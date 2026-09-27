package com.imran.examcountdown

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.widget.FrameLayout
import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.Exam
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.core.Profile
import com.imran.examcountdown.core.ReminderSettings
import com.imran.examcountdown.core.Season
import com.imran.examcountdown.core.SeasonCalculator
import com.imran.examcountdown.core.Subject
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.notify.AppVisibility
import com.imran.examcountdown.notify.Notifier
import com.imran.examcountdown.notify.ReminderScheduler
import com.imran.examcountdown.ui.AmbientTicker
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.MotionPolicy
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.flp
import com.imran.examcountdown.ui.screens.HomeScreen
import com.imran.examcountdown.ui.screens.Screen
import com.imran.examcountdown.ui.screens.SettingsScreen
import com.imran.examcountdown.ui.screens.SetupScreen
import com.imran.examcountdown.ui.screens.StudyScreen
import com.imran.examcountdown.ui.screens.TimetableScreen
import com.imran.examcountdown.ui.widgets.ConfettiView
import com.imran.examcountdown.ui.widgets.NavBar
import com.imran.examcountdown.ui.widgets.ParticleFieldView

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

    private lateinit var root: FrameLayout
    private lateinit var particles: ParticleFieldView
    private lateinit var content: FrameLayout
    private lateinit var nav: NavBar
    private lateinit var confetti: ConfettiView
    private val screens = arrayOfNulls<Screen>(4)
    private val shownBefore = BooleanArray(4)
    private var currentTab = -1
    private var setup: SetupScreen? = null
    private var insetTop = 0
    private var insetBottom = 0
    private var resumed = false
    private var pendingPermission: ((Boolean) -> Unit)? = null
    private val handler = Handler(Looper.getMainLooper())
    private val ticker = Runnable { tick() }
    private var powerReceiverRegistered = false
    private val powerReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) = applyMotion()
    }

    private val current: Screen? get() = if (currentTab >= 0) screens[currentTab] else null

    // ------------------------------------------------------------------ lifecycle

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Fonts.init(this)
        store = Store(this)
        data = loadData()
        season = SeasonCalculator.compute(data.exams, AppClock.now(), data.markedDone)
        policy = MotionPolicy.resolve(this, data.motion)
        setupWindow()
        buildViews()
        if (Build.VERSION.SDK_INT >= 31) setupSplashExit()
        val tab = savedInstanceState?.getInt(STATE_TAB, TAB_HOME) ?: intent.getIntExtra(EXTRA_TAB, TAB_HOME)
        if (store.setupDone) showTab(tab, animate = false) else showSetup()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (setup == null && intent.hasExtra(EXTRA_TAB)) showTab(intent.getIntExtra(EXTRA_TAB, TAB_HOME), animate = true)
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        AppVisibility.resumed = true
        // The app may have been in the background for hours: reload and recompute everything
        // from the current time rather than from anything cached.
        data = loadData()
        screens.forEach { it?.onDataChanged() }
        current?.onShow(false)
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
        ambient.stop()
        particles.animating = false
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
        // Draw edge to edge; screens pad themselves using the system bar insets.
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
        @Suppress("DEPRECATION")
        window.statusBarColor = Color.TRANSPARENT
        @Suppress("DEPRECATION")
        window.navigationBarColor = Color.TRANSPARENT
    }

    private fun buildViews() {
        root = FrameLayout(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(Palette.BG_TOP, Palette.BG_MID, Palette.BG_BOTTOM),
            )
        }
        particles = ParticleFieldView(this)
        content = FrameLayout(this)
        nav = NavBar(
            this,
            listOf("Home", "Timetable", "Study", "Settings"),
            listOf(R.drawable.ic_home, R.drawable.ic_timeline, R.drawable.ic_study, R.drawable.ic_settings),
        ) { showTab(it, animate = true) }
        confetti = ConfettiView(this)
        root.addView(particles, flp(MATCH, MATCH))
        root.addView(content, flp(MATCH, MATCH))
        root.addView(nav, flp(MATCH, dp(68), Gravity.BOTTOM).apply {
            leftMargin = dp(16)
            rightMargin = dp(16)
            bottomMargin = dp(12)
        })
        root.addView(confetti, flp(MATCH, MATCH))
        ambient.add(particles)
        root.setOnApplyWindowInsetsListener { _, insets ->
            val top: Int
            val bottom: Int
            val left: Int
            val right: Int
            if (Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                top = bars.top
                bottom = bars.bottom
                left = bars.left
                right = bars.right
            } else {
                @Suppress("DEPRECATION")
                top = insets.systemWindowInsetTop
                @Suppress("DEPRECATION")
                bottom = insets.systemWindowInsetBottom
                @Suppress("DEPRECATION")
                left = insets.systemWindowInsetLeft
                @Suppress("DEPRECATION")
                right = insets.systemWindowInsetRight
            }
            insetTop = top
            insetBottom = bottom
            content.setPadding(left, 0, right, 0)
            (nav.layoutParams as FrameLayout.LayoutParams).apply {
                leftMargin = dp(16) + left
                rightMargin = dp(16) + right
                bottomMargin = dp(12) + bottom
            }
            nav.requestLayout()
            screens.forEach { it?.applyInsets(top, bottom) }
            setup?.applyInsets(top, bottom)
            insets
        }
        setContentView(root)
    }

    private fun setupSplashExit() {
        splashScreen.setOnExitAnimationListener { view ->
            if (!policy.motion) {
                view.remove()
                return@setOnExitAnimationListener
            }
            view.iconView?.animate()?.scaleX(1.12f)?.scaleY(1.12f)?.setDuration(300)?.start()
            view.animate().alpha(0f).setStartDelay(60).setDuration(320).withEndAction { view.remove() }.start()
        }
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
        previous?.root?.visibility = View.GONE
        currentTab = index
        screen.root.visibility = View.VISIBLE
        if (animate && policy.motion) {
            screen.root.alpha = 0f
            screen.root.translationY = dp(14).toFloat()
            screen.root.animate().alpha(1f).translationY(0f).setDuration(240).start()
        } else {
            screen.root.alpha = 1f
            screen.root.translationY = 0f
        }
        nav.visibility = View.VISIBLE
        nav.select(index, animate)
        val first = !shownBefore[index]
        shownBefore[index] = true
        screen.onShow(first)
        applyMotion()
        tick()
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
        nav.visibility = View.GONE
        root.addView(s.root, root.indexOfChild(confetti), flp(MATCH, MATCH))
        s.applyInsets(insetTop, insetBottom)
        root.requestApplyInsets()
    }

    fun finishSetup() {
        store.setupDone = true
        val s = setup ?: return
        setup = null
        val view = s.root
        if (policy.motion) {
            view.animate().alpha(0f).setDuration(260).withEndAction { root.removeView(view) }.start()
        } else {
            root.removeView(view)
        }
        showTab(TAB_HOME, animate = true)
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
        particles.animating = resumed && policy.ambient && (setup != null || currentTab == TAB_HOME)
        if (resumed && policy.ambient) ambient.start() else ambient.stop()
        screens.forEach { it?.onMotionChanged() }
    }

    fun celebrate() {
        if (policy.motion) confetti.burst()
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
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:$packageName")))
        }
    }

    fun resetAllData() {
        store.resetAll()
        ReminderScheduler.reschedule(this)
        recreate()
    }

    fun versionName(): String = try {
        @Suppress("DEPRECATION")
        packageManager.getPackageInfo(packageName, 0).versionName ?: "1.0"
    } catch (e: PackageManager.NameNotFoundException) {
        "1.0"
    }
}

package com.runova.app.ui

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.graphics.Color
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavController
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.runova.app.R
import com.runova.app.graph
import com.runova.app.share.Images
import com.runova.app.state.UiMapper
import com.runova.app.ui.components.LocalBackHandler
import com.runova.app.ui.components.LocalTileProvider
import com.runova.app.ui.components.MainTab
import com.runova.app.ui.components.RunovaDialog
import com.runova.app.ui.model.MapStyle
import com.runova.app.ui.model.ThemeMode
import com.runova.app.ui.screens.AboutScreen
import com.runova.app.ui.screens.AchievementsActions
import com.runova.app.ui.screens.AchievementsScreen
import com.runova.app.ui.screens.CoachActions
import com.runova.app.ui.screens.CoachScreen
import com.runova.app.ui.screens.GoalsActions
import com.runova.app.ui.screens.GoalsScreen
import com.runova.app.ui.screens.HeartRateActions
import com.runova.app.ui.screens.HeartRateScreen
import com.runova.app.ui.screens.HistoryActions
import com.runova.app.ui.screens.HistoryScreen
import com.runova.app.ui.screens.HomeActions
import com.runova.app.ui.screens.HomeScreen
import com.runova.app.ui.screens.LocationPermissionSheet
import com.runova.app.ui.screens.NotificationsActions
import com.runova.app.ui.screens.NotificationsScreen
import com.runova.app.ui.screens.OnboardingScreen
import com.runova.app.ui.screens.PermissionSummary
import com.runova.app.ui.screens.PersonalInfoActions
import com.runova.app.ui.screens.PersonalInfoScreen
import com.runova.app.ui.screens.ProfileActions
import com.runova.app.ui.screens.ProfileScreen
import com.runova.app.ui.screens.RecoveryDialog
import com.runova.app.ui.screens.RunCompleteActions
import com.runova.app.ui.screens.RunCompleteScreen
import com.runova.app.ui.screens.RunDetailsActions
import com.runova.app.ui.screens.RunDetailsScreen
import com.runova.app.ui.screens.RunningActions
import com.runova.app.ui.screens.RunningScreen
import com.runova.app.ui.screens.SettingsActions
import com.runova.app.ui.screens.SettingsScreen
import com.runova.app.ui.screens.SplashScreen
import com.runova.app.ui.screens.StatsActions
import com.runova.app.ui.screens.StatsScreen
import com.runova.app.ui.screens.ThemePickerSheet
import com.runova.app.ui.theme.Runova
import com.runova.app.ui.theme.RunovaFonts
import com.runova.app.ui.theme.RunovaTheme
import kotlinx.coroutines.launch
import java.io.File

object Routes {
    const val SPLASH = "splash"
    const val ONBOARDING = "onboarding"
    const val HOME = "home"
    const val HISTORY = "history"
    const val STATS = "stats"
    const val GOALS = "goals"
    const val PROFILE = "profile"
    const val RUNNING = "running"
    const val COMPLETE = "complete"
    const val DETAILS = "details/{runId}"
    const val ACHIEVEMENTS = "achievements"
    const val COACH = "coach"
    const val SETTINGS = "settings"
    const val PERSONAL = "personal"
    const val HEART = "heart"
    const val ABOUT = "about"
    const val NOTIFICATIONS = "notifications"

    fun details(runId: Long) = "details/$runId"

    fun tab(tab: MainTab): String = when (tab) {
        MainTab.HOME -> HOME
        MainTab.ACTIVITY -> HISTORY
        MainTab.STATS -> STATS
        MainTab.GOALS -> GOALS
        MainTab.PROFILE -> PROFILE
    }

    val tabs = setOf(HOME, HISTORY, STATS, GOALS, PROFILE)
}

private fun NavController.goTab(tab: MainTab) {
    navigate(Routes.tab(tab)) {
        popUpTo(Routes.HOME) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

private fun NavController.goHome() {
    navigate(Routes.HOME) {
        popUpTo(Routes.HOME) { inclusive = false }
        launchSingleTop = true
    }
}

private fun Context.findActivity(): Activity? {
    var c: Context? = this
    while (c is ContextWrapper) {
        if (c is Activity) return c
        c = c.baseContext
    }
    return null
}

private fun appFonts() = RunovaFonts(
    text = FontFamily(
        Font(R.font.barlow_regular, FontWeight.Normal),
        Font(R.font.barlow_medium, FontWeight.Medium),
        Font(R.font.barlow_semibold, FontWeight.SemiBold),
        Font(R.font.barlow_bold, FontWeight.Bold),
        Font(R.font.barlow_extrabold, FontWeight.ExtraBold),
    ),
    numbers = FontFamily(
        Font(R.font.barlow_semicondensed_medium, FontWeight.Medium),
        Font(R.font.barlow_semicondensed_semibold, FontWeight.SemiBold),
        Font(R.font.barlow_semicondensed_bold, FontWeight.Bold),
    ),
    condensed = FontFamily(
        Font(R.font.barlow_condensed_semibold, FontWeight.SemiBold),
        Font(R.font.barlow_condensed_bold, FontWeight.Bold),
    ),
)

/** Permission checks and the system screens the app sends people to. */
object Perms {
    private fun granted(context: Context, p: String) = ContextCompat.checkSelfPermission(context, p) == android.content.pm.PackageManager.PERMISSION_GRANTED

    fun location(context: Context) = granted(context, Manifest.permission.ACCESS_FINE_LOCATION)
    fun activity(context: Context) = Build.VERSION.SDK_INT < 29 || granted(context, Manifest.permission.ACTIVITY_RECOGNITION)
    fun notifications(context: Context) = Build.VERSION.SDK_INT < 33 || granted(context, Manifest.permission.POST_NOTIFICATIONS)
    fun summary(context: Context) = PermissionSummary(location(context), activity(context), notifications(context))

    val onboarding: Array<String>
        get() = buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 29) add(Manifest.permission.ACTIVITY_RECOGNITION)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        }.toTypedArray()

    val locationOnly = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)

    fun gpsEnabled(context: Context) = context.getSystemService(LocationManager::class.java)?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true

    fun appSettings(context: Context) = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))

    fun locationSettings() = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
}

@Composable
private fun KeepScreenOn(on: Boolean) {
    val view = LocalView.current
    DisposableEffect(on) {
        view.keepScreenOn = on
        onDispose { view.keepScreenOn = false }
    }
}

@Composable
private fun Loading() {
    Box(Modifier.fillMaxSize().background(Runova.colors.background), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Runova.colors.lime, modifier = Modifier.size(40.dp))
    }
}

private val backHandler: @Composable (Boolean, () -> Unit) -> Unit = { enabled, onBack -> BackHandler(enabled, onBack) }

private fun isTab(entry: NavBackStackEntry) = entry.destination.route in Routes.tabs

private val enter: AnimatedContentTransitionScope<NavBackStackEntry>.() -> EnterTransition = {
    if (isTab(initialState) && isTab(targetState)) fadeIn(tween(220))
    else fadeIn(tween(260)) + slideInHorizontally(tween(320)) { it / 8 }
}
private val exit: AnimatedContentTransitionScope<NavBackStackEntry>.() -> ExitTransition = { fadeOut(tween(200)) }
private val popEnter: AnimatedContentTransitionScope<NavBackStackEntry>.() -> EnterTransition = {
    if (isTab(initialState) && isTab(targetState)) fadeIn(tween(220)) else fadeIn(tween(260)) + slideInHorizontally(tween(320)) { -it / 10 }
}
private val popExit: AnimatedContentTransitionScope<NavBackStackEntry>.() -> ExitTransition = {
    if (isTab(initialState) && isTab(targetState)) fadeOut(tween(180)) else fadeOut(tween(220)) + slideOutHorizontally(tween(300)) { it / 8 }
}

@Composable
fun RunovaRoot(pendingRoute: MutableState<String?>) {
    val context = LocalContext.current
    val activity = context.findActivity() as? ComponentActivity
    val graph = context.graph
    val main: MainViewModel = viewModel()
    val run: RunViewModel = viewModel()
    val coachVm: CoachViewModel = viewModel()
    val data by main.data.collectAsStateWithLifecycle()
    val loaded by main.loaded.collectAsStateWithLifecycle()

    val systemDark = isSystemInDarkTheme()
    val dark = when (data.settings.theme) {
        ThemeMode.DARK -> true
        ThemeMode.LIGHT -> false
        ThemeMode.SYSTEM -> systemDark
    }
    LaunchedEffect(dark) {
        val style = if (dark) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        activity?.enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    }
    val tiles = when (data.settings.mapStyle) {
        MapStyle.AUTO -> if (dark) graph.darkTiles else graph.lightTiles
        MapStyle.DARK -> graph.darkTiles
        MapStyle.LIGHT -> graph.lightTiles
    }
    val fonts = remember { appFonts() }

    RunovaTheme(dark = dark, fonts = fonts) {
        CompositionLocalProvider(LocalTileProvider provides tiles, LocalBackHandler provides backHandler) {
            AppContent(pendingRoute, main, run, coachVm, loaded)
        }
    }
}

@Composable
private fun AppContent(pendingRoute: MutableState<String?>, main: MainViewModel, run: RunViewModel, coachVm: CoachViewModel, loaded: Boolean) {
    val context = LocalContext.current
    val activity = context.findActivity()
    val scope = rememberCoroutineScope()
    val nav = rememberNavController()
    val data by main.data.collectAsStateWithLifecycle()
    val recovery by run.recovery.collectAsStateWithLifecycle()
    val saving by run.saving.collectAsStateWithLifecycle()
    val backStack by nav.currentBackStackEntryAsState()

    var permissions by remember { mutableStateOf(Perms.summary(context)) }
    var showLocationSheet by remember { mutableStateOf(false) }
    var locationBlocked by remember { mutableStateOf(false) }
    var showGpsOff by remember { mutableStateOf(false) }
    var showThemePicker by remember { mutableStateOf(false) }
    var photoPath by rememberSaveable { mutableStateOf<String?>(null) }

    fun toast(text: String) = Toast.makeText(context, text, Toast.LENGTH_SHORT).show()

    fun open(intent: Intent?) {
        if (intent == null) return
        try {
            context.startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            toast("No app on this device can open that")
        }
    }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        permissions = Perms.summary(context)
        main.refreshHeartRate()
    }

    fun startRun() {
        when {
            run.isRecording() -> nav.navigate(Routes.RUNNING) { launchSingleTop = true }
            recovery != null -> Unit // the recovery dialog is showing
            !Perms.location(context) -> {
                locationBlocked = false
                showLocationSheet = true
            }
            !Perms.gpsEnabled(context) -> showGpsOff = true
            else -> {
                run.start()
                nav.navigate(Routes.RUNNING) { launchSingleTop = true }
            }
        }
    }

    val locationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        permissions = Perms.summary(context)
        if (Perms.location(context)) {
            showLocationSheet = false
            startRun()
        } else {
            // No rationale after a denial means "don't ask again": only Settings can grant it now.
            locationBlocked = activity != null && !ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.ACCESS_FINE_LOCATION)
            showLocationSheet = true
        }
    }
    val onboardingLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        permissions = Perms.summary(context)
        // Start counting daily steps right away if activity recognition was just granted.
        scope.launch { context.graph.steps.sample() }
    }
    val bluetoothLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { main.refreshHeartRate() }
    val enableBluetooth = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { main.refreshHeartRate() }
    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> if (uri != null) main.setAvatar(uri) }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        photoPath?.let { run.photoTaken(File(it), ok) }
        photoPath = null
    }

    fun takePhoto() {
        val file = run.newPhotoFile()
        photoPath = file.path
        try {
            camera.launch(Images.photoUri(context, file))
        } catch (e: ActivityNotFoundException) {
            photoPath = null
            file.delete()
            toast("No camera app found")
        }
    }

    fun pickAvatar() = avatarPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))

    // Deep links from notifications ("running", "notifications").
    val pending by pendingRoute
    LaunchedEffect(pending, loaded, data.settings.onboarded, backStack) {
        val route = pending ?: return@LaunchedEffect
        if (!loaded || !data.settings.onboarded || backStack == null) return@LaunchedEffect
        if (nav.currentDestination?.route == Routes.SPLASH) nav.navigate(Routes.HOME) { popUpTo(Routes.SPLASH) { inclusive = true } }
        when (route) {
            Routes.RUNNING -> if (run.isRecording()) nav.navigate(Routes.RUNNING) { launchSingleTop = true }
            Routes.NOTIFICATIONS -> nav.navigate(Routes.NOTIFICATIONS) { launchSingleTop = true }
        }
        pendingRoute.value = null
    }

    Box(Modifier.fillMaxSize().background(Runova.colors.background)) {
        NavHost(
            navController = nav,
            startDestination = Routes.SPLASH,
            enterTransition = enter,
            exitTransition = exit,
            popEnterTransition = popEnter,
            popExitTransition = popExit,
        ) {
            splashAndOnboarding(nav, main, loaded, data.settings.onboarded, permissions, pending != null) { onboardingLauncher.launch(Perms.onboarding) }

            composable(Routes.HOME) {
                val s by main.home.collectAsStateWithLifecycle()
                val state = s ?: return@composable Loading()
                HomeScreen(
                    state,
                    HomeActions(
                        onSelectDay = main::selectDay,
                        onStartRun = ::startRun,
                        onOpenActiveRun = { nav.navigate(Routes.RUNNING) { launchSingleTop = true } },
                        onOpenNotifications = { nav.navigate(Routes.NOTIFICATIONS) },
                        onOpenCoach = { nav.navigate(Routes.COACH) },
                        onTab = nav::goTab,
                    ),
                )
            }

            composable(Routes.HISTORY) {
                val s by main.history.collectAsStateWithLifecycle()
                val state = s ?: return@composable Loading()
                HistoryScreen(
                    state,
                    HistoryActions(
                        onBack = { nav.goHome() },
                        onOpen = { nav.navigate(Routes.details(it)) },
                        onSort = main::setHistorySort,
                        onFilter = main::setHistoryFilter,
                        onStartRun = ::startRun,
                        onTab = nav::goTab,
                    ),
                )
            }

            composable(Routes.STATS) {
                val s by main.stats.collectAsStateWithLifecycle()
                val state = s ?: return@composable Loading()
                StatsScreen(
                    state,
                    StatsActions(
                        onBack = { nav.goHome() },
                        onRange = main::setStatsRange,
                        onMetric = main::setStatsMetric,
                        onShift = main::shiftStats,
                        onTab = nav::goTab,
                    ),
                )
            }

            composable(Routes.GOALS) {
                val s by main.goals.collectAsStateWithLifecycle()
                val state = s ?: return@composable Loading()
                GoalsScreen(
                    state,
                    GoalsActions(
                        onBack = { nav.goHome() },
                        onPeriod = main::setGoalsPeriod,
                        onSaveTargets = main::saveTargets,
                        onTab = nav::goTab,
                    ),
                )
            }

            composable(Routes.PROFILE) {
                val s by main.profile.collectAsStateWithLifecycle()
                val state = s ?: return@composable Loading()
                ProfileScreen(
                    state,
                    ProfileActions(
                        onSettings = { nav.navigate(Routes.SETTINGS) },
                        onEditAvatar = ::pickAvatar,
                        onPersonalInfo = { nav.navigate(Routes.PERSONAL) },
                        onAchievements = {
                            main.prepareAchievements(celebrateNew = false)
                            nav.navigate(Routes.ACHIEVEMENTS)
                        },
                        onHeartRate = { nav.navigate(Routes.HEART) },
                        onNotifications = { nav.navigate(Routes.NOTIFICATIONS) },
                        onTheme = { showThemePicker = true },
                        onAbout = { nav.navigate(Routes.ABOUT) },
                        onTab = nav::goTab,
                    ),
                )
                ThemePickerSheet(
                    visible = showThemePicker,
                    current = data.settings.theme,
                    onPick = {
                        main.setTheme(it)
                        showThemePicker = false
                    },
                    onDismiss = { showThemePicker = false },
                )
            }

            composable(Routes.RUNNING) {
                val s by run.running.collectAsStateWithLifecycle()
                val state = s
                KeepScreenOn(state?.keepScreenOn == true)
                if (state == null) {
                    Loading()
                    // The run ended elsewhere (e.g. discarded); saving navigates on its own. The
                    // session is checked directly because the UI state can lag one frame behind.
                    LaunchedEffect(saving) {
                        if (!saving && !run.isRecording() && nav.currentDestination?.route == Routes.RUNNING) nav.popBackStack()
                    }
                    return@composable
                }
                RunningScreen(
                    state,
                    RunningActions(
                        onMinimize = { if (!nav.popBackStack()) nav.goHome() },
                        onPause = run::pause,
                        onResume = run::resume,
                        onFinish = {
                            run.finish {
                                nav.navigate(Routes.COMPLETE) { popUpTo(Routes.RUNNING) { inclusive = true } }
                            }
                        },
                        onDiscard = {
                            run.discard()
                            if (!nav.popBackStack()) nav.goHome()
                        },
                        onCamera = ::takePhoto,
                        onVoiceChange = run::setVoice,
                        onAutoPauseChange = run::setAutoPause,
                        onKeepScreenOnChange = run::setKeepScreenOn,
                    ),
                )
            }

            composable(Routes.COMPLETE) {
                val s by run.completion.collectAsStateWithLifecycle()
                val state = s ?: return@composable Loading()
                RunCompleteScreen(
                    state,
                    RunCompleteActions(
                        onViewDetails = { nav.navigate(Routes.details(state.runId)) { popUpTo(Routes.COMPLETE) { inclusive = true } } },
                        onDone = { nav.goHome() },
                        onOpenAchievements = {
                            main.prepareAchievements(celebrateNew = true)
                            nav.navigate(Routes.ACHIEVEMENTS)
                        },
                    ),
                )
            }

            composable(Routes.DETAILS, arguments = listOf(navArgument("runId") { type = NavType.LongType })) { entry ->
                val id = entry.arguments?.getLong("runId") ?: return@composable
                LaunchedEffect(id) {
                    if (!run.runExists(id)) {
                        toast("This run was deleted")
                        if (!nav.popBackStack()) nav.goHome()
                    }
                }
                val flow = remember(id, data.settings.units) { run.details(id, data.settings.units) }
                val s by flow.collectAsStateWithLifecycle()
                val state = s ?: return@composable Loading()
                RunDetailsScreen(
                    state,
                    RunDetailsActions(
                        onBack = { if (!nav.popBackStack()) nav.goHome() },
                        onShare = { scope.launch { open(run.shareIntent(id)) } },
                        onExportGpx = { scope.launch { open(run.gpxIntent(id)) } },
                        onDelete = { run.deleteRun(id) { if (!nav.popBackStack()) nav.goHome() } },
                    ),
                )
            }

            composable(Routes.ACHIEVEMENTS) {
                val s by main.achievements.collectAsStateWithLifecycle()
                DisposableEffect(Unit) { onDispose { main.acknowledgeAchievements() } }
                val state = s ?: return@composable Loading()
                AchievementsScreen(
                    state,
                    AchievementsActions(
                        onBack = { nav.popBackStack() },
                        onSelect = main::selectAchievement,
                        onAcknowledge = main::acknowledgeAchievements,
                        onShare = { open(main.shareAchievement(it)) },
                    ),
                )
            }

            composable(Routes.COACH) {
                val state by coachVm.state.collectAsStateWithLifecycle()
                CoachScreen(
                    state,
                    CoachActions(
                        onBack = { nav.popBackStack() },
                        onSend = coachVm::send,
                        onClear = coachVm::clear,
                        onOpenSettings = { nav.navigate(Routes.SETTINGS) },
                    ),
                )
            }

            composable(Routes.SETTINGS) {
                val state by main.settings.collectAsStateWithLifecycle()
                SettingsScreen(
                    state,
                    SettingsActions(
                        onBack = { nav.popBackStack() },
                        onUnits = main::setUnits,
                        onVoice = main::setVoice,
                        onAutoPause = main::setAutoPause,
                        onKeepScreenOn = main::setKeepScreenOn,
                        onCountdown = main::setCountdown,
                        onTheme = main::setTheme,
                        onMapStyle = main::setMapStyle,
                        onReminder = { on ->
                            main.setReminder(on)
                            if (on && !Perms.notifications(context) && Build.VERSION.SDK_INT >= 33) {
                                onboardingLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
                            }
                        },
                        onReminderTime = main::setReminderTime,
                        onSaveApiKey = main::saveApiKey,
                        onClearApiKey = main::clearApiKey,
                        onModel = main::setModel,
                        onTestApi = main::testApi,
                        onOpenPermissions = { open(Perms.appSettings(context)) },
                        onExportAll = {
                            scope.launch {
                                val intent = main.exportAll()
                                if (intent == null) toast("No runs to export yet") else open(intent)
                            }
                        },
                        onDeleteAll = {
                            main.deleteEverything {
                                nav.navigate(Routes.ONBOARDING) { popUpTo(nav.graph.id) { inclusive = true } }
                            }
                        },
                    ),
                )
            }

            composable(Routes.PERSONAL) {
                val s by main.personal.collectAsStateWithLifecycle()
                val state = s ?: return@composable Loading()
                PersonalInfoScreen(
                    state,
                    PersonalInfoActions(
                        onBack = { nav.popBackStack() },
                        onSave = {
                            main.savePersonal(it)
                            nav.popBackStack()
                        },
                        onPickPhoto = ::pickAvatar,
                        onRemovePhoto = main::removeAvatar,
                    ),
                )
            }

            composable(Routes.HEART) {
                val state by main.heartRate.collectAsStateWithLifecycle()
                DisposableEffect(Unit) { onDispose { main.stopHeartRateScan() } }
                HeartRateScreen(
                    state,
                    HeartRateActions(
                        onBack = { nav.popBackStack() },
                        onRequestPermission = { bluetoothLauncher.launch(context.graph.heartRate.requiredPermissions) },
                        onEnableBluetooth = {
                            try {
                                enableBluetooth.launch(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE))
                            } catch (e: SecurityException) {
                                bluetoothLauncher.launch(context.graph.heartRate.requiredPermissions)
                            } catch (e: ActivityNotFoundException) {
                                toast("Turn on Bluetooth in your device settings")
                            }
                        },
                        onScan = main::scanHeartRate,
                        onStopScan = main::stopHeartRateScan,
                        onConnect = main::connectHeartRate,
                        onDisconnect = main::disconnectHeartRate,
                    ),
                )
            }

            composable(Routes.ABOUT) {
                AboutScreen(com.runova.app.BuildConfig.VERSION_NAME) { nav.popBackStack() }
            }

            composable(Routes.NOTIFICATIONS) {
                val items by main.inbox.collectAsStateWithLifecycle()
                NotificationsScreen(
                    items,
                    UiMapper.reminderText(data.settings),
                    NotificationsActions(
                        onBack = { if (!nav.popBackStack()) nav.goHome() },
                        onMarkAllRead = main::markAllRead,
                        onOpenReminders = { nav.navigate(Routes.SETTINGS) },
                        onOpenItem = { item ->
                            main.markRead(item.id)
                            main.inboxTarget(item.id)?.let { nav.navigate(it) }
                        },
                    ),
                )
            }
        }

        // Overlays shared by all screens.
        LocationPermissionSheet(
            visible = showLocationSheet,
            permanentlyDenied = locationBlocked,
            onAllow = { locationLauncher.launch(Perms.locationOnly) },
            onOpenSettings = {
                showLocationSheet = false
                open(Perms.appSettings(context))
            },
            onDismiss = { showLocationSheet = false },
        )
        RunovaDialog(
            visible = showGpsOff,
            onDismiss = { showGpsOff = false },
            title = "Location is off",
            message = "Turn on location services so RUNOVA can track your route, distance and pace.",
            confirmText = "Open settings",
            onConfirm = {
                showGpsOff = false
                open(Perms.locationSettings())
            },
        )
        val r = recovery
        RecoveryDialog(
            visible = r != null && data.settings.onboarded && backStack?.destination?.route != Routes.SPLASH,
            summary = r?.summary.orEmpty(),
            onResume = {
                run.resumeRecovered()
                nav.navigate(Routes.RUNNING) { launchSingleTop = true }
            },
            onSave = { run.saveRecovered { nav.navigate(Routes.COMPLETE) { launchSingleTop = true } } },
            onDiscard = run::discardRecovered,
        )
    }
}

private fun NavGraphBuilder.splashAndOnboarding(
    nav: NavController,
    main: MainViewModel,
    loaded: Boolean,
    onboarded: Boolean,
    permissions: PermissionSummary,
    skipSplash: Boolean,
    requestPermissions: () -> Unit,
) {
    composable(Routes.SPLASH) {
        var played by remember { mutableStateOf(skipSplash) }
        SplashScreen(onFinished = { played = true })
        LaunchedEffect(played, loaded) {
            if (played && loaded && nav.currentDestination?.route == Routes.SPLASH) {
                nav.navigate(if (onboarded) Routes.HOME else Routes.ONBOARDING) { popUpTo(Routes.SPLASH) { inclusive = true } }
            }
        }
    }
    composable(Routes.ONBOARDING) {
        OnboardingScreen(
            permissions = permissions,
            onRequestPermissions = requestPermissions,
            onFinish = { draft ->
                main.finishOnboarding(draft)
                nav.navigate(Routes.HOME) { popUpTo(Routes.ONBOARDING) { inclusive = true } }
            },
        )
    }
}

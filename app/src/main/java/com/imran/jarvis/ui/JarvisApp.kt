package com.imran.jarvis.ui

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.imran.jarvis.JarvisViewModel
import com.imran.jarvis.UiEvent
import com.imran.jarvis.actions.Permissions
import com.imran.jarvis.ui.conversation.ConversationScreen
import com.imran.jarvis.ui.home.HomeScreen
import com.imran.jarvis.ui.settings.SettingsScreen
import com.imran.jarvis.ui.theme.JarvisColors
import com.imran.jarvis.ui.theme.JarvisTheme
import kotlinx.coroutines.launch

private object Routes {
    const val HOME = "home"
    const val CONVERSATION = "conversation"
    const val SETTINGS = "settings"
}

/** The whole app: three screens, the Android permission pop-ups, and the messages at the bottom. */
@Composable
fun JarvisApp(vm: JarvisViewModel = viewModel()) {
    val context = LocalContext.current
    val nav = rememberNavController()
    val snackbar = remember { SnackbarHostState() }

    // ----- Microphone: asked the first time the user taps a mic button -----
    var afterMic by remember { mutableStateOf<(() -> Unit)?>(null) }
    val micLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val next = afterMic
        afterMic = null
        if (granted) next?.invoke() else vm.onMicPermissionDenied()
    }
    val withMic: (() -> Unit) -> Unit = { action ->
        if (Permissions.hasMic(context)) {
            action()
        } else {
            afterMic = action
            micLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    // ----- A voice command that needs a permission (for example "call Rahul") -----
    val actionPermissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        vm.onPermissionsResult(result.isNotEmpty() && result.values.all { it })
    }

    // ----- The "Calls" switch in Settings -----
    val callsSwitch = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        val granted = result.isNotEmpty() && result.values.all { it }
        vm.setCallsEnabled(granted)
        if (!granted) vm.showAppInfoHint("Phone and Contacts permission is off")
    }

    // ----- One-time messages from the ViewModel -----
    LaunchedEffect(vm) {
        vm.uiEvents.collect { event ->
            when (event) {
                is UiEvent.Message -> launch { snackbar.showSnackbar(event.text) }

                is UiEvent.RequestPermissions -> actionPermissions.launch(event.permissions.toTypedArray())

                UiEvent.NeedNotificationAccess -> launch {
                    val answer = snackbar.showSnackbar("Turn on JARVIS in Notification access", actionLabel = "Settings")
                    if (answer == SnackbarResult.ActionPerformed) SystemSettings.openNotificationAccess(context)
                }

                is UiEvent.AppInfoHint -> launch {
                    val answer = snackbar.showSnackbar(event.text, actionLabel = "Settings")
                    if (answer == SnackbarResult.ActionPerformed) SystemSettings.openAppInfo(context)
                }
            }
        }
    }

    // Stop listening/speaking when the app leaves the screen; re-check permissions when it comes back.
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { vm.stopEverything() }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.refreshPermissions() }

    JarvisTheme {
        Box(Modifier.fillMaxSize()) {
            NavHost(
                navController = nav,
                startDestination = Routes.HOME,
                enterTransition = { fadeIn(tween(220)) },
                exitTransition = { fadeOut(tween(160)) },
                popEnterTransition = { fadeIn(tween(220)) },
                popExitTransition = { fadeOut(tween(160)) },
            ) {
                composable(Routes.HOME) {
                    HomeScreen(
                        vm = vm,
                        onMic = {
                            withMic {
                                nav.navigate(Routes.CONVERSATION) { launchSingleTop = true }
                                vm.startListening()
                            }
                        },
                        onOpenConversation = { nav.navigate(Routes.CONVERSATION) { launchSingleTop = true } },
                        onOpenSettings = { nav.navigate(Routes.SETTINGS) { launchSingleTop = true } },
                    )
                }
                composable(Routes.CONVERSATION) {
                    ConversationScreen(
                        vm = vm,
                        onBack = { nav.popBackStack() },
                        onOpenSettings = { nav.navigate(Routes.SETTINGS) { launchSingleTop = true } },
                        onMic = { withMic { vm.onMicTapped() } },
                    )
                }
                composable(Routes.SETTINGS) {
                    SettingsScreen(
                        vm = vm,
                        onBack = { nav.popBackStack() },
                        onCallsToggle = { wanted ->
                            when {
                                !wanted -> vm.setCallsEnabled(false)
                                Permissions.hasCalls(context) -> vm.setCallsEnabled(true)
                                else -> callsSwitch.launch(Permissions.CALLS.toTypedArray())
                            }
                        },
                        onNotificationsToggle = { wanted ->
                            vm.setNotificationsEnabled(wanted)
                            if (wanted && !Permissions.hasNotificationAccess(context)) {
                                SystemSettings.openNotificationAccess(context)
                            }
                        },
                        onOpenNotificationAccess = { SystemSettings.openNotificationAccess(context) },
                    )
                }
            }

            SnackbarHost(
                hostState = snackbar,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(start = 12.dp, end = 12.dp, bottom = 120.dp),
            ) { data ->
                Snackbar(
                    snackbarData = data,
                    shape = RoundedCornerShape(14.dp),
                    containerColor = JarvisColors.CardHigh,
                    contentColor = JarvisColors.TextPrimary,
                    actionColor = JarvisColors.Cyan,
                )
            }
        }
    }
}

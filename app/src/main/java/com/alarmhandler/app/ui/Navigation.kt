package com.alarmhandler.app.ui

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.alarmhandler.app.data.model.DismissChallenge
import com.alarmhandler.app.data.prefs.AppSettings
import com.alarmhandler.app.ui.about.AboutScreen
import com.alarmhandler.app.ui.challenge.ChallengePickerScreen
import com.alarmhandler.app.ui.edit.EditAlarmScreen
import com.alarmhandler.app.ui.history.HistoryScreen
import com.alarmhandler.app.ui.home.HomeScreen
import com.alarmhandler.app.ui.settings.SettingsScreen
import com.alarmhandler.app.ui.sound.SoundPickerScreen
import com.alarmhandler.app.ui.theme.LocalPixelStyle

/** Every destination in the app. */
object Routes {
    const val HOME = "home"
    const val EDIT = "edit/{alarmId}"
    const val SOUND = "sound/{soundId}"
    const val CHALLENGE = "challenge/{challenge}/{strength}"
    const val SETTINGS = "settings"
    const val HISTORY = "history"
    const val ABOUT = "about"

    fun edit(alarmId: Long) = "edit/$alarmId"

    // The current selection travels in the route so the picker can open on it
    // without needing a shared view model.
    fun sound(soundId: String) = "sound/${java.net.URLEncoder.encode(soundId, "UTF-8")}"

    fun challenge(challenge: DismissChallenge, strength: Int) =
        "challenge/${challenge.id}/$strength"
}

/** Keys used to hand a picker's result back to the screen that opened it. */
object NavResults {
    const val SOUND_ID = "result_sound_id"
    const val CHALLENGE_ID = "result_challenge_id"
    const val CHALLENGE_STRENGTH = "result_challenge_strength"
}

@Composable
fun AlarmHandlerNavHost(
    settings: AppSettings,
    navController: NavHostController = rememberNavController(),
) {
    val reducedMotion = LocalPixelStyle.current.reducedMotion
    val duration = if (reducedMotion) 0 else 220

    NavHost(
        navController = navController,
        startDestination = Routes.HOME,
        enterTransition = {
            slideInHorizontally(tween(duration)) { it / 6 } + fadeIn(tween(duration))
        },
        exitTransition = { fadeOut(tween(duration)) },
        popEnterTransition = { fadeIn(tween(duration)) },
        popExitTransition = {
            slideOutHorizontally(tween(duration)) { it / 6 } + fadeOut(tween(duration))
        },
    ) {
        composable(Routes.HOME) {
            HomeScreen(
                settings = settings,
                onAddAlarm = { navController.navigate(Routes.edit(0L)) },
                onEditAlarm = { id -> navController.navigate(Routes.edit(id)) },
                onOpenSettings = { navController.navigate(Routes.SETTINGS) },
                onOpenHistory = { navController.navigate(Routes.HISTORY) },
                onOpenAbout = { navController.navigate(Routes.ABOUT) },
            )
        }

        composable(
            route = Routes.EDIT,
            arguments = listOf(navArgument("alarmId") { type = NavType.LongType }),
        ) { entry ->
            val alarmId = entry.arguments?.getLong("alarmId") ?: 0L
            EditAlarmScreen(
                alarmId = alarmId,
                settings = settings,
                savedStateHandle = entry.savedStateHandle,
                onBack = { navController.popBackStack() },
                onPickSound = { current -> navController.navigate(Routes.sound(current)) },
                onPickChallenge = { challenge, strength ->
                    navController.navigate(Routes.challenge(challenge, strength))
                },
            )
        }

        composable(
            route = Routes.SOUND,
            arguments = listOf(navArgument("soundId") { type = NavType.StringType }),
        ) { entry ->
            val encoded = entry.arguments?.getString("soundId").orEmpty()
            val current = runCatching { java.net.URLDecoder.decode(encoded, "UTF-8") }
                .getOrDefault(encoded)
            SoundPickerScreen(
                currentSoundId = current,
                onBack = { navController.popBackStack() },
                onPicked = { id ->
                    navController.previousBackStackEntry
                        ?.savedStateHandle?.set(NavResults.SOUND_ID, id)
                    navController.popBackStack()
                },
            )
        }

        composable(
            route = Routes.CHALLENGE,
            arguments = listOf(
                navArgument("challenge") { type = NavType.StringType },
                navArgument("strength") { type = NavType.IntType },
            ),
        ) { entry ->
            ChallengePickerScreen(
                current = DismissChallenge.fromId(entry.arguments?.getString("challenge")),
                currentStrength = entry.arguments?.getInt("strength") ?: 3,
                onBack = { navController.popBackStack() },
                onPicked = { challenge, strength ->
                    navController.previousBackStackEntry?.savedStateHandle?.apply {
                        set(NavResults.CHALLENGE_ID, challenge.id)
                        set(NavResults.CHALLENGE_STRENGTH, strength)
                    }
                    navController.popBackStack()
                },
            )
        }

        composable(Routes.SETTINGS) {
            SettingsScreen(
                settings = settings,
                onBack = { navController.popBackStack() },
                onOpenAbout = { navController.navigate(Routes.ABOUT) },
                onOpenSound = { current -> navController.navigate(Routes.sound(current)) },
                savedStateHandle = it.savedStateHandle,
            )
        }

        composable(Routes.HISTORY) {
            HistoryScreen(
                settings = settings,
                onBack = { navController.popBackStack() },
            )
        }

        composable(Routes.ABOUT) {
            AboutScreen(onBack = { navController.popBackStack() })
        }
    }
}

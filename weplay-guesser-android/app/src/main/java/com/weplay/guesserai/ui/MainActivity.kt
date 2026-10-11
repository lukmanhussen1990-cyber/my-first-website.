package com.weplay.guesserai.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.weplay.guesserai.WePlayGuesserApp
import com.weplay.guesserai.ui.history.HistoryScreen
import com.weplay.guesserai.ui.home.HomeScreen
import com.weplay.guesserai.ui.permissions.PermissionsScreen
import com.weplay.guesserai.ui.settings.SettingsScreen
import com.weplay.guesserai.ui.setup.SetupScreen
import com.weplay.guesserai.ui.theme.WePlayTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val start = if ((application as WePlayGuesserApp).container.settings.current.hasApiKey) HOME else SETUP
        setContent {
            WePlayTheme {
                Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
                    val nav = rememberNavController()
                    NavHost(nav, startDestination = start) {
                        composable(SETUP) {
                            SetupScreen(onDone = { nav.navigate(PERMISSIONS) { popUpTo(SETUP) { inclusive = true } } })
                        }
                        composable(PERMISSIONS) {
                            PermissionsScreen(onContinue = {
                                if (!nav.popBackStack(HOME, inclusive = false)) nav.navigate(HOME) { popUpTo(PERMISSIONS) { inclusive = true } }
                            })
                        }
                        composable(HOME) {
                            HomeScreen(
                                onNeedSetup = { nav.navigate(SETUP) },
                                onNeedPermissions = { nav.navigate(PERMISSIONS) },
                                onSettings = { nav.navigate(SETTINGS) },
                                onHistory = { nav.navigate(HISTORY) },
                            )
                        }
                        composable(SETTINGS) { SettingsScreen(onBack = { nav.popBackStack() }) }
                        composable(HISTORY) { HistoryScreen(onBack = { nav.popBackStack() }) }
                    }
                }
            }
        }
    }

    private companion object {
        const val SETUP = "setup"
        const val PERMISSIONS = "permissions"
        const val HOME = "home"
        const val SETTINGS = "settings"
        const val HISTORY = "history"
    }
}

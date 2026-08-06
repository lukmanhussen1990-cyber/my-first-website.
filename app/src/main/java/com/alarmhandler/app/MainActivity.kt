package com.alarmhandler.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.alarmhandler.app.data.ServiceLocator
import com.alarmhandler.app.data.prefs.AppSettings
import com.alarmhandler.app.ui.AlarmHandlerNavHost
import com.alarmhandler.app.ui.theme.AlarmHandlerTheme
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Hold the mascot splash until the stored theme is known, so the app
        // never flashes the wrong background colour on a cold start.
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        ServiceLocator.init(applicationContext)
        val settingsFlow = ServiceLocator.settings.settings
            .stateIn(
                scope = lifecycleScope,
                started = SharingStarted.Eagerly,
                initialValue = null,
            )
        splash.setKeepOnScreenCondition { settingsFlow.value == null }

        setContent {
            val settings by settingsFlow.collectAsStateWithLifecycle()
            val resolved = settings ?: AppSettings()
            AlarmHandlerTheme(resolved) {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.background),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    AlarmHandlerNavHost(settings = resolved)
                }
            }
        }
    }
}

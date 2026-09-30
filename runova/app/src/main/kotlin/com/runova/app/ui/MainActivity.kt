package com.runova.app.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.runova.app.graph
import com.runova.app.tracking.Notifications
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    /** Route requested by a notification tap, consumed by the navigation host. */
    private val pendingRoute = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        // Hands the system splash over to the animated Compose splash immediately.
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) pendingRoute.value = intent?.getStringExtra(Notifications.EXTRA_ROUTE)
        setContent { RunovaRoot(pendingRoute) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra(Notifications.EXTRA_ROUTE)?.let { pendingRoute.value = it }
    }

    override fun onResume() {
        super.onResume()
        val app = graph
        lifecycleScope.launch {
            // Refresh today's steps and pay out goals reached while the app was closed; they
            // show up in the in-app notifications.
            app.steps.sample()
            app.repository.settlePendingRewards()
        }
    }
}

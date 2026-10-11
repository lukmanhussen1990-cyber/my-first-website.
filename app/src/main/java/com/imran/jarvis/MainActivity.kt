package com.imran.jarvis

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import com.imran.jarvis.ui.JarvisApp

class MainActivity : ComponentActivity() {

    /** Goes up by one each time the notification or the Quick Settings tile asks JARVIS to listen. */
    private var listenRequest by mutableIntStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Draw behind the status bar and navigation bar; light icons because the app is dark.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        if (savedInstanceState == null) handleIntent(intent)
        setContent { JarvisApp(listenRequest = listenRequest) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        if (intent?.getBooleanExtra(EXTRA_START_LISTENING, false) == true) {
            intent.removeExtra(EXTRA_START_LISTENING) // handle each tap only once
            listenRequest++
        }
    }

    companion object {
        private const val EXTRA_START_LISTENING = "com.imran.jarvis.START_LISTENING"

        /** Opens JARVIS (or brings it to the front) and starts listening. */
        fun listenIntent(context: Context): Intent =
            Intent(context, MainActivity::class.java)
                .putExtra(EXTRA_START_LISTENING, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
}

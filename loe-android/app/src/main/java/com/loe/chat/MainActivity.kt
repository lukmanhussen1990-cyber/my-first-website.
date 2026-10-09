package com.loe.chat

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.loe.chat.ui.LoeApp
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.ui.theme.isLoeDark

class MainActivity : ComponentActivity() {

    private val openConversation = mutableStateOf<Long?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        openConversation.value = conversationFrom(intent)
        val graph = Loe.graph
        graph.notifier.ensureChannel()
        setContent {
            val settings by graph.settings.state.collectAsState()
            val dark = isLoeDark(settings.theme)
            DisposableEffect(dark) {
                val style = if (dark) {
                    SystemBarStyle.dark(Color.TRANSPARENT)
                } else {
                    SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                }
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
                onDispose { }
            }
            LoeTheme(dark = dark) {
                LoeApp(
                    graph = graph,
                    openConversationId = openConversation.value,
                    onOpenedConversation = { openConversation.value = null },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        conversationFrom(intent)?.let { openConversation.value = it }
    }

    private fun conversationFrom(intent: Intent?): Long? =
        intent?.getLongExtra(EXTRA_CONVERSATION_ID, -1L)?.takeIf { it > 0 }

    companion object {
        const val EXTRA_CONVERSATION_ID = "conversation_id"
    }
}

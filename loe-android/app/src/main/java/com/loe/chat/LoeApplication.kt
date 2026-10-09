package com.loe.chat

import android.app.Application
import android.content.Context
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.loe.chat.ai.AiService
import com.loe.chat.data.ChatRepository
import com.loe.chat.data.LoeDatabase
import com.loe.chat.data.SettingsStore
import com.loe.chat.engine.BotRegistry
import com.loe.chat.engine.ChatEngine
import com.loe.chat.engine.ReplyNotifier
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/** App-wide singletons (simple manual dependency injection). */
class AppGraph(context: Context, databaseName: String? = "loe.db") {
    private val app = context.applicationContext

    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val settings = SettingsStore(app)
    val repository = ChatRepository(LoeDatabase(app, databaseName), app.filesDir)
    val bots = BotRegistry(repository, scope)
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.MINUTES)
        .writeTimeout(2, TimeUnit.MINUTES)
        .build()
    val ai = AiService(http)
    val notifier = ReplyNotifier(app)

    @Volatile
    var inForeground: Boolean = true

    val engine = ChatEngine(app, repository, settings, bots, ai, notifier, scope) { inForeground }
}

class LoeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        val graph = AppGraph(this)
        Loe.graph = graph
        ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                graph.inForeground = true
            }

            override fun onStop(owner: LifecycleOwner) {
                graph.inForeground = false
            }
        })
    }
}

/** Global access to the app graph (set once in [LoeApplication.onCreate]). */
object Loe {
    lateinit var graph: AppGraph
}

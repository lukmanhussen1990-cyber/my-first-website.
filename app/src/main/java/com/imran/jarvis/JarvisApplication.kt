package com.imran.jarvis

import android.app.Application
import com.imran.jarvis.actions.ActionExecutor
import com.imran.jarvis.actions.TorchController
import com.imran.jarvis.ai.AiRouter
import com.imran.jarvis.data.ApiKeyStore
import com.imran.jarvis.data.SettingsRepository

/** Creates the long-lived helpers once, when the app starts. */
class JarvisApplication : Application() {
    val container: AppContainer by lazy { AppContainer(this) }
}

class AppContainer(app: Application) {
    val settings = SettingsRepository(app)
    val apiKeys = ApiKeyStore(app)
    val ai = AiRouter.create()
    val torch = TorchController(app)
    val actions = ActionExecutor(app, torch)
}

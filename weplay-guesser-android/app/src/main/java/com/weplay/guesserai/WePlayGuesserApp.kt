package com.weplay.guesserai

import android.app.Application

class WePlayGuesserApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        CrashLog.install(this)
        container = AppContainer(this)
    }
}

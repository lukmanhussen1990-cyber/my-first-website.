package com.alarmhandler.app

import android.app.Application
import android.util.Log
import com.alarmhandler.app.alarm.NotificationHelper
import com.alarmhandler.app.data.ServiceLocator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class AlarmHandlerApp : Application() {

    override fun onCreate() {
        super.onCreate()
        ServiceLocator.init(this)
        NotificationHelper(this).ensureChannels()

        // Re-arm on every cold start. The boot receiver covers reboots, but an
        // app that was force stopped has all of its alarms cancelled by the
        // system and gets no broadcast when it is launched again.
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            runCatching { ServiceLocator.alarms.rescheduleAll() }
                .onFailure { Log.e(TAG, "Could not re-arm alarms on start", it) }
        }
    }

    private companion object {
        const val TAG = "AlarmHandlerApp"
    }
}

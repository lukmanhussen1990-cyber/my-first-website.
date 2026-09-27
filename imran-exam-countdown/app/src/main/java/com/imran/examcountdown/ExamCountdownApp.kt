package com.imran.examcountdown

import android.app.Application
import com.imran.examcountdown.notify.Notifier
import com.imran.examcountdown.notify.ReminderScheduler

class ExamCountdownApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifier.createChannels(this)
        ReminderScheduler.reschedule(this)
    }

    companion object {
        /**
         * True once the opening animation has been considered in this process. It only plays on
         * a cold launch (a fresh process); returning to a running app is immediate.
         */
        @Volatile
        var introHandled = false
    }
}

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
}

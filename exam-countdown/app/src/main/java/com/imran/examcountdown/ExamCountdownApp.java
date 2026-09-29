package com.imran.examcountdown;

import android.app.Application;
import com.imran.examcountdown.notify.Notifier;
import com.imran.examcountdown.notify.ReminderScheduler;
import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;

public final class ExamCountdownApp extends Application {
    public static final Companion Companion = new Companion(null);
    private static volatile boolean introHandled;

    public static final boolean access$getIntroHandled$cp() {
        return introHandled;
    }

    public static final void access$setIntroHandled$cp(boolean z) {
        introHandled = z;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        ExamCountdownApp examCountdownApp = this;
        Notifier.INSTANCE.createChannels(examCountdownApp);
        ReminderScheduler.INSTANCE.reschedule(examCountdownApp);
    }

    public static final class Companion {
        public Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }

        public final boolean getIntroHandled() {
            return ExamCountdownApp.access$getIntroHandled$cp();
        }

        public final void setIntroHandled(boolean z) {
            ExamCountdownApp.access$setIntroHandled$cp(z);
        }
    }
}

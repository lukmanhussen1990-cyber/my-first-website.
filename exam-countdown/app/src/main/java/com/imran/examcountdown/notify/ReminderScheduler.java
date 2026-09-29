package com.imran.examcountdown.notify;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.FocusMode;
import com.imran.examcountdown.core.FocusState;
import com.imran.examcountdown.core.FocusTimer;
import com.imran.examcountdown.core.Profile;
import com.imran.examcountdown.core.Reminder;
import com.imran.examcountdown.core.ReminderPlanner;
import com.imran.examcountdown.core.ReminderSettings;
import com.imran.examcountdown.data.AppClock;
import com.imran.examcountdown.data.Store;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.collections.SetsKt;
import kotlin.jvm.internal.Intrinsics;

public final class ReminderScheduler {
    public static final String ACTION_WAKE = "com.imran.examcountdown.action.WAKE";
    public static final ReminderScheduler INSTANCE = new ReminderScheduler();
    private static final int REQUEST_WAKE = 7;

    private ReminderScheduler() {
    }

    public final void onWake(Context context) {
        ReminderSettings reminderSettings;
        FocusMode finished;
        Intrinsics.checkNotNullParameter(context, "context");
        Store store = new Store(context);
        long now = AppClock.INSTANCE.now();
        ReminderSettings reminders = store.getReminders();
        boolean canPost = Notifier.INSTANCE.canPost(context);
        List<Reminder> plan = ReminderPlanner.INSTANCE.plan(store.getExams(), reminders);
        Set<String> delivered = store.getDelivered();
        List<Reminder> due = ReminderPlanner.INSTANCE.due(plan, now, delivered, reminders.getArmedAt());
        if (due.isEmpty()) {
            reminderSettings = reminders;
        } else {
            if (canPost) {
                Choices choices = store.getChoices();
                Profile profile = store.getProfile();
                for (Reminder reminder : due) {
                    Notifier.INSTANCE.showExamReminder(context, reminder, choices, profile, now);
                }
            }
            reminderSettings = reminders;
            Set<String> set = delivered;
            List<Reminder> list = due;
            ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(list, 10));
            for (Reminder reminder2 : list) {
                arrayList.add(reminder2.getKey());
            }
            store.setDelivered(SetsKt.plus((Set) set, (Iterable) arrayList));
        }
        FocusState focus = store.getFocus();
        FocusState focusState = FocusTimer.INSTANCE.settle(focus, AppClock.INSTANCE.moment(context), AppClock.INSTANCE.localEpochDay());
        if (!Intrinsics.areEqual(focusState, focus)) {
            store.setFocus(focusState);
            if (focus.getRunning() && !focusState.getRunning() && reminderSettings.getFocusAlerts() && canPost && !AppVisibility.INSTANCE.getResumed() && (finished = focusState.getFinished()) != null) {
                Notifier.INSTANCE.showFocusDone(context, finished);
            }
        }
        reschedule(context);
    }

    public final void reschedule(Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        Store store = new Store(context);
        long now = AppClock.INSTANCE.now();
        ReminderSettings reminders = store.getReminders();
        boolean canPost = Notifier.INSTANCE.canPost(context);
        List<Reminder> plan = ReminderPlanner.INSTANCE.plan(store.getExams(), reminders);
        Set<String> delivered = store.getDelivered();
        List<Reminder> list = plan;
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(list, 10));
        for (Reminder reminder : list) {
            arrayList.add(reminder.getKey());
        }
        Set set = CollectionsKt.toSet(arrayList);
        if (!set.containsAll(delivered)) {
            store.setDelivered(CollectionsKt.intersect(delivered, set));
        }
        Long l = null;
        Long nextFireAt = canPost ? ReminderPlanner.INSTANCE.nextFireAt(plan, now, delivered, reminders.getArmedAt()) : null;
        if (canPost && reminders.getFocusAlerts()) {
            l = FocusTimer.INSTANCE.endsAt(store.getFocus(), AppClock.INSTANCE.moment(context));
        }
        Long l2 = CollectionsKt.minOrNull(CollectionsKt.listOfNotNull(new Long[]{nextFireAt, l}));
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(AlarmManager.class);
        if (alarmManager == null) {
            return;
        }
        PendingIntent wakeIntent = wakeIntent(context);
        if (l2 == null) {
            alarmManager.cancel(wakeIntent);
            return;
        }
        boolean z = Build.VERSION.SDK_INT < 31 || alarmManager.canScheduleExactAlarms();
        long wakeAt = ReminderPlanner.INSTANCE.wakeAt(l2.longValue(), now, z);
        if (z && wakeAt == l2.longValue()) {
            alarmManager.setExactAndAllowWhileIdle(0, wakeAt, wakeIntent);
        } else {
            alarmManager.setAndAllowWhileIdle(0, wakeAt, wakeIntent);
        }
    }

    private final PendingIntent wakeIntent(Context context) {
        PendingIntent broadcast = PendingIntent.getBroadcast(context, REQUEST_WAKE, new Intent(context, AlarmReceiver.class).setAction(ACTION_WAKE), 201326592);
        Intrinsics.checkNotNullExpressionValue(broadcast, "getBroadcast(...)");
        return broadcast;
    }
}

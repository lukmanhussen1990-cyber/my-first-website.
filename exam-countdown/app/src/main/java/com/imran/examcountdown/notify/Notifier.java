package com.imran.examcountdown.notify;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.imran.examcountdown.MainActivity;
import com.imran.examcountdown.R;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.FocusMode;
import com.imran.examcountdown.core.Formats;
import com.imran.examcountdown.core.ModelKt;
import com.imran.examcountdown.core.Profile;
import com.imran.examcountdown.core.Reminder;
import com.imran.examcountdown.core.ReminderKind;
import com.imran.examcountdown.core.SeasonCalculator;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.Pair;
import kotlin.TuplesKt;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;
import kotlin.text.StringsKt;

public final class Notifier {
    private static final int ACCENT = -14722501;
    public static final String CHANNEL_FOCUS = "focus_timer";
    public static final String CHANNEL_REMINDERS = "exam_reminders";
    private static final int ID_EXAM_BASE = 100;
    private static final int ID_FOCUS = 1;
    public static final Notifier INSTANCE = new Notifier();

    public class WhenMappings {
        public static final int[] $EnumSwitchMapping$0;
        public static final int[] $EnumSwitchMapping$1;

        static {
            int[] iArr = new int[ReminderKind.values().length];
            try {
                iArr[ReminderKind.DAY_BEFORE.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[ReminderKind.HOUR_BEFORE.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            $EnumSwitchMapping$0 = iArr;
            int[] iArr2 = new int[FocusMode.values().length];
            try {
                iArr2[FocusMode.FOCUS.ordinal()] = 1;
            } catch (NoSuchFieldError unused3) {
            }
            try {
                iArr2[FocusMode.BREAK.ordinal()] = 2;
            } catch (NoSuchFieldError unused4) {
            }
            $EnumSwitchMapping$1 = iArr2;
        }
    }

    private Notifier() {
    }

    public final void createChannels(Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(NotificationManager.class);
        if (notificationManager == null) {
            return;
        }
        NotificationChannel notificationChannel = new NotificationChannel(CHANNEL_REMINDERS, context.getString(R.string.channel_reminders), 4);
        notificationChannel.setDescription(context.getString(R.string.channel_reminders_desc));
        NotificationChannel notificationChannel2 = new NotificationChannel(CHANNEL_FOCUS, context.getString(R.string.channel_focus), 3);
        notificationChannel2.setDescription(context.getString(R.string.channel_focus_desc));
        notificationManager.createNotificationChannels(CollectionsKt.listOf(new NotificationChannel[]{notificationChannel, notificationChannel2}));
    }

    public final boolean canPost(Context context) {
        NotificationManager notificationManager;
        Intrinsics.checkNotNullParameter(context, "context");
        return (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == 0) && (notificationManager = (NotificationManager) context.getSystemService(NotificationManager.class)) != null && notificationManager.areNotificationsEnabled();
    }

    public final void showExamReminder(Context context, Reminder reminder, Choices choices, Profile profile, long j) {
        String str;
        String str2;
        String str3;
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(reminder, "reminder");
        Intrinsics.checkNotNullParameter(choices, "choices");
        Intrinsics.checkNotNullParameter(profile, "profile");
        Exam exam = reminder.getExam();
        String title = exam.title(choices);
        String time = Formats.INSTANCE.time(exam.getStart());
        String str4 = StringsKt.isBlank(profile.getHall()) ? "" : " · Hall " + profile.getHall();
        int i = WhenMappings.$EnumSwitchMapping$0[reminder.getKind().ordinal()];
        if (i == 1) {
            str = (Intrinsics.areEqual(exam.getDate(), SeasonCalculator.INSTANCE.todayInIndia(j).plusDays(1L)) ? "Tomorrow" : Formats.INSTANCE.dateShort(exam.getDate())) + ": " + title;
            str2 = "Starts at " + time + " (India time)" + str4 + ". One chapter at a time — you’ve got this!";
        } else if (i != 2) {
            throw new NoWhenBranchMatchedException();
        } else {
            long coerceAtLeast = RangesKt.coerceAtLeast(((exam.getStartMillis() - j) + 59999) / ModelKt.MINUTE, 0L);
            if (55 <= coerceAtLeast && coerceAtLeast < 66) {
                str3 = "in 1 hour";
            } else if (coerceAtLeast > 1) {
                str3 = "in " + coerceAtLeast + " minutes";
            } else {
                str3 = "now";
            }
            str = title + " starts " + str3;
            str2 = time + " (India time)" + str4 + ". Deep breath — you’re ready.";
        }
        post(context, CHANNEL_REMINDERS, (exam.getSubject().ordinal() * 2) + ID_EXAM_BASE + reminder.getKind().ordinal(), str, str2, 0);
    }

    public final void showFocusDone(Context context, FocusMode mode) {
        Pair pair;
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(mode, "mode");
        int i = WhenMappings.$EnumSwitchMapping$1[mode.ordinal()];
        if (i == 1) {
            pair = TuplesKt.to("Focus session complete 🎉", "25 minutes done. Time for a 5-minute break.");
        } else if (i != 2) {
            throw new NoWhenBranchMatchedException();
        } else {
            pair = TuplesKt.to("Break’s over", "Ready for another 25-minute focus session?");
        }
        post(context, CHANNEL_FOCUS, 1, (String) pair.component1(), (String) pair.component2(), 2);
    }

    private final void post(Context context, String str, int i, String str2, String str3, int i2) {
        NotificationManager notificationManager;
        if (canPost(context) && (notificationManager = (NotificationManager) context.getSystemService(NotificationManager.class)) != null) {
            Intent putExtra = new Intent(context, MainActivity.class).addFlags(872415232).putExtra(MainActivity.EXTRA_TAB, i2);
            Intrinsics.checkNotNullExpressionValue(putExtra, "putExtra(...)");
            String str4 = str3;
            Notification build = new Notification.Builder(context, str).setSmallIcon(R.drawable.ic_stat_countdown).setColor(ACCENT).setContentTitle(str2).setContentText(str4).setStyle(new Notification.BigTextStyle().bigText(str4)).setCategory(Intrinsics.areEqual(str, CHANNEL_REMINDERS) ? "reminder" : "alarm").setAutoCancel(true).setContentIntent(PendingIntent.getActivity(context, i, putExtra, 201326592)).build();
            Intrinsics.checkNotNullExpressionValue(build, "build(...)");
            notificationManager.notify(i, build);
        }
    }
}

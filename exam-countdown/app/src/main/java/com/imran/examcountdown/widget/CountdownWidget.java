package com.imran.examcountdown.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import com.imran.examcountdown.MainActivity;
import com.imran.examcountdown.R;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.Countdown;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.ExamStatus;
import com.imran.examcountdown.core.Formats;
import com.imran.examcountdown.core.Profile;
import com.imran.examcountdown.core.Season;
import com.imran.examcountdown.core.SeasonCalculator;
import com.imran.examcountdown.core.Timetable;
import com.imran.examcountdown.data.AppClock;
import com.imran.examcountdown.data.Store;
import java.time.ZonedDateTime;
import java.util.Locale;

/**
 * Home-screen widget: the next exam and a live countdown.
 *
 * More than a day away it shows the number of days; inside the last day it shows a ticking
 * hours:minutes:seconds timer (a RemoteViews Chronometer, so no per-second updates are needed).
 * It refreshes when the app changes data, on boot/time changes, at the next exam start or midnight,
 * and every 30 minutes as a safety net.
 */
public final class CountdownWidget extends AppWidgetProvider {
    private static final long DAY = 24L * 60 * 60 * 1000;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        try {
            RemoteViews views = build(context);
            for (int id : ids) manager.updateAppWidget(id, views);
        } catch (Throwable ignored) {
            // A widget must never take the app process down.
        }
    }

    @Override
    public void onDisabled(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(refreshIntent(context));
        } catch (Throwable ignored) {
        }
    }

    /** Re-renders every placed widget. Cheap when none is placed. */
    public static void refresh(Context context) {
        try {
            Context app = context.getApplicationContext();
            AppWidgetManager manager = AppWidgetManager.getInstance(app);
            int[] ids = manager.getAppWidgetIds(new ComponentName(app, CountdownWidget.class));
            if (ids == null || ids.length == 0) return;
            RemoteViews views = build(app);
            for (int id : ids) manager.updateAppWidget(id, views);
        } catch (Throwable ignored) {
        }
    }

    static RemoteViews build(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_countdown);
        Intent open = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        Store store = new Store(context);
        if (!store.getSetupDone()) {
            show(v, "WELCOME", "Exam Countdown", "Set up", "Open the app to begin", false, 0);
            return v;
        }
        long now = AppClock.INSTANCE.now();
        Season season = SeasonCalculator.INSTANCE.compute(store.getExams(), now, store.getMarkedDone());
        Choices choices = store.getChoices();
        Profile profile = store.getProfile();
        String hall = profile.getHall() == null || profile.getHall().trim().isEmpty() ? "" : " · Hall " + profile.getHall();

        ExamStatus live = season.getLive();
        ExamStatus next = season.getNext();
        long refreshAt = nextMidnight(now);
        if (live != null) {
            Exam exam = live.getExam();
            show(v, "EXAM IN PROGRESS", exam.headline(choices), "Good luck!",
                    "Started " + Formats.INSTANCE.time(exam.getStart()) + hall, false, 0);
            if (next != null) refreshAt = Math.min(refreshAt, next.getStartMillis());
            v.setContentDescription(R.id.widget_root, exam.title(choices) + " is in progress. Good luck!");
        } else if (next != null) {
            Exam exam = next.getExam();
            long remaining = Math.max(0L, next.getStartMillis() - now);
            String label = season.getNextIsFinal() ? "FINAL EXAM" : "NEXT EXAM";
            String when = Formats.INSTANCE.relativeDay(exam.getDate(), now).toUpperCase(Locale.ROOT);
            String meta = Formats.INSTANCE.dateShort(exam.getDate()) + " · " + Formats.INSTANCE.time(exam.getStart()) + hall;
            Countdown cd = Countdown.Companion.until(next.getStartMillis(), now);
            if (remaining >= DAY) {
                long days = cd.getDays();
                show(v, label + " · " + when, exam.headline(choices), days + (days == 1 ? " day" : " days"), meta, false, 0);
            } else {
                show(v, label + " · " + when, exam.headline(choices), "", meta, true, SystemClock.elapsedRealtime() + remaining);
            }
            refreshAt = Math.min(refreshAt, next.getStartMillis() + 1000L);
            v.setContentDescription(R.id.widget_root, exam.title(choices) + " starts in " + cd.spoken());
        } else {
            show(v, "EXAM SEASON", season.isOver() ? "All done!" : "No exams", season.isOver() ? "Well done" : "", "Time to rest and celebrate", false, 0);
        }
        scheduleRefresh(context, refreshAt, now);
        return v;
    }

    private static void show(RemoteViews v, String label, String title, String big, String meta, boolean timer, long timerBase) {
        v.setTextViewText(R.id.widget_label, label);
        v.setTextViewText(R.id.widget_title, title);
        v.setTextViewText(R.id.widget_meta, meta);
        if (timer) {
            v.setViewVisibility(R.id.widget_big, View.GONE);
            v.setViewVisibility(R.id.widget_timer, View.VISIBLE);
            v.setChronometerCountDown(R.id.widget_timer, true);
            v.setChronometer(R.id.widget_timer, timerBase, null, true);
        } else {
            v.setViewVisibility(R.id.widget_timer, View.GONE);
            v.setViewVisibility(R.id.widget_big, big.isEmpty() ? View.GONE : View.VISIBLE);
            v.setTextViewText(R.id.widget_big, big);
        }
    }

    private static long nextMidnight(long now) {
        return ZonedDateTime.ofInstant(java.time.Instant.ofEpochMilli(now), Timetable.INSTANCE.getZONE())
                .toLocalDate().plusDays(1).atStartOfDay(Timetable.INSTANCE.getZONE()).toInstant().toEpochMilli() + 1000L;
    }

    private static PendingIntent refreshIntent(Context context) {
        Intent i = new Intent(context, CountdownWidget.class).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        int[] ids = AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, CountdownWidget.class));
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        return PendingIntent.getBroadcast(context, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** One inexact wake-up at the next moment the display would change (exam start / midnight). */
    private static void scheduleRefresh(Context context, long at, long now) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null || at <= now) return;
            am.setAndAllowWhileIdle(AlarmManager.RTC, at, refreshIntent(context));
        } catch (Throwable ignored) {
        }
    }
}

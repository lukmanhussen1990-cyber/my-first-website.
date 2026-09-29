package com.imran.examcountdown.core;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.Intrinsics;

public final class ReminderPlanner {
    public static final long DAY_BEFORE_GRACE = 21600000;
    public static final long FINAL_APPROACH = 240000;
    public static final ReminderPlanner INSTANCE = new ReminderPlanner();

    private ReminderPlanner() {
    }

    public final List<Reminder> plan(List<Exam> exams, ReminderSettings settings) {
        Iterator<Exam> it;
        Intrinsics.checkNotNullParameter(exams, "exams");
        Intrinsics.checkNotNullParameter(settings, "settings");
        if (settings.getEnabled()) {
            ArrayList arrayList = new ArrayList();
            for (Iterator<Exam> it2 = exams.iterator(); it2.hasNext(); it2 = it) {
                Exam next = it2.next();
                long startMillis = next.getStartMillis();
                if (settings.getDayBefore()) {
                    it = it2;
                    arrayList.add(new Reminder(next, ReminderKind.DAY_BEFORE, startMillis - ModelKt.DAY, Math.min(startMillis - 64800000, settings.getHourBefore() ? startMillis - ModelKt.HOUR : startMillis)));
                } else {
                    it = it2;
                }
                if (settings.getHourBefore()) {
                    arrayList.add(new Reminder(next, ReminderKind.HOUR_BEFORE, startMillis - ModelKt.HOUR, startMillis));
                }
            }
            return CollectionsKt.sortedWith(arrayList, new ReminderPlanner$plan$$inlined$sortedBy$1());
        }
        return CollectionsKt.emptyList();
    }

    public final List<Reminder> due(List<Reminder> plan, long j, Set<String> delivered, long j2) {
        Intrinsics.checkNotNullParameter(plan, "plan");
        Intrinsics.checkNotNullParameter(delivered, "delivered");
        ArrayList arrayList = new ArrayList();
        for (Object obj : plan) {
            Reminder reminder = (Reminder) obj;
            long fireAt = reminder.getFireAt();
            if (j2 <= fireAt && fireAt <= j && j < reminder.getExpiresAt() && !delivered.contains(reminder.getKey())) {
                arrayList.add(obj);
            }
        }
        return arrayList;
    }

    public final Long nextFireAt(List<Reminder> plan, long j, Set<String> delivered, long j2) {
        Long l;
        Intrinsics.checkNotNullParameter(plan, "plan");
        Intrinsics.checkNotNullParameter(delivered, "delivered");
        ArrayList arrayList = new ArrayList();
        for (Object obj : plan) {
            Reminder reminder = (Reminder) obj;
            if (reminder.getFireAt() > j && reminder.getFireAt() >= j2 && !delivered.contains(reminder.getKey())) {
                arrayList.add(obj);
            }
        }
        Iterator it = arrayList.iterator();
        if (it.hasNext()) {
            Long valueOf = Long.valueOf(((Reminder) it.next()).getFireAt());
            while (it.hasNext()) {
                Long valueOf2 = Long.valueOf(((Reminder) it.next()).getFireAt());
                if (valueOf.compareTo(valueOf2) > 0) {
                    valueOf = valueOf2;
                }
            }
            l = valueOf;
        } else {
            l = null;
        }
        return l;
    }

    public final long wakeAt(long j, long j2, boolean z) {
        if (z) {
            return j;
        }
        long j3 = j - j2;
        return j3 <= FINAL_APPROACH ? j : j2 + (j3 / 2);
    }
}

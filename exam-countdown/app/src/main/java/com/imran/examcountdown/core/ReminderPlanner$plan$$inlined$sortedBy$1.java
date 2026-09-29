package com.imran.examcountdown.core;

import java.util.Comparator;
import kotlin.Metadata;
import kotlin.comparisons.ComparisonsKt;

public final class ReminderPlanner$plan$$inlined$sortedBy$1<T> implements Comparator<T> {
    @Override
    public final int compare(T t, T t2) {
        return ComparisonsKt.compareValues(Long.valueOf(((Reminder) t).getFireAt()), Long.valueOf(((Reminder) t2).getFireAt()));
    }
}

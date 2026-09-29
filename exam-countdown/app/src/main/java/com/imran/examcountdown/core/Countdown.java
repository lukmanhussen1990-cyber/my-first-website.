package com.imran.examcountdown.core;

import java.util.ArrayList;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.ranges.RangesKt;

public final class Countdown {
    public static final Companion Companion = new Companion(null);
    private final long days;
    private final int hours;
    private final int minutes;
    private final int seconds;

    public static Countdown copy$default(Countdown countdown, long j, int i, int i2, int i3, int i4, Object obj) {
        if ((i4 & 1) != 0) {
            j = countdown.days;
        }
        long j2 = j;
        if ((i4 & 2) != 0) {
            i = countdown.hours;
        }
        int i5 = i;
        if ((i4 & 4) != 0) {
            i2 = countdown.minutes;
        }
        int i6 = i2;
        if ((i4 & 8) != 0) {
            i3 = countdown.seconds;
        }
        return countdown.copy(j2, i5, i6, i3);
    }

    public final long component1() {
        return this.days;
    }

    public final int component2() {
        return this.hours;
    }

    public final int component3() {
        return this.minutes;
    }

    public final int component4() {
        return this.seconds;
    }

    public final Countdown copy(long j, int i, int i2, int i3) {
        return new Countdown(j, i, i2, i3);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof Countdown) {
            Countdown countdown = (Countdown) obj;
            return this.days == countdown.days && this.hours == countdown.hours && this.minutes == countdown.minutes && this.seconds == countdown.seconds;
        }
        return false;
    }

    public int hashCode() {
        return (((((Long.hashCode(this.days) * 31) + Integer.hashCode(this.hours)) * 31) + Integer.hashCode(this.minutes)) * 31) + Integer.hashCode(this.seconds);
    }

    public String toString() {
        return "Countdown(days=" + this.days + ", hours=" + this.hours + ", minutes=" + this.minutes + ", seconds=" + this.seconds + ')';
    }

    public Countdown(long j, int i, int i2, int i3) {
        this.days = j;
        this.hours = i;
        this.minutes = i2;
        this.seconds = i3;
    }

    public final long getDays() {
        return this.days;
    }

    public final int getHours() {
        return this.hours;
    }

    public final int getMinutes() {
        return this.minutes;
    }

    public final int getSeconds() {
        return this.seconds;
    }

    public final boolean isZero() {
        return this.days == 0 && this.hours == 0 && this.minutes == 0 && this.seconds == 0;
    }

    public final String spoken() {
        ArrayList<String> arrayList = new ArrayList<>();
        long j = this.days;
        if (j > 0) {
            arrayList.add(Companion.access$plural(Companion, j, "day"));
        }
        int i = this.hours;
        if (i > 0) {
            arrayList.add(Companion.access$plural(Companion, i, "hour"));
        }
        if (this.minutes > 0 || arrayList.isEmpty()) {
            arrayList.add(Companion.access$plural(Companion, this.minutes, "minute"));
        }
        return arrayList.size() == 1 ? (String) arrayList.get(0) : CollectionsKt.joinToString(CollectionsKt.dropLast(arrayList, 1), ", ", "", "", -1, "...", null) + " and " + ((String) CollectionsKt.last((List<? extends Object>) arrayList));
    }

    public static final class Companion {
        public Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }

        public static final String access$plural(Companion companion, long j, String str) {
            return companion.plural(j, str);
        }

        public final Countdown until(long j, long j2) {
            long coerceAtLeast = (RangesKt.coerceAtLeast(j - j2, 0L) + 999) / 1000;
            long j3 = 86400;
            long j4 = coerceAtLeast / j3;
            long j5 = 3600;
            int i = (int) ((coerceAtLeast % j3) / j5);
            long j6 = coerceAtLeast % j5;
            long j7 = 60;
            return new Countdown(j4, i, (int) (j6 / j7), (int) (coerceAtLeast % j7));
        }

        public final long delayToNextTick(long j, long j2) {
            long j3 = j - j2;
            if (j3 <= 0) {
                return 1000L;
            }
            long j4 = j3 % 1000;
            if (j4 == 0) {
                return 1000L;
            }
            return j4;
        }

        private final String plural(long j, String str) {
            return (j == 1 ? new StringBuilder("1 ").append(str) : new StringBuilder().append(j).append(' ').append(str).append('s')).toString();
        }
    }
}

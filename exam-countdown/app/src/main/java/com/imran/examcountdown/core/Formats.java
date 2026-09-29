package com.imran.examcountdown.core;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.chrono.ChronoLocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class Formats {
    public static final Formats INSTANCE = new Formats();
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);
    private static final DateTimeFormatter DATE_FULL = DateTimeFormatter.ofPattern("EEE, d MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter DATE_SHORT = DateTimeFormatter.ofPattern("EEE, d MMM", Locale.ENGLISH);
    private static final DateTimeFormatter DATE_LONG = DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale.ENGLISH);
    private static final DateTimeFormatter WEEKDAY = DateTimeFormatter.ofPattern("EEE", Locale.ENGLISH);
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH);

    private Formats() {
    }

    public final String time(LocalTime t) {
        Intrinsics.checkNotNullParameter(t, "t");
        String format = TIME.format(t);
        Intrinsics.checkNotNullExpressionValue(format, "format(...)");
        return format;
    }

    public static String time$default(Formats formats, long j, ZoneId zoneId, int i, Object obj) {
        if ((i & 2) != 0) {
            zoneId = Timetable.INSTANCE.getZONE();
        }
        return formats.time(j, zoneId);
    }

    public final String time(long j, ZoneId zone) {
        Intrinsics.checkNotNullParameter(zone, "zone");
        String format = TIME.format(Instant.ofEpochMilli(j).atZone(zone));
        Intrinsics.checkNotNullExpressionValue(format, "format(...)");
        return format;
    }

    public final String dateFull(LocalDate d) {
        Intrinsics.checkNotNullParameter(d, "d");
        String format = DATE_FULL.format(d);
        Intrinsics.checkNotNullExpressionValue(format, "format(...)");
        return format;
    }

    public final String dateShort(LocalDate d) {
        Intrinsics.checkNotNullParameter(d, "d");
        String format = DATE_SHORT.format(d);
        Intrinsics.checkNotNullExpressionValue(format, "format(...)");
        return format;
    }

    public final String dateLong(LocalDate d) {
        Intrinsics.checkNotNullParameter(d, "d");
        String format = DATE_LONG.format(d);
        Intrinsics.checkNotNullExpressionValue(format, "format(...)");
        return format;
    }

    public final String weekday(LocalDate d) {
        Intrinsics.checkNotNullParameter(d, "d");
        String format = WEEKDAY.format(d);
        Intrinsics.checkNotNullExpressionValue(format, "format(...)");
        return format;
    }

    public final String month(LocalDate d) {
        Intrinsics.checkNotNullParameter(d, "d");
        String format = MONTH.format(d);
        Intrinsics.checkNotNullExpressionValue(format, "format(...)");
        Locale ENGLISH = Locale.ENGLISH;
        Intrinsics.checkNotNullExpressionValue(ENGLISH, "ENGLISH");
        String upperCase = format.toUpperCase(ENGLISH);
        Intrinsics.checkNotNullExpressionValue(upperCase, "toUpperCase(...)");
        return upperCase;
    }

    public final String startInZone(Exam exam, ZoneId zone) {
        String str;
        Intrinsics.checkNotNullParameter(exam, "exam");
        Intrinsics.checkNotNullParameter(zone, "zone");
        Instant ofEpochMilli = Instant.ofEpochMilli(exam.getStartMillis());
        ZonedDateTime atZone = ofEpochMilli.atZone(zone);
        ZonedDateTime atZone2 = ofEpochMilli.atZone(Timetable.INSTANCE.getZONE());
        if (Intrinsics.areEqual(atZone.getOffset(), atZone2.getOffset())) {
            return null;
        }
        int compareTo = atZone.toLocalDate().compareTo((ChronoLocalDate) atZone2.toLocalDate());
        if (compareTo < 0) {
            str = " (the day before)";
        } else if (compareTo > 0) {
            str = " (the next day)";
        } else {
            str = "";
        }
        return TIME.format(atZone) + str;
    }

    public final String relativeDay(LocalDate date, long j) {
        Intrinsics.checkNotNullParameter(date, "date");
        long epochDay = date.toEpochDay() - SeasonCalculator.INSTANCE.todayInIndia(j).toEpochDay();
        if (epochDay == 0) {
            return "Today";
        }
        int i = (epochDay > 1L ? 1 : (epochDay == 1L ? 0 : -1));
        if (i == 0) {
            return "Tomorrow";
        }
        if (i > 0) {
            return "In " + epochDay + " days";
        }
        if (epochDay == -1) {
            return "Yesterday";
        }
        return (-epochDay) + " days ago";
    }
}

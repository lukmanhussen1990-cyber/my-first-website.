package com.imran.examcountdown.core;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.NoSuchElementException;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.comparisons.ComparisonsKt;
import kotlin.jvm.internal.Intrinsics;

public final class Timetable {
    public static final int CORE_MINUTES = 180;
    private static final List<Exam> DEFAULT;
    private static final List<Integer> DURATION_CHOICES;
    public static final String DURATION_NOTE = "The timetable gives 3 hours for core subjects and 1½ hours for non-core subjects, but doesn't say which subjects are core. The app never guesses an end time: set a duration in Settings once it's confirmed.";
    public static final Timetable INSTANCE;
    public static final int NON_CORE_MINUTES = 90;
    private static final LocalTime SESSION_END;
    public static final String SESSION_NOTE = "Class VIII session: 12:30 PM – 3:30 PM (India time).";
    private static final LocalTime START_TIME;
    private static final ZoneId ZONE;

    public static Comparable $r8$lambda$HxXt2hjRnph_lyuokMx_azUn0VA(Exam exam) {
        return sorted$lambda$1(exam);
    }

    public static Comparable m8$r8$lambda$sl2FnVefr1SjvyQqWy_M05q1bg(Exam exam) {
        return sorted$lambda$0(exam);
    }

    private Timetable() {
    }

    static {
        Timetable timetable = new Timetable();
        INSTANCE = timetable;
        ZoneId of = ZoneId.of("Asia/Kolkata");
        Intrinsics.checkNotNullExpressionValue(of, "of(...)");
        ZONE = of;
        LocalTime of2 = LocalTime.of(12, 30);
        Intrinsics.checkNotNullExpressionValue(of2, "of(...)");
        START_TIME = of2;
        LocalTime of3 = LocalTime.of(15, 30);
        Intrinsics.checkNotNullExpressionValue(of3, "of(...)");
        SESSION_END = of3;
        DEFAULT = CollectionsKt.listOf(new Exam[]{timetable.exam(Subject.MIL, 2026, 9, 28), timetable.exam(Subject.ENGLISH_1, 2026, 9, 30), timetable.exam(Subject.SOCIAL_SCIENCE, 2026, 10, 3), timetable.exam(Subject.GENERAL_SCIENCE, 2026, 10, 5), timetable.exam(Subject.GENERAL_MATHEMATICS, 2026, 10, 7), timetable.exam(Subject.ENGLISH_2, 2026, 10, 8), timetable.exam(Subject.MORAL_SCIENCE, 2026, 10, 10), timetable.exam(Subject.ELECTIVE, 2026, 10, 12)});
        DURATION_CHOICES = CollectionsKt.listOf(new Integer[]{null, 60, 90, 120, 150, Integer.valueOf((int) CORE_MINUTES)});
    }

    public final ZoneId getZONE() {
        return ZONE;
    }

    public final LocalTime getSTART_TIME() {
        return START_TIME;
    }

    public final LocalTime getSESSION_END() {
        return SESSION_END;
    }

    public final List<Exam> getDEFAULT() {
        return DEFAULT;
    }

    public final List<Integer> getDURATION_CHOICES() {
        return DURATION_CHOICES;
    }

    private static final Comparable sorted$lambda$0(Exam it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return Long.valueOf(it.getStartMillis());
    }

    private static final Comparable sorted$lambda$1(Exam it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return Integer.valueOf(it.getSubject().ordinal());
    }

    public final List<Exam> sorted(List<Exam> exams) {
        Intrinsics.checkNotNullParameter(exams, "exams");
        return CollectionsKt.sortedWith(exams, ComparisonsKt.compareBy(new Timetable$$ExternalSyntheticLambda0(), new Timetable$$ExternalSyntheticLambda1()));
    }

    public final Exam m9default(Subject subject) {
        Intrinsics.checkNotNullParameter(subject, "subject");
        for (Exam exam : DEFAULT) {
            if (exam.getSubject() == subject) {
                return exam;
            }
        }
        throw new NoSuchElementException("Collection contains no element matching the predicate.");
    }

    public final String durationLabel(Integer num) {
        if (num == null) {
            return "Not confirmed";
        }
        if (num.intValue() == 90) {
            return "1½ hours (non-core)";
        }
        if (num.intValue() == 180) {
            return "3 hours (core)";
        }
        int intValue = num.intValue() / 60;
        int intValue2 = num.intValue() % 60;
        if (intValue == 0) {
            return intValue2 + " min";
        }
        if (intValue2 == 0) {
            return intValue == 1 ? "1 hour" : intValue + " hours";
        } else if (intValue2 != 30) {
            return intValue + " h " + intValue2 + " min";
        } else {
            return intValue + "½ hours";
        }
    }

    private final Exam exam(Subject subject, int i, int i2, int i3) {
        LocalDate of = LocalDate.of(i, i2, i3);
        Intrinsics.checkNotNullExpressionValue(of, "of(...)");
        return new Exam(subject, of, START_TIME, null, 8, null);
    }
}

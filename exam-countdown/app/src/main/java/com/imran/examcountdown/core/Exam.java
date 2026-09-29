package com.imran.examcountdown.core;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;

public final class Exam {
    private final LocalDate date;
    private final Integer durationMinutes;
    private final LocalTime start;
    private final Subject subject;

    public class WhenMappings {
        public static final int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[Subject.values().length];
            try {
                iArr[Subject.MIL.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[Subject.ELECTIVE.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    public static Exam copy$default(Exam exam, Subject subject, LocalDate localDate, LocalTime localTime, Integer num, int i, Object obj) {
        if ((i & 1) != 0) {
            subject = exam.subject;
        }
        if ((i & 2) != 0) {
            localDate = exam.date;
        }
        if ((i & 4) != 0) {
            localTime = exam.start;
        }
        if ((i & 8) != 0) {
            num = exam.durationMinutes;
        }
        return exam.copy(subject, localDate, localTime, num);
    }

    public final Subject component1() {
        return this.subject;
    }

    public final LocalDate component2() {
        return this.date;
    }

    public final LocalTime component3() {
        return this.start;
    }

    public final Integer component4() {
        return this.durationMinutes;
    }

    public final Exam copy(Subject subject, LocalDate date, LocalTime start, Integer num) {
        Intrinsics.checkNotNullParameter(subject, "subject");
        Intrinsics.checkNotNullParameter(date, "date");
        Intrinsics.checkNotNullParameter(start, "start");
        return new Exam(subject, date, start, num);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof Exam) {
            Exam exam = (Exam) obj;
            return this.subject == exam.subject && Intrinsics.areEqual(this.date, exam.date) && Intrinsics.areEqual(this.start, exam.start) && Intrinsics.areEqual(this.durationMinutes, exam.durationMinutes);
        }
        return false;
    }

    public int hashCode() {
        int hashCode = ((((this.subject.hashCode() * 31) + this.date.hashCode()) * 31) + this.start.hashCode()) * 31;
        Integer num = this.durationMinutes;
        return hashCode + (num == null ? 0 : num.hashCode());
    }

    public String toString() {
        return "Exam(subject=" + this.subject + ", date=" + this.date + ", start=" + this.start + ", durationMinutes=" + this.durationMinutes + ')';
    }

    public Exam(Subject subject, LocalDate date, LocalTime start, Integer num) {
        Intrinsics.checkNotNullParameter(subject, "subject");
        Intrinsics.checkNotNullParameter(date, "date");
        Intrinsics.checkNotNullParameter(start, "start");
        this.subject = subject;
        this.date = date;
        this.start = start;
        this.durationMinutes = num;
    }

    public Exam(Subject subject, LocalDate localDate, LocalTime localTime, Integer num, int i, DefaultConstructorMarker defaultConstructorMarker) {
        this(subject, localDate, localTime, (i & 8) != 0 ? null : num);
    }

    public final Subject getSubject() {
        return this.subject;
    }

    public final LocalDate getDate() {
        return this.date;
    }

    public final LocalTime getStart() {
        return this.start;
    }

    public final Integer getDurationMinutes() {
        return this.durationMinutes;
    }

    public final long getStartMillis() {
        return ZonedDateTime.of(this.date, this.start, Timetable.INSTANCE.getZONE()).toInstant().toEpochMilli();
    }

    public final Long getConfirmedEndMillis() {
        Integer num = this.durationMinutes;
        if (num != null) {
            return Long.valueOf(getStartMillis() + (num.intValue() * ModelKt.MINUTE));
        }
        return null;
    }

    public final long getDayEndMillis() {
        return this.date.plusDays(1L).atStartOfDay(Timetable.INSTANCE.getZONE()).toInstant().toEpochMilli();
    }

    public final String getKey() {
        return this.subject.name() + '@' + getStartMillis();
    }

    public final String title(Choices choices) {
        String sb;
        String sb2;
        Intrinsics.checkNotNullParameter(choices, "choices");
        int i = WhenMappings.$EnumSwitchMapping$0[this.subject.ordinal()];
        if (i == 1) {
            MilLanguage mil = choices.getMil();
            return (mil == null || (sb = new StringBuilder("MIL (").append(mil.getLabel()).append(')').toString()) == null) ? this.subject.getOfficialName() : sb;
        } else if (i == 2) {
            Elective elective = choices.getElective();
            return (elective == null || (sb2 = new StringBuilder("Elective (").append(elective.getLabel()).append(')').toString()) == null) ? this.subject.getOfficialName() : sb2;
        } else {
            return this.subject.getOfficialName();
        }
    }

    public final String headline(Choices choices) {
        String label;
        String label2;
        Intrinsics.checkNotNullParameter(choices, "choices");
        int i = WhenMappings.$EnumSwitchMapping$0[this.subject.ordinal()];
        if (i == 1) {
            MilLanguage mil = choices.getMil();
            return (mil == null || (label = mil.getLabel()) == null) ? "MIL" : label;
        } else if (i == 2) {
            Elective elective = choices.getElective();
            return (elective == null || (label2 = elective.getLabel()) == null) ? "Elective" : label2;
        } else {
            return this.subject.getOfficialName();
        }
    }

    public final String kicker(Choices choices) {
        Intrinsics.checkNotNullParameter(choices, "choices");
        int i = WhenMappings.$EnumSwitchMapping$0[this.subject.ordinal()];
        if (i == 1) {
            return choices.getMil() != null ? "MIL" : "Bengali / Hindi";
        } else if (i != 2) {
            return null;
        } else {
            return choices.getElective() != null ? "Elective" : "Adv. Maths / Comp. Sci. / Arabic";
        }
    }
}

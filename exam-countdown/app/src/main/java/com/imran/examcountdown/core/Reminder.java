package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class Reminder {
    private final Exam exam;
    private final long expiresAt;
    private final long fireAt;
    private final ReminderKind kind;

    public static Reminder copy$default(Reminder reminder, Exam exam, ReminderKind reminderKind, long j, long j2, int i, Object obj) {
        if ((i & 1) != 0) {
            exam = reminder.exam;
        }
        if ((i & 2) != 0) {
            reminderKind = reminder.kind;
        }
        ReminderKind reminderKind2 = reminderKind;
        if ((i & 4) != 0) {
            j = reminder.fireAt;
        }
        long j3 = j;
        if ((i & 8) != 0) {
            j2 = reminder.expiresAt;
        }
        return reminder.copy(exam, reminderKind2, j3, j2);
    }

    public final Exam component1() {
        return this.exam;
    }

    public final ReminderKind component2() {
        return this.kind;
    }

    public final long component3() {
        return this.fireAt;
    }

    public final long component4() {
        return this.expiresAt;
    }

    public final Reminder copy(Exam exam, ReminderKind kind, long j, long j2) {
        Intrinsics.checkNotNullParameter(exam, "exam");
        Intrinsics.checkNotNullParameter(kind, "kind");
        return new Reminder(exam, kind, j, j2);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof Reminder) {
            Reminder reminder = (Reminder) obj;
            return Intrinsics.areEqual(this.exam, reminder.exam) && this.kind == reminder.kind && this.fireAt == reminder.fireAt && this.expiresAt == reminder.expiresAt;
        }
        return false;
    }

    public int hashCode() {
        return (((((this.exam.hashCode() * 31) + this.kind.hashCode()) * 31) + Long.hashCode(this.fireAt)) * 31) + Long.hashCode(this.expiresAt);
    }

    public String toString() {
        return "Reminder(exam=" + this.exam + ", kind=" + this.kind + ", fireAt=" + this.fireAt + ", expiresAt=" + this.expiresAt + ')';
    }

    public Reminder(Exam exam, ReminderKind kind, long j, long j2) {
        Intrinsics.checkNotNullParameter(exam, "exam");
        Intrinsics.checkNotNullParameter(kind, "kind");
        this.exam = exam;
        this.kind = kind;
        this.fireAt = j;
        this.expiresAt = j2;
    }

    public final Exam getExam() {
        return this.exam;
    }

    public final ReminderKind getKind() {
        return this.kind;
    }

    public final long getFireAt() {
        return this.fireAt;
    }

    public final long getExpiresAt() {
        return this.expiresAt;
    }

    public final String getKey() {
        return this.kind.name() + ':' + this.exam.getKey();
    }
}

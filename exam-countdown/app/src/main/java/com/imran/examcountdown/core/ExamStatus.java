package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;

public final class ExamStatus {
    private final DoneReason doneReason;
    private final Exam exam;
    private final boolean isToday;
    private final Phase phase;

    public static ExamStatus copy$default(ExamStatus examStatus, Exam exam, Phase phase, boolean z, DoneReason doneReason, int i, Object obj) {
        if ((i & 1) != 0) {
            exam = examStatus.exam;
        }
        if ((i & 2) != 0) {
            phase = examStatus.phase;
        }
        if ((i & 4) != 0) {
            z = examStatus.isToday;
        }
        if ((i & 8) != 0) {
            doneReason = examStatus.doneReason;
        }
        return examStatus.copy(exam, phase, z, doneReason);
    }

    public final Exam component1() {
        return this.exam;
    }

    public final Phase component2() {
        return this.phase;
    }

    public final boolean component3() {
        return this.isToday;
    }

    public final DoneReason component4() {
        return this.doneReason;
    }

    public final ExamStatus copy(Exam exam, Phase phase, boolean z, DoneReason doneReason) {
        Intrinsics.checkNotNullParameter(exam, "exam");
        Intrinsics.checkNotNullParameter(phase, "phase");
        return new ExamStatus(exam, phase, z, doneReason);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof ExamStatus) {
            ExamStatus examStatus = (ExamStatus) obj;
            return Intrinsics.areEqual(this.exam, examStatus.exam) && this.phase == examStatus.phase && this.isToday == examStatus.isToday && this.doneReason == examStatus.doneReason;
        }
        return false;
    }

    public int hashCode() {
        int hashCode = ((((this.exam.hashCode() * 31) + this.phase.hashCode()) * 31) + Boolean.hashCode(this.isToday)) * 31;
        DoneReason doneReason = this.doneReason;
        return hashCode + (doneReason == null ? 0 : doneReason.hashCode());
    }

    public String toString() {
        return "ExamStatus(exam=" + this.exam + ", phase=" + this.phase + ", isToday=" + this.isToday + ", doneReason=" + this.doneReason + ')';
    }

    public ExamStatus(Exam exam, Phase phase, boolean z, DoneReason doneReason) {
        Intrinsics.checkNotNullParameter(exam, "exam");
        Intrinsics.checkNotNullParameter(phase, "phase");
        this.exam = exam;
        this.phase = phase;
        this.isToday = z;
        this.doneReason = doneReason;
    }

    public ExamStatus(Exam exam, Phase phase, boolean z, DoneReason doneReason, int i, DefaultConstructorMarker defaultConstructorMarker) {
        this(exam, phase, z, (i & 8) != 0 ? null : doneReason);
    }

    public final Exam getExam() {
        return this.exam;
    }

    public final Phase getPhase() {
        return this.phase;
    }

    public final boolean isToday() {
        return this.isToday;
    }

    public final DoneReason getDoneReason() {
        return this.doneReason;
    }

    public final long getStartMillis() {
        return this.exam.getStartMillis();
    }
}

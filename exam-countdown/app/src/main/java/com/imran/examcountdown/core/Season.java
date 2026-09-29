package com.imran.examcountdown.core;

import java.util.Collection;
import java.util.List;
import java.util.ListIterator;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class Season {
    private final List<ExamStatus> exams;
    private final ExamStatus live;
    private final ExamStatus next;
    private final long now;

    public static Season copy$default(Season season, long j, List list, ExamStatus examStatus, ExamStatus examStatus2, int i, Object obj) {
        if ((i & 1) != 0) {
            j = season.now;
        }
        long j2 = j;
        List<ExamStatus> list2 = list;
        if ((i & 2) != 0) {
            list2 = season.exams;
        }
        List list3 = list2;
        if ((i & 4) != 0) {
            examStatus = season.live;
        }
        ExamStatus examStatus3 = examStatus;
        if ((i & 8) != 0) {
            examStatus2 = season.next;
        }
        return season.copy(j2, list3, examStatus3, examStatus2);
    }

    public final long component1() {
        return this.now;
    }

    public final List<ExamStatus> component2() {
        return this.exams;
    }

    public final ExamStatus component3() {
        return this.live;
    }

    public final ExamStatus component4() {
        return this.next;
    }

    public final Season copy(long j, List<ExamStatus> exams, ExamStatus examStatus, ExamStatus examStatus2) {
        Intrinsics.checkNotNullParameter(exams, "exams");
        return new Season(j, exams, examStatus, examStatus2);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof Season) {
            Season season = (Season) obj;
            return this.now == season.now && Intrinsics.areEqual(this.exams, season.exams) && Intrinsics.areEqual(this.live, season.live) && Intrinsics.areEqual(this.next, season.next);
        }
        return false;
    }

    public int hashCode() {
        int hashCode = ((Long.hashCode(this.now) * 31) + this.exams.hashCode()) * 31;
        ExamStatus examStatus = this.live;
        int hashCode2 = (hashCode + (examStatus == null ? 0 : examStatus.hashCode())) * 31;
        ExamStatus examStatus2 = this.next;
        return hashCode2 + (examStatus2 != null ? examStatus2.hashCode() : 0);
    }

    public String toString() {
        return "Season(now=" + this.now + ", exams=" + this.exams + ", live=" + this.live + ", next=" + this.next + ')';
    }

    public Season(long j, List<ExamStatus> exams, ExamStatus examStatus, ExamStatus examStatus2) {
        Intrinsics.checkNotNullParameter(exams, "exams");
        this.now = j;
        this.exams = exams;
        this.live = examStatus;
        this.next = examStatus2;
    }

    public final long getNow() {
        return this.now;
    }

    public final List<ExamStatus> getExams() {
        return this.exams;
    }

    public final ExamStatus getLive() {
        return this.live;
    }

    public final ExamStatus getNext() {
        return this.next;
    }

    public final int getTotal() {
        return this.exams.size();
    }

    public final int getCompleted() {
        List<ExamStatus> list = this.exams;
        int i = 0;
        if (!(list instanceof Collection) || !list.isEmpty()) {
            for (ExamStatus examStatus : list) {
                if (examStatus.getPhase() == Phase.DONE && (i = i + 1) < 0) {
                    CollectionsKt.throwCountOverflow();
                }
            }
        }
        return i;
    }

    public final float getProgress() {
        if (getTotal() == 0) {
            return 0.0f;
        }
        return getCompleted() / (float) getTotal();
    }

    public final boolean isOver() {
        return getTotal() > 0 && getCompleted() == getTotal();
    }

    public final boolean isFinalLive() {
        return this.live != null && this.next == null;
    }

    public final boolean getNextIsFinal() {
        ExamStatus examStatus = this.next;
        return examStatus != null && Intrinsics.areEqual(examStatus, CollectionsKt.last((List<? extends Object>) this.exams));
    }

    public final ExamStatus getFinishedToday() {
        ExamStatus examStatus;
        List<ExamStatus> list = this.exams;
        ListIterator<ExamStatus> listIterator = list.listIterator(list.size());
        while (true) {
            if (!listIterator.hasPrevious()) {
                examStatus = null;
                break;
            }
            examStatus = listIterator.previous();
            ExamStatus examStatus2 = examStatus;
            if (examStatus2.getPhase() == Phase.DONE && examStatus2.isToday() && this.live == null) {
                break;
            }
        }
        return examStatus;
    }

    public final float ringFraction() {
        ExamStatus examStatus = this.next;
        if (examStatus == null) {
            return (isOver() || this.live != null) ? 1.0f : 0.0f;
        }
        ExamStatus examStatus2 = (ExamStatus) CollectionsKt.getOrNull(this.exams, this.exams.indexOf(examStatus) - 1);
        long startMillis = examStatus2 != null ? examStatus2.getStartMillis() : examStatus.getStartMillis() - 604800000;
        return RangesKt.coerceIn(((float) (this.now - startMillis)) / ((float) RangesKt.coerceAtLeast(examStatus.getStartMillis() - startMillis, 1L)), 0.0f, 1.0f);
    }
}

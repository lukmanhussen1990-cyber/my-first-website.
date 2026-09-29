package com.imran.examcountdown.core;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;
import java.util.ListIterator;
import java.util.Set;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.collections.SetsKt;
import kotlin.jvm.internal.Intrinsics;

public final class SeasonCalculator {
    public static final SeasonCalculator INSTANCE = new SeasonCalculator();

    private SeasonCalculator() {
    }

    public static Season compute$default(SeasonCalculator seasonCalculator, List list, long j, Set set, int i, Object obj) {
        if ((i & 4) != 0) {
            set = SetsKt.emptySet();
        }
        return seasonCalculator.compute(list, j, set);
    }

    public final Season compute(List<Exam> exams, long j, Set<String> markedDone) {
        ExamStatus examStatus;
        Object obj;
        boolean z;
        Intrinsics.checkNotNullParameter(exams, "exams");
        Intrinsics.checkNotNullParameter(markedDone, "markedDone");
        LocalDate localDate = todayInIndia(j);
        List<Exam> sorted = Timetable.INSTANCE.sorted(exams);
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(sorted, 10));
        for (Exam exam : sorted) {
            arrayList.add(INSTANCE.status(exam, j, localDate, markedDone));
        }
        ArrayList arrayList2 = arrayList;
        ArrayList arrayList3 = new ArrayList(CollectionsKt.collectionSizeOrDefault(arrayList2, 10));
        int i = 0;
        for (Object obj2 : arrayList2) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            ExamStatus examStatus2 = (ExamStatus) obj2;
            List<ExamStatus> drop = CollectionsKt.drop(arrayList2, i2);
            z = false;
            if (!(drop instanceof Collection) || !drop.isEmpty()) {
                for (ExamStatus examStatus3 : drop) {
                    if (examStatus3.getPhase() != Phase.UPCOMING) {
                        z = true;
                        break;
                    }
                }
            }
            if (examStatus2.getPhase() == Phase.LIVE && z) {
                examStatus2 = ExamStatus.copy$default(examStatus2, null, Phase.DONE, false, DoneReason.NEXT_STARTED, 5, null);
            }
            arrayList3.add(examStatus2);
            i = i2;
        }
        ArrayList arrayList4 = arrayList3;
        ListIterator listIterator = arrayList4.listIterator(arrayList4.size());
        while (true) {
            examStatus = null;
            if (!listIterator.hasPrevious()) {
                obj = null;
                break;
            }
            obj = listIterator.previous();
            if (((ExamStatus) obj).getPhase() == Phase.LIVE) {
                break;
            }
        }
        ExamStatus examStatus4 = (ExamStatus) obj;
        Iterator it = arrayList4.iterator();
        while (true) {
            if (!it.hasNext()) {
                break;
            }
            Object next = it.next();
            if (((ExamStatus) next).getPhase() == Phase.UPCOMING) {
                examStatus = (ExamStatus) next;
                break;
            }
        }
        return new Season(j, arrayList4, examStatus4, examStatus);
    }

    public final ExamStatus status(Exam exam, long j, LocalDate today, Set<String> markedDone) {
        Intrinsics.checkNotNullParameter(exam, "exam");
        Intrinsics.checkNotNullParameter(today, "today");
        Intrinsics.checkNotNullParameter(markedDone, "markedDone");
        boolean areEqual = Intrinsics.areEqual(exam.getDate(), today);
        if (j < exam.getStartMillis()) {
            return new ExamStatus(exam, Phase.UPCOMING, areEqual, null, 8, null);
        }
        if (markedDone.contains(exam.getKey())) {
            return new ExamStatus(exam, Phase.DONE, areEqual, DoneReason.MARKED_DONE);
        }
        Long confirmedEndMillis = exam.getConfirmedEndMillis();
        if (confirmedEndMillis == null || j < confirmedEndMillis.longValue()) {
            if (confirmedEndMillis != null) {
                return new ExamStatus(exam, Phase.LIVE, areEqual, null, 8, null);
            }
            return j >= exam.getDayEndMillis() ? new ExamStatus(exam, Phase.DONE, areEqual, DoneReason.DATE_PASSED) : new ExamStatus(exam, Phase.LIVE, areEqual, null, 8, null);
        }
        return new ExamStatus(exam, Phase.DONE, areEqual, DoneReason.DURATION_ENDED);
    }

    public final Long nextChange(List<Exam> exams, long j) {
        Intrinsics.checkNotNullParameter(exams, "exams");
        List mutableListOf = CollectionsKt.mutableListOf(Long.valueOf(nextMidnightInIndia(j)));
        for (Exam exam : exams) {
            List list = mutableListOf;
            list.add(Long.valueOf(exam.getStartMillis()));
            list.add(Long.valueOf(exam.getDayEndMillis()));
            Long confirmedEndMillis = exam.getConfirmedEndMillis();
            if (confirmedEndMillis != null) {
                list.add(Long.valueOf(confirmedEndMillis.longValue()));
            }
        }
        ArrayList arrayList = new ArrayList();
        for (Object obj : mutableListOf) {
            if (((Number) obj).longValue() > j) {
                arrayList.add(obj);
            }
        }
        return (Long) CollectionsKt.minOrNull((Iterable<? extends Comparable>) arrayList);
    }

    public final LocalDate todayInIndia(long j) {
        LocalDate localDate = Instant.ofEpochMilli(j).atZone(Timetable.INSTANCE.getZONE()).toLocalDate();
        Intrinsics.checkNotNullExpressionValue(localDate, "toLocalDate(...)");
        return localDate;
    }

    public final long nextMidnightInIndia(long j) {
        return todayInIndia(j).plusDays(1L).atStartOfDay(Timetable.INSTANCE.getZONE()).toInstant().toEpochMilli();
    }
}

package com.imran.examcountdown.core;

import java.time.LocalDate;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.Intrinsics;

public final class Messages {
    public static final Messages INSTANCE = new Messages();
    private static final List<String> GENERAL = CollectionsKt.listOf(new String[]{"One chapter at a time. You’ve got this.", "Small steps every day add up to big results.", "Revise, rest, repeat. A steady rhythm beats cramming.", "Progress, not perfection.", "You’ve prepared more than you think.", "Focus on today’s topic. Tomorrow can wait.", "Short breaks help revision stick.", "Every page you revise is a step forward.", "A good night’s sleep helps you remember what you learned.", "Stay calm, stay curious, keep going."});

    private Messages() {
    }

    public final List<String> getGENERAL() {
        return GENERAL;
    }

    public static String pick$default(Messages messages, Season season, Choices choices, int i, int i2, Object obj) {
        if ((i2 & 4) != 0) {
            i = 0;
        }
        return messages.pick(season, choices, i);
    }

    public final String pick(Season season, Choices choices, int i) {
        String special;
        Intrinsics.checkNotNullParameter(season, "season");
        Intrinsics.checkNotNullParameter(choices, "choices");
        if (i != 0 || (special = special(season, choices)) == null) {
            List<String> list = GENERAL;
            long size = list.size();
            long now = (season.getNow() / 10800000) % size;
            int size2 = list.size();
            int i2 = (((int) (now + (size & (((now ^ size) & ((-now) | now)) >> 63)))) + i) % size2;
            return list.get(i2 + (size2 & (((i2 ^ size2) & ((-i2) | i2)) >> 31)));
        }
        return special;
    }

    private final String special(Season season, Choices choices) {
        ExamStatus next = season.getNext();
        LocalDate plusDays = SeasonCalculator.INSTANCE.todayInIndia(season.getNow()).plusDays(1L);
        ExamStatus finishedToday = season.getFinishedToday();
        if (season.isOver()) {
            return "Time to relax — you’ve earned it.";
        }
        if (season.isFinalLive()) {
            return "Last paper! Read every question carefully and finish strong.";
        }
        if (season.getLive() != null) {
            return "Read each question calmly. You’ve got this!";
        }
        if (next != null) {
            if (next.isToday()) {
                return "Exam day! Eat well, reach early and read every question carefully.";
            }
            if (finishedToday != null) {
                return season.getCompleted() + " done, " + (season.getTotal() - season.getCompleted()) + " to go. Rest a little, then look over " + next.getExam().headline(choices) + '.';
            }
            if (Intrinsics.areEqual(next.getExam().getDate(), plusDays)) {
                return next.getExam().headline(choices) + " is tomorrow. Revise lightly and get a good night’s sleep.";
            }
            if (season.getNextIsFinal()) {
                return "Just one to go. Finish strong!";
            }
        }
        return null;
    }
}

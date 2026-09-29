package com.imran.examcountdown.core;

import java.util.List;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.Intrinsics;

public final class Checklists {
    public static final Checklists INSTANCE = new Checklists();

    public class WhenMappings {
        public static final int[] $EnumSwitchMapping$0;
        public static final int[] $EnumSwitchMapping$1;

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
            try {
                iArr[Subject.ENGLISH_1.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            try {
                iArr[Subject.ENGLISH_2.ordinal()] = 4;
            } catch (NoSuchFieldError unused4) {
            }
            try {
                iArr[Subject.SOCIAL_SCIENCE.ordinal()] = 5;
            } catch (NoSuchFieldError unused5) {
            }
            try {
                iArr[Subject.GENERAL_SCIENCE.ordinal()] = 6;
            } catch (NoSuchFieldError unused6) {
            }
            try {
                iArr[Subject.GENERAL_MATHEMATICS.ordinal()] = 7;
            } catch (NoSuchFieldError unused7) {
            }
            try {
                iArr[Subject.MORAL_SCIENCE.ordinal()] = 8;
            } catch (NoSuchFieldError unused8) {
            }
            $EnumSwitchMapping$0 = iArr;
            int[] iArr2 = new int[Elective.values().length];
            try {
                iArr2[Elective.ADVANCED_MATHEMATICS.ordinal()] = 1;
            } catch (NoSuchFieldError unused9) {
            }
            try {
                iArr2[Elective.COMPUTER_SCIENCE.ordinal()] = 2;
            } catch (NoSuchFieldError unused10) {
            }
            try {
                iArr2[Elective.ARABIC.ordinal()] = 3;
            } catch (NoSuchFieldError unused11) {
            }
            $EnumSwitchMapping$1 = iArr2;
        }
    }

    private Checklists() {
    }

    public final String key(Subject subject, Choices choices) {
        String name;
        String name2;
        Intrinsics.checkNotNullParameter(subject, "subject");
        Intrinsics.checkNotNullParameter(choices, "choices");
        int i = WhenMappings.$EnumSwitchMapping$0[subject.ordinal()];
        String str = "ANY";
        if (i == 1) {
            StringBuilder sb = new StringBuilder("MIL:");
            MilLanguage mil = choices.getMil();
            if (mil != null && (name = mil.name()) != null) {
                str = name;
            }
            return sb.append(str).toString();
        } else if (i == 2) {
            StringBuilder sb2 = new StringBuilder("ELECTIVE:");
            Elective elective = choices.getElective();
            if (elective != null && (name2 = elective.name()) != null) {
                str = name2;
            }
            return sb2.append(str).toString();
        } else {
            return subject.name();
        }
    }

    public final List<String> defaults(Subject subject, Choices choices) {
        Intrinsics.checkNotNullParameter(subject, "subject");
        Intrinsics.checkNotNullParameter(choices, "choices");
        switch (WhenMappings.$EnumSwitchMapping$0[subject.ordinal()]) {
            case 1:
                return CollectionsKt.listOf(new String[]{"Read through every lesson and poem", "Revise grammar", "Practise an essay and a letter", "Learn word meanings and spellings", "Solve one sample paper"});
            case 2:
                Elective elective = choices.getElective();
                int i = elective == null ? -1 : WhenMappings.$EnumSwitchMapping$1[elective.ordinal()];
                if (i != -1) {
                    if (i != 1) {
                        if (i != 2) {
                            if (i != 3) {
                                throw new NoWhenBranchMatchedException();
                            }
                            return CollectionsKt.listOf(new String[]{"Revise vocabulary", "Practise reading and writing", "Revise grammar", "Solve one sample paper"});
                        }
                        return CollectionsKt.listOf(new String[]{"Revise definitions and key terms", "Practise writing programs step by step", "Solve one sample paper"});
                    }
                    return CollectionsKt.listOf(new String[]{"Revise formulas and theorems", "Practise problems from each chapter", "Solve one sample paper"});
                }
                return CollectionsKt.listOf(new String[]{"Go through class notes", "Solve one sample paper"});
            case 3:
            case 4:
                return CollectionsKt.listOf(new String[]{"Go through class notes", "Revise grammar", "Practise writing answers neatly", "Learn new words and spellings", "Solve one sample paper"});
            case 5:
                return CollectionsKt.listOf(new String[]{"Revise History chapters", "Revise Geography and practise maps", "Revise Civics / Political Science", "Learn important dates and terms", "Solve one sample paper"});
            case 6:
                return CollectionsKt.listOf(new String[]{"Revise Physics chapters", "Revise Chemistry chapters", "Revise Biology chapters", "Practise labelled diagrams", "Learn key definitions"});
            case 7:
                return CollectionsKt.listOf(new String[]{"Write out all the formulas", "Practise textbook exercises", "Redo the solved examples", "Solve one sample paper", "Check your common mistakes"});
            case 8:
                return CollectionsKt.listOf(new String[]{"Read every lesson", "Note the key values and morals", "Practise short answers"});
            default:
                throw new NoWhenBranchMatchedException();
        }
    }
}

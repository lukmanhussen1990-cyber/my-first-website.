package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;

public final class Choices {
    private final Elective elective;
    private final MilLanguage mil;

    public Choices() {
        this(null, null, 3, null);
    }

    public static Choices copy$default(Choices choices, MilLanguage milLanguage, Elective elective, int i, Object obj) {
        if ((i & 1) != 0) {
            milLanguage = choices.mil;
        }
        if ((i & 2) != 0) {
            elective = choices.elective;
        }
        return choices.copy(milLanguage, elective);
    }

    public final MilLanguage component1() {
        return this.mil;
    }

    public final Elective component2() {
        return this.elective;
    }

    public final Choices copy(MilLanguage milLanguage, Elective elective) {
        return new Choices(milLanguage, elective);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof Choices) {
            Choices choices = (Choices) obj;
            return this.mil == choices.mil && this.elective == choices.elective;
        }
        return false;
    }

    public int hashCode() {
        MilLanguage milLanguage = this.mil;
        int hashCode = (milLanguage == null ? 0 : milLanguage.hashCode()) * 31;
        Elective elective = this.elective;
        return hashCode + (elective != null ? elective.hashCode() : 0);
    }

    public String toString() {
        return "Choices(mil=" + this.mil + ", elective=" + this.elective + ')';
    }

    public Choices(MilLanguage milLanguage, Elective elective) {
        this.mil = milLanguage;
        this.elective = elective;
    }

    public Choices(MilLanguage milLanguage, Elective elective, int i, DefaultConstructorMarker defaultConstructorMarker) {
        this((i & 1) != 0 ? null : milLanguage, (i & 2) != 0 ? null : elective);
    }

    public final Elective getElective() {
        return this.elective;
    }

    public final MilLanguage getMil() {
        return this.mil;
    }

    public final boolean getComplete() {
        return (this.mil == null || this.elective == null) ? false : true;
    }
}

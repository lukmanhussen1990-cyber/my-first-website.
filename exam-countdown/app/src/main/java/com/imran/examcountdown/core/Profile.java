package com.imran.examcountdown.core;

import java.util.ArrayList;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.Regex;
import kotlin.text.StringsKt;

public final class Profile {
    private final String className;
    private final String examination;
    private final String hall;
    private final String name;
    private final String roll;
    private final String school;

    public static CharSequence $r8$lambda$hC0ah0qFbKyUE8rOdR58IhMzPBg(String str) {
        return _get_initials_$lambda$1(str);
    }

    public Profile() {
        this(null, null, null, null, null, null, 63, null);
    }

    public static Profile copy$default(Profile profile, String str, String str2, String str3, String str4, String str5, String str6, int i, Object obj) {
        if ((i & 1) != 0) {
            str = profile.name;
        }
        if ((i & 2) != 0) {
            str2 = profile.school;
        }
        String str7 = str2;
        if ((i & 4) != 0) {
            str3 = profile.className;
        }
        String str8 = str3;
        if ((i & 8) != 0) {
            str4 = profile.roll;
        }
        String str9 = str4;
        if ((i & 16) != 0) {
            str5 = profile.hall;
        }
        String str10 = str5;
        if ((i & 32) != 0) {
            str6 = profile.examination;
        }
        return profile.copy(str, str7, str8, str9, str10, str6);
    }

    public final String component1() {
        return this.name;
    }

    public final String component2() {
        return this.school;
    }

    public final String component3() {
        return this.className;
    }

    public final String component4() {
        return this.roll;
    }

    public final String component5() {
        return this.hall;
    }

    public final String component6() {
        return this.examination;
    }

    public final Profile copy(String name, String school, String className, String roll, String hall, String examination) {
        Intrinsics.checkNotNullParameter(name, "name");
        Intrinsics.checkNotNullParameter(school, "school");
        Intrinsics.checkNotNullParameter(className, "className");
        Intrinsics.checkNotNullParameter(roll, "roll");
        Intrinsics.checkNotNullParameter(hall, "hall");
        Intrinsics.checkNotNullParameter(examination, "examination");
        return new Profile(name, school, className, roll, hall, examination);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof Profile) {
            Profile profile = (Profile) obj;
            return Intrinsics.areEqual(this.name, profile.name) && Intrinsics.areEqual(this.school, profile.school) && Intrinsics.areEqual(this.className, profile.className) && Intrinsics.areEqual(this.roll, profile.roll) && Intrinsics.areEqual(this.hall, profile.hall) && Intrinsics.areEqual(this.examination, profile.examination);
        }
        return false;
    }

    public int hashCode() {
        return (((((((((this.name.hashCode() * 31) + this.school.hashCode()) * 31) + this.className.hashCode()) * 31) + this.roll.hashCode()) * 31) + this.hall.hashCode()) * 31) + this.examination.hashCode();
    }

    public String toString() {
        return "Profile(name=" + this.name + ", school=" + this.school + ", className=" + this.className + ", roll=" + this.roll + ", hall=" + this.hall + ", examination=" + this.examination + ')';
    }

    public Profile(String name, String school, String className, String roll, String hall, String examination) {
        Intrinsics.checkNotNullParameter(name, "name");
        Intrinsics.checkNotNullParameter(school, "school");
        Intrinsics.checkNotNullParameter(className, "className");
        Intrinsics.checkNotNullParameter(roll, "roll");
        Intrinsics.checkNotNullParameter(hall, "hall");
        Intrinsics.checkNotNullParameter(examination, "examination");
        this.name = name;
        this.school = school;
        this.className = className;
        this.roll = roll;
        this.hall = hall;
        this.examination = examination;
    }

    public Profile(String str, String str2, String str3, String str4, String str5, String str6, int i, DefaultConstructorMarker defaultConstructorMarker) {
        this((i & 1) != 0 ? "Imran Hussain" : str, (i & 2) != 0 ? "Al-Ameen Academy, Badarpur" : str2, (i & 4) != 0 ? "VIII Blue" : str3, (i & 8) != 0 ? "47" : str4, (i & 16) != 0 ? "24" : str5, (i & 32) != 0 ? "Half-Yearly 2026–2027" : str6);
    }

    public final String getName() {
        return this.name;
    }

    public final String getSchool() {
        return this.school;
    }

    public final String getClassName() {
        return this.className;
    }

    public final String getRoll() {
        return this.roll;
    }

    public final String getHall() {
        return this.hall;
    }

    public final String getExamination() {
        return this.examination;
    }

    private final List<String> getWords() {
        Regex regex = new Regex("\\s+");
        ArrayList arrayList = new ArrayList();
        for (Object obj : regex.split(StringsKt.trim((CharSequence) this.name).toString(), 0)) {
            if (((String) obj).length() > 0) {
                arrayList.add(obj);
            }
        }
        return arrayList;
    }

    public final String getFirstName() {
        String str = (String) CollectionsKt.firstOrNull((List<? extends Object>) getWords());
        return str == null ? "" : str;
    }

    private static final CharSequence _get_initials_$lambda$1(String it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return String.valueOf(Character.toUpperCase(StringsKt.first(it)));
    }

    public final String getInitials() {
        String joinToString$default = CollectionsKt.joinToString(CollectionsKt.take(getWords(), 2), "", "", "", -1, "...", new Profile$$ExternalSyntheticLambda0());
        if (joinToString$default.length() == 0) {
            joinToString$default = "?";
        }
        return joinToString$default;
    }
}

package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;

public final class CheckItem {
    private final boolean done;
    private final long id;
    private final String text;

    public static CheckItem copy$default(CheckItem checkItem, long j, String str, boolean z, int i, Object obj) {
        if ((i & 1) != 0) {
            j = checkItem.id;
        }
        if ((i & 2) != 0) {
            str = checkItem.text;
        }
        if ((i & 4) != 0) {
            z = checkItem.done;
        }
        return checkItem.copy(j, str, z);
    }

    public final long component1() {
        return this.id;
    }

    public final String component2() {
        return this.text;
    }

    public final boolean component3() {
        return this.done;
    }

    public final CheckItem copy(long j, String text, boolean z) {
        Intrinsics.checkNotNullParameter(text, "text");
        return new CheckItem(j, text, z);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof CheckItem) {
            CheckItem checkItem = (CheckItem) obj;
            return this.id == checkItem.id && Intrinsics.areEqual(this.text, checkItem.text) && this.done == checkItem.done;
        }
        return false;
    }

    public int hashCode() {
        return (((Long.hashCode(this.id) * 31) + this.text.hashCode()) * 31) + Boolean.hashCode(this.done);
    }

    public String toString() {
        return "CheckItem(id=" + this.id + ", text=" + this.text + ", done=" + this.done + ')';
    }

    public CheckItem(long j, String text, boolean z) {
        Intrinsics.checkNotNullParameter(text, "text");
        this.id = j;
        this.text = text;
        this.done = z;
    }

    public CheckItem(long j, String str, boolean z, int i, DefaultConstructorMarker defaultConstructorMarker) {
        this(j, str, (i & 4) != 0 ? false : z);
    }

    public final boolean getDone() {
        return this.done;
    }

    public final long getId() {
        return this.id;
    }

    public final String getText() {
        return this.text;
    }
}

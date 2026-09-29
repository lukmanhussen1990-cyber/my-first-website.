package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;

public final class ReminderSettings {
    private final long armedAt;
    private final boolean dayBefore;
    private final boolean enabled;
    private final boolean focusAlerts;
    private final boolean hourBefore;

    public ReminderSettings() {
        this(false, false, false, false, 0L, 31, null);
    }

    public static ReminderSettings copy$default(ReminderSettings reminderSettings, boolean z, boolean z2, boolean z3, boolean z4, long j, int i, Object obj) {
        if ((i & 1) != 0) {
            z = reminderSettings.enabled;
        }
        if ((i & 2) != 0) {
            z2 = reminderSettings.dayBefore;
        }
        boolean z5 = z2;
        if ((i & 4) != 0) {
            z3 = reminderSettings.hourBefore;
        }
        boolean z6 = z3;
        if ((i & 8) != 0) {
            z4 = reminderSettings.focusAlerts;
        }
        boolean z7 = z4;
        if ((i & 16) != 0) {
            j = reminderSettings.armedAt;
        }
        return reminderSettings.copy(z, z5, z6, z7, j);
    }

    public final boolean component1() {
        return this.enabled;
    }

    public final boolean component2() {
        return this.dayBefore;
    }

    public final boolean component3() {
        return this.hourBefore;
    }

    public final boolean component4() {
        return this.focusAlerts;
    }

    public final long component5() {
        return this.armedAt;
    }

    public final ReminderSettings copy(boolean z, boolean z2, boolean z3, boolean z4, long j) {
        return new ReminderSettings(z, z2, z3, z4, j);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof ReminderSettings) {
            ReminderSettings reminderSettings = (ReminderSettings) obj;
            return this.enabled == reminderSettings.enabled && this.dayBefore == reminderSettings.dayBefore && this.hourBefore == reminderSettings.hourBefore && this.focusAlerts == reminderSettings.focusAlerts && this.armedAt == reminderSettings.armedAt;
        }
        return false;
    }

    public int hashCode() {
        return (((((((Boolean.hashCode(this.enabled) * 31) + Boolean.hashCode(this.dayBefore)) * 31) + Boolean.hashCode(this.hourBefore)) * 31) + Boolean.hashCode(this.focusAlerts)) * 31) + Long.hashCode(this.armedAt);
    }

    public String toString() {
        return "ReminderSettings(enabled=" + this.enabled + ", dayBefore=" + this.dayBefore + ", hourBefore=" + this.hourBefore + ", focusAlerts=" + this.focusAlerts + ", armedAt=" + this.armedAt + ')';
    }

    public ReminderSettings(boolean z, boolean z2, boolean z3, boolean z4, long j) {
        this.enabled = z;
        this.dayBefore = z2;
        this.hourBefore = z3;
        this.focusAlerts = z4;
        this.armedAt = j;
    }

    public ReminderSettings(boolean z, boolean z2, boolean z3, boolean z4, long j, int i, DefaultConstructorMarker defaultConstructorMarker) {
        this((i & 1) != 0 ? false : z, (i & 2) != 0 ? true : z2, (i & 4) == 0 ? z3 : true, (i & 8) == 0 ? z4 : false, (i & 16) != 0 ? 0L : j);
    }

    public final boolean getEnabled() {
        return this.enabled;
    }

    public final boolean getDayBefore() {
        return this.dayBefore;
    }

    public final boolean getHourBefore() {
        return this.hourBefore;
    }

    public final boolean getFocusAlerts() {
        return this.focusAlerts;
    }

    public final long getArmedAt() {
        return this.armedAt;
    }
}

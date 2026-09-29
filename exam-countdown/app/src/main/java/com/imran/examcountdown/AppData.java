package com.imran.examcountdown;

import com.imran.examcountdown.core.AvatarFrame;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.MotionPref;
import com.imran.examcountdown.core.Profile;
import com.imran.examcountdown.core.ReminderSettings;
import java.util.List;
import java.util.Set;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class AppData {
    private final AvatarFrame avatarFrame;
    private final Choices choices;
    private final List<Exam> exams;
    private final boolean frameAnimated;
    private final Set<String> markedDone;
    private final MotionPref motion;
    private final Profile profile;
    private final ReminderSettings reminders;

    public static AppData copy$default(AppData appData, Profile profile, Choices choices, List list, Set set, ReminderSettings reminderSettings, MotionPref motionPref, AvatarFrame avatarFrame, boolean z, int i, Object obj) {
        return appData.copy((i & 1) != 0 ? appData.profile : profile, (i & 2) != 0 ? appData.choices : choices, (i & 4) != 0 ? appData.exams : list, (i & 8) != 0 ? appData.markedDone : set, (i & 16) != 0 ? appData.reminders : reminderSettings, (i & 32) != 0 ? appData.motion : motionPref, (i & 64) != 0 ? appData.avatarFrame : avatarFrame, (i & 128) != 0 ? appData.frameAnimated : z);
    }

    public final Profile component1() {
        return this.profile;
    }

    public final Choices component2() {
        return this.choices;
    }

    public final List<Exam> component3() {
        return this.exams;
    }

    public final Set<String> component4() {
        return this.markedDone;
    }

    public final ReminderSettings component5() {
        return this.reminders;
    }

    public final MotionPref component6() {
        return this.motion;
    }

    public final AvatarFrame component7() {
        return this.avatarFrame;
    }

    public final boolean component8() {
        return this.frameAnimated;
    }

    public final AppData copy(Profile profile, Choices choices, List<Exam> exams, Set<String> markedDone, ReminderSettings reminders, MotionPref motion, AvatarFrame avatarFrame, boolean z) {
        Intrinsics.checkNotNullParameter(profile, "profile");
        Intrinsics.checkNotNullParameter(choices, "choices");
        Intrinsics.checkNotNullParameter(exams, "exams");
        Intrinsics.checkNotNullParameter(markedDone, "markedDone");
        Intrinsics.checkNotNullParameter(reminders, "reminders");
        Intrinsics.checkNotNullParameter(motion, "motion");
        Intrinsics.checkNotNullParameter(avatarFrame, "avatarFrame");
        return new AppData(profile, choices, exams, markedDone, reminders, motion, avatarFrame, z);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof AppData) {
            AppData appData = (AppData) obj;
            return Intrinsics.areEqual(this.profile, appData.profile) && Intrinsics.areEqual(this.choices, appData.choices) && Intrinsics.areEqual(this.exams, appData.exams) && Intrinsics.areEqual(this.markedDone, appData.markedDone) && Intrinsics.areEqual(this.reminders, appData.reminders) && this.motion == appData.motion && this.avatarFrame == appData.avatarFrame && this.frameAnimated == appData.frameAnimated;
        }
        return false;
    }

    public int hashCode() {
        return (((((((((((((this.profile.hashCode() * 31) + this.choices.hashCode()) * 31) + this.exams.hashCode()) * 31) + this.markedDone.hashCode()) * 31) + this.reminders.hashCode()) * 31) + this.motion.hashCode()) * 31) + this.avatarFrame.hashCode()) * 31) + Boolean.hashCode(this.frameAnimated);
    }

    public String toString() {
        return "AppData(profile=" + this.profile + ", choices=" + this.choices + ", exams=" + this.exams + ", markedDone=" + this.markedDone + ", reminders=" + this.reminders + ", motion=" + this.motion + ", avatarFrame=" + this.avatarFrame + ", frameAnimated=" + this.frameAnimated + ')';
    }

    public AppData(Profile profile, Choices choices, List<Exam> exams, Set<String> markedDone, ReminderSettings reminders, MotionPref motion, AvatarFrame avatarFrame, boolean z) {
        Intrinsics.checkNotNullParameter(profile, "profile");
        Intrinsics.checkNotNullParameter(choices, "choices");
        Intrinsics.checkNotNullParameter(exams, "exams");
        Intrinsics.checkNotNullParameter(markedDone, "markedDone");
        Intrinsics.checkNotNullParameter(reminders, "reminders");
        Intrinsics.checkNotNullParameter(motion, "motion");
        Intrinsics.checkNotNullParameter(avatarFrame, "avatarFrame");
        this.profile = profile;
        this.choices = choices;
        this.exams = exams;
        this.markedDone = markedDone;
        this.reminders = reminders;
        this.motion = motion;
        this.avatarFrame = avatarFrame;
        this.frameAnimated = z;
    }

    public final Profile getProfile() {
        return this.profile;
    }

    public final Choices getChoices() {
        return this.choices;
    }

    public final List<Exam> getExams() {
        return this.exams;
    }

    public final Set<String> getMarkedDone() {
        return this.markedDone;
    }

    public final ReminderSettings getReminders() {
        return this.reminders;
    }

    public final MotionPref getMotion() {
        return this.motion;
    }

    public final AvatarFrame getAvatarFrame() {
        return this.avatarFrame;
    }

    public final boolean getFrameAnimated() {
        return this.frameAnimated;
    }
}

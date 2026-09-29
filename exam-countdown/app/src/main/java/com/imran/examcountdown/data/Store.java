package com.imran.examcountdown.data;

import android.content.Context;
import android.content.SharedPreferences;
import com.imran.examcountdown.core.AvatarFrame;
import com.imran.examcountdown.core.CheckItem;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.Elective;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.FocusMode;
import com.imran.examcountdown.core.FocusState;
import com.imran.examcountdown.core.MilLanguage;
import com.imran.examcountdown.core.MotionPref;
import com.imran.examcountdown.core.Profile;
import com.imran.examcountdown.core.ReminderSettings;
import com.imran.examcountdown.core.Subject;
import com.imran.examcountdown.core.ThemeMode;
import com.imran.examcountdown.core.Timetable;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.collections.IntIterator;
import kotlin.collections.SetsKt;
import kotlin.enums.EnumEntries;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;
import kotlin.text.StringsKt;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class Store {
    public static final Companion Companion = new Companion(null);
    private static final String FILE = "imran_exam_countdown";
    private static final String K_AVATAR = "avatar_version";
    private static final String K_CHECKLIST = "checklist_v1:";
    private static final String K_CLASS = "profile_class";
    private static final String K_DELIVERED = "reminders_delivered";
    private static final String K_ELECTIVE = "choice_elective";
    private static final String K_EXAMINATION = "profile_examination";
    private static final String K_EXAMS = "exams_v1";
    private static final String K_FOCUS = "focus_v1";
    private static final String K_FRAME = "avatar_frame";
    private static final String K_FRAME_ANIMATED = "avatar_frame_animated";
    private static final String K_HALL = "profile_hall";
    private static final String K_HAPTICS = "haptics";
    private static final String K_INTRO = "intro_enabled";
    private static final String K_MARKED_DONE = "marked_done";
    private static final String K_MIL = "choice_mil";
    private static final String K_MOTION = "motion";
    private static final String K_NAME = "profile_name";
    private static final String K_REM_ARMED = "reminders_armed_at";
    private static final String K_REM_DAY = "reminders_day_before";
    private static final String K_REM_FOCUS = "reminders_focus";
    private static final String K_REM_HOUR = "reminders_hour_before";
    private static final String K_REM_ON = "reminders_on";
    private static final String K_ROLL = "profile_roll";
    private static final String K_SCHOOL = "profile_school";
    private static final String K_SETUP = "setup_done";
    private static final String K_THEME = "theme";
    private final SharedPreferences prefs;

    public Store(Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        SharedPreferences sharedPreferences = context.getApplicationContext().getSharedPreferences(FILE, 0);
        Intrinsics.checkNotNullExpressionValue(sharedPreferences, "getSharedPreferences(...)");
        this.prefs = sharedPreferences;
    }

    public final boolean getSetupDone() {
        return this.prefs.getBoolean(K_SETUP, false);
    }

    public final void setSetupDone(boolean z) {
        this.prefs.edit().putBoolean(K_SETUP, z).apply();
    }

    public final Profile getProfile() {
        Profile profile = new Profile(null, null, null, null, null, null, 63, null);
        return new Profile(string(K_NAME, profile.getName()), string(K_SCHOOL, profile.getSchool()), string(K_CLASS, profile.getClassName()), string(K_ROLL, profile.getRoll()), string(K_HALL, profile.getHall()), string(K_EXAMINATION, profile.getExamination()));
    }

    public final void setProfile(Profile p) {
        Intrinsics.checkNotNullParameter(p, "p");
        this.prefs.edit().putString(K_NAME, StringsKt.trim((CharSequence) p.getName()).toString()).putString(K_SCHOOL, StringsKt.trim((CharSequence) p.getSchool()).toString()).putString(K_CLASS, StringsKt.trim((CharSequence) p.getClassName()).toString()).putString(K_ROLL, StringsKt.trim((CharSequence) p.getRoll()).toString()).putString(K_HALL, StringsKt.trim((CharSequence) p.getHall()).toString()).putString(K_EXAMINATION, StringsKt.trim((CharSequence) p.getExamination()).toString()).apply();
    }

    public final Choices getChoices() {
        MilLanguage milLanguage;
        MilLanguage milLanguage2;
        Enum r2 = null;
        String string = this.prefs.getString(K_MIL, null);
        int i = 0;
        if (string == null) {
            milLanguage2 = null;
        } else {
            MilLanguage[] values = MilLanguage.values();
            int length = values.length;
            int i2 = 0;
            while (true) {
                if (i2 >= length) {
                    milLanguage = null;
                    break;
                }
                milLanguage = values[i2];
                if (Intrinsics.areEqual(milLanguage.name(), string)) {
                    break;
                }
                i2++;
            }
            milLanguage2 = milLanguage;
        }
        MilLanguage milLanguage3 = milLanguage2;
        String string2 = this.prefs.getString(K_ELECTIVE, null);
        if (string2 != null) {
            Elective[] values2 = Elective.values();
            int length2 = values2.length;
            while (true) {
                if (i >= length2) {
                    break;
                }
                Elective elective = values2[i];
                if (Intrinsics.areEqual(elective.name(), string2)) {
                    r2 = elective;
                    break;
                }
                i++;
            }
            r2 = r2;
        }
        return new Choices(milLanguage3, (Elective) r2);
    }

    public final void setChoices(Choices c) {
        Intrinsics.checkNotNullParameter(c, "c");
        SharedPreferences.Editor edit = this.prefs.edit();
        MilLanguage mil = c.getMil();
        SharedPreferences.Editor putString = edit.putString(K_MIL, mil != null ? mil.name() : null);
        Elective elective = c.getElective();
        putString.putString(K_ELECTIVE, elective != null ? elective.name() : null).apply();
    }

    public final List<Exam> getExams() {
        return Companion.decodeExams(this.prefs.getString(K_EXAMS, null));
    }

    public final void setExams(List<Exam> value) {
        Intrinsics.checkNotNullParameter(value, "value");
        this.prefs.edit().putString(K_EXAMS, Companion.encodeExams(value)).apply();
    }

    public final Set<String> getMarkedDone() {
        Set<String> stringSet = this.prefs.getStringSet(K_MARKED_DONE, SetsKt.emptySet());
        if (stringSet == null) {
            stringSet = SetsKt.emptySet();
        }
        return new HashSet(stringSet);
    }

    public final void setMarkedDone(Set<String> value) {
        Intrinsics.checkNotNullParameter(value, "value");
        this.prefs.edit().putStringSet(K_MARKED_DONE, new HashSet(value)).apply();
    }

    public final ReminderSettings getReminders() {
        return new ReminderSettings(this.prefs.getBoolean(K_REM_ON, false), this.prefs.getBoolean(K_REM_DAY, true), this.prefs.getBoolean(K_REM_HOUR, true), this.prefs.getBoolean(K_REM_FOCUS, false), this.prefs.getLong(K_REM_ARMED, 0L));
    }

    public final void setReminders(ReminderSettings r) {
        Intrinsics.checkNotNullParameter(r, "r");
        this.prefs.edit().putBoolean(K_REM_ON, r.getEnabled()).putBoolean(K_REM_DAY, r.getDayBefore()).putBoolean(K_REM_HOUR, r.getHourBefore()).putBoolean(K_REM_FOCUS, r.getFocusAlerts()).putLong(K_REM_ARMED, r.getArmedAt()).apply();
    }

    public final Set<String> getDelivered() {
        Set<String> stringSet = this.prefs.getStringSet(K_DELIVERED, SetsKt.emptySet());
        if (stringSet == null) {
            stringSet = SetsKt.emptySet();
        }
        return new HashSet(stringSet);
    }

    public final void setDelivered(Set<String> value) {
        Intrinsics.checkNotNullParameter(value, "value");
        this.prefs.edit().putStringSet(K_DELIVERED, new HashSet(value)).apply();
    }

    public final MotionPref getMotion() {
        Enum r2 = null;
        String string = this.prefs.getString(K_MOTION, null);
        if (string != null) {
            MotionPref[] values = MotionPref.values();
            int length = values.length;
            int i = 0;
            while (true) {
                if (i >= length) {
                    break;
                }
                MotionPref motionPref = values[i];
                if (Intrinsics.areEqual(motionPref.name(), string)) {
                    r2 = motionPref;
                    break;
                }
                i++;
            }
            r2 = r2;
        }
        MotionPref motionPref2 = (MotionPref) r2;
        return motionPref2 == null ? MotionPref.SYSTEM : motionPref2;
    }

    public final void setMotion(MotionPref value) {
        Intrinsics.checkNotNullParameter(value, "value");
        this.prefs.edit().putString(K_MOTION, value.name()).apply();
    }

    public final FocusState getFocus() {
        return Companion.decodeFocus(this.prefs.getString(K_FOCUS, null));
    }

    public final void setFocus(FocusState value) {
        Intrinsics.checkNotNullParameter(value, "value");
        this.prefs.edit().putString(K_FOCUS, Companion.encodeFocus(value)).apply();
    }

    public final ThemeMode getTheme() {
        Enum r2 = null;
        String string = this.prefs.getString(K_THEME, null);
        if (string != null) {
            ThemeMode[] values = ThemeMode.values();
            int length = values.length;
            int i = 0;
            while (true) {
                if (i >= length) {
                    break;
                }
                ThemeMode themeMode = values[i];
                if (Intrinsics.areEqual(themeMode.name(), string)) {
                    r2 = themeMode;
                    break;
                }
                i++;
            }
            r2 = r2;
        }
        ThemeMode themeMode2 = (ThemeMode) r2;
        return themeMode2 == null ? ThemeMode.SYSTEM : themeMode2;
    }

    public final void setTheme(ThemeMode value) {
        Intrinsics.checkNotNullParameter(value, "value");
        this.prefs.edit().putString(K_THEME, value.name()).apply();
    }

    public final boolean getIntroEnabled() {
        return this.prefs.getBoolean(K_INTRO, true);
    }

    public final void setIntroEnabled(boolean z) {
        this.prefs.edit().putBoolean(K_INTRO, z).apply();
    }

    public final boolean getHaptics() {
        return this.prefs.getBoolean(K_HAPTICS, true);
    }

    public final void setHaptics(boolean z) {
        this.prefs.edit().putBoolean(K_HAPTICS, z).apply();
    }

    public final long getAvatarVersion() {
        return this.prefs.getLong(K_AVATAR, 0L);
    }

    public final void setAvatarVersion(long j) {
        this.prefs.edit().putLong(K_AVATAR, j).apply();
    }

    public final AvatarFrame getAvatarFrame() {
        Enum r2 = null;
        String string = this.prefs.getString(K_FRAME, null);
        if (string != null) {
            AvatarFrame[] values = AvatarFrame.values();
            int length = values.length;
            int i = 0;
            while (true) {
                if (i >= length) {
                    break;
                }
                AvatarFrame avatarFrame = values[i];
                if (Intrinsics.areEqual(avatarFrame.name(), string)) {
                    r2 = avatarFrame;
                    break;
                }
                i++;
            }
            r2 = r2;
        }
        AvatarFrame avatarFrame2 = (AvatarFrame) r2;
        return avatarFrame2 == null ? AvatarFrame.DEFAULT : avatarFrame2;
    }

    public final void setAvatarFrame(AvatarFrame value) {
        Intrinsics.checkNotNullParameter(value, "value");
        this.prefs.edit().putString(K_FRAME, value.name()).apply();
    }

    public final boolean getFrameAnimated() {
        return this.prefs.getBoolean(K_FRAME_ANIMATED, true);
    }

    public final void setFrameAnimated(boolean z) {
        this.prefs.edit().putBoolean(K_FRAME_ANIMATED, z).apply();
    }

    public final List<CheckItem> checklist(String key, List<String> defaults) {
        Intrinsics.checkNotNullParameter(key, "key");
        Intrinsics.checkNotNullParameter(defaults, "defaults");
        String string = this.prefs.getString(K_CHECKLIST + key, null);
        if (string == null) {
            List<String> list = defaults;
            ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(list, 10));
            int i = 0;
            for (Object obj : list) {
                int i2 = i + 1;
                if (i < 0) {
                    CollectionsKt.throwIndexOverflow();
                }
                arrayList.add(new CheckItem(i + 1L, (String) obj, false, 4, null));
                i = i2;
            }
            return arrayList;
        }
        return Companion.decodeItems(string);
    }

    public final void saveChecklist(String key, List<CheckItem> items) {
        Intrinsics.checkNotNullParameter(key, "key");
        Intrinsics.checkNotNullParameter(items, "items");
        this.prefs.edit().putString(K_CHECKLIST + key, Companion.encodeItems(items)).apply();
    }

    public final void resetChecklist(String key) {
        Intrinsics.checkNotNullParameter(key, "key");
        this.prefs.edit().remove(K_CHECKLIST + key).apply();
    }

    public final void resetAll() {
        this.prefs.edit().clear().commit();
    }

    private final String string(String str, String str2) {
        String string = this.prefs.getString(str, null);
        return string == null ? str2 : string;
    }

    public static final class Companion {
        public Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }

        public final String encodeExams(List<Exam> list) {
            Intrinsics.checkNotNullParameter(list, "list");
            JSONArray jSONArray = new JSONArray();
            for (Exam exam : list) {
                JSONObject put = new JSONObject().put("subject", exam.getSubject().name()).put("date", exam.getDate().toString()).put("start", exam.getStart().toString());
                Object durationMinutes = exam.getDurationMinutes();
                if (durationMinutes == null) {
                    durationMinutes = JSONObject.NULL;
                }
                jSONArray.put(put.put("minutes", durationMinutes));
            }
            String jSONArray2 = jSONArray.toString();
            Intrinsics.checkNotNullExpressionValue(jSONArray2, "toString(...)");
            return jSONArray2;
        }

        public final List<Exam> decodeExams(String str) {
            Subject subject;
            Subject subject2;
            if (str == null) {
                return Timetable.INSTANCE.getDEFAULT();
            }
            HashMap hashMap = new HashMap();
            try {
                JSONArray jSONArray = new JSONArray(str);
                int length = jSONArray.length();
                for (int i = 0; i < length; i++) {
                    JSONObject optJSONObject = jSONArray.optJSONObject(i);
                    if (optJSONObject != null) {
                        String optString = optJSONObject.optString("subject");
                        Integer num = null;
                        if (optString == null) {
                            subject2 = null;
                        } else {
                            Subject[] values = Subject.values();
                            int length2 = values.length;
                            int i2 = 0;
                            while (true) {
                                if (i2 >= length2) {
                                    subject = null;
                                    break;
                                }
                                subject = values[i2];
                                if (Intrinsics.areEqual(subject.name(), optString)) {
                                    break;
                                }
                                i2++;
                            }
                            subject2 = subject;
                        }
                        Subject subject3 = subject2;
                        if (subject3 != null) {
                            try {
                                HashMap hashMap2 = hashMap;
                                LocalDate parse = LocalDate.parse(optJSONObject.getString("date"));
                                Intrinsics.checkNotNullExpressionValue(parse, "parse(...)");
                                LocalTime parse2 = LocalTime.parse(optJSONObject.getString("start"));
                                Intrinsics.checkNotNullExpressionValue(parse2, "parse(...)");
                                if (!optJSONObject.isNull("minutes")) {
                                    num = Integer.valueOf(optJSONObject.getInt("minutes"));
                                }
                                hashMap2.put(subject3, new Exam(subject3, parse, parse2, num));
                            } catch (DateTimeParseException unused) {
                            }
                        }
                    }
                }
                EnumEntries<Subject> entries = Subject.getEntries();
                ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(entries, 10));
                for (Subject subject4 : entries) {
                    Exam exam = (Exam) hashMap.get(subject4);
                    if (exam == null) {
                        exam = Timetable.INSTANCE.m9default(subject4);
                    }
                    arrayList.add(exam);
                }
                return arrayList;
            } catch (JSONException unused2) {
                return Timetable.INSTANCE.getDEFAULT();
            }
        }

        public final String encodeFocus(FocusState s) {
            Object obj;
            Intrinsics.checkNotNullParameter(s, "s");
            JSONObject put = new JSONObject().put("mode", s.getMode().name()).put("running", s.getRunning()).put("endWall", s.getEndWall()).put("endElapsed", s.getEndElapsed()).put("boot", s.getBoot()).put("remaining", s.getRemaining());
            FocusMode finished = s.getFinished();
            if (finished == null || (obj = finished.name()) == null) {
                obj = JSONObject.NULL;
            }
            String jSONObject = put.put("finished", obj).put("sessionsToday", s.getSessionsToday()).put("sessionsDay", s.getSessionsDay()).toString();
            Intrinsics.checkNotNullExpressionValue(jSONObject, "toString(...)");
            return jSONObject;
        }

        public final FocusState decodeFocus(String str) {
            FocusMode focusMode;
            FocusMode focusMode2;
            if (str == null) {
                return new FocusState(null, false, 0L, 0L, 0, 0L, null, 0, 0L, 511, null);
            }
            try {
                JSONObject jSONObject = new JSONObject(str);
                String optString = jSONObject.optString("mode");
                FocusMode obj = null;
                if (optString == null) {
                    focusMode2 = null;
                } else {
                    FocusMode[] values = FocusMode.values();
                    int length = values.length;
                    int i = 0;
                    while (true) {
                        if (i >= length) {
                            focusMode = null;
                            break;
                        }
                        focusMode = values[i];
                        if (Intrinsics.areEqual(focusMode.name(), optString)) {
                            break;
                        }
                        i++;
                    }
                    focusMode2 = focusMode;
                }
                FocusMode focusMode3 = focusMode2;
                if (focusMode3 == null) {
                    focusMode3 = FocusMode.FOCUS;
                }
                FocusMode focusMode4 = focusMode3;
                boolean optBoolean = jSONObject.optBoolean("running", false);
                long optLong = jSONObject.optLong("endWall", 0L);
                long optLong2 = jSONObject.optLong("endElapsed", 0L);
                int optInt = jSONObject.optInt("boot", -1);
                long coerceIn = RangesKt.coerceIn(jSONObject.optLong("remaining", focusMode4.getDurationMs()), 0L, focusMode4.getDurationMs());
                if (!jSONObject.isNull("finished")) {
                    String optString2 = jSONObject.optString("finished");
                    if (optString2 != null) {
                        FocusMode[] values2 = FocusMode.values();
                        int length2 = values2.length;
                        int i2 = 0;
                        while (true) {
                            if (i2 >= length2) {
                                break;
                            }
                            FocusMode obj2 = values2[i2];
                            if (Intrinsics.areEqual(obj2.name(), optString2)) {
                                obj = obj2;
                                break;
                            }
                            i2++;
                        }
                    }
                }
                return new FocusState(focusMode4, optBoolean, optLong, optLong2, optInt, coerceIn, obj, jSONObject.optInt("sessionsToday", 0), jSONObject.optLong("sessionsDay", -1L));
            } catch (JSONException unused) {
                return new FocusState(null, false, 0L, 0L, 0, 0L, null, 0, 0L, 511, null);
            }
        }

        public final String encodeItems(List<CheckItem> items) {
            Intrinsics.checkNotNullParameter(items, "items");
            JSONArray jSONArray = new JSONArray();
            for (CheckItem checkItem : items) {
                jSONArray.put(new JSONObject().put("id", checkItem.getId()).put("text", checkItem.getText()).put("done", checkItem.getDone()));
            }
            String jSONArray2 = jSONArray.toString();
            Intrinsics.checkNotNullExpressionValue(jSONArray2, "toString(...)");
            return jSONArray2;
        }

        public final List<CheckItem> decodeItems(String json) {
            CheckItem checkItem;
            Intrinsics.checkNotNullParameter(json, "json");
            try {
                JSONArray jSONArray = new JSONArray(json);
                ArrayList arrayList = new ArrayList();
                Iterator<Integer> it = RangesKt.until(0, jSONArray.length()).iterator();
                while (it.hasNext()) {
                    JSONObject optJSONObject = jSONArray.optJSONObject(((IntIterator) it).nextInt());
                    if (optJSONObject != null) {
                        long optLong = optJSONObject.optLong("id");
                        String optString = optJSONObject.optString("text");
                        Intrinsics.checkNotNullExpressionValue(optString, "optString(...)");
                        checkItem = new CheckItem(optLong, optString, optJSONObject.optBoolean("done"));
                    } else {
                        checkItem = null;
                    }
                    if (checkItem != null) {
                        arrayList.add(checkItem);
                    }
                }
                return arrayList;
            } catch (JSONException unused) {
                return CollectionsKt.emptyList();
            }
        }

        private final <T extends Enum<T>> T enumOrNull(String str) {
            if (str != null) {
                Intrinsics.reifiedOperationMarker(5, "T");
                Enum[] enumArr = new Enum[0];
            }
            return null;
        }
    }
}

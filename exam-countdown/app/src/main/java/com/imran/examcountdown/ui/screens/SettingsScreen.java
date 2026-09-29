package com.imran.examcountdown.ui.screens;

import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.content.Context;
import android.view.View;
import android.widget.DatePicker;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.TimePicker;
import com.imran.examcountdown.AppData;
import com.imran.examcountdown.MainActivity;
import com.imran.examcountdown.R;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.Elective;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.Formats;
import com.imran.examcountdown.core.MilLanguage;
import com.imran.examcountdown.core.ModelKt;
import com.imran.examcountdown.core.MotionPref;
import com.imran.examcountdown.core.Profile;
import com.imran.examcountdown.core.ReminderSettings;
import com.imran.examcountdown.core.Subject;
import com.imran.examcountdown.core.ThemeMode;
import com.imran.examcountdown.core.Timetable;
import com.imran.examcountdown.notify.Notifier;
import com.imran.examcountdown.ui.Dialogs;
import com.imran.examcountdown.ui.Fonts;
import com.imran.examcountdown.ui.MotionPolicy;
import com.imran.examcountdown.ui.Shapes;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import com.imran.examcountdown.ui.widgets.AvatarView;
import com.imran.examcountdown.ui.widgets.ButtonStyle;
import com.imran.examcountdown.ui.widgets.ControlsKt;
import com.imran.examcountdown.ui.widgets.SegmentedControl;
import com.imran.examcountdown.ui.widgets.ToggleView;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.collections.IntIterator;
import kotlin.enums.EnumEntries;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.IntRange;
import kotlin.ranges.RangesKt;
import kotlin.text.StringsKt;

public final class SettingsScreen extends Screen {
    private final AvatarView avatar;
    private long avatarVersion;
    private final LinearLayout content;
    private final ToggleView dayToggle;
    private final SegmentedControl electiveControl;
    private final ToggleView focusToggle;
    private final ToggleView hapticsToggle;
    private final ToggleView hourToggle;
    private final ToggleView introToggle;
    private final SegmentedControl milControl;
    private final SegmentedControl motionControl;
    private final TextView motionNote;
    private final TextView openSettingsButton;
    private final TextView permissionNote;
    private final TextView profileName;
    private final HashMap<String, TextView> profileValues;
    private final ToggleView remindersToggle;
    private final LinearLayout scheduleList;
    private final ScrollView scroll;
    private final LinearLayout subToggles;
    private final SegmentedControl themeControl;
    private final TextView versionText;

    public static Unit m44$r8$lambda$JeIWWdjcHBkfne7mIwhvM1VQJU(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$54(settingsScreen, layoutParams);
    }

    public static Unit m45$r8$lambda$0hjvuVE5aiOy4cSCWuvjXIY87A(Function0 function0, View view) {
        return editExam$lambda$94$lambda$93(function0, view);
    }

    public static Unit m46$r8$lambda$1TOauukNdSyO7m133WnWAXg8ew(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return profileField$lambda$72$lambda$70(linearLayout, layoutParams);
    }

    public static Unit m47$r8$lambda$1Vdeqnld5QrfwOqIYAtXfS5c(MainActivity mainActivity, View view) {
        return _init_$lambda$60(mainActivity, view);
    }

    public static Unit $r8$lambda$1puK9CXCB8AZ3CqRVxbUt2_E5Nw(MainActivity mainActivity, SettingsScreen settingsScreen, boolean z) {
        return _init_$lambda$36(mainActivity, settingsScreen, z);
    }

    public static Unit $r8$lambda$3Qj5RrhlCPMjSM6PqAd8qKvC_78(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$56(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$3SYaeU445UziGLb06cyA9pBzXwg(SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3) {
        return editExam$lambda$94$lambda$85(settingsScreen, subject, textView, textView2, textView3);
    }

    public static Unit $r8$lambda$3TQTaKYF90mdav83wDQjfM5Oq8M(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$40(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$4L8JNp_9K8_n3gfpVKcnqS9AvY4(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return profileHeader$lambda$67$lambda$65(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$4UgbTyPDO9DLkuByWvN5TLwGffE(TextView textView) {
        return _init_$lambda$21(textView);
    }

    public static Unit m48$r8$lambda$5lx6WniDJeoQhFyXwlXQc7y_Nc(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$44(settingsScreen, layoutParams);
    }

    public static String $r8$lambda$6QJrMWwqc1Y90dv7S55qjRC8dCA(Profile profile) {
        return _init_$lambda$10(profile);
    }

    public static Unit $r8$lambda$6ceYrYy53iK2HSL1zHw0JWBKt8U(MainActivity mainActivity, boolean z) {
        return _init_$lambda$41(mainActivity, z);
    }

    public static String m49$r8$lambda$7PQqooLCWyFoAIggpSdQwCZn9U(Profile profile) {
        return _init_$lambda$11(profile);
    }

    public static Unit $r8$lambda$7mkNmHjp7sv14riRdtOwYlr5VmM(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$25(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$83l0TNBWWeTG72QEEqiUq7ns6zs(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$26(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$9N8cIKJ6qdU45X4wXqcXDo8ybgc(MainActivity mainActivity, View view) {
        return openSettingsButton$lambda$4(mainActivity, view);
    }

    public static Unit $r8$lambda$9SOqq5jZ0EZTWqqCQ2dRSiB8fD0(MainActivity mainActivity, boolean z) {
        return _init_$lambda$48(mainActivity, z);
    }

    public static Unit m50$r8$lambda$AXDcRtfhBIG6i9fpBHUozl7KRM(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$22(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$Agc1NjnBMcFZADg7Fu57lX_wTs8(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$28(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$B7ROFJGQfj2f1VAk_KcSdDI1xIE(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$8(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$Bba_SoWgw5P6Nhq9YmuVJSRll2c(MainActivity mainActivity, SettingsScreen settingsScreen, boolean z) {
        return _init_$lambda$30(mainActivity, settingsScreen, z);
    }

    public static Unit m51$r8$lambda$Bp4KC7m9mdLj9sui5DeO00Vm0s(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return renderSchedule$lambda$81$lambda$80$lambda$77$lambda$76(linearLayout, layoutParams);
    }

    public static Unit m52$r8$lambda$BqvEvA8j_ghEK_LLcZ8VaOQW4(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$15(settingsScreen, layoutParams);
    }

    public static void $r8$lambda$Bu34qedFSQdqTEvu1jnKQJ8sjK8(Exam exam, SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3, TimePicker timePicker, int i, int i2) {
        editExam$lambda$94$lambda$88$lambda$87(exam, settingsScreen, subject, textView, textView2, textView3, timePicker, i, i2);
    }

    public static String $r8$lambda$Bwr0tPCAQbGj8yj2H3HwGoqDeTg(Profile profile) {
        return _init_$lambda$13(profile);
    }

    public static Unit $r8$lambda$Dia7UfnYGwpYQYDo9Dw8SesFfRA(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return renderSchedule$lambda$81$lambda$80$lambda$77$lambda$75$lambda$74(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$Ds4Gs2p3sTVVMZ8kIh11yqiPR4o(SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3) {
        return editExam$lambda$94$lambda$91(settingsScreen, subject, textView, textView2, textView3);
    }

    public static Unit $r8$lambda$DxnaqpjEH1LaCqip7BLVr7TozPM(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$38(settingsScreen, layoutParams);
    }

    public static void $r8$lambda$EYKqfXDirZaupgJP6DwaazK2jIY(SettingsScreen settingsScreen, View view) {
        profileHeader$lambda$67$lambda$66(settingsScreen, view);
    }

    public static void $r8$lambda$Fbw5blCYHcuDcoyjjZpG9bC_cx8(SettingsScreen settingsScreen, Exam exam, View view) {
        renderSchedule$lambda$81$lambda$80$lambda$79(settingsScreen, exam, view);
    }

    public static Unit $r8$lambda$FxfMikOI18RhrzfwehjGbPM9Gvo(MainActivity mainActivity, SettingsScreen settingsScreen, int i) {
        return _init_$lambda$20(mainActivity, settingsScreen, i);
    }

    public static Unit $r8$lambda$FyfZNAPsrJEXKlljyp60YgJRmms(MainActivity mainActivity, SettingsScreen settingsScreen, boolean z) {
        return _init_$lambda$34(mainActivity, settingsScreen, z);
    }

    public static Unit $r8$lambda$GKRuL_yE1eXFqgFAHZnmF55K7l0(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$61(settingsScreen, layoutParams);
    }

    public static Unit m53$r8$lambda$GZyofwprvTOuHdddeOVdiLiDKM(MainActivity mainActivity, int i) {
        return _init_$lambda$39(mainActivity, i);
    }

    public static Unit $r8$lambda$KgAG2zdk7zypkgMXs44KLKcF3mI(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return toggleRow$lambda$107$lambda$105(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$KyHVAy9aLkObxgn19La2hEnrIeI(MainActivity mainActivity, SettingsScreen settingsScreen, int i) {
        return _init_$lambda$19(mainActivity, settingsScreen, i);
    }

    public static Unit $r8$lambda$NX2b7CtXfIgCdam5BcvCIwgkKns(SettingsScreen settingsScreen, Subject subject, LinearLayout linearLayout, Function0 function0) {
        return editExam$lambda$94(settingsScreen, subject, linearLayout, function0);
    }

    public static Unit m54$r8$lambda$OGZOC7S79nkK1nP4nrdIakOhVE(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return profileField$lambda$72$lambda$69$lambda$68(linearLayout, layoutParams);
    }

    public static void $r8$lambda$OKgJkXpdF4jRcsNhwPBkCtMR09M(ToggleView toggleView, View view) {
        toggleRow$lambda$107$lambda$106(toggleView, view);
    }

    public static Unit $r8$lambda$OllU0JnaBGOcrrtROl4uw58nnR4(TextView textView) {
        return _init_$lambda$55(textView);
    }

    public static Unit $r8$lambda$PVQc2gVbuYlDg5l8rlKEYIkc3eg(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$37(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$QKD2j3lJHDa6ZP3kktz8xpJ8GMk(TextView textView) {
        return _init_$lambda$57(textView);
    }

    public static Unit $r8$lambda$QMvn1mVgBli_7JNfS7VokMhauME(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$45(settingsScreen, layoutParams);
    }

    public static void $r8$lambda$RLiq8NJutP7MdQuCILOssvgNze4(SettingsScreen settingsScreen, String str, Function1 function1, View view) {
        profileField$lambda$72$lambda$71(settingsScreen, str, function1, view);
    }

    public static Unit m55$r8$lambda$UiKj9UrRHFhTkF_aR1WnNur7o(MainActivity mainActivity, SettingsScreen settingsScreen, int i) {
        return _init_$lambda$46(mainActivity, settingsScreen, i);
    }

    public static Unit $r8$lambda$UokxeHUbSQtrgZzMj0qtLPmhfnA(Subject subject, SettingsScreen settingsScreen, TextView textView, TextView textView2, TextView textView3, View view) {
        return editExam$lambda$94$lambda$92(subject, settingsScreen, textView, textView2, textView3, view);
    }

    public static Unit $r8$lambda$VAowakahEDMF6ZizfB_hRseTjAw(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return renderSchedule$lambda$81$lambda$80$lambda$78(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$VG82zqdBz6qmjTQxYNrug7WG89g(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return profileHeader$lambda$67$lambda$64$lambda$63(linearLayout, layoutParams);
    }

    public static void $r8$lambda$XrA5bvDba571bhUDuT9RHXcyFwo(Function0 function0, View view) {
        actionRow$lambda$102$lambda$101(function0, view);
    }

    public static Unit m56$r8$lambda$Yu6X7SdBg8wUMJx7Vv2SDyr9Y4(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$58(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$ZJ2YLzW0GnVvEfZCrEOFzo1WLJ4(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$47(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$ZZSEExGNtdVvIFVnjTjruJWFJCg(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return editRow$lambda$99$lambda$97(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$_K3U8K3TToKRfIZ2VfBlZvR37ug(MainActivity mainActivity, SettingsScreen settingsScreen, boolean z) {
        return _init_$lambda$32(mainActivity, settingsScreen, z);
    }

    public static Unit $r8$lambda$_PoAO0b4WlPZM3oo3QA3BePe6gI(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return toggleRow$lambda$107$lambda$104$lambda$103(linearLayout, layoutParams);
    }

    public static Unit m57$r8$lambda$bPB2Th12_NZk5I6Yc779ZZUTto(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return editRow$lambda$99$lambda$96$lambda$95(linearLayout, layoutParams);
    }

    public static Unit m58$r8$lambda$cwUAFMZI3NRZafPfaKaiHA9SII(TextView textView) {
        return permissionNote$lambda$3(textView);
    }

    public static void m59$r8$lambda$dmMsUD6GiN2gwkYbJI8Zb8hsU(Exam exam, SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3, DatePicker datePicker, int i, int i2, int i3) {
        editExam$lambda$94$lambda$85$lambda$84(exam, settingsScreen, subject, textView, textView2, textView3, datePicker, i, i2, i3);
    }

    public static String m60$r8$lambda$fENO7pTuc3VjUMlGtt4MIVtogc(Profile profile) {
        return _init_$lambda$14(profile);
    }

    public static Unit m61$r8$lambda$hAdrtEbCZVgOSKvVePeU59anno(SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3) {
        return editExam$lambda$94$lambda$88(settingsScreen, subject, textView, textView2, textView3);
    }

    public static Unit $r8$lambda$iH93bX6JHZaxnPMecjZGR6z45cI(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$17(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$iyrMCDsMqPXsi_lV0SvYll6KUsY(TextView textView) {
        return motionNote$lambda$7(textView);
    }

    public static Unit $r8$lambda$k3VIrLJ0FDX1SG4ni0tffMZTLgs(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$9(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$k6kvIbH_ZCuXXFpsX26ywSYmlpA(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$18(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$lThGbhuXE1D3neTUG72TQfmXjxQ(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$16(settingsScreen, layoutParams);
    }

    public static Unit m62$r8$lambda$mWsuqUmDqjRzACGP729hlcxiog(Exam exam, List list, SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3, int i) {
        return editExam$lambda$94$lambda$91$lambda$90(exam, list, settingsScreen, subject, textView, textView2, textView3, i);
    }

    public static String m63$r8$lambda$nHfv8eN3NYdcTdCOv02M7xlS1I(Profile profile) {
        return _init_$lambda$12(profile);
    }

    public static void m64$r8$lambda$nqq_95QbXsovHFpNKI7XACy5fs(Function0 function0, View view) {
        editRow$lambda$99$lambda$98(function0, view);
    }

    public static Unit m65$r8$lambda$ofg5_x91VnGIUzvbyZko_MsnwY(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return actionRow$lambda$102$lambda$100(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$pY8WnllpzCtlmZZUAwq0NOEGQ84(MainActivity mainActivity) {
        return _init_$lambda$42(mainActivity);
    }

    public static Unit $r8$lambda$pgXQUPvKrQ5WggoJfUr40tKxJS4(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return section$lambda$62(settingsScreen, layoutParams);
    }

    public static Unit m66$r8$lambda$qxvuZDC4psJljtteZUKB4QArE(SettingsScreen settingsScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$43(settingsScreen, layoutParams);
    }

    public static Unit $r8$lambda$rP1brsIuhIj214iMEhAHtseZvIk(TextView textView) {
        return _init_$lambda$27(textView);
    }

    public static Unit $r8$lambda$s4GsapiYY94LIaIecDf2BQXbj7c(String str, Profile profile, SettingsScreen settingsScreen, String str2) {
        return editField$lambda$73(str, profile, settingsScreen, str2);
    }

    public static Unit $r8$lambda$sjHRD0X8ZiBB4vkqAkS755_qmvA(MainActivity mainActivity, SettingsScreen settingsScreen) {
        return _init_$lambda$24(mainActivity, settingsScreen);
    }

    public static Unit $r8$lambda$xNy1puYDGqiaBXD7o9eg_ygJQGo(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return editExam$lambda$94$lambda$86(linearLayout, layoutParams);
    }

    @Override
    public long nextTickDelay(long j) {
        return ModelKt.MINUTE;
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public SettingsScreen(MainActivity host) {
        super(host);
        Intrinsics.checkNotNullParameter(host, "host");
        ScrollView scrollView = new ScrollView(getCtx());
        scrollView.setVerticalScrollBarEnabled(false);
        scrollView.setOverScrollMode(1);
        this.scroll = scrollView;
        LinearLayout linearLayout = new LinearLayout(getCtx());
        linearLayout.setOrientation(1);
        Unit unit = Unit.INSTANCE;
        this.content = linearLayout;
        this.avatar = new AvatarView(getCtx());
        this.profileName = ThemeKt.text$default(getCtx(), "", 17.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null);
        this.profileValues = new HashMap<>();
        this.avatarVersion = -1L;
        Context ctx = getCtx();
        EnumEntries<MilLanguage> entries = MilLanguage.getEntries();
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(entries, 10));
        for (MilLanguage milLanguage : entries) {
            arrayList.add(milLanguage.getLabel());
        }
        this.milControl = new SegmentedControl(ctx, arrayList);
        Context ctx2 = getCtx();
        EnumEntries<Elective> entries2 = Elective.getEntries();
        ArrayList arrayList2 = new ArrayList(CollectionsKt.collectionSizeOrDefault(entries2, 10));
        for (Elective elective : entries2) {
            arrayList2.add(elective.getShortLabel());
        }
        this.electiveControl = new SegmentedControl(ctx2, arrayList2);
        LinearLayout linearLayout2 = new LinearLayout(getCtx());
        linearLayout2.setOrientation(1);
        Unit unit2 = Unit.INSTANCE;
        this.scheduleList = linearLayout2;
        this.remindersToggle = new ToggleView(getCtx());
        this.dayToggle = new ToggleView(getCtx());
        this.hourToggle = new ToggleView(getCtx());
        this.focusToggle = new ToggleView(getCtx());
        LinearLayout linearLayout3 = new LinearLayout(getCtx());
        linearLayout3.setOrientation(1);
        Unit unit3 = Unit.INSTANCE;
        this.subToggles = linearLayout3;
        this.permissionNote = ThemeKt.text$default(getCtx(), "", 14.0f, Ui.INSTANCE.getC().getDanger(), null, new SettingsScreen$$ExternalSyntheticLambda14(), 8, null);
        this.openSettingsButton = ControlsKt.pillButton(getCtx(), "Open notification settings", Integer.valueOf((int) R.drawable.ic_bell), ButtonStyle.SECONDARY, new SettingsScreen$$ExternalSyntheticLambda25(host));
        Context ctx3 = getCtx();
        EnumEntries<ThemeMode> entries3 = ThemeMode.getEntries();
        ArrayList arrayList3 = new ArrayList(CollectionsKt.collectionSizeOrDefault(entries3, 10));
        for (ThemeMode themeMode : entries3) {
            arrayList3.add(themeMode.getLabel());
        }
        this.themeControl = new SegmentedControl(ctx3, arrayList3);
        this.introToggle = new ToggleView(getCtx());
        Context ctx4 = getCtx();
        EnumEntries<MotionPref> entries4 = MotionPref.getEntries();
        ArrayList arrayList4 = new ArrayList(CollectionsKt.collectionSizeOrDefault(entries4, 10));
        for (MotionPref motionPref : entries4) {
            arrayList4.add(motionPref.getLabel());
        }
        SegmentedControl segmentedControl = new SegmentedControl(ctx4, arrayList4);
        this.motionControl = segmentedControl;
        TextView text$default = ThemeKt.text$default(getCtx(), "", 13.5f, Ui.INSTANCE.getC().getText3(), null, new SettingsScreen$$ExternalSyntheticLambda36(), 8, null);
        this.motionNote = text$default;
        ToggleView toggleView = new ToggleView(getCtx());
        this.hapticsToggle = toggleView;
        TextView text$default2 = ThemeKt.text$default(getCtx(), "", 14.0f, Ui.INSTANCE.getC().getText2(), null, null, 24, null);
        this.versionText = text$default2;
        this.scroll.addView(this.content, new FrameLayout.LayoutParams(-1, -2));
        this.content.addView(ThemeKt.heading$default(getCtx(), "Settings", 30.0f, 0, 4, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda47(this), 7, null));
        this.content.addView(ThemeKt.text$default(getCtx(), "Everything stays on this phone.", 15.0f, Ui.INSTANCE.getC().getText2(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda56(this), 7, null));
        section("Profile");
        this.content.addView(profileHeader());
        this.content.addView(ThemeKt.separator(getCtx()));
        profileField$default(this, "School", R.drawable.ic_school, false, new SettingsScreen$$ExternalSyntheticLambda57(), 4, null);
        profileField$default(this, "Class", R.drawable.ic_study, false, new SettingsScreen$$ExternalSyntheticLambda58(), 4, null);
        profileField$default(this, "Roll number", R.drawable.ic_flag, false, new SettingsScreen$$ExternalSyntheticLambda59(), 4, null);
        profileField$default(this, "Examination hall", R.drawable.ic_hall, false, new SettingsScreen$$ExternalSyntheticLambda60(), 4, null);
        profileField("Examination", R.drawable.ic_calendar, true, new SettingsScreen$$ExternalSyntheticLambda61());
        section("Subjects");
        this.content.addView(ThemeKt.text$default(getCtx(), "MIL paper", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda15(this), 7, null));
        this.content.addView(this.milControl, ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda16(this), 7, null));
        this.content.addView(ThemeKt.text$default(getCtx(), "Elective", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda17(this), 7, null));
        this.content.addView(this.electiveControl, ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda18(this), 7, null));
        this.milControl.setOnSelect(new SettingsScreen$$ExternalSyntheticLambda19(host, this));
        this.electiveControl.setOnSelect(new SettingsScreen$$ExternalSyntheticLambda20(host, this));
        section("Exam schedule");
        this.content.addView(ThemeKt.text$default(getCtx(), "Tap an exam to change its date, start time or duration. The timetable gives 3 hours for core subjects and 1½ hours for non-core subjects, but doesn't say which subjects are core. The app never guesses an end time: set a duration in Settings once it's confirmed.", 14.0f, Ui.INSTANCE.getC().getText3(), null, new SettingsScreen$$ExternalSyntheticLambda21(), 8, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda22(this), 7, null));
        this.content.addView(this.scheduleList);
        this.content.addView(actionRow("Reset to the official timetable", R.drawable.ic_restore, new SettingsScreen$$ExternalSyntheticLambda23(host, this)));
        section("Reminders");
        this.content.addView(toggleRow$default(this, "Exam reminders", "One day and one hour before each exam", this.remindersToggle, false, 8, null));
        this.subToggles.addView(ThemeKt.separator(getCtx()));
        this.subToggles.addView(toggleRow("1 day before", null, this.dayToggle, true));
        this.subToggles.addView(ThemeKt.separator(getCtx()));
        this.subToggles.addView(toggleRow("1 hour before", null, this.hourToggle, true));
        this.content.addView(this.subToggles);
        this.content.addView(ThemeKt.separator(getCtx()));
        this.content.addView(toggleRow$default(this, "Focus timer alerts", "A notification when a session or break ends", this.focusToggle, false, 8, null));
        this.content.addView(this.permissionNote, ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda24(this), 7, null));
        this.content.addView(this.openSettingsButton, ThemeKt.lp$default(-2, -2, 0.0f, new SettingsScreen$$ExternalSyntheticLambda26(this), 4, null));
        this.content.addView(ThemeKt.text$default(getCtx(), "Reminders work offline. To save battery, Android may deliver them a few minutes late.", 13.5f, Ui.INSTANCE.getC().getText3(), null, new SettingsScreen$$ExternalSyntheticLambda27(), 8, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda28(this), 7, null));
        this.remindersToggle.setOnChange(new SettingsScreen$$ExternalSyntheticLambda29(host, this));
        this.dayToggle.setOnChange(new SettingsScreen$$ExternalSyntheticLambda30(host, this));
        this.hourToggle.setOnChange(new SettingsScreen$$ExternalSyntheticLambda31(host, this));
        this.focusToggle.setOnChange(new SettingsScreen$$ExternalSyntheticLambda32(host, this));
        section("Appearance");
        this.content.addView(ThemeKt.text$default(getCtx(), "Theme", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda33(this), 7, null));
        this.content.addView(this.themeControl, ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda34(this), 7, null));
        this.themeControl.setOnSelect(new SettingsScreen$$ExternalSyntheticLambda35(host));
        this.content.addView(toggleRow$default(this, "Opening animation", "The school emblem opening when the app starts", this.introToggle, false, 8, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda37(this), 7, null));
        this.introToggle.setOnChange(new SettingsScreen$$ExternalSyntheticLambda38(host));
        this.content.addView(ThemeKt.separator(getCtx()));
        this.content.addView(actionRow("Replay opening", R.drawable.ic_replay, new SettingsScreen$$ExternalSyntheticLambda39(host)));
        this.content.addView(ThemeKt.separator(getCtx()));
        this.content.addView(ThemeKt.text$default(getCtx(), "Reduce motion", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda40(this), 7, null));
        this.content.addView(segmentedControl, ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda41(this), 7, null));
        this.content.addView(text$default, ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda42(this), 7, null));
        segmentedControl.setOnSelect(new SettingsScreen$$ExternalSyntheticLambda43(host, this));
        this.content.addView(ThemeKt.separator(getCtx()), ThemeKt.lp$default(-1, -2, 0.0f, new SettingsScreen$$ExternalSyntheticLambda44(this), 4, null));
        this.content.addView(toggleRow$default(this, "Haptic feedback", "Subtle vibration on taps and ticks", toggleView, false, 8, null));
        toggleView.setOnChange(new SettingsScreen$$ExternalSyntheticLambda45(host));
        section("About");
        LinearLayout linearLayout4 = this.content;
        LinearLayout linearLayout5 = new LinearLayout(getCtx());
        linearLayout5.setOrientation(0);
        linearLayout5.setGravity(16);
        ImageView imageView = new ImageView(getCtx());
        imageView.setImageResource(R.mipmap.ic_launcher);
        LinearLayout linearLayout6 = linearLayout5;
        linearLayout5.addView(imageView, ThemeKt.lp$default(ThemeKt.dp(linearLayout6, (Number) 48), ThemeKt.dp(linearLayout6, (Number) 48), 0.0f, null, 12, null));
        LinearLayout linearLayout7 = new LinearLayout(getCtx());
        linearLayout7.setOrientation(1);
        Context ctx5 = getCtx();
        String string = getCtx().getString(R.string.app_name);
        Intrinsics.checkNotNullExpressionValue(string, "getString(...)");
        linearLayout7.addView(ThemeKt.text$default(ctx5, string, 16.5f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null));
        linearLayout7.addView(text$default2, ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda46(linearLayout7), 7, null));
        linearLayout5.addView(linearLayout7, ThemeKt.lp(0, -2, 1.0f, new SettingsScreen$$ExternalSyntheticLambda48(linearLayout5)));
        linearLayout4.addView(linearLayout6, ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda49(this), 7, null));
        this.content.addView(ThemeKt.text$default(getCtx(), "Works completely offline: no account, no ads and no internet permission. Your profile, photo, checklists and settings are saved only on this phone.", 14.5f, Ui.INSTANCE.getC().getText2(), null, new SettingsScreen$$ExternalSyntheticLambda50(), 8, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda51(this), 7, null));
        this.content.addView(ThemeKt.text$default(getCtx(), "School emblem © Al-Ameen Academy, Badarpur. Fonts: Source Serif 4 and Source Sans 3 (SIL Open Font License 1.1).", 13.0f, Ui.INSTANCE.getC().getText3(), null, new SettingsScreen$$ExternalSyntheticLambda52(), 8, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda53(this), 7, null));
        this.content.addView(ControlsKt.pillButton(getCtx(), "Reset all data", Integer.valueOf((int) R.drawable.ic_delete), ButtonStyle.DANGER, new SettingsScreen$$ExternalSyntheticLambda54(host)), ThemeKt.lp$default(-2, -2, 0.0f, new SettingsScreen$$ExternalSyntheticLambda55(this), 4, null));
    }

    @Override
    public View getRoot() {
        return this.scroll;
    }

    private static final Unit permissionNote$lambda$3(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit openSettingsButton$lambda$4(MainActivity mainActivity, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        mainActivity.openNotificationSettings();
        return Unit.INSTANCE;
    }

    private static final Unit motionNote$lambda$7(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$8(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$9(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 6);
        return Unit.INSTANCE;
    }

    private static final String _init_$lambda$10(Profile it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return it.getSchool();
    }

    private static final String _init_$lambda$11(Profile it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return it.getClassName();
    }

    private static final String _init_$lambda$12(Profile it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return it.getRoll();
    }

    private static final String _init_$lambda$13(Profile it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return it.getHall();
    }

    private static final String _init_$lambda$14(Profile it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return it.getExamination();
    }

    private static final Unit _init_$lambda$15(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 4);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$16(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 10);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$17(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 18);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$18(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 10);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$19(MainActivity mainActivity, SettingsScreen settingsScreen, int i) {
        mainActivity.updateChoices(Choices.copy$default(mainActivity.getData().getChoices(), (MilLanguage) MilLanguage.getEntries().get(i), null, 2, null));
        settingsScreen.refresh();
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$20(MainActivity mainActivity, SettingsScreen settingsScreen, int i) {
        mainActivity.updateChoices(Choices.copy$default(mainActivity.getData().getChoices(), null, (Elective) Elective.getEntries().get(i), 1, null));
        settingsScreen.refresh();
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$21(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$22(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.bottomMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$24(MainActivity mainActivity, SettingsScreen settingsScreen) {
        Dialogs.confirm$default(Dialogs.INSTANCE, mainActivity, "Reset the timetable?", "All eight exams go back to the official dates, the 12:30 PM start and unconfirmed durations.", "Reset", false, new SettingsScreen$$ExternalSyntheticLambda72(mainActivity, settingsScreen), 16, null);
        return Unit.INSTANCE;
    }

    public static final Unit lambda$24$lambda$23(MainActivity mainActivity, SettingsScreen settingsScreen) {
        mainActivity.updateExams(Timetable.INSTANCE.getDEFAULT());
        settingsScreen.refresh();
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$25(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$26(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 10);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$27(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$28(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 10);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$30(MainActivity mainActivity, SettingsScreen settingsScreen, boolean z) {
        mainActivity.setExamReminders(z, new SettingsScreen$$ExternalSyntheticLambda76(settingsScreen));
        return Unit.INSTANCE;
    }

    public static final Unit lambda$30$lambda$29(SettingsScreen settingsScreen) {
        settingsScreen.refresh();
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$32(MainActivity mainActivity, SettingsScreen settingsScreen, boolean z) {
        mainActivity.updateReminderSettings(new SettingsScreen$$ExternalSyntheticLambda65(z));
        settingsScreen.refresh();
        return Unit.INSTANCE;
    }

    public static final ReminderSettings lambda$32$lambda$31(boolean z, ReminderSettings it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return ReminderSettings.copy$default(it, false, z, false, false, 0L, 29, null);
    }

    private static final Unit _init_$lambda$34(MainActivity mainActivity, SettingsScreen settingsScreen, boolean z) {
        mainActivity.updateReminderSettings(new SettingsScreen$$ExternalSyntheticLambda83(z));
        settingsScreen.refresh();
        return Unit.INSTANCE;
    }

    public static final ReminderSettings lambda$34$lambda$33(boolean z, ReminderSettings it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return ReminderSettings.copy$default(it, false, false, z, false, 0L, 27, null);
    }

    private static final Unit _init_$lambda$36(MainActivity mainActivity, SettingsScreen settingsScreen, boolean z) {
        mainActivity.setFocusAlerts(z, new SettingsScreen$$ExternalSyntheticLambda82(settingsScreen));
        return Unit.INSTANCE;
    }

    public static final Unit lambda$36$lambda$35(SettingsScreen settingsScreen) {
        settingsScreen.refresh();
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$37(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 4);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$38(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 10);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$39(MainActivity mainActivity, int i) {
        mainActivity.setTheme((ThemeMode) ThemeMode.getEntries().get(i));
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$40(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$41(MainActivity mainActivity, boolean z) {
        mainActivity.setIntroEnabled(z);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$42(MainActivity mainActivity) {
        mainActivity.replayIntro();
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$43(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 14);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$44(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 10);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$45(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 10);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$46(MainActivity mainActivity, SettingsScreen settingsScreen, int i) {
        mainActivity.setMotion((MotionPref) MotionPref.getEntries().get(i));
        settingsScreen.refresh();
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$47(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 12);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$48(MainActivity mainActivity, boolean z) {
        mainActivity.setHaptics(z);
        return Unit.INSTANCE;
    }

    public static final Unit lambda$53$lambda$51$lambda$50(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 3);
        return Unit.INSTANCE;
    }

    public static final Unit lambda$53$lambda$52(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 14));
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$54(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 4);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$55(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$56(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 14);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$57(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$58(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 10);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$60(MainActivity mainActivity, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Dialogs.INSTANCE.confirm(mainActivity, "Reset everything?", "This clears your profile edits, photo, subject choices, schedule edits, checklists, focus history and reminders.", "Reset everything", true, new SettingsScreen$$ExternalSyntheticLambda77(mainActivity));
        return Unit.INSTANCE;
    }

    public static final Unit lambda$60$lambda$59(MainActivity mainActivity) {
        mainActivity.resetAllData();
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$61(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 18);
        return Unit.INSTANCE;
    }

    private final void section(String str) {
        this.content.addView(ThemeKt.label$default(getCtx(), str, Ui.INSTANCE.getC().getGreenText(), 0.0f, 4, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda78(this), 7, null));
    }

    private static final Unit section$lambda$62(SettingsScreen settingsScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 30);
        lp.bottomMargin = ThemeKt.dp(settingsScreen.getCtx(), (Number) 8);
        return Unit.INSTANCE;
    }

    private final View profileHeader() {
        LinearLayout linearLayout = new LinearLayout(getCtx());
        linearLayout.setOrientation(0);
        linearLayout.setGravity(16);
        LinearLayout linearLayout2 = linearLayout;
        linearLayout.setMinimumHeight(ThemeKt.dp(linearLayout2, (Number) 76));
        linearLayout.setPadding(0, ThemeKt.dp(linearLayout2, (Number) 10), 0, ThemeKt.dp(linearLayout2, (Number) 10));
        linearLayout.setBackground(Shapes.INSTANCE.ripple(getCtx(), null, (Number) 12));
        linearLayout.addView(this.avatar, ThemeKt.lp$default(ThemeKt.dp(linearLayout2, (Number) 58), ThemeKt.dp(linearLayout2, (Number) 58), 0.0f, null, 12, null));
        LinearLayout linearLayout3 = new LinearLayout(getCtx());
        linearLayout3.setOrientation(1);
        linearLayout3.addView(this.profileName);
        linearLayout3.addView(ThemeKt.text$default(getCtx(), "Photo, frame and display name", 14.0f, Ui.INSTANCE.getC().getText3(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda79(linearLayout3), 7, null));
        linearLayout.addView(linearLayout3, ThemeKt.lp(0, -2, 1.0f, new SettingsScreen$$ExternalSyntheticLambda80(linearLayout)));
        linearLayout.addView(ThemeKt.icon(getCtx(), R.drawable.ic_chevron_right, Ui.INSTANCE.getC().getText3(), 22));
        linearLayout.setContentDescription("Edit photo, frame and display name");
        linearLayout.setOnClickListener(new SettingsScreen$$ExternalSyntheticLambda81(this));
        return linearLayout2;
    }

    private static final Unit profileHeader$lambda$67$lambda$64$lambda$63(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
        return Unit.INSTANCE;
    }

    private static final Unit profileHeader$lambda$67$lambda$65(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 14));
        return Unit.INSTANCE;
    }

    private static final void profileHeader$lambda$67$lambda$66(SettingsScreen settingsScreen, View view) {
        settingsScreen.getHost().openProfileEditor(settingsScreen.avatar);
    }

    static void profileField$default(SettingsScreen settingsScreen, String str, int i, boolean z, Function1 function1, int i2, Object obj) {
        if ((i2 & 4) != 0) {
            z = false;
        }
        settingsScreen.profileField(str, i, z, function1);
    }

    private final void profileField(String str, int i, boolean z, Function1<? super Profile, String> function1) {
        TextView text$default = ThemeKt.text$default(getCtx(), "", 16.0f, Ui.INSTANCE.getC().getText(), null, null, 24, null);
        this.profileValues.put(str, text$default);
        LinearLayout linearLayout = this.content;
        LinearLayout linearLayout2 = new LinearLayout(getCtx());
        linearLayout2.setOrientation(0);
        linearLayout2.setGravity(16);
        LinearLayout linearLayout3 = linearLayout2;
        linearLayout2.setMinimumHeight(ThemeKt.dp(linearLayout3, (Number) 60));
        linearLayout2.setPadding(0, ThemeKt.dp(linearLayout3, (Number) 8), ThemeKt.dp(linearLayout3, (Number) 4), ThemeKt.dp(linearLayout3, (Number) 8));
        linearLayout2.setBackground(Shapes.INSTANCE.ripple(getCtx(), null, (Number) 12));
        linearLayout2.addView(ThemeKt.icon(getCtx(), i, Ui.INSTANCE.getC().getText3(), 20));
        LinearLayout linearLayout4 = new LinearLayout(getCtx());
        linearLayout4.setOrientation(1);
        linearLayout4.addView(ThemeKt.text$default(getCtx(), str, 13.0f, Ui.INSTANCE.getC().getText3(), Fonts.INSTANCE.getSansMedium(), null, 16, null));
        linearLayout4.addView(text$default, ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda73(linearLayout4), 7, null));
        linearLayout2.addView(linearLayout4, ThemeKt.lp(0, -2, 1.0f, new SettingsScreen$$ExternalSyntheticLambda74(linearLayout2)));
        linearLayout2.addView(ThemeKt.icon(getCtx(), R.drawable.ic_edit, Ui.INSTANCE.getC().getText3(), 18));
        linearLayout2.setOnClickListener(new SettingsScreen$$ExternalSyntheticLambda75(this, str, function1));
        linearLayout.addView(linearLayout3);
        if (z) {
            return;
        }
        this.content.addView(ThemeKt.separator(getCtx()));
    }

    private static final Unit profileField$lambda$72$lambda$69$lambda$68(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
        return Unit.INSTANCE;
    }

    private static final Unit profileField$lambda$72$lambda$70(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 16));
        return Unit.INSTANCE;
    }

    private static final void profileField$lambda$72$lambda$71(SettingsScreen settingsScreen, String str, Function1 function1, View view) {
        settingsScreen.editField(str, function1);
    }

    private final void editField(String str, Function1<? super Profile, String> function1) {
        Profile profile = getHost().getData().getProfile();
        Dialogs.editText$default(Dialogs.INSTANCE, getHost(), str, function1.invoke(profile), null, (Intrinsics.areEqual(str, "Roll number") || Intrinsics.areEqual(str, "Examination hall")) ? 4097 : 8193, null, new SettingsScreen$$ExternalSyntheticLambda5(str, profile, this), 40, null);
    }

    /* JADX WARN: Can't fix incorrect switch cases order, some code will duplicate */
    private static final Unit editField$lambda$73(String str, Profile profile, SettingsScreen settingsScreen, String value) {
        Profile copy$default;
        Intrinsics.checkNotNullParameter(value, "value");
        switch (str.hashCode()) {
            case -1824110700:
                if (str.equals("School")) {
                    copy$default = Profile.copy$default(profile, null, value, null, null, null, null, 61, null);
                    break;
                }
                copy$default = Profile.copy$default(profile, null, null, null, null, null, value, 31, null);
                break;
            case 65190232:
                if (str.equals("Class")) {
                    copy$default = Profile.copy$default(profile, null, null, value, null, null, null, 59, null);
                    break;
                }
                copy$default = Profile.copy$default(profile, null, null, null, null, null, value, 31, null);
                break;
            case 936210216:
                if (str.equals("Examination hall")) {
                    copy$default = Profile.copy$default(profile, null, null, null, null, value, null, 47, null);
                    break;
                }
                copy$default = Profile.copy$default(profile, null, null, null, null, null, value, 31, null);
                break;
            case 1545032748:
                if (str.equals("Roll number")) {
                    copy$default = Profile.copy$default(profile, null, null, null, value, null, null, 55, null);
                    break;
                }
                copy$default = Profile.copy$default(profile, null, null, null, null, null, value, 31, null);
                break;
            default:
                copy$default = Profile.copy$default(profile, null, null, null, null, null, value, 31, null);
                break;
        }
        settingsScreen.getHost().updateProfile(copy$default);
        settingsScreen.refresh();
        return Unit.INSTANCE;
    }

    private final void renderSchedule() {
        this.scheduleList.removeAllViews();
        Choices choices = getHost().getData().getChoices();
        int i = 0;
        for (Object obj : Timetable.INSTANCE.sorted(getHost().getData().getExams())) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            Exam exam = (Exam) obj;
            if (i > 0) {
                this.scheduleList.addView(ThemeKt.separator(getCtx()));
            }
            boolean areEqual = Intrinsics.areEqual(exam, Timetable.INSTANCE.m9default(exam.getSubject()));
            LinearLayout linearLayout = this.scheduleList;
            LinearLayout linearLayout2 = new LinearLayout(getCtx());
            linearLayout2.setOrientation(0);
            linearLayout2.setGravity(16);
            LinearLayout linearLayout3 = linearLayout2;
            linearLayout2.setMinimumHeight(ThemeKt.dp(linearLayout3, (Number) 64));
            linearLayout2.setPadding(0, ThemeKt.dp(linearLayout3, (Number) 10), ThemeKt.dp(linearLayout3, (Number) 4), ThemeKt.dp(linearLayout3, (Number) 10));
            linearLayout2.setBackground(Shapes.INSTANCE.ripple(getCtx(), null, (Number) 12));
            LinearLayout linearLayout4 = new LinearLayout(getCtx());
            linearLayout4.setOrientation(1);
            LinearLayout linearLayout5 = new LinearLayout(getCtx());
            linearLayout5.setOrientation(0);
            linearLayout5.setGravity(16);
            linearLayout5.addView(ThemeKt.text$default(getCtx(), exam.title(choices), 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null), ThemeKt.lp$default(0, -2, 1.0f, null, 8, null));
            if (!areEqual) {
                linearLayout5.addView(ThemeKt.label(getCtx(), "Edited", Ui.INSTANCE.getC().getGoldText(), 11.0f), ThemeKt.lp$default(-2, -2, 0.0f, new SettingsScreen$$ExternalSyntheticLambda0(linearLayout5), 4, null));
            }
            linearLayout4.addView(linearLayout5);
            linearLayout4.addView(ThemeKt.text$default(getCtx(), Formats.INSTANCE.dateShort(exam.getDate()) + " · " + Formats.INSTANCE.time(exam.getStart()) + " · " + Timetable.INSTANCE.durationLabel(exam.getDurationMinutes()), 14.0f, Ui.INSTANCE.getC().getText2(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda1(linearLayout4), 7, null));
            linearLayout2.addView(linearLayout4, ThemeKt.lp$default(0, -2, 1.0f, null, 8, null));
            linearLayout2.addView(ThemeKt.icon(getCtx(), R.drawable.ic_chevron_right, Ui.INSTANCE.getC().getText3(), 22), ThemeKt.lp$default(ThemeKt.dp(linearLayout3, (Number) 22), ThemeKt.dp(linearLayout3, (Number) 22), 0.0f, new SettingsScreen$$ExternalSyntheticLambda2(linearLayout2), 4, null));
            linearLayout2.setOnClickListener(new SettingsScreen$$ExternalSyntheticLambda3(this, exam));
            linearLayout.addView(linearLayout3);
            i = i2;
        }
        this.scheduleList.addView(ThemeKt.separator(getCtx()));
    }

    private static final Unit renderSchedule$lambda$81$lambda$80$lambda$77$lambda$75$lambda$74(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 8));
        return Unit.INSTANCE;
    }

    private static final Unit renderSchedule$lambda$81$lambda$80$lambda$77$lambda$76(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 3);
        return Unit.INSTANCE;
    }

    private static final Unit renderSchedule$lambda$81$lambda$80$lambda$78(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 8));
        return Unit.INSTANCE;
    }

    private static final void renderSchedule$lambda$81$lambda$80$lambda$79(SettingsScreen settingsScreen, Exam exam, View view) {
        settingsScreen.editExam(exam.getSubject());
    }

    private static final Exam editExam$current(SettingsScreen settingsScreen, Subject subject) {
        for (Exam exam : settingsScreen.getHost().getData().getExams()) {
            if (exam.getSubject() == subject) {
                return exam;
            }
        }
        throw new NoSuchElementException("Collection contains no element matching the predicate.");
    }

    private final void editExam(Subject subject) {
        Dialogs.INSTANCE.sheet(getHost(), editExam$current(this, subject).title(getHost().getData().getChoices()), "Changes apply straight away.", new SettingsScreen$$ExternalSyntheticLambda11(this, subject));
    }

    private static final Unit editExam$lambda$94(SettingsScreen settingsScreen, Subject subject, LinearLayout sheet, Function0 dismiss) {
        Intrinsics.checkNotNullParameter(sheet, "$this$sheet");
        Intrinsics.checkNotNullParameter(dismiss, "dismiss");
        TextView text$default = ThemeKt.text$default(settingsScreen.getCtx(), "", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansMedium(), null, 16, null);
        TextView text$default2 = ThemeKt.text$default(settingsScreen.getCtx(), "", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansMedium(), null, 16, null);
        TextView text$default3 = ThemeKt.text$default(settingsScreen.getCtx(), "", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansMedium(), null, 16, null);
        sheet.addView(settingsScreen.editRow("Date", R.drawable.ic_calendar, text$default, new SettingsScreen$$ExternalSyntheticLambda66(settingsScreen, subject, text$default, text$default2, text$default3)), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda67(sheet), 7, null));
        sheet.addView(ThemeKt.separator(settingsScreen.getCtx()));
        sheet.addView(settingsScreen.editRow("Start time", R.drawable.ic_clock, text$default2, new SettingsScreen$$ExternalSyntheticLambda68(settingsScreen, subject, text$default, text$default2, text$default3)));
        sheet.addView(ThemeKt.separator(settingsScreen.getCtx()));
        sheet.addView(settingsScreen.editRow("Duration", R.drawable.ic_bolt, text$default3, new SettingsScreen$$ExternalSyntheticLambda69(settingsScreen, subject, text$default, text$default2, text$default3)));
        editExam$lambda$94$render(text$default, text$default2, text$default3, settingsScreen, subject);
        Dialogs.INSTANCE.actions(sheet, ControlsKt.pillButton(settingsScreen.getCtx(), "Use official", Integer.valueOf((int) R.drawable.ic_restore), ButtonStyle.GHOST, new SettingsScreen$$ExternalSyntheticLambda70(subject, settingsScreen, text$default, text$default2, text$default3)), ControlsKt.pillButton$default(settingsScreen.getCtx(), "Done", null, null, new SettingsScreen$$ExternalSyntheticLambda71(dismiss), 6, null));
        return Unit.INSTANCE;
    }

    private static final void editExam$lambda$94$render(TextView textView, TextView textView2, TextView textView3, SettingsScreen settingsScreen, Subject subject) {
        Exam editExam$current = editExam$current(settingsScreen, subject);
        textView.setText(Formats.INSTANCE.dateFull(editExam$current.getDate()));
        textView2.setText(Formats.INSTANCE.time(editExam$current.getStart()) + " (India time)");
        textView3.setText(Timetable.INSTANCE.durationLabel(editExam$current.getDurationMinutes()));
    }

    private static final void editExam$lambda$94$save(SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3, Exam exam) {
        MainActivity host = settingsScreen.getHost();
        List<Exam> exams = settingsScreen.getHost().getData().getExams();
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(exams, 10));
        for (Exam exam2 : exams) {
            if (exam2.getSubject() == subject) {
                exam2 = exam;
            }
            arrayList.add(exam2);
        }
        host.updateExams(arrayList);
        editExam$lambda$94$render(textView, textView2, textView3, settingsScreen, subject);
        settingsScreen.refresh();
    }

    private static final Unit editExam$lambda$94$lambda$85(SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3) {
        Exam editExam$current = editExam$current(settingsScreen, subject);
        new DatePickerDialog(settingsScreen.getHost(), R.style.Theme_ExamCountdown_Dialog, new SettingsScreen$$ExternalSyntheticLambda6(editExam$current, settingsScreen, subject, textView, textView2, textView3), editExam$current.getDate().getYear(), editExam$current.getDate().getMonthValue() - 1, editExam$current.getDate().getDayOfMonth()).show();
        return Unit.INSTANCE;
    }

    private static final void editExam$lambda$94$lambda$85$lambda$84(Exam exam, SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3, DatePicker datePicker, int i, int i2, int i3) {
        LocalDate of = LocalDate.of(i, i2 + 1, i3);
        Intrinsics.checkNotNullExpressionValue(of, "of(...)");
        editExam$lambda$94$save(settingsScreen, subject, textView, textView2, textView3, Exam.copy$default(exam, null, of, null, null, 13, null));
    }

    private static final Unit editExam$lambda$94$lambda$86(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 14);
        return Unit.INSTANCE;
    }

    private static final Unit editExam$lambda$94$lambda$88(SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3) {
        Exam editExam$current = editExam$current(settingsScreen, subject);
        new TimePickerDialog(settingsScreen.getHost(), R.style.Theme_ExamCountdown_Dialog, new SettingsScreen$$ExternalSyntheticLambda10(editExam$current, settingsScreen, subject, textView, textView2, textView3), editExam$current.getStart().getHour(), editExam$current.getStart().getMinute(), false).show();
        return Unit.INSTANCE;
    }

    private static final void editExam$lambda$94$lambda$88$lambda$87(Exam exam, SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3, TimePicker timePicker, int i, int i2) {
        LocalTime of = LocalTime.of(i, i2);
        Intrinsics.checkNotNullExpressionValue(of, "of(...)");
        editExam$lambda$94$save(settingsScreen, subject, textView, textView2, textView3, Exam.copy$default(exam, null, null, of, null, 11, null));
    }

    private static final Unit editExam$lambda$94$lambda$91(SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3) {
        Exam editExam$current = editExam$current(settingsScreen, subject);
        List<Integer> duration_choices = Timetable.INSTANCE.getDURATION_CHOICES();
        Dialogs dialogs = Dialogs.INSTANCE;
        MainActivity host = settingsScreen.getHost();
        List<Integer> list = duration_choices;
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(list, 10));
        for (Integer num : list) {
            arrayList.add(Timetable.INSTANCE.durationLabel(num));
        }
        dialogs.choice(host, "Duration", arrayList, RangesKt.coerceAtLeast(duration_choices.indexOf(editExam$current.getDurationMinutes()), 0), "Only choose a duration once your school confirms it. Class VIII session: 12:30 PM – 3:30 PM (India time).", new SettingsScreen$$ExternalSyntheticLambda4(editExam$current, duration_choices, settingsScreen, subject, textView, textView2, textView3));
        return Unit.INSTANCE;
    }

    private static final Unit editExam$lambda$94$lambda$91$lambda$90(Exam exam, List list, SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3, int i) {
        editExam$lambda$94$save(settingsScreen, subject, textView, textView2, textView3, Exam.copy$default(exam, null, null, null, (Integer) list.get(i), 7, null));
        return Unit.INSTANCE;
    }

    private static final Unit editExam$lambda$94$lambda$92(Subject subject, SettingsScreen settingsScreen, TextView textView, TextView textView2, TextView textView3, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        editExam$lambda$94$save(settingsScreen, subject, textView, textView2, textView3, Timetable.INSTANCE.m9default(subject));
        return Unit.INSTANCE;
    }

    private static final Unit editExam$lambda$94$lambda$93(Function0 function0, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        function0.invoke();
        return Unit.INSTANCE;
    }

    private final View editRow(String str, int i, TextView textView, Function0<Unit> function0) {
        LinearLayout linearLayout = new LinearLayout(getCtx());
        linearLayout.setOrientation(0);
        linearLayout.setGravity(16);
        LinearLayout linearLayout2 = linearLayout;
        linearLayout.setMinimumHeight(ThemeKt.dp(linearLayout2, (Number) 60));
        linearLayout.setPadding(ThemeKt.dp(linearLayout2, (Number) 4), ThemeKt.dp(linearLayout2, (Number) 8), ThemeKt.dp(linearLayout2, (Number) 4), ThemeKt.dp(linearLayout2, (Number) 8));
        linearLayout.setBackground(Shapes.INSTANCE.ripple(getCtx(), null, (Number) 12));
        linearLayout.addView(ThemeKt.icon(getCtx(), i, Ui.INSTANCE.getC().getGreenText(), 20));
        LinearLayout linearLayout3 = new LinearLayout(getCtx());
        linearLayout3.setOrientation(1);
        linearLayout3.addView(ThemeKt.text$default(getCtx(), str, 13.0f, Ui.INSTANCE.getC().getText3(), Fonts.INSTANCE.getSansMedium(), null, 16, null));
        linearLayout3.addView(textView, ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda62(linearLayout3), 7, null));
        linearLayout.addView(linearLayout3, ThemeKt.lp(0, -2, 1.0f, new SettingsScreen$$ExternalSyntheticLambda63(linearLayout)));
        linearLayout.addView(ThemeKt.icon(getCtx(), R.drawable.ic_chevron_right, Ui.INSTANCE.getC().getText3(), 20));
        linearLayout.setOnClickListener(new SettingsScreen$$ExternalSyntheticLambda64(function0));
        return linearLayout2;
    }

    private static final Unit editRow$lambda$99$lambda$96$lambda$95(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
        return Unit.INSTANCE;
    }

    private static final Unit editRow$lambda$99$lambda$97(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 14));
        return Unit.INSTANCE;
    }

    private static final void editRow$lambda$99$lambda$98(Function0 function0, View view) {
        function0.invoke();
    }

    private final View actionRow(String str, int i, Function0<Unit> function0) {
        LinearLayout linearLayout = new LinearLayout(getCtx());
        linearLayout.setOrientation(0);
        linearLayout.setGravity(16);
        LinearLayout linearLayout2 = linearLayout;
        linearLayout.setMinimumHeight(ThemeKt.dp(linearLayout2, (Number) 56));
        linearLayout.setPadding(0, ThemeKt.dp(linearLayout2, (Number) 8), 0, ThemeKt.dp(linearLayout2, (Number) 8));
        linearLayout.setBackground(Shapes.INSTANCE.ripple(getCtx(), null, (Number) 12));
        linearLayout.addView(ThemeKt.icon(getCtx(), i, Ui.INSTANCE.getC().getGreenText(), 20));
        linearLayout.addView(ThemeKt.text$default(getCtx(), str, 15.5f, Ui.INSTANCE.getC().getGreenText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null), ThemeKt.lp(0, -2, 1.0f, new SettingsScreen$$ExternalSyntheticLambda12(linearLayout)));
        linearLayout.setOnClickListener(new SettingsScreen$$ExternalSyntheticLambda13(function0));
        return linearLayout2;
    }

    private static final Unit actionRow$lambda$102$lambda$100(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 14));
        return Unit.INSTANCE;
    }

    private static final void actionRow$lambda$102$lambda$101(Function0 function0, View view) {
        function0.invoke();
    }

    private final View toggleRow(String str, String str2, ToggleView toggleView, boolean z) {
        LinearLayout linearLayout = new LinearLayout(getCtx());
        linearLayout.setOrientation(0);
        linearLayout.setGravity(16);
        LinearLayout linearLayout2 = linearLayout;
        linearLayout.setMinimumHeight(ThemeKt.dp(linearLayout2, Integer.valueOf(str2 == null ? 52 : 64)));
        linearLayout.setPadding(ThemeKt.dp(linearLayout2, Integer.valueOf(z ? 18 : 0)), ThemeKt.dp(linearLayout2, (Number) 8), 0, ThemeKt.dp(linearLayout2, (Number) 8));
        LinearLayout linearLayout3 = new LinearLayout(getCtx());
        linearLayout3.setOrientation(1);
        Context ctx = getCtx();
        String str3 = str;
        float f = z ? 15.5f : 16.0f;
        int text = Ui.INSTANCE.getC().getText();
        Fonts fonts = Fonts.INSTANCE;
        linearLayout3.addView(ThemeKt.text$default(ctx, str3, f, text, z ? fonts.getSans() : fonts.getSansSemibold(), null, 16, null));
        if (str2 != null) {
            linearLayout3.addView(ThemeKt.text$default(getCtx(), str2, 14.0f, Ui.INSTANCE.getC().getText3(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new SettingsScreen$$ExternalSyntheticLambda7(linearLayout3), 7, null));
        }
        linearLayout.addView(linearLayout3, ThemeKt.lp$default(0, -2, 1.0f, null, 8, null));
        linearLayout.addView(toggleView, ThemeKt.lp$default(-2, -2, 0.0f, new SettingsScreen$$ExternalSyntheticLambda8(linearLayout), 4, null));
        toggleView.setContentDescription(str3);
        linearLayout.setOnClickListener(new SettingsScreen$$ExternalSyntheticLambda9(toggleView));
        return linearLayout2;
    }

    static View toggleRow$default(SettingsScreen settingsScreen, String str, String str2, ToggleView toggleView, boolean z, int i, Object obj) {
        if ((i & 8) != 0) {
            z = false;
        }
        return settingsScreen.toggleRow(str, str2, toggleView, z);
    }

    private static final Unit toggleRow$lambda$107$lambda$104$lambda$103(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
        return Unit.INSTANCE;
    }

    private static final Unit toggleRow$lambda$107$lambda$105(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 12));
        return Unit.INSTANCE;
    }

    private static final void toggleRow$lambda$107$lambda$106(ToggleView toggleView, View view) {
        toggleView.performClick();
    }

    @Override
    public void onShow(boolean z) {
        refresh();
        if (z && getHost().getPolicy().getMotion()) {
            IntRange until = RangesKt.until(0, this.content.getChildCount());
            ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(until, 10));
            Iterator<Integer> it = until.iterator();
            while (it.hasNext()) {
                arrayList.add(this.content.getChildAt(((IntIterator) it).nextInt()));
            }
            ArrayList arrayList2 = new ArrayList();
            for (Object obj : arrayList) {
                if (((View) obj).getVisibility() == 0) {
                    arrayList2.add(obj);
                }
            }
            ScreenKt.staggerIn$default(CollectionsKt.take(arrayList2, 14), true, 0L, 4, null);
        }
    }

    @Override
    public void onDataChanged() {
        if (this.scroll.isShown()) {
            refresh();
        }
    }

    @Override
    public void onMotionChanged() {
        this.avatar.setAnimateFrame(getHost().getFramesMoving());
        refreshMotion();
    }

    @Override
    public void applyInsets(int i, int i2) {
        this.content.setPadding(ThemeKt.dp(getCtx(), (Number) 20), i + ThemeKt.dp(getCtx(), (Number) 8), ThemeKt.dp(getCtx(), (Number) 20), ThemeKt.dp(getCtx(), (Number) 28));
    }

    public final void refresh() {
        AppData data = getHost().getData();
        Profile profile = data.getProfile();
        this.avatar.setInitials(profile.getInitials());
        this.avatar.setFrame(data.getAvatarFrame(), this.avatar.isShown());
        long avatarVersion = getHost().getStore().getAvatarVersion();
        if (avatarVersion != this.avatarVersion) {
            this.avatarVersion = avatarVersion;
            this.avatar.setPhoto(getHost().avatarBitmap(ThemeKt.dp(getCtx(), (Number) 58)));
        }
        TextView textView = this.profileName;
        String name = profile.getName();
        if (StringsKt.isBlank(name)) {
            name = "Add your name";
        }
        ThemeKt.update(textView, name);
        TextView textView2 = this.profileValues.get("School");
        if (textView2 != null) {
            String school = profile.getSchool();
            if (StringsKt.isBlank(school)) {
                school = "Not set";
            }
            ThemeKt.update(textView2, school);
        }
        TextView textView3 = this.profileValues.get("Class");
        if (textView3 != null) {
            String className = profile.getClassName();
            if (StringsKt.isBlank(className)) {
                className = "Not set";
            }
            ThemeKt.update(textView3, className);
        }
        TextView textView4 = this.profileValues.get("Roll number");
        if (textView4 != null) {
            String roll = profile.getRoll();
            if (StringsKt.isBlank(roll)) {
                roll = "Not set";
            }
            ThemeKt.update(textView4, roll);
        }
        TextView textView5 = this.profileValues.get("Examination hall");
        if (textView5 != null) {
            String hall = profile.getHall();
            if (StringsKt.isBlank(hall)) {
                hall = "Not set";
            }
            ThemeKt.update(textView5, hall);
        }
        TextView textView6 = this.profileValues.get("Examination");
        if (textView6 != null) {
            String examination = profile.getExamination();
            ThemeKt.update(textView6, StringsKt.isBlank(examination) ? "Not set" : examination);
        }
        SegmentedControl segmentedControl = this.milControl;
        MilLanguage mil = data.getChoices().getMil();
        SegmentedControl.select$default(segmentedControl, mil != null ? mil.ordinal() : -1, false, false, 6, null);
        SegmentedControl segmentedControl2 = this.electiveControl;
        Elective elective = data.getChoices().getElective();
        SegmentedControl.select$default(segmentedControl2, elective != null ? elective.ordinal() : -1, false, false, 6, null);
        renderSchedule();
        ReminderSettings reminders = data.getReminders();
        boolean canPost = Notifier.INSTANCE.canPost(getCtx());
        boolean z = true;
        ToggleView.setChecked$default(this.remindersToggle, reminders.getEnabled() && canPost, false, 2, null);
        ToggleView.setChecked$default(this.dayToggle, reminders.getDayBefore(), false, 2, null);
        ToggleView.setChecked$default(this.hourToggle, reminders.getHourBefore(), false, 2, null);
        ToggleView.setChecked$default(this.focusToggle, reminders.getFocusAlerts() && canPost, false, 2, null);
        this.subToggles.setAlpha((reminders.getEnabled() && canPost) ? 1.0f : 0.45f);
        this.dayToggle.setEnabled(reminders.getEnabled() && canPost);
        this.hourToggle.setEnabled(reminders.getEnabled() && canPost);
        boolean z2 = reminders.getEnabled() || reminders.getFocusAlerts();
        ScreenKt.setVisible(this.permissionNote, z2 && !canPost);
        TextView textView7 = this.openSettingsButton;
        if (!z2 || canPost) {
            z = false;
        }
        ScreenKt.setVisible(textView7, z);
        ThemeKt.update(this.permissionNote, "Notifications are turned off for this app, so reminders can’t be shown. Allow them in Android settings.");
        SegmentedControl.select$default(this.themeControl, getHost().getStore().getTheme().ordinal(), false, false, 6, null);
        ToggleView.setChecked$default(this.introToggle, getHost().getStore().getIntroEnabled(), false, 2, null);
        ToggleView.setChecked$default(this.hapticsToggle, getHost().getStore().getHaptics(), false, 2, null);
        refreshMotion();
        ThemeKt.update(this.versionText, "Version " + getHost().versionName() + " · Class VIII, Half-Yearly 2026–2027");
    }

    private final void refreshMotion() {
        String str;
        MotionPref motion = getHost().getData().getMotion();
        SegmentedControl.select$default(this.motionControl, motion.ordinal(), false, false, 6, null);
        MotionPolicy policy = getHost().getPolicy();
        TextView textView = this.motionNote;
        if (motion == MotionPref.REDUCED) {
            str = "Movement is off: no opening animation, sliding digits, drifting light or confetti, and profile frames stay still. Everything still works.";
        } else if (motion == MotionPref.FULL && !policy.getAmbient()) {
            str = "Full motion. Battery Saver is on, so continuous effects (drifting light, pulses, moving frames) are paused.";
        } else if (motion == MotionPref.FULL) {
            str = "Full motion, even if Android’s “Remove animations” is on.";
        } else if (policy.getMotion()) {
            str = !policy.getAmbient() ? "Following Android. Battery Saver is on, so continuous effects are paused." : "Following Android’s animation setting.";
        } else {
            str = "Following Android: “Remove animations” is on, so motion is reduced.";
        }
        ThemeKt.update(textView, str);
    }
}

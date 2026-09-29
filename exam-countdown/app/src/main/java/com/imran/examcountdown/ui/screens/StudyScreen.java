package com.imran.examcountdown.ui.screens;

import android.animation.ValueAnimator;
import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PathMeasure;
import android.graphics.RectF;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.LinearInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import com.imran.examcountdown.AppData;
import com.imran.examcountdown.MainActivity;
import com.imran.examcountdown.R;
import com.imran.examcountdown.core.CheckItem;
import com.imran.examcountdown.core.Checklists;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.ExamStatus;
import com.imran.examcountdown.core.FocusMode;
import com.imran.examcountdown.core.FocusPhase;
import com.imran.examcountdown.core.FocusState;
import com.imran.examcountdown.core.FocusTimer;
import com.imran.examcountdown.core.Formats;
import com.imran.examcountdown.core.Moment;
import com.imran.examcountdown.core.Phase;
import com.imran.examcountdown.core.Season;
import com.imran.examcountdown.core.Subject;
import com.imran.examcountdown.data.AppClock;
import com.imran.examcountdown.ui.AmbientListener;
import com.imran.examcountdown.ui.Dialogs;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.Fonts;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.Haptics;
import com.imran.examcountdown.ui.Shapes;
import com.imran.examcountdown.ui.Spring;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import com.imran.examcountdown.ui.widgets.ButtonStyle;
import com.imran.examcountdown.ui.widgets.ControlsKt;
import com.imran.examcountdown.ui.widgets.ProgressTrack;
import com.imran.examcountdown.ui.widgets.RollingNumberView;
import com.imran.examcountdown.ui.widgets.SegmentedControl;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import kotlin.KotlinVersion;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.Pair;
import kotlin.TuplesKt;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.collections.IntIterator;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.IntRange;
import kotlin.ranges.RangesKt;
import kotlin.text.StringsKt;
import kotlin.text.Typography;

public final class StudyScreen extends Screen implements AmbientListener {
    private String builtFor;
    private final LinkedHashMap<Subject, ChecklistCard> cards;
    private final LinearLayout cardsContainer;
    private final TextView colon;
    private final LinearLayout content;
    private Subject expanded;
    private FocusPhase lastPhase;
    private final RollingNumberView minutes;
    private final SegmentedControl modeControl;
    private final TextView overall;
    private final TextView phaseText;
    private final TextView primary;
    private final TextView reset;
    private final ScrollView scroll;
    private final RollingNumberView seconds;
    private final TextView sessions;
    private boolean smoothing;
    private FocusState state;
    private final LinearLayout timerRow;
    private final ProgressTrack track;

    public class WhenMappings {
        public static final int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[FocusPhase.values().length];
            try {
                iArr[FocusPhase.READY.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[FocusPhase.RUNNING.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            try {
                iArr[FocusPhase.PAUSED.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            try {
                iArr[FocusPhase.FINISHED.ordinal()] = 4;
            } catch (NoSuchFieldError unused4) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    public static Unit $r8$lambda$6ckh4Yx32XeXrrq1iJ0baVpUSu0(StudyScreen studyScreen, int i) {
        return _init_$lambda$21(studyScreen, i);
    }

    public static Unit $r8$lambda$7D92aglzibMO3Za6sCv9WjERhYY(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$18(studyScreen, layoutParams);
    }

    public static void m73$r8$lambda$AYLPMH1ikwiGT6NUqZcI9mBWPU(StudyScreen studyScreen, ChecklistCard checklistCard) {
        reveal$lambda$26(studyScreen, checklistCard);
    }

    public static Unit $r8$lambda$Ag7fuYeQ8NpMccR42AzkHbOfIPs(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$9(studyScreen, layoutParams);
    }

    public static Unit $r8$lambda$C0ta7Nhu_jlUmcqXjIKtW4D3SAA(TextView textView) {
        return colon$lambda$1(textView);
    }

    public static Unit $r8$lambda$EKHe8EZcYSLIopZnOKqYaJxAnzc(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$15(studyScreen, layoutParams);
    }

    public static Unit $r8$lambda$EvK0WrORiexSmdVU8EwrU8niMpQ(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$5(studyScreen, layoutParams);
    }

    public static Unit $r8$lambda$GGp90mLcVDskBoo9Evr1zSWzY6g(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$16(studyScreen, layoutParams);
    }

    public static Unit m74$r8$lambda$OI4hZSm0uyDYQx_6HqvIJClhNs(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$11(studyScreen, layoutParams);
    }

    public static Unit m75$r8$lambda$QYIs_DxKJitpAxRIyhfzUtuyGw(StudyScreen studyScreen, View view) {
        return reset$lambda$4(studyScreen, view);
    }

    public static Unit m76$r8$lambda$QoR0HFQO0WXOsyHITg4Jy9q97Y(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$14(studyScreen, layoutParams);
    }

    public static Unit $r8$lambda$ST5ZAgAo2s8wOs88W7asIyqS6Y4(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$20(studyScreen, layoutParams);
    }

    public static CharSequence m77$r8$lambda$_RH3LqS4xqZfas7oHZnw82vJnY(Exam exam) {
        return onShow$lambda$22(exam);
    }

    public static Unit $r8$lambda$b9NHV9IpW8FGlYJSQhEdF61jf5s(StudyScreen studyScreen, View view) {
        return primary$lambda$3(studyScreen, view);
    }

    public static Unit $r8$lambda$eIqxOj2SW9E6UrrPnHfyy4P8ywI(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$6(studyScreen, layoutParams);
    }

    public static Unit $r8$lambda$fRxnIsZyxGVDIaNTP4kAQkXOgrY(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$7(studyScreen, layoutParams);
    }

    public static Unit $r8$lambda$jtIBAOarqXKTj0QR5yZDYtmWGFc(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$10(studyScreen, layoutParams);
    }

    public static Unit m78$r8$lambda$kqkjdxZqwKj5krV549hIF1pFQ(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$8(studyScreen, layoutParams);
    }

    public static void $r8$lambda$q9f0HAzMMTSNhy9LfHtxhmTq6HU(StudyScreen studyScreen) {
        celebrateSession$lambda$27(studyScreen);
    }

    public static Unit m79$r8$lambda$x3YgYz8Jbk7ayjIbEXFsBjCaeA(StudyScreen studyScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$19(studyScreen, layoutParams);
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public StudyScreen(MainActivity host) {
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
        SegmentedControl segmentedControl = new SegmentedControl(getCtx(), CollectionsKt.listOf(new String[]{"Focus · 25 min", "Break · 5 min"}));
        this.modeControl = segmentedControl;
        RollingNumberView rollingNumberView = new RollingNumberView(getCtx());
        this.minutes = rollingNumberView;
        RollingNumberView rollingNumberView2 = new RollingNumberView(getCtx());
        this.seconds = rollingNumberView2;
        TextView text = ThemeKt.text(getCtx(), ":", 40.0f, Ui.INSTANCE.getC().getText3(), Fonts.INSTANCE.getSerif(), new StudyScreen$$ExternalSyntheticLambda0());
        this.colon = text;
        LinearLayout linearLayout2 = new LinearLayout(getCtx());
        linearLayout2.setOrientation(0);
        linearLayout2.setGravity(16);
        linearLayout2.setGravity(80);
        linearLayout2.addView(rollingNumberView, ThemeKt.lp$default(-2, -2, 0.0f, null, 12, null));
        linearLayout2.addView(text, ThemeKt.lp$default(-2, -2, 0.0f, null, 12, null));
        linearLayout2.addView(rollingNumberView2, ThemeKt.lp$default(-2, -2, 0.0f, null, 12, null));
        this.timerRow = linearLayout2;
        ProgressTrack progressTrack = new ProgressTrack(getCtx());
        this.track = progressTrack;
        TextView text$default = ThemeKt.text$default(getCtx(), "", 14.5f, Ui.INSTANCE.getC().getText2(), Fonts.INSTANCE.getSansMedium(), null, 16, null);
        this.phaseText = text$default;
        TextView pillButton$default = ControlsKt.pillButton$default(getCtx(), "Start focus", Integer.valueOf((int) R.drawable.ic_play), null, new StudyScreen$$ExternalSyntheticLambda9(this), 4, null);
        this.primary = pillButton$default;
        TextView pillButton = ControlsKt.pillButton(getCtx(), "Reset", Integer.valueOf((int) R.drawable.ic_replay), ButtonStyle.SECONDARY, new StudyScreen$$ExternalSyntheticLambda10(this));
        this.reset = pillButton;
        TextView text$default2 = ThemeKt.text$default(getCtx(), "", 13.5f, Ui.INSTANCE.getC().getText3(), null, null, 24, null);
        this.sessions = text$default2;
        this.state = new FocusState(null, false, 0L, 0L, 0, 0L, null, 0, 0L, 511, null);
        TextView text$default3 = ThemeKt.text$default(getCtx(), "", 14.0f, Ui.INSTANCE.getC().getText2(), Fonts.INSTANCE.getSansMedium(), null, 16, null);
        this.overall = text$default3;
        LinearLayout linearLayout3 = new LinearLayout(getCtx());
        linearLayout3.setOrientation(1);
        Unit unit2 = Unit.INSTANCE;
        this.cardsContainer = linearLayout3;
        this.cards = new LinkedHashMap<>();
        this.builtFor = "";
        scrollView.addView(linearLayout, new FrameLayout.LayoutParams(-1, -2));
        linearLayout.addView(ThemeKt.heading$default(getCtx(), "Study", 30.0f, 0, 4, null), ThemeKt.lp$default(0, 0, 0.0f, new StudyScreen$$ExternalSyntheticLambda11(this), 7, null));
        linearLayout.addView(ThemeKt.text$default(getCtx(), "Focus timer and revision checklists", 15.0f, Ui.INSTANCE.getC().getText2(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new StudyScreen$$ExternalSyntheticLambda12(this), 7, null));
        linearLayout.addView(ThemeKt.label$default(getCtx(), "Focus timer", 0, 0.0f, 6, null), ThemeKt.lp$default(0, 0, 0.0f, new StudyScreen$$ExternalSyntheticLambda13(this), 7, null));
        linearLayout.addView(segmentedControl, ThemeKt.lp$default(0, 0, 0.0f, new StudyScreen$$ExternalSyntheticLambda14(this), 7, null));
        linearLayout.addView(linearLayout2, ThemeKt.lp$default(-2, -2, 0.0f, new StudyScreen$$ExternalSyntheticLambda15(this), 4, null));
        linearLayout.addView(progressTrack, ThemeKt.lp$default(-1, ThemeKt.dp(getCtx(), (Number) 16), 0.0f, new StudyScreen$$ExternalSyntheticLambda16(this), 4, null));
        linearLayout.addView(text$default, ThemeKt.lp$default(0, 0, 0.0f, new StudyScreen$$ExternalSyntheticLambda17(this), 7, null));
        LinearLayout linearLayout4 = new LinearLayout(getCtx());
        linearLayout4.setOrientation(0);
        linearLayout4.setGravity(16);
        linearLayout4.addView(pillButton$default, ThemeKt.lp$default(0, -2, 1.0f, null, 8, null));
        linearLayout4.addView(pillButton, ThemeKt.lp$default(-2, -2, 0.0f, new StudyScreen$$ExternalSyntheticLambda1(linearLayout4), 4, null));
        linearLayout.addView(linearLayout4, ThemeKt.lp$default(0, 0, 0.0f, new StudyScreen$$ExternalSyntheticLambda2(this), 7, null));
        linearLayout.addView(text$default2, ThemeKt.lp$default(0, 0, 0.0f, new StudyScreen$$ExternalSyntheticLambda3(this), 7, null));
        linearLayout.addView(ThemeKt.separator(getCtx()), ThemeKt.lp$default(-1, -2, 0.0f, new StudyScreen$$ExternalSyntheticLambda4(this), 4, null));
        LinearLayout linearLayout5 = new LinearLayout(getCtx());
        linearLayout5.setOrientation(0);
        linearLayout5.setGravity(16);
        linearLayout5.addView(ThemeKt.label$default(getCtx(), "Revision checklists", 0, 0.0f, 6, null), ThemeKt.lp$default(0, -2, 1.0f, null, 8, null));
        linearLayout5.addView(text$default3);
        linearLayout.addView(linearLayout5, ThemeKt.lp$default(0, 0, 0.0f, new StudyScreen$$ExternalSyntheticLambda5(this), 7, null));
        linearLayout.addView(ThemeKt.text$default(getCtx(), "Tap a task to tick it off. Use the pencil to edit or delete it.", 14.0f, Ui.INSTANCE.getC().getText3(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new StudyScreen$$ExternalSyntheticLambda6(this), 7, null));
        linearLayout.addView(linearLayout3, ThemeKt.lp$default(0, 0, 0.0f, new StudyScreen$$ExternalSyntheticLambda7(this), 7, null));
        float dp = ThemeKt.dp(getCtx(), (Number) 60);
        rollingNumberView.setTextSizePx(dp);
        rollingNumberView2.setTextSizePx(dp);
        float f = 0.06f * dp;
        rollingNumberView.setVerticalGapPx(f);
        rollingNumberView2.setVerticalGapPx(f);
        text.setPadding(ThemeKt.dp(getCtx(), (Number) 4), 0, ThemeKt.dp(getCtx(), (Number) 4), (int) (dp * 0.14f));
        rollingNumberView.setCountsDown(true);
        rollingNumberView2.setCountsDown(true);
        segmentedControl.setOnSelect(new StudyScreen$$ExternalSyntheticLambda8(this));
    }

    public static final void access$setExpanded$p(StudyScreen studyScreen, Subject subject) {
        studyScreen.expanded = subject;
    }

    public static final void access$updateCards(StudyScreen studyScreen, Season season) {
        studyScreen.updateCards(season);
    }

    @Override
    public View getRoot() {
        return this.scroll;
    }

    private static final Unit colon$lambda$1(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setGravity(17);
        return Unit.INSTANCE;
    }

    private static final Unit primary$lambda$3(StudyScreen studyScreen, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        studyScreen.onPrimary();
        return Unit.INSTANCE;
    }

    private static final Unit reset$lambda$4(StudyScreen studyScreen, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        studyScreen.onReset();
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$5(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$6(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$7(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 24);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$8(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 12);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$9(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 18);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$10(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$11(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 10);
        return Unit.INSTANCE;
    }

    public static final Unit lambda$13$lambda$12(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 10));
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$14(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 18);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$15(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 12);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$16(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 26);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$18(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 22);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$19(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$20(StudyScreen studyScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(studyScreen.getCtx(), (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$21(StudyScreen studyScreen, int i) {
        studyScreen.state = FocusTimer.INSTANCE.select(studyScreen.state, (FocusMode) FocusMode.getEntries().get(i));
        studyScreen.saveFocus();
        return Unit.INSTANCE;
    }

    @Override
    public void onShow(boolean z) {
        this.state = getHost().getStore().getFocus();
        this.lastPhase = null;
        AppData data = getHost().getData();
        String str = String.valueOf(data.getChoices()) + '|' + CollectionsKt.joinToString(data.getExams(), ", ", "", "", -1, "...", new StudyScreen$$ExternalSyntheticLambda18());
        if (!Intrinsics.areEqual(str, this.builtFor)) {
            this.builtFor = str;
            buildCards();
        }
        refreshFocus(false);
        updateCards(getHost().getSeason());
        onMotionChanged();
        getHost().getAmbient().add(this);
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
            ScreenKt.staggerIn$default(arrayList2, true, 0L, 4, null);
        }
    }

    private static final CharSequence onShow$lambda$22(Exam it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return it.getKey();
    }

    @Override
    public void onHide() {
        getHost().getAmbient().remove(this);
        this.colon.setAlpha(1.0f);
    }

    @Override
    public void onDataChanged() {
        this.builtFor = "";
    }

    @Override
    public void onMotionChanged() {
        this.minutes.setAnimateChanges(getHost().getPolicy().getMotion());
        this.seconds.setAnimateChanges(getHost().getPolicy().getMotion());
        this.modeControl.setAnimateChanges(getHost().getPolicy().getMotion());
        boolean ambient = getHost().getPolicy().getAmbient();
        this.smoothing = ambient;
        if (ambient) {
            return;
        }
        this.colon.setAlpha(1.0f);
        this.track.setShimmer(-1.0f);
    }

    @Override
    public void applyInsets(int i, int i2) {
        this.content.setPadding(ThemeKt.dp(getCtx(), (Number) 20), i + ThemeKt.dp(getCtx(), (Number) 8), ThemeKt.dp(getCtx(), (Number) 20), ThemeKt.dp(getCtx(), (Number) 24));
    }

    @Override
    public void tick(Season season) {
        Intrinsics.checkNotNullParameter(season, "season");
        refreshFocus(false);
        updateCards(season);
    }

    @Override
    public long nextTickDelay(long j) {
        if (!this.state.getRunning()) {
            long j2 = 1000;
            return j2 - (j % j2);
        }
        long remaining = FocusTimer.INSTANCE.remaining(this.state, AppClock.INSTANCE.moment(getCtx())) % 1000;
        if (remaining == 0) {
            remaining = 1000;
        }
        return remaining + 5;
    }

    @Override
    public void onAmbientFrame(long j) {
        if (this.smoothing) {
            if (!this.state.getRunning()) {
                if (this.colon.getAlpha() != 1.0f) {
                    this.colon.setAlpha(1.0f);
                }
                this.track.setShimmer(-1.0f);
                return;
            }
            long remaining = FocusTimer.INSTANCE.remaining(this.state, AppClock.INSTANCE.moment(getCtx()));
            this.track.set(((float) remaining) / ((float) this.state.getMode().getDurationMs()), false);
            this.track.setShimmer(((((float) (j % 2800)) / 2800.0f) * 1.5f) - 0.25f);
            this.colon.setAlpha((((((float) Math.cos((((float) (remaining % 1000)) / 1000.0f) * 6.283f)) * 0.5f) + 0.5f) * 0.65f) + 0.35f);
        }
    }

    public final void reveal(Subject subject) {
        if (subject == null) {
            return;
        }
        if (this.cards.isEmpty()) {
            onShow(false);
        }
        this.expanded = subject;
        for (Map.Entry<Subject, ChecklistCard> entry : this.cards.entrySet()) {
            entry.getValue().setExpanded(entry.getKey() == subject, false);
        }
        ChecklistCard checklistCard = this.cards.get(subject);
        if (checklistCard == null) {
            return;
        }
        this.scroll.post(new StudyScreen$$ExternalSyntheticLambda19(this, checklistCard));
    }

    private static final void reveal$lambda$26(StudyScreen studyScreen, ChecklistCard checklistCard) {
        int top = (studyScreen.cardsContainer.getTop() + checklistCard.getView().getTop()) - ThemeKt.dp(studyScreen.getCtx(), (Number) 8);
        boolean motion = studyScreen.getHost().getPolicy().getMotion();
        ScrollView scrollView = studyScreen.scroll;
        if (motion) {
            scrollView.smoothScrollTo(0, top);
        } else {
            scrollView.scrollTo(0, top);
        }
    }

    private final void refreshFocus(boolean z) {
        String str;
        String str2;
        Pair pair;
        Moment moment = AppClock.INSTANCE.moment(getCtx());
        FocusState focusState = FocusTimer.INSTANCE.settle(this.state, moment, AppClock.INSTANCE.localEpochDay());
        if (!Intrinsics.areEqual(focusState, this.state)) {
            boolean z2 = this.state.getRunning() && !focusState.getRunning();
            this.state = focusState;
            getHost().getStore().setFocus(focusState);
            if (z2) {
                celebrateSession();
            }
        }
        long remaining = FocusTimer.INSTANCE.remaining(this.state, moment);
        long j = (999 + remaining) / 1000;
        long j2 = 60;
        long j3 = j / j2;
        RollingNumberView.setValue$default(this.minutes, j3, false, 2, null);
        long j4 = j % j2;
        RollingNumberView.setValue$default(this.seconds, j4, false, 2, null);
        this.track.setFillColor(this.state.getMode() == FocusMode.FOCUS ? Ui.INSTANCE.getC().getGreen() : Ui.INSTANCE.getC().getGold());
        if (!this.state.getRunning() || !this.smoothing) {
            this.track.set(((float) remaining) / ((float) this.state.getMode().getDurationMs()), z);
        }
        SegmentedControl.select$default(this.modeControl, this.state.getMode().ordinal(), false, false, 6, null);
        FocusPhase phase = FocusTimer.INSTANCE.phase(this.state, moment);
        TextView textView = this.phaseText;
        int i = WhenMappings.$EnumSwitchMapping$0[phase.ordinal()];
        if (i == 1) {
            str = this.state.getMode() == FocusMode.FOCUS ? "Ready for 25 minutes of focus." : "Ready for a 5-minute break.";
        } else if (i == 2) {
            str = this.state.getMode() == FocusMode.FOCUS ? "Focusing… The line shows the time left." : "On a break. Stretch, drink some water.";
        } else if (i == 3) {
            str = "Paused. Resume whenever you’re ready.";
        } else if (i != 4) {
            throw new NoWhenBranchMatchedException();
        } else {
            str = this.state.getFinished() == FocusMode.BREAK ? "Break over." : "Session complete! Time for a 5-minute break.";
        }
        ThemeKt.update(textView, str);
        if (phase != this.lastPhase) {
            this.lastPhase = phase;
            int i2 = WhenMappings.$EnumSwitchMapping$0[phase.ordinal()];
            if (i2 == 1) {
                pair = TuplesKt.to(this.state.getMode() != FocusMode.FOCUS ? "Start break" : "Start focus", Integer.valueOf((int) R.drawable.ic_play));
            } else if (i2 == 2) {
                pair = TuplesKt.to("Pause", Integer.valueOf((int) R.drawable.ic_pause));
            } else if (i2 == 3) {
                pair = TuplesKt.to("Resume", Integer.valueOf((int) R.drawable.ic_play));
            } else if (i2 != 4) {
                throw new NoWhenBranchMatchedException();
            } else {
                pair = this.state.getFinished() == FocusMode.BREAK ? TuplesKt.to("Start focus", Integer.valueOf((int) R.drawable.ic_bolt)) : TuplesKt.to("Start 5-min break", Integer.valueOf((int) R.drawable.ic_coffee));
            }
            int intValue = ((Number) pair.component2()).intValue();
            this.primary.setText((String) pair.component1());
            ControlsKt.setLeadingIcon$default(this.primary, intValue, 0, 2, null);
            this.reset.setVisibility(phase == FocusPhase.READY ? 8 : 0);
        }
        TextView textView2 = this.sessions;
        int sessionsToday = this.state.getSessionsToday();
        if (sessionsToday == 0) {
            str2 = "No focus sessions yet today. You can pause any time.";
        } else if (sessionsToday == 1) {
            str2 = "1 focus session done today. Nice!";
        } else {
            str2 = sessionsToday + " focus sessions done today. Great work!";
        }
        ThemeKt.update(textView2, str2);
        this.timerRow.setContentDescription(this.state.getMode().getLabel() + " timer, " + j3 + " minutes " + j4 + " seconds left. " + ((Object) this.phaseText.getText()));
    }

    private final void onPrimary() {
        FocusState start;
        Moment moment = AppClock.INSTANCE.moment(getCtx());
        int i = WhenMappings.$EnumSwitchMapping$0[FocusTimer.INSTANCE.phase(this.state, moment).ordinal()];
        if (i == 1 || i == 3) {
            start = FocusTimer.INSTANCE.start(this.state, moment);
        } else if (i == 2) {
            start = FocusTimer.INSTANCE.pause(this.state, moment);
        } else if (i == 4) {
            start = this.state.getFinished() == FocusMode.BREAK ? FocusTimer.INSTANCE.startFocus(this.state, moment) : FocusTimer.INSTANCE.startBreak(this.state, moment);
        } else {
            throw new NoWhenBranchMatchedException();
        }
        this.state = start;
        saveFocus();
    }

    private final void onReset() {
        this.state = FocusTimer.INSTANCE.reset(this.state);
        saveFocus();
    }

    private final void saveFocus() {
        getHost().getStore().setFocus(this.state);
        getHost().rescheduleAlarms();
        refreshFocus(true);
        getHost().requestTick();
    }

    private final void celebrateSession() {
        Haptics.INSTANCE.confirm(this.timerRow);
        if (getHost().getPolicy().getMotion()) {
            this.timerRow.setPivotX(0.0f);
            this.timerRow.animate().scaleX(1.05f).scaleY(1.05f).setDuration(120L).setInterpolator(Ease.INSTANCE.getOut()).withEndAction(new StudyScreen$$ExternalSyntheticLambda20(this)).start();
            getHost().popAt(this.timerRow, 1.1f);
        }
    }

    private static final void celebrateSession$lambda$27(StudyScreen studyScreen) {
        studyScreen.timerRow.animate().scaleX(1.0f).scaleY(1.0f).setInterpolator(new Spring(0.7f)).setDuration(280L).start();
    }

    private final void buildCards() {
        this.cardsContainer.removeAllViews();
        this.cards.clear();
        int i = 0;
        for (Object obj : getHost().getSeason().getExams()) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            ExamStatus examStatus = (ExamStatus) obj;
            ChecklistCard checklistCard = new ChecklistCard(this, examStatus.getExam().getSubject());
            this.cards.put(examStatus.getExam().getSubject(), checklistCard);
            if (i > 0) {
                this.cardsContainer.addView(ThemeKt.separator(getCtx()));
            }
            this.cardsContainer.addView(checklistCard.getView(), ThemeKt.lp$default(0, 0, 0.0f, null, 15, null));
            checklistCard.load();
            checklistCard.setExpanded(examStatus.getExam().getSubject() == this.expanded, false);
            i = i2;
        }
    }

    private final void updateCards(Season season) {
        int i;
        int i2 = 0;
        int i3 = 0;
        for (ExamStatus examStatus : season.getExams()) {
            ChecklistCard checklistCard = this.cards.get(examStatus.getExam().getSubject());
            if (checklistCard != null) {
                checklistCard.bindHeader(examStatus);
                List<CheckItem> items = checklistCard.getItems();
                if ((items instanceof Collection) && items.isEmpty()) {
                    i = 0;
                } else {
                    i = 0;
                    for (CheckItem checkItem : items) {
                        if (checkItem.getDone() && (i = i + 1) < 0) {
                            CollectionsKt.throwCountOverflow();
                        }
                    }
                }
                i2 += i;
                i3 += checklistCard.getItems().size();
            }
        }
        ThemeKt.update(this.overall, i2 + " / " + i3 + " done");
    }

    public final class ChecklistCard {
        private final LinearLayout body;
        private final TextView caption;
        private final ImageView chevron;
        private String headerSignature;
        private boolean isExpanded;
        private List<CheckItem> items;
        private final LinearLayout itemsBox;
        private String key;
        private final MiniRing ring;
        private final Subject subject;
        final StudyScreen this$0;
        private final TextView title;
        private final LinearLayout view;

        public class WhenMappings {
            public static final int[] $EnumSwitchMapping$0;

            static {
                int[] iArr = new int[Phase.values().length];
                try {
                    iArr[Phase.DONE.ordinal()] = 1;
                } catch (NoSuchFieldError unused) {
                }
                try {
                    iArr[Phase.LIVE.ordinal()] = 2;
                } catch (NoSuchFieldError unused2) {
                }
                try {
                    iArr[Phase.UPCOMING.ordinal()] = 3;
                } catch (NoSuchFieldError unused3) {
                }
                $EnumSwitchMapping$0 = iArr;
            }
        }

        public static Unit m80$r8$lambda$8gIeWvDFa1m2BMsqypChfAMHlc(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
            return itemRow$lambda$21$lambda$18(linearLayout, layoutParams);
        }

        public static Unit m81$r8$lambda$EVXfNsY_rLuxVU3whHqp2Phuys(ChecklistCard checklistCard, CheckItem checkItem) {
            return editItem$lambda$26(checklistCard, checkItem);
        }

        public static Unit m82$r8$lambda$FHIBbhxAos1qOq2wSaVUJVwgSg(ChecklistCard checklistCard, TextView textView) {
            return _init_$lambda$9(checklistCard, textView);
        }

        public static void m83$r8$lambda$ICuL7rzcuT90Vuyaj7aIi54E9Q(ChecklistCard checklistCard) {
            itemRow$lambda$21$lambda$20$lambda$19(checklistCard);
        }

        public static Unit $r8$lambda$Ull3389qnMNMVARkYSOH5FlAmKs(StudyScreen studyScreen, ChecklistCard checklistCard, TextView textView) {
            return _init_$lambda$7(studyScreen, checklistCard, textView);
        }

        public static void $r8$lambda$c7EqHIZa0grOGryBhfSWfzHPa6I(ChecklistCard checklistCard, CheckItem checkItem, View view) {
            itemRow$lambda$17$lambda$16(checklistCard, checkItem, view);
        }

        public static Unit $r8$lambda$dQl71Y0_tkt3n2R6CU44mKSzJQA(ChecklistCard checklistCard, CheckItem checkItem, String str) {
            return editItem$lambda$28(checklistCard, checkItem, str);
        }

        public static Unit m84$r8$lambda$hkyUgmwjl1WdIzHxxFeQwcBIfg(ChecklistCard checklistCard, String str) {
            return addItem$lambda$24(checklistCard, str);
        }

        public static void $r8$lambda$ogHgoFPUeAvy3A9hVzl4NrmbRvk(CheckItem checkItem, CheckCircle checkCircle, StudyScreen studyScreen, LinearLayout linearLayout, ChecklistCard checklistCard, TextView textView, View view) {
            itemRow$lambda$21$lambda$20(checkItem, checkCircle, studyScreen, linearLayout, checklistCard, textView, view);
        }

        public static Unit $r8$lambda$qLmofH8f4bAC4yty5yPYOaAA7GY(StudyScreen studyScreen, ChecklistCard checklistCard) {
            return restoreDefaults$lambda$29(studyScreen, checklistCard);
        }

        public static Unit $r8$lambda$xrRe_A12QNKUYQZoT_PAAsqujuk(CheckItem checkItem, TextView textView) {
            return itemRow$lambda$15(checkItem, textView);
        }

        public ChecklistCard(StudyScreen studyScreen, Subject subject) {
            Intrinsics.checkNotNullParameter(subject, "subject");
            this.this$0 = studyScreen;
            this.subject = subject;
            MiniRing miniRing = new MiniRing(studyScreen.getCtx());
            this.ring = miniRing;
            TextView text$default = ThemeKt.text$default(studyScreen.getCtx(), "", 16.5f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null);
            this.title = text$default;
            TextView text$default2 = ThemeKt.text$default(studyScreen.getCtx(), "", 13.5f, Ui.INSTANCE.getC().getText3(), null, null, 24, null);
            this.caption = text$default2;
            ImageView imageView = new ImageView(studyScreen.getCtx());
            imageView.setImageResource(R.drawable.ic_expand);
            imageView.setImageTintList(ColorStateList.valueOf(Ui.INSTANCE.getC().getText2()));
            imageView.setImportantForAccessibility(2);
            this.chevron = imageView;
            LinearLayout linearLayout = new LinearLayout(studyScreen.getCtx());
            linearLayout.setOrientation(1);
            Unit unit = Unit.INSTANCE;
            this.body = linearLayout;
            LinearLayout linearLayout2 = new LinearLayout(studyScreen.getCtx());
            linearLayout2.setOrientation(1);
            Unit unit2 = Unit.INSTANCE;
            this.itemsBox = linearLayout2;
            this.key = "";
            this.headerSignature = "";
            this.items = CollectionsKt.emptyList();
            LinearLayout linearLayout3 = new LinearLayout(studyScreen.getCtx());
            linearLayout3.setOrientation(0);
            linearLayout3.setGravity(16);
            LinearLayout linearLayout4 = linearLayout3;
            linearLayout3.setMinimumHeight(ThemeKt.dp(linearLayout4, (Number) 64));
            linearLayout3.setPadding(0, ThemeKt.dp(linearLayout4, (Number) 10), ThemeKt.dp(linearLayout4, (Number) 4), ThemeKt.dp(linearLayout4, (Number) 10));
            linearLayout3.setBackground(Shapes.INSTANCE.ripple(studyScreen.getCtx(), null, (Number) 12));
            linearLayout3.addView(miniRing, ThemeKt.lp$default(ThemeKt.dp(linearLayout4, (Number) 32), ThemeKt.dp(linearLayout4, (Number) 32), 0.0f, null, 12, null));
            LinearLayout linearLayout5 = new LinearLayout(studyScreen.getCtx());
            linearLayout5.setOrientation(1);
            linearLayout5.addView(text$default);
            linearLayout5.addView(text$default2, ThemeKt.lp$default(0, 0, 0.0f, new StudyScreen$ChecklistCard$$ExternalSyntheticLambda3(linearLayout5), 7, null));
            linearLayout3.addView(linearLayout5, ThemeKt.lp(0, -2, 1.0f, new StudyScreen$ChecklistCard$$ExternalSyntheticLambda4(linearLayout3)));
            linearLayout3.addView(imageView, ThemeKt.lp$default(ThemeKt.dp(linearLayout4, (Number) 24), ThemeKt.dp(linearLayout4, (Number) 24), 0.0f, null, 12, null));
            linearLayout3.setOnClickListener(new StudyScreen$ChecklistCard$$ExternalSyntheticLambda5(this));
            TextView text = ThemeKt.text(studyScreen.getCtx(), "Add a task", 15.0f, Ui.INSTANCE.getC().getGreenText(), Fonts.INSTANCE.getSansSemibold(), new StudyScreen$ChecklistCard$$ExternalSyntheticLambda6(studyScreen, this));
            TextView text2 = ThemeKt.text(studyScreen.getCtx(), "Restore suggested tasks", 13.5f, Ui.INSTANCE.getC().getText3(), Fonts.INSTANCE.getSansMedium(), new StudyScreen$ChecklistCard$$ExternalSyntheticLambda7(this));
            linearLayout.setPadding(ThemeKt.dp(studyScreen.getCtx(), (Number) 46), 0, 0, ThemeKt.dp(studyScreen.getCtx(), (Number) 10));
            linearLayout.addView(linearLayout2);
            LinearLayout linearLayout6 = new LinearLayout(studyScreen.getCtx());
            linearLayout6.setOrientation(0);
            linearLayout6.setGravity(16);
            linearLayout6.addView(text, ThemeKt.lp$default(0, -2, 1.0f, null, 8, null));
            linearLayout6.addView(text2, ThemeKt.lp$default(-2, -2, 0.0f, null, 12, null));
            linearLayout.addView(linearLayout6);
            linearLayout.setVisibility(8);
            LinearLayout linearLayout7 = new LinearLayout(studyScreen.getCtx());
            linearLayout7.setOrientation(1);
            linearLayout7.addView(linearLayout4);
            linearLayout7.addView(linearLayout);
            this.view = linearLayout7;
        }

        public final Subject getSubject() {
            return this.subject;
        }

        public final LinearLayout getView() {
            return this.view;
        }

        public final List<CheckItem> getItems() {
            return this.items;
        }

        public static final Unit lambda$5$lambda$2$lambda$1(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
            Intrinsics.checkNotNullParameter(lp, "$this$lp");
            lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
            return Unit.INSTANCE;
        }

        public static final Unit lambda$5$lambda$3(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
            Intrinsics.checkNotNullParameter(lp, "$this$lp");
            lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 14));
            return Unit.INSTANCE;
        }

        public static final void lambda$5$lambda$4(ChecklistCard checklistCard, View view) {
            checklistCard.toggle();
        }

        private static final Unit _init_$lambda$7(StudyScreen studyScreen, ChecklistCard checklistCard, TextView text) {
            Intrinsics.checkNotNullParameter(text, "$this$text");
            text.setGravity(16);
            TextView textView = text;
            text.setMinHeight(ThemeKt.dp(textView, (Number) 48));
            text.setPadding(ThemeKt.dp(textView, (Number) 2), 0, ThemeKt.dp(textView, (Number) 12), 0);
            ControlsKt.setLeadingIcon(text, R.drawable.ic_add, 20);
            text.setBackground(Shapes.INSTANCE.ripple(studyScreen.getCtx(), null, (Number) 12));
            text.setOnClickListener(new StudyScreen$ChecklistCard$$ExternalSyntheticLambda15(checklistCard));
            return Unit.INSTANCE;
        }

        public static final void lambda$7$lambda$6(ChecklistCard checklistCard, View view) {
            checklistCard.addItem();
        }

        private static final Unit _init_$lambda$9(ChecklistCard checklistCard, TextView text) {
            Intrinsics.checkNotNullParameter(text, "$this$text");
            text.setGravity(16);
            TextView textView = text;
            text.setMinHeight(ThemeKt.dp(textView, (Number) 44));
            text.setPadding(ThemeKt.dp(textView, (Number) 12), 0, ThemeKt.dp(textView, (Number) 4), 0);
            text.setOnClickListener(new StudyScreen$ChecklistCard$$ExternalSyntheticLambda14(checklistCard));
            return Unit.INSTANCE;
        }

        public static final void lambda$9$lambda$8(ChecklistCard checklistCard, View view) {
            checklistCard.restoreDefaults();
        }

        public final void load() {
            Choices choices = this.this$0.getHost().getData().getChoices();
            this.key = Checklists.INSTANCE.key(this.subject, choices);
            this.items = this.this$0.getHost().getStore().checklist(this.key, Checklists.INSTANCE.defaults(this.subject, choices));
            renderItems();
        }

        public final void bindHeader(ExamStatus status) {
            String str;
            Intrinsics.checkNotNullParameter(status, "status");
            Choices choices = this.this$0.getHost().getData().getChoices();
            List<CheckItem> list = this.items;
            int i = 0;
            if (!(list instanceof Collection) || !list.isEmpty()) {
                for (CheckItem checkItem : list) {
                    if (checkItem.getDone() && (i = i + 1) < 0) {
                        CollectionsKt.throwCountOverflow();
                    }
                }
            }
            int i2 = WhenMappings.$EnumSwitchMapping$0[status.getPhase().ordinal()];
            if (i2 == 1) {
                str = "Exam done";
            } else if (i2 == 2) {
                str = "Exam in progress";
            } else if (i2 != 3) {
                throw new NoWhenBranchMatchedException();
            } else {
                str = Formats.INSTANCE.relativeDay(status.getExam().getDate(), this.this$0.getHost().getSeason().getNow());
            }
            String str2 = status.getExam().getKey() + '|' + choices + '|' + i + '|' + this.items.size() + '|' + str;
            if (Intrinsics.areEqual(str2, this.headerSignature)) {
                return;
            }
            this.headerSignature = str2;
            this.title.setText(status.getExam().title(choices));
            this.caption.setText(Formats.INSTANCE.dateShort(status.getExam().getDate()) + " · " + str + " · " + i + " of " + this.items.size() + " done");
            this.ring.setAnimateChanges(this.this$0.getHost().getPolicy().getMotion());
            this.ring.set(i, this.items.size());
        }

        public final void toggle() {
            setExpanded(!this.isExpanded, true);
            if (this.isExpanded) {
                StudyScreen.access$setExpanded$p(this.this$0, this.subject);
            }
        }

        public final void setExpanded(boolean z, boolean z2) {
            this.isExpanded = z;
            this.body.setVisibility(z ? 0 : 8);
            float f = z ? 180.0f : 0.0f;
            if (z2 && this.this$0.getHost().getPolicy().getMotion()) {
                this.chevron.animate().rotation(f).setDuration(220L).setInterpolator(Ease.INSTANCE.getInOut()).start();
                if (z) {
                    this.body.setAlpha(0.0f);
                    this.body.setTranslationY(-ThemeKt.dp(this.this$0.getCtx(), (Number) 8));
                    this.body.animate().translationY(0.0f).setDuration(240L).setInterpolator(Ease.INSTANCE.getOut()).start();
                    FxKt.fadeTo$default(this.body, 1.0f, 200L, 0L, 4, null);
                    return;
                }
                return;
            }
            this.chevron.setRotation(f);
        }

        private final void renderItems() {
            this.itemsBox.removeAllViews();
            for (CheckItem checkItem : this.items) {
                this.itemsBox.addView(itemRow(checkItem));
            }
        }

        private final View itemRow(CheckItem checkItem) {
            CheckCircle checkCircle = new CheckCircle(this.this$0.getCtx());
            checkCircle.setChecked(checkItem.getDone(), false);
            TextView text$default = ThemeKt.text$default(this.this$0.getCtx(), checkItem.getText(), 15.5f, checkItem.getDone() ? Ui.INSTANCE.getC().getText3() : Ui.INSTANCE.getC().getText(), null, new StudyScreen$ChecklistCard$$ExternalSyntheticLambda8(checkItem), 8, null);
            ImageView imageView = new ImageView(this.this$0.getCtx());
            StudyScreen studyScreen = this.this$0;
            imageView.setImageResource(R.drawable.ic_edit);
            imageView.setImageTintList(ColorStateList.valueOf(Ui.INSTANCE.getC().getText3()));
            ImageView imageView2 = imageView;
            imageView.setPadding(ThemeKt.dp(imageView2, (Number) 12), ThemeKt.dp(imageView2, (Number) 12), ThemeKt.dp(imageView2, (Number) 12), ThemeKt.dp(imageView2, (Number) 12));
            imageView.setBackground(Shapes.INSTANCE.ripple(studyScreen.getCtx(), null, (Number) 20));
            imageView.setContentDescription("Edit “" + checkItem.getText() + Typography.rightDoubleQuote);
            imageView.setOnClickListener(new StudyScreen$ChecklistCard$$ExternalSyntheticLambda9(this, checkItem));
            Context ctx = this.this$0.getCtx();
            StudyScreen studyScreen2 = this.this$0;
            LinearLayout linearLayout = new LinearLayout(ctx);
            linearLayout.setOrientation(0);
            linearLayout.setGravity(16);
            LinearLayout linearLayout2 = linearLayout;
            linearLayout.setMinimumHeight(ThemeKt.dp(linearLayout2, (Number) 48));
            linearLayout.setBackground(Shapes.INSTANCE.ripple(studyScreen2.getCtx(), null, (Number) 10));
            linearLayout.addView(checkCircle, ThemeKt.lp$default(ThemeKt.dp(linearLayout2, (Number) 22), ThemeKt.dp(linearLayout2, (Number) 22), 0.0f, null, 12, null));
            linearLayout.addView(text$default, ThemeKt.lp(0, -2, 1.0f, new StudyScreen$ChecklistCard$$ExternalSyntheticLambda10(linearLayout)));
            linearLayout.addView(imageView2, ThemeKt.lp$default(ThemeKt.dp(linearLayout2, (Number) 44), ThemeKt.dp(linearLayout2, (Number) 44), 0.0f, null, 12, null));
            linearLayout.setContentDescription(checkItem.getText() + ", " + (checkItem.getDone() ? "done" : "not done"));
            linearLayout.setOnClickListener(new StudyScreen$ChecklistCard$$ExternalSyntheticLambda11(checkItem, checkCircle, studyScreen2, linearLayout, this, text$default));
            return linearLayout2;
        }

        private static final Unit itemRow$lambda$15(CheckItem checkItem, TextView text) {
            Intrinsics.checkNotNullParameter(text, "$this$text");
            text.setPaintFlags(checkItem.getDone() ? text.getPaintFlags() | 16 : text.getPaintFlags() & (-17));
            return Unit.INSTANCE;
        }

        private static final void itemRow$lambda$17$lambda$16(ChecklistCard checklistCard, CheckItem checkItem, View view) {
            checklistCard.editItem(checkItem);
        }

        private static final Unit itemRow$lambda$21$lambda$18(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
            Intrinsics.checkNotNullParameter(lp, "$this$lp");
            lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 14));
            return Unit.INSTANCE;
        }

        private static final void itemRow$lambda$21$lambda$20(CheckItem checkItem, CheckCircle checkCircle, StudyScreen studyScreen, LinearLayout linearLayout, ChecklistCard checklistCard, TextView textView, View view) {
            CheckItem copy$default = CheckItem.copy$default(checkItem, 0L, null, !checkItem.getDone(), 3, null);
            checkCircle.setChecked(copy$default.getDone(), studyScreen.getHost().getPolicy().getMotion());
            if (copy$default.getDone()) {
                Haptics.INSTANCE.confirm(linearLayout);
            } else {
                Haptics.INSTANCE.tap(linearLayout);
            }
            checklistCard.replace(checkItem, copy$default);
            textView.setTextColor(copy$default.getDone() ? Ui.INSTANCE.getC().getText3() : Ui.INSTANCE.getC().getText());
            textView.setPaintFlags(copy$default.getDone() ? textView.getPaintFlags() | 16 : textView.getPaintFlags() & (-17));
            linearLayout.setContentDescription(checkItem.getText() + ", " + (copy$default.getDone() ? "done" : "not done"));
            linearLayout.setOnClickListener(null);
            linearLayout.postDelayed(new StudyScreen$ChecklistCard$$ExternalSyntheticLambda2(checklistCard), studyScreen.getHost().getPolicy().getMotion() ? 340L : 0L);
        }

        private static final void itemRow$lambda$21$lambda$20$lambda$19(ChecklistCard checklistCard) {
            checklistCard.renderItems();
        }

        private final void replace(CheckItem checkItem, CheckItem checkItem2) {
            List<CheckItem> list = this.items;
            ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(list, 10));
            for (CheckItem checkItem3 : list) {
                if (checkItem3.getId() == checkItem.getId()) {
                    checkItem3 = checkItem2;
                }
                arrayList.add(checkItem3);
            }
            this.items = arrayList;
            save(false);
        }

        private final void addItem() {
            Dialogs.editText$default(Dialogs.INSTANCE, this.this$0.getHost(), "New task", "", "e.g. Revise chapter 3", 0, null, new StudyScreen$ChecklistCard$$ExternalSyntheticLambda1(this), 48, null);
        }

        private static final Unit addItem$lambda$24(ChecklistCard checklistCard, String text) {
            Long l;
            Intrinsics.checkNotNullParameter(text, "text");
            if (StringsKt.isBlank(text)) {
                return Unit.INSTANCE;
            }
            Iterator<CheckItem> it = checklistCard.items.iterator();
            if (it.hasNext()) {
                Long valueOf = Long.valueOf(((CheckItem) it.next()).getId());
                while (it.hasNext()) {
                    Long valueOf2 = Long.valueOf(((CheckItem) it.next()).getId());
                    if (valueOf.compareTo(valueOf2) < 0) {
                        valueOf = valueOf2;
                    }
                }
                l = valueOf;
            } else {
                l = null;
            }
            Long l2 = l;
            checklistCard.items = CollectionsKt.plus((Collection<? extends CheckItem>) checklistCard.items, new CheckItem((l2 != null ? l2.longValue() : 0L) + 1, text, false, 4, null));
            checklistCard.save(true);
            return Unit.INSTANCE;
        }

        private final void editItem(CheckItem checkItem) {
            Dialogs.editText$default(Dialogs.INSTANCE, this.this$0.getHost(), "Edit task", checkItem.getText(), null, 0, new StudyScreen$ChecklistCard$$ExternalSyntheticLambda12(this, checkItem), new StudyScreen$ChecklistCard$$ExternalSyntheticLambda13(this, checkItem), 24, null);
        }

        private static final Unit editItem$lambda$26(ChecklistCard checklistCard, CheckItem checkItem) {
            ArrayList arrayList = new ArrayList();
            for (Object obj : checklistCard.items) {
                if (((CheckItem) obj).getId() != checkItem.getId()) {
                    arrayList.add(obj);
                }
            }
            checklistCard.items = arrayList;
            checklistCard.save(true);
            return Unit.INSTANCE;
        }

        private static final Unit editItem$lambda$28(ChecklistCard checklistCard, CheckItem checkItem, String text) {
            Intrinsics.checkNotNullParameter(text, "text");
            List<CheckItem> list = checklistCard.items;
            ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(list, 10));
            for (CheckItem checkItem2 : list) {
                if (checkItem2.getId() == checkItem.getId()) {
                    checkItem2 = CheckItem.copy$default(checkItem2, 0L, text, false, 5, null);
                }
                arrayList.add(checkItem2);
            }
            checklistCard.items = arrayList;
            checklistCard.save(true);
            return Unit.INSTANCE;
        }

        private final void restoreDefaults() {
            Dialogs.confirm$default(Dialogs.INSTANCE, this.this$0.getHost(), "Restore suggested tasks?", "This replaces the tasks for " + ((Object) this.title.getText()) + " with the original suggestions.", "Restore", false, new StudyScreen$ChecklistCard$$ExternalSyntheticLambda0(this.this$0, this), 16, null);
        }

        private static final Unit restoreDefaults$lambda$29(StudyScreen studyScreen, ChecklistCard checklistCard) {
            studyScreen.getHost().getStore().resetChecklist(checklistCard.key);
            checklistCard.load();
            checklistCard.headerSignature = "";
            StudyScreen.access$updateCards(studyScreen, studyScreen.getHost().getSeason());
            return Unit.INSTANCE;
        }

        private final void save(boolean z) {
            this.this$0.getHost().getStore().saveChecklist(this.key, this.items);
            if (z) {
                renderItems();
            }
            this.headerSignature = "";
            StudyScreen studyScreen = this.this$0;
            StudyScreen.access$updateCards(studyScreen, studyScreen.getHost().getSeason());
        }
    }

    public static final class MiniRing extends View {
        private boolean animateChanges;
        private ValueAnimator animator;
        private final Paint arc;
        private boolean complete;
        private float fraction;
        private final Paint label;
        private final RectF oval;
        private float shown;
        private final Paint track;

        public static void $r8$lambda$eqq6S2FNg7onuDMzPkN8pcFjAd4(MiniRing miniRing, ValueAnimator valueAnimator) {
            set$lambda$4$lambda$3(miniRing, valueAnimator);
        }

        /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
        public MiniRing(Context context) {
            super(context);
            Intrinsics.checkNotNullParameter(context, "context");
            Paint paint = new Paint(1);
            paint.setStyle(Paint.Style.STROKE);
            Float valueOf = Float.valueOf(3.0f);
            paint.setStrokeWidth(ThemeKt.dpf(context, valueOf));
            this.track = paint;
            Paint paint2 = new Paint(1);
            paint2.setStyle(Paint.Style.STROKE);
            paint2.setStrokeWidth(ThemeKt.dpf(context, valueOf));
            paint2.setStrokeCap(Paint.Cap.ROUND);
            this.arc = paint2;
            Paint paint3 = new Paint(1);
            paint3.setTextAlign(Paint.Align.CENTER);
            paint3.setTypeface(Fonts.INSTANCE.getSansSemibold());
            paint3.setTextSize(ThemeKt.dpf(context, Float.valueOf(10.5f)));
            this.label = paint3;
            this.oval = new RectF();
            setImportantForAccessibility(2);
            this.shown = -1.0f;
            this.animateChanges = true;
        }

        public final void set(int i, int i2) {
            this.fraction = i2 == 0 ? 0.0f : i / (float) i2;
            this.complete = i2 > 0 && i == i2;
            ValueAnimator valueAnimator = this.animator;
            if (valueAnimator != null) {
                valueAnimator.cancel();
            }
            if (this.shown < 0.0f || !isAttachedToWindow() || !this.animateChanges) {
                this.shown = this.fraction;
                invalidate();
                return;
            }
            ValueAnimator ofFloat = ValueAnimator.ofFloat(this.shown, this.fraction);
            ofFloat.setDuration(300L);
            ofFloat.setInterpolator(Ease.INSTANCE.getInOut());
            ofFloat.addUpdateListener(new StudyScreen$MiniRing$$ExternalSyntheticLambda0(this));
            ofFloat.start();
            this.animator = ofFloat;
        }

        private static final void set$lambda$4$lambda$3(MiniRing miniRing, ValueAnimator it) {
            Intrinsics.checkNotNullParameter(it, "it");
            Object animatedValue = it.getAnimatedValue();
            Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
            miniRing.shown = ((Float) animatedValue).floatValue();
            miniRing.invalidate();
        }

        public final boolean getAnimateChanges() {
            return this.animateChanges;
        }

        public final void setAnimateChanges(boolean z) {
            this.animateChanges = z;
        }

        @Override
        protected void onSizeChanged(int i, int i2, int i3, int i4) {
            float strokeWidth = this.track.getStrokeWidth();
            this.oval.set(strokeWidth, strokeWidth, i - strokeWidth, i2 - strokeWidth);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            Intrinsics.checkNotNullParameter(canvas, "canvas");
            this.track.setColor(Ui.INSTANCE.getC().getTrack());
            this.arc.setColor(this.complete ? Ui.INSTANCE.getC().getGold() : Ui.INSTANCE.getC().getGreen());
            this.label.setColor(this.complete ? Ui.INSTANCE.getC().getGoldText() : Ui.INSTANCE.getC().getText2());
            canvas.drawOval(this.oval, this.track);
            float coerceIn = RangesKt.coerceIn(this.shown, 0.0f, 1.0f);
            if (coerceIn > 0.0f) {
                canvas.drawArc(this.oval, -90.0f, coerceIn * 360.0f, false, this.arc);
            }
            canvas.drawText(this.complete ? "✓" : String.valueOf(Math.round(this.fraction * 100)), getWidth() / 2.0f, (getHeight() / 2.0f) - ((this.label.descent() + this.label.ascent()) / 2.0f), this.label);
        }
    }

    public static final class CheckCircle extends View {
        private ValueAnimator animator;
        private final Paint fill;
        private final PathMeasure measure;
        private final Path partial;
        private final Path path;
        private boolean popping;
        private float progress;
        private final Paint ring;
        private final Paint tick;

        public static void $r8$lambda$gAMj40ihKfng5NJowMl_2Vi5ZzQ(CheckCircle checkCircle, ValueAnimator valueAnimator) {
            setChecked$lambda$3$lambda$2(checkCircle, valueAnimator);
        }

        /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
        public CheckCircle(Context context) {
            super(context);
            Intrinsics.checkNotNullParameter(context, "context");
            this.partial = new Path();
            this.measure = new PathMeasure();
            Paint paint = new Paint(1);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(ThemeKt.dpf(context, Float.valueOf(1.8f)));
            this.ring = paint;
            this.fill = new Paint(1);
            Paint paint2 = new Paint(1);
            paint2.setStyle(Paint.Style.STROKE);
            paint2.setStrokeWidth(ThemeKt.dpf(context, Float.valueOf(2.2f)));
            paint2.setStrokeCap(Paint.Cap.ROUND);
            paint2.setStrokeJoin(Paint.Join.ROUND);
            this.tick = paint2;
            this.path = new Path();
            setImportantForAccessibility(2);
        }

        public final void setChecked(boolean z, boolean z2) {
            ValueAnimator valueAnimator = this.animator;
            if (valueAnimator != null) {
                valueAnimator.cancel();
            }
            float f = z ? 1.0f : 0.0f;
            if (!z2) {
                this.progress = f;
                this.popping = false;
                invalidate();
                return;
            }
            this.popping = z;
            ValueAnimator ofFloat = ValueAnimator.ofFloat(this.progress, f);
            ofFloat.setDuration(z ? 320L : 180L);
            ofFloat.setInterpolator(z ? new LinearInterpolator() : new DecelerateInterpolator());
            ofFloat.addUpdateListener(new StudyScreen$CheckCircle$$ExternalSyntheticLambda0(this));
            ofFloat.start();
            this.animator = ofFloat;
        }

        private static final void setChecked$lambda$3$lambda$2(CheckCircle checkCircle, ValueAnimator it) {
            Intrinsics.checkNotNullParameter(it, "it");
            Object animatedValue = it.getAnimatedValue();
            Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
            checkCircle.progress = ((Float) animatedValue).floatValue();
            checkCircle.invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            Intrinsics.checkNotNullParameter(canvas, "canvas");
            float width = getWidth() / 2.0f;
            float height = getHeight() / 2.0f;
            float min = Math.min(width, height) - this.ring.getStrokeWidth();
            this.ring.setColor(Ui.INSTANCE.getC().getText3());
            canvas.drawCircle(width, height, min, this.ring);
            float f = this.progress;
            if (f <= 0.0f) {
                return;
            }
            if (this.popping) {
                f = Ease.INSTANCE.cubicOut(FxKt.window(this.progress, 0.0f, 0.5f));
            }
            float cubicOut = this.popping ? Ease.INSTANCE.cubicOut(FxKt.window(this.progress, 0.3f, 0.7f)) : this.progress;
            this.fill.setColor(Ui.INSTANCE.getC().getGreen());
            this.fill.setAlpha(RangesKt.coerceIn((int) (((float) KotlinVersion.MAX_COMPONENT_VALUE) * (this.popping ? FxKt.window(this.progress, 0.0f, 0.3f) : this.progress)), 0, (int) KotlinVersion.MAX_COMPONENT_VALUE));
            canvas.drawCircle(width, height, ((this.ring.getStrokeWidth() / 2) + min) * ((f * 0.45f) + 0.55f), this.fill);
            this.path.reset();
            this.path.moveTo(width - (0.45f * min), (0.02f * min) + height);
            this.path.lineTo(width - (0.1f * min), (0.36f * min) + height);
            this.path.lineTo(width + (0.48f * min), height - (min * 0.32f));
            this.tick.setColor(Ui.INSTANCE.getC().getOnGreen());
            if (cubicOut >= 1.0f) {
                canvas.drawPath(this.path, this.tick);
            } else if (cubicOut > 0.0f) {
                this.measure.setPath(this.path, false);
                this.partial.reset();
                PathMeasure pathMeasure = this.measure;
                pathMeasure.getSegment(0.0f, pathMeasure.getLength() * cubicOut, this.partial, true);
                canvas.drawPath(this.partial, this.tick);
            }
        }
    }
}

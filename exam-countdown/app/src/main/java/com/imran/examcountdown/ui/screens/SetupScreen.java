package com.imran.examcountdown.ui.screens;

import android.content.res.ColorStateList;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import com.imran.examcountdown.MainActivity;
import com.imran.examcountdown.R;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.Elective;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.Formats;
import com.imran.examcountdown.core.MilLanguage;
import com.imran.examcountdown.core.Profile;
import com.imran.examcountdown.core.Subject;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.Fonts;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.Shapes;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import com.imran.examcountdown.ui.widgets.ButtonStyle;
import com.imran.examcountdown.ui.widgets.ControlsKt;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import kotlin.Metadata;
import kotlin.Pair;
import kotlin.TuplesKt;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.collections.IntIterator;
import kotlin.collections.MapsKt;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.IntRange;
import kotlin.ranges.RangesKt;

public final class SetupScreen {
    private final ImageView back;
    private final LinearLayout column;
    private final MainActivity ctx;
    private Elective elective;
    private final ImageView emblem;
    private final LinearLayout footer;
    private final MainActivity host;
    private MilLanguage mil;
    private final LinearLayout page;
    private final FrameLayout root;
    private final ScrollView scroll;
    private int step;
    private final TextView stepLabel;
    private final LinearLayout steps;

    public static Unit $r8$lambda$2FIsWeXWYcofmh3Wx7sz3deHfNo(TextView textView) {
        return title$lambda$20(textView);
    }

    public static Unit $r8$lambda$7M3W81AS_F7N3Y3B60T1r1AdpT8(SetupScreen setupScreen) {
        return remindersStep$lambda$40$lambda$39(setupScreen);
    }

    public static Unit m67$r8$lambda$F2CXs7Bm0QhR5xaG7DPdGqVfM4(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return remindersStep$lambda$42(setupScreen, layoutParams);
    }

    public static Unit $r8$lambda$GMQ3qhibS1s7QkDNsP64pAe2sJk(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return remindersStep$lambda$37(setupScreen, layoutParams);
    }

    public static void $r8$lambda$IaBgjGsD5OSZMDXluvxw2EudOC4(Function0 function0, View view) {
        choiceRow$lambda$48$lambda$47(function0, view);
    }

    public static Unit m68$r8$lambda$IuVOaeMNkI_VPPuxiiyWhkFs0s(SetupScreen setupScreen, Elective elective, ArrayList arrayList, int i, TextView textView) {
        return electiveStep$lambda$35$lambda$34(setupScreen, elective, arrayList, i, textView);
    }

    public static Unit $r8$lambda$Nr5bIedfb4XHmXCmCotoLcgWYA8(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return choiceRow$lambda$48$lambda$45(linearLayout, layoutParams);
    }

    public static Unit m69$r8$lambda$PsPswHyeabHMqqFGMSsAyj112s(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return electiveStep$lambda$36(setupScreen, layoutParams);
    }

    public static Unit $r8$lambda$Q7JNnc6DiKzyXeIJuD6fHih1zmw(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return milStep$lambda$32(setupScreen, layoutParams);
    }

    public static Unit m70$r8$lambda$RcUDN9I95ZZpGXgO3S_82c80eY(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return title$lambda$21(setupScreen, layoutParams);
    }

    public static Unit $r8$lambda$Tq9laFJkYLsJB4jVbGutSg2OCCs(SetupScreen setupScreen, View view) {
        return remindersStep$lambda$41(setupScreen, view);
    }

    public static Unit $r8$lambda$U24Ku_f7mJTC2KF9eKzAZJu_BJg(SetupScreen setupScreen, View view) {
        return electiveStep$lambda$33(setupScreen, view);
    }

    public static Unit $r8$lambda$VIeN8fzLYeGGANHJBHzP769Nivk(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$13(setupScreen, layoutParams);
    }

    public static Unit $r8$lambda$Xo_ZjTUcRwetPyPBigrmqGCxeK0(SetupScreen setupScreen, View view) {
        return milStep$lambda$29(setupScreen, view);
    }

    public static Unit m71$r8$lambda$anKnMPJS5g_qnWUz5FMcz5CekY(SetupScreen setupScreen, MilLanguage milLanguage, ArrayList arrayList, int i, TextView textView) {
        return milStep$lambda$31$lambda$30(setupScreen, milLanguage, arrayList, i, textView);
    }

    public static Unit $r8$lambda$bq_qXdsNeuBBQv_qMruVJ4p2uvk(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$12(setupScreen, layoutParams);
    }

    public static Unit $r8$lambda$fo64Khon5stxshdbPCFFOEZyTME(SetupScreen setupScreen, View view) {
        return remindersStep$lambda$40(setupScreen, view);
    }

    public static void $r8$lambda$g2sbFh9d6N2yXV6KKccOoKM4K0I(SetupScreen setupScreen, View view) {
        back$lambda$4$lambda$3(setupScreen, view);
    }

    public static Unit $r8$lambda$hkLc0n375kr0KPEFbWxjjE_jsGY(TextView textView) {
        return choiceRow$lambda$48$lambda$46(textView);
    }

    public static Unit $r8$lambda$iEM2mDTfI2v1Z6Gw7rgi8f3vBV4(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return remindersStep$lambda$38(setupScreen, layoutParams);
    }

    public static Unit $r8$lambda$jqOJcfVRi1dvX1lGJD0uRoW3Zkw(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return detail$lambda$27$lambda$26(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$kbfkmJZF4Fz3b3mBNj8l1q7ZvBc(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$14(setupScreen, layoutParams);
    }

    public static Unit $r8$lambda$nb61Jj75hc9RfL1VAv3xT0KXqlw(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return title$lambda$19(setupScreen, layoutParams);
    }

    public static Unit $r8$lambda$o4ou2PCZ4ukxQ3C3hjW31zeSGio(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return welcome$lambda$24(setupScreen, layoutParams);
    }

    public static Unit $r8$lambda$oDR5BlHaXmBRym1eOazC_GeAMMQ(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$9(setupScreen, layoutParams);
    }

    public static Unit m72$r8$lambda$pyk0glGQy6PN4CxuHGYc2klaVo(SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return welcome$lambda$23(setupScreen, layoutParams);
    }

    public static Unit $r8$lambda$uB3MitN8vtf_WCITta7vvU7dU4A(int i, SetupScreen setupScreen, LinearLayout.LayoutParams layoutParams) {
        return render$lambda$16(i, setupScreen, layoutParams);
    }

    public static Unit $r8$lambda$uOwatt38n2ytMhITAc9qfCwyq_Y(SetupScreen setupScreen, View view) {
        return welcome$lambda$25(setupScreen, view);
    }

    public static Unit $r8$lambda$w6_YcEC7EADvRLRCbRh6WdIZj9Q(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return choiceRow$lambda$48$lambda$44$lambda$43(linearLayout, layoutParams);
    }

    public SetupScreen(MainActivity host) {
        Intrinsics.checkNotNullParameter(host, "host");
        this.host = host;
        this.ctx = host;
        FrameLayout frameLayout = new FrameLayout(host);
        frameLayout.setBackgroundColor(Ui.INSTANCE.getC().getBg());
        this.root = frameLayout;
        ScrollView scrollView = new ScrollView(host);
        scrollView.setVerticalScrollBarEnabled(false);
        scrollView.setFillViewport(true);
        this.scroll = scrollView;
        LinearLayout linearLayout = new LinearLayout(host);
        linearLayout.setOrientation(1);
        Unit unit = Unit.INSTANCE;
        this.column = linearLayout;
        ImageView imageView = new ImageView(host);
        imageView.setImageResource(R.drawable.emblem_small);
        imageView.setContentDescription("Al-Ameen Academy emblem");
        this.emblem = imageView;
        TextView label = ThemeKt.label(host, "", Ui.INSTANCE.getC().getText3(), 11.0f);
        this.stepLabel = label;
        LinearLayout linearLayout2 = new LinearLayout(host);
        linearLayout2.setOrientation(0);
        linearLayout2.setGravity(16);
        Unit unit2 = Unit.INSTANCE;
        this.steps = linearLayout2;
        LinearLayout linearLayout3 = new LinearLayout(host);
        linearLayout3.setOrientation(1);
        Unit unit3 = Unit.INSTANCE;
        this.page = linearLayout3;
        LinearLayout linearLayout4 = new LinearLayout(host);
        linearLayout4.setOrientation(1);
        Unit unit4 = Unit.INSTANCE;
        this.footer = linearLayout4;
        ImageView imageView2 = new ImageView(host);
        imageView2.setImageResource(R.drawable.ic_back);
        imageView2.setImageTintList(ColorStateList.valueOf(Ui.INSTANCE.getC().getText2()));
        imageView2.setPadding(ThemeKt.dp(host, (Number) 10), ThemeKt.dp(host, (Number) 10), ThemeKt.dp(host, (Number) 10), ThemeKt.dp(host, (Number) 10));
        imageView2.setBackground(Shapes.INSTANCE.ripple(host, null, (Number) 22));
        imageView2.setContentDescription("Back");
        imageView2.setOnClickListener(new SetupScreen$$ExternalSyntheticLambda0(this));
        this.back = imageView2;
        this.mil = host.getData().getChoices().getMil();
        this.elective = host.getData().getChoices().getElective();
        LinearLayout linearLayout5 = new LinearLayout(host);
        linearLayout5.setOrientation(0);
        linearLayout5.setGravity(16);
        LinearLayout linearLayout6 = linearLayout5;
        linearLayout5.addView(imageView, ThemeKt.lp$default(ThemeKt.dp(linearLayout6, (Number) 36), ThemeKt.dp(linearLayout6, (Number) 36), 0.0f, null, 12, null));
        LinearLayout linearLayout7 = new LinearLayout(host);
        linearLayout7.setOrientation(1);
        linearLayout7.addView(ThemeKt.text$default(host, "Al-Ameen Academy", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSerif(), null, 16, null));
        linearLayout7.addView(ThemeKt.label(host, "Badarpur · Estd. 1994", Ui.INSTANCE.getC().getGoldText(), 10.5f), ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda1(linearLayout7), 7, null));
        linearLayout5.addView(linearLayout7, ThemeKt.lp(0, -2, 1.0f, new SetupScreen$$ExternalSyntheticLambda2(linearLayout5)));
        linearLayout5.addView(label);
        linearLayout.addView(linearLayout6);
        linearLayout.addView(ThemeKt.separator(host), ThemeKt.lp$default(-1, -2, 0.0f, new SetupScreen$$ExternalSyntheticLambda3(this), 4, null));
        LinearLayout linearLayout8 = new LinearLayout(host);
        linearLayout8.setOrientation(0);
        linearLayout8.setGravity(16);
        LinearLayout linearLayout9 = linearLayout8;
        linearLayout8.addView(imageView2, ThemeKt.lp$default(ThemeKt.dp(linearLayout9, (Number) 44), ThemeKt.dp(linearLayout9, (Number) 44), 0.0f, null, 12, null));
        linearLayout8.addView(linearLayout2, ThemeKt.lp(0, -2, 1.0f, new SetupScreen$$ExternalSyntheticLambda4(linearLayout8)));
        linearLayout.addView(linearLayout9, ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda5(this), 7, null));
        linearLayout.addView(linearLayout3, ThemeKt.lp(-1, 0, 1.0f, new SetupScreen$$ExternalSyntheticLambda6(this)));
        linearLayout.addView(linearLayout4, ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda7(this), 7, null));
        scrollView.addView(linearLayout, new FrameLayout.LayoutParams(-1, -1));
        frameLayout.addView(scrollView, ThemeKt.flp$default(-1, -1, 0, 4, null));
        render$default(this, false, false, 2, null);
    }

    public final FrameLayout getRoot() {
        return this.root;
    }

    public final ImageView getEmblem() {
        return this.emblem;
    }

    private static final void back$lambda$4$lambda$3(SetupScreen setupScreen, View view) {
        setupScreen.back();
    }

    public static final Unit lambda$8$lambda$6$lambda$5(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 3);
        return Unit.INSTANCE;
    }

    public static final Unit lambda$8$lambda$7(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 12));
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$9(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 14);
        return Unit.INSTANCE;
    }

    public static final Unit lambda$11$lambda$10(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 8));
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$12(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$13(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 4);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$14(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 20);
        return Unit.INSTANCE;
    }

    public final void applyInsets(int i, int i2) {
        this.column.setPadding(ThemeKt.dp(this.ctx, (Number) 20), i + ThemeKt.dp(this.ctx, (Number) 8), ThemeKt.dp(this.ctx, (Number) 20), i2 + ThemeKt.dp(this.ctx, (Number) 20));
    }

    public final boolean back() {
        int i = this.step;
        if (i == 0) {
            return false;
        }
        this.step = i - 1;
        render(true, false);
        return true;
    }

    private final void next() {
        int i = this.step;
        if (i == 1) {
            MainActivity mainActivity = this.host;
            mainActivity.updateChoices(Choices.copy$default(mainActivity.getData().getChoices(), this.mil, null, 2, null));
        } else if (i == 2) {
            MainActivity mainActivity2 = this.host;
            mainActivity2.updateChoices(Choices.copy$default(mainActivity2.getData().getChoices(), null, this.elective, 1, null));
        }
        int i2 = this.step;
        if (i2 < 3) {
            this.step = i2 + 1;
            render(true, true);
        }
    }

    static void render$default(SetupScreen setupScreen, boolean z, boolean z2, int i, Object obj) {
        if ((i & 2) != 0) {
            z2 = true;
        }
        setupScreen.render(z, z2);
    }

    private final void render(boolean z, boolean z2) {
        View childAt;
        this.steps.removeAllViews();
        int i = 0;
        while (true) {
            if (i >= 4) {
                break;
            }
            LinearLayout linearLayout = this.steps;
            View view = new View(this.ctx);
            view.setBackground(Shapes.rounded$default(Shapes.INSTANCE, this.ctx, (Number) 2, i <= this.step ? Ui.INSTANCE.getC().getGreen() : Ui.INSTANCE.getC().getTrack(), 0, null, 24, null));
            linearLayout.addView(view, ThemeKt.lp(0, ThemeKt.dp(this.ctx, (Number) 4), 1.0f, new SetupScreen$$ExternalSyntheticLambda28(i, this)));
            i++;
        }
        this.stepLabel.setText("STEP " + (this.step + 1) + " OF 4");
        this.back.setVisibility(this.step != 0 ? 0 : 4);
        this.page.removeAllViews();
        this.footer.removeAllViews();
        int i2 = this.step;
        if (i2 == 0) {
            welcome();
        } else if (i2 == 1) {
            milStep();
        } else if (i2 == 2) {
            electiveStep();
        } else {
            remindersStep();
        }
        if (z && this.host.getPolicy().getMotion()) {
            float dp = ThemeKt.dp(this.ctx, (Number) 20);
            int i3 = z2 ? 1 : -1;
            this.page.setAlpha(0.0f);
            this.page.setTranslationX(dp * i3);
            this.page.animate().translationX(0.0f).setDuration(260L).setInterpolator(Ease.INSTANCE.getOut()).start();
            FxKt.fadeTo$default(this.page, 1.0f, 200L, 0L, 4, null);
            IntRange until = RangesKt.until(0, this.page.getChildCount());
            ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(until, 10));
            Iterator<Integer> it = until.iterator();
            while (it.hasNext()) {
                arrayList.add(this.page.getChildAt(((IntIterator) it).nextInt()));
            }
            ScreenKt.staggerIn(arrayList, true, 40L);
            if (z2 && (childAt = this.steps.getChildAt(this.step)) != null) {
                childAt.setPivotX(0.0f);
                childAt.setScaleX(0.0f);
                childAt.animate().scaleX(1.0f).setDuration(280L).setInterpolator(Ease.INSTANCE.getOut()).start();
            }
        }
        this.scroll.scrollTo(0, 0);
    }

    private static final Unit render$lambda$16(int i, SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        if (i > 0) {
            lp.setMarginStart(ThemeKt.dp(setupScreen.ctx, (Number) 6));
        }
        return Unit.INSTANCE;
    }

    private final void title(String str, String str2) {
        this.page.addView(ThemeKt.heading$default(this.ctx, str, 30.0f, 0, 4, null), ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda29(this), 7, null));
        this.page.addView(ThemeKt.text$default(this.ctx, str2, 16.0f, Ui.INSTANCE.getC().getText2(), null, new SetupScreen$$ExternalSyntheticLambda30(), 8, null), ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda31(this), 7, null));
    }

    private static final Unit title$lambda$19(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 12);
        return Unit.INSTANCE;
    }

    private static final Unit title$lambda$20(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.35f);
        return Unit.INSTANCE;
    }

    private static final Unit title$lambda$21(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 8);
        return Unit.INSTANCE;
    }

    private final void welcome() {
        Profile profile = this.host.getData().getProfile();
        title(profile.getFirstName().length() == 0 ? "Hey there" : "Hey, " + profile.getFirstName(), "Let’s get your exam countdown ready. It only takes a moment.");
        LinearLayout linearLayout = new LinearLayout(this.ctx);
        linearLayout.setOrientation(1);
        int i = 0;
        for (Object obj : CollectionsKt.listOf((Object[]) new Pair[]{TuplesKt.to(Integer.valueOf((int) R.drawable.ic_person), profile.getName()), TuplesKt.to(Integer.valueOf((int) R.drawable.ic_school), profile.getSchool()), TuplesKt.to(Integer.valueOf((int) R.drawable.ic_study), "Class " + profile.getClassName() + " · Roll " + profile.getRoll()), TuplesKt.to(Integer.valueOf((int) R.drawable.ic_hall), "Examination hall " + profile.getHall()), TuplesKt.to(Integer.valueOf((int) R.drawable.ic_calendar), profile.getExamination())})) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            Pair pair = (Pair) obj;
            int intValue = ((Number) pair.component1()).intValue();
            String str = (String) pair.component2();
            if (i > 0) {
                linearLayout.addView(ThemeKt.separator(this.ctx));
            }
            linearLayout.addView(detail(intValue, str));
            i = i2;
        }
        this.page.addView(linearLayout, ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda16(this), 7, null));
        this.page.addView(ThemeKt.text$default(this.ctx, "You can change any of these later in Settings.", 14.0f, Ui.INSTANCE.getC().getText3(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda17(this), 7, null));
        this.footer.addView(ControlsKt.pillButton$default(this.ctx, "Let’s go", Integer.valueOf((int) R.drawable.ic_forward), null, new SetupScreen$$ExternalSyntheticLambda18(this), 4, null), ThemeKt.lp$default(0, 0, 0.0f, null, 15, null));
    }

    private static final Unit welcome$lambda$23(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 20);
        return Unit.INSTANCE;
    }

    private static final Unit welcome$lambda$24(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 12);
        return Unit.INSTANCE;
    }

    private static final Unit welcome$lambda$25(SetupScreen setupScreen, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        setupScreen.next();
        return Unit.INSTANCE;
    }

    private final View detail(int i, String str) {
        LinearLayout linearLayout = new LinearLayout(this.ctx);
        linearLayout.setOrientation(0);
        linearLayout.setGravity(16);
        LinearLayout linearLayout2 = linearLayout;
        linearLayout.setMinimumHeight(ThemeKt.dp(linearLayout2, (Number) 52));
        linearLayout.addView(ThemeKt.icon(this.ctx, i, Ui.INSTANCE.getC().getGreenText(), 20));
        linearLayout.addView(ThemeKt.text$default(this.ctx, str, 16.0f, Ui.INSTANCE.getC().getText(), null, null, 24, null), ThemeKt.lp(0, -2, 1.0f, new SetupScreen$$ExternalSyntheticLambda24(linearLayout)));
        return linearLayout2;
    }

    private static final Unit detail$lambda$27$lambda$26(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 14));
        return Unit.INSTANCE;
    }

    private final String examDate(Subject subject) {
        Formats formats = Formats.INSTANCE;
        for (Exam exam : this.host.getData().getExams()) {
            if (exam.getSubject() == subject) {
                return formats.dateLong(exam.getDate());
            }
        }
        throw new NoSuchElementException("Collection contains no element matching the predicate.");
    }

    private final void milStep() {
        title("Your MIL paper", "Which language do you take for MIL on " + examDate(Subject.MIL) + '?');
        ArrayList arrayList = new ArrayList();
        TextView pillButton$default = ControlsKt.pillButton$default(this.ctx, "Continue", null, null, new SetupScreen$$ExternalSyntheticLambda25(this), 6, null);
        LinearLayout linearLayout = new LinearLayout(this.ctx);
        linearLayout.setOrientation(1);
        int i = 0;
        for (Object obj : MilLanguage.getEntries()) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            MilLanguage milLanguage = (MilLanguage) obj;
            if (i > 0) {
                linearLayout.addView(ThemeKt.separator(this.ctx));
            }
            LinearLayout choiceRow = choiceRow(milLanguage.getLabel(), milLanguage.getNativeLabel(), "MIL (" + milLanguage.getLabel() + ')', new SetupScreen$$ExternalSyntheticLambda26(this, milLanguage, arrayList, i, pillButton$default));
            arrayList.add(choiceRow);
            linearLayout.addView(choiceRow);
            i = i2;
        }
        this.page.addView(linearLayout, ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda27(this), 7, null));
        ArrayList arrayList2 = arrayList;
        MilLanguage milLanguage2 = this.mil;
        select(arrayList2, milLanguage2 != null ? milLanguage2.ordinal() : -1);
        pillButton$default.setAlpha(this.mil == null ? 0.45f : 1.0f);
        this.footer.addView(pillButton$default, ThemeKt.lp$default(0, 0, 0.0f, null, 15, null));
    }

    private static final Unit milStep$lambda$29(SetupScreen setupScreen, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        if (setupScreen.mil != null) {
            setupScreen.next();
        }
        return Unit.INSTANCE;
    }

    private static final Unit milStep$lambda$31$lambda$30(SetupScreen setupScreen, MilLanguage milLanguage, ArrayList arrayList, int i, TextView textView) {
        setupScreen.mil = milLanguage;
        setupScreen.select(arrayList, i);
        textView.setAlpha(1.0f);
        return Unit.INSTANCE;
    }

    private static final Unit milStep$lambda$32(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 20);
        return Unit.INSTANCE;
    }

    private final void electiveStep() {
        title("Your elective", "Which elective do you take on " + examDate(Subject.ELECTIVE) + '?');
        ArrayList arrayList = new ArrayList();
        TextView pillButton$default = ControlsKt.pillButton$default(this.ctx, "Continue", null, null, new SetupScreen$$ExternalSyntheticLambda8(this), 6, null);
        Map mapOf = MapsKt.mapOf(TuplesKt.to(Elective.ARABIC, "العربية"));
        LinearLayout linearLayout = new LinearLayout(this.ctx);
        linearLayout.setOrientation(1);
        int i = 0;
        for (Object obj : Elective.getEntries()) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            Elective elective = (Elective) obj;
            if (i > 0) {
                linearLayout.addView(ThemeKt.separator(this.ctx));
            }
            LinearLayout choiceRow = choiceRow(elective.getLabel(), (String) mapOf.get(elective), "Elective (" + elective.getLabel() + ')', new SetupScreen$$ExternalSyntheticLambda9(this, elective, arrayList, i, pillButton$default));
            arrayList.add(choiceRow);
            linearLayout.addView(choiceRow);
            i = i2;
            mapOf = mapOf;
        }
        this.page.addView(linearLayout, ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda10(this), 7, null));
        ArrayList arrayList2 = arrayList;
        Elective elective2 = this.elective;
        select(arrayList2, elective2 != null ? elective2.ordinal() : -1);
        pillButton$default.setAlpha(this.elective == null ? 0.45f : 1.0f);
        this.footer.addView(pillButton$default, ThemeKt.lp$default(0, 0, 0.0f, null, 15, null));
    }

    private static final Unit electiveStep$lambda$33(SetupScreen setupScreen, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        if (setupScreen.elective != null) {
            setupScreen.next();
        }
        return Unit.INSTANCE;
    }

    private static final Unit electiveStep$lambda$35$lambda$34(SetupScreen setupScreen, Elective elective, ArrayList arrayList, int i, TextView textView) {
        setupScreen.elective = elective;
        setupScreen.select(arrayList, i);
        textView.setAlpha(1.0f);
        return Unit.INSTANCE;
    }

    private static final Unit electiveStep$lambda$36(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 20);
        return Unit.INSTANCE;
    }

    private final void remindersStep() {
        title("Exam reminders?", "A gentle reminder one day and one hour before each exam. If you say yes, Android will ask whether the app may show notifications.");
        LinearLayout linearLayout = new LinearLayout(this.ctx);
        linearLayout.setOrientation(1);
        linearLayout.addView(detail(R.drawable.ic_bell, "Tomorrow: MIL — starts at 12:30 PM"));
        linearLayout.addView(ThemeKt.separator(this.ctx));
        linearLayout.addView(detail(R.drawable.ic_clock, "Starts in 1 hour · Hall " + this.host.getData().getProfile().getHall()));
        this.page.addView(linearLayout, ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda11(this), 7, null));
        this.page.addView(ThemeKt.text$default(this.ctx, "Works offline. You can switch this off any time in Settings.", 14.0f, Ui.INSTANCE.getC().getText3(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda12(this), 7, null));
        this.footer.addView(ControlsKt.pillButton$default(this.ctx, "Turn on reminders", Integer.valueOf((int) R.drawable.ic_bell), null, new SetupScreen$$ExternalSyntheticLambda13(this), 4, null), ThemeKt.lp$default(0, 0, 0.0f, null, 15, null));
        this.footer.addView(ControlsKt.pillButton$default(this.ctx, "Not now", null, ButtonStyle.GHOST, new SetupScreen$$ExternalSyntheticLambda14(this), 2, null), ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda15(this), 7, null));
    }

    private static final Unit remindersStep$lambda$37(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 20);
        return Unit.INSTANCE;
    }

    private static final Unit remindersStep$lambda$38(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 12);
        return Unit.INSTANCE;
    }

    private static final Unit remindersStep$lambda$40(SetupScreen setupScreen, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        setupScreen.host.setExamReminders(true, new SetupScreen$$ExternalSyntheticLambda19(setupScreen));
        return Unit.INSTANCE;
    }

    private static final Unit remindersStep$lambda$40$lambda$39(SetupScreen setupScreen) {
        setupScreen.host.finishSetup();
        return Unit.INSTANCE;
    }

    private static final Unit remindersStep$lambda$41(SetupScreen setupScreen, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        setupScreen.host.finishSetup();
        return Unit.INSTANCE;
    }

    private static final Unit remindersStep$lambda$42(SetupScreen setupScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(setupScreen.ctx, (Number) 6);
        return Unit.INSTANCE;
    }

    private final LinearLayout choiceRow(String str, String str2, String str3, Function0<Unit> function0) {
        View view = new View(this.ctx);
        LinearLayout linearLayout = new LinearLayout(this.ctx);
        linearLayout.setOrientation(0);
        linearLayout.setGravity(16);
        LinearLayout linearLayout2 = linearLayout;
        linearLayout.setMinimumHeight(ThemeKt.dp(linearLayout2, (Number) 68));
        linearLayout.setPadding(ThemeKt.dp(linearLayout2, (Number) 12), ThemeKt.dp(linearLayout2, (Number) 10), ThemeKt.dp(linearLayout2, (Number) 12), ThemeKt.dp(linearLayout2, (Number) 10));
        linearLayout.addView(view, ThemeKt.lp$default(ThemeKt.dp(linearLayout2, (Number) 22), ThemeKt.dp(linearLayout2, (Number) 22), 0.0f, null, 12, null));
        LinearLayout linearLayout3 = new LinearLayout(this.ctx);
        linearLayout3.setOrientation(1);
        String str4 = str;
        linearLayout3.addView(ThemeKt.text$default(this.ctx, str4, 17.5f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null));
        linearLayout3.addView(ThemeKt.text$default(this.ctx, str3, 14.0f, Ui.INSTANCE.getC().getText3(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new SetupScreen$$ExternalSyntheticLambda20(linearLayout3), 7, null));
        linearLayout.addView(linearLayout3, ThemeKt.lp(0, -2, 1.0f, new SetupScreen$$ExternalSyntheticLambda21(linearLayout)));
        if (str2 != null) {
            linearLayout.addView(ThemeKt.text$default(this.ctx, str2, 18.0f, Ui.INSTANCE.getC().getText2(), null, new SetupScreen$$ExternalSyntheticLambda22(), 8, null));
        }
        linearLayout.setTag(view);
        linearLayout.setContentDescription(str4);
        linearLayout.setOnClickListener(new SetupScreen$$ExternalSyntheticLambda23(function0));
        return linearLayout;
    }

    private static final Unit choiceRow$lambda$48$lambda$44$lambda$43(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
        return Unit.INSTANCE;
    }

    private static final Unit choiceRow$lambda$48$lambda$45(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 16));
        return Unit.INSTANCE;
    }

    private static final Unit choiceRow$lambda$48$lambda$46(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setGravity(8388613);
        return Unit.INSTANCE;
    }

    private static final void choiceRow$lambda$48$lambda$47(Function0 function0, View view) {
        function0.invoke();
    }

    private final void select(List<? extends LinearLayout> list, int i) {
        GradientDrawable oval;
        int i2 = 0;
        for (Object obj : list) {
            int i3 = i2 + 1;
            if (i2 < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            LinearLayout linearLayout = (LinearLayout) obj;
            boolean z = i2 == i;
            linearLayout.setBackground(Shapes.INSTANCE.ripple(this.ctx, z ? Shapes.rounded$default(Shapes.INSTANCE, this.ctx, (Number) 12, Ui.INSTANCE.getC().getGreenSoft(), 0, null, 24, null) : null, (Number) 12));
            Object tag = linearLayout.getTag();
            Intrinsics.checkNotNull(tag, "null cannot be cast to non-null type android.view.View");
            View view = (View) tag;
            if (z) {
                oval = Shapes.INSTANCE.oval(Ui.INSTANCE.getC().getGreen(), Ui.INSTANCE.withAlpha(Ui.INSTANCE.getC().getGreen(), 0.35f), ThemeKt.dp(this.ctx, (Number) 5));
            } else {
                oval = Shapes.INSTANCE.oval(0, Ui.INSTANCE.getC().getText3(), ThemeKt.dp(this.ctx, (Number) 2));
            }
            view.setBackground(oval);
            linearLayout.setSelected(z);
            i2 = i3;
        }
    }
}

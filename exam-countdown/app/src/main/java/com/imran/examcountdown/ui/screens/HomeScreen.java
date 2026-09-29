package com.imran.examcountdown.ui.screens;

import android.graphics.drawable.Drawable;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import com.imran.examcountdown.AppData;
import com.imran.examcountdown.MainActivity;
import com.imran.examcountdown.R;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.Countdown;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.ExamStatus;
import com.imran.examcountdown.core.Formats;
import com.imran.examcountdown.core.Messages;
import com.imran.examcountdown.core.ModelKt;
import com.imran.examcountdown.core.Phase;
import com.imran.examcountdown.core.Profile;
import com.imran.examcountdown.core.Season;
import com.imran.examcountdown.core.Timetable;
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
import com.imran.examcountdown.ui.widgets.AuroraView;
import com.imran.examcountdown.ui.widgets.AvatarView;
import com.imran.examcountdown.ui.widgets.ButtonStyle;
import com.imran.examcountdown.ui.widgets.ControlsKt;
import com.imran.examcountdown.ui.widgets.CountdownView;
import com.imran.examcountdown.ui.widgets.FlowRow;
import com.imran.examcountdown.ui.widgets.ProgressTrack;
import com.imran.examcountdown.ui.widgets.PulseDot;
import com.imran.examcountdown.ui.widgets.SeasonProgressView;
import com.imran.examcountdown.ui.widgets.SheenCard;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.collections.IntIterator;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.IntRange;
import kotlin.ranges.RangesKt;
import kotlin.text.StringsKt;

public final class HomeScreen extends Screen implements AmbientListener {
    private final AuroraView aurora;
    private final AvatarView avatar;
    private long avatarVersion;
    private final TextView celebrateBody;
    private final LinearLayout celebrateSection;
    private final TextView celebrateTitle;
    private final LinearLayout content;
    private final CountdownView countdown;
    private final TextView dateItem;
    private final FlowRow details;
    private final ImageView emblem;
    private boolean entranceDone;
    private final TextView finalNote;
    private final FrameLayout frame;
    private final TextView greeting;
    private final TextView hallItem;
    private final TextView identity;
    private final TextView liveButton;
    private final SheenCard liveCard;
    private final TextView liveDetail;
    private final PulseDot liveDot;
    private final TextView liveDuration;
    private String liveKey;
    private final TextView liveTitle;
    private final TextView localNote;
    private final TextView message;
    private int messageOffset;
    private final LinearLayout messageRow;
    private Mode mode;
    private final TextView nextLabel;
    private final LinearLayout nextSection;
    private final SeasonProgressView progressBar;
    private final TextView progressCaption;
    private final TextView progressCount;
    private final TextView revise;
    private final TextView schoolName;
    private final TextView schoolPlace;
    private final ScrollView scroll;
    private long spokenMinute;
    private final TextView subject;
    private String subjectKey;
    private long target;
    private final TextView timeItem;
    private final TextView timetableLink;
    private final ProgressTrack track;
    private final TextView trackCaption;
    private String upcomingKey;
    private final TextView upcomingLabel;
    private final LinearLayout upcomingList;

    public class WhenMappings {
        public static final int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[Mode.values().length];
            try {
                iArr[Mode.COUNTDOWN.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[Mode.FINAL_LIVE.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            try {
                iArr[Mode.CELEBRATE.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    public static Unit $r8$lambda$0qZygSKjlTdfIJcyOD9vXhPU5OU(SheenCard sheenCard, LinearLayout.LayoutParams layoutParams) {
        return liveCard$lambda$15$lambda$14(sheenCard, layoutParams);
    }

    public static Unit m15$r8$lambda$1fEbylbTAUgTZojWS0YphQODFQ(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$62(homeScreen, layoutParams);
    }

    public static Unit $r8$lambda$3KojZCfnIINAzKhupwg6Ytlm2Is(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return celebrateSection$lambda$25$lambda$22(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$3f2KLvFMYw6n6Z6y893jzNMPRr8(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$50(homeScreen, layoutParams);
    }

    public static Unit m16$r8$lambda$4Apv1DunQm9kKMBYi63qzc3rGg(MainActivity mainActivity, TextView textView) {
        return timetableLink$lambda$32(mainActivity, textView);
    }

    public static Unit m17$r8$lambda$7g0p_K3qK4jGaTkI2FinF9sKgA(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return messageRow$lambda$30$lambda$28(linearLayout, layoutParams);
    }

    public static Unit m18$r8$lambda$7ysIzVwe6vXNiltrhvXEzhqP6k(TextView textView) {
        return liveDuration$lambda$5(textView);
    }

    public static Unit $r8$lambda$8HHqGtIyMNsYoh_b_aqS8e41xt4(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$43(homeScreen, layoutParams);
    }

    public static Unit m19$r8$lambda$A3x4S0cVO28lqmMa5GqWZQzUP8(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$54(homeScreen, layoutParams);
    }

    public static void $r8$lambda$A8pDPd3xdoegAmAXsQ7S6DSOWZQ(HomeScreen homeScreen, View view) {
        messageRow$lambda$30$lambda$29(homeScreen, view);
    }

    public static Unit $r8$lambda$ANrHAAfRxKVIlrOzfaUqpYKXsSk(TextView textView) {
        return message$lambda$26(textView);
    }

    public static Unit m20$r8$lambda$AtMOiF_OA80Gix_zqsf5wGXceY(SheenCard sheenCard, LinearLayout.LayoutParams layoutParams) {
        return liveCard$lambda$15$lambda$11(sheenCard, layoutParams);
    }

    public static Unit m21$r8$lambda$CTYeWh9sqBo5pkQ5Oc4PVUCyPo(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return upcomingRow$lambda$83$lambda$79$lambda$78(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$DXbHEYbXmMLicbj58AJ9KTyZGsw(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return liveCard$lambda$15$lambda$10$lambda$8(linearLayout, layoutParams);
    }

    public static void m22$r8$lambda$E9jFHRdeOnrHo2Xm933zStjN1g(HomeScreen homeScreen) {
        applyMode$lambda$73(homeScreen);
    }

    public static void $r8$lambda$EIV_lnBExV8ZXPex_0T2AlXLv0A(MainActivity mainActivity, View view) {
        timetableLink$lambda$32$lambda$31(mainActivity, view);
    }

    public static Unit $r8$lambda$EYT9SnV0j_cBCR42i5GrUL1n03U(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return liveCard$lambda$15$lambda$10$lambda$9(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$FQ27xQULZ1ZerdSza86cJ4ygKgg(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$45(homeScreen, layoutParams);
    }

    public static Unit $r8$lambda$FUU95oaV7vt4MHykUVVj6E7tkB4(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$44(homeScreen, layoutParams);
    }

    public static Unit $r8$lambda$IjghqrYViVlVtknF93cW6q_W6hw(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$47(homeScreen, layoutParams);
    }

    public static void $r8$lambda$Kc3lvsPHDZyMWsUoqsFMZoQjjOE(HomeScreen homeScreen, View view, int i, int i2, int i3, int i4) {
        _init_$lambda$64(homeScreen, view, i, i2, i3, i4);
    }

    public static Unit m23$r8$lambda$MjeR_eOY7aPtnGVKlfEZvrp6zc(HomeScreen homeScreen, TextView textView) {
        return liveButton$lambda$7(homeScreen, textView);
    }

    public static Unit $r8$lambda$N7Wkbq9X8LwzZHdqWcjfayNOOjw(int i, TextView textView) {
        return detail$lambda$65(i, textView);
    }

    public static Unit $r8$lambda$N9L5ueX6iCCVKBuiDXcIepRXFBY(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$53(homeScreen, layoutParams);
    }

    public static Unit $r8$lambda$P_4ocGHo1hdBpNDhNqUkbzsZD9k(SheenCard sheenCard, LinearLayout.LayoutParams layoutParams) {
        return liveCard$lambda$15$lambda$13(sheenCard, layoutParams);
    }

    public static Unit m24$r8$lambda$PeDWuozcK1CFe9CJz6wWnm03JY(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return celebrateSection$lambda$25$lambda$24(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$QKAWRwboEImktdrv3f5bTMgPjzE(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$48(homeScreen, layoutParams);
    }

    public static void $r8$lambda$QcvAorSrR2wsmGP8lLgpylk6y4U(HomeScreen homeScreen, View view) {
        liveButton$lambda$7$lambda$6(homeScreen, view);
    }

    public static Unit $r8$lambda$S_9cMiZQRFoLTPqBwy7HLeUbgZ8(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return celebrateSection$lambda$25$lambda$21(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$UBena_XkJ4j91clJ_JWIf4ulm14(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$46(homeScreen, layoutParams);
    }

    public static Unit $r8$lambda$VXJPhzCnMRvU1E6B037HLf0Bkb4(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$49(homeScreen, layoutParams);
    }

    public static void m25$r8$lambda$VkumezQmn6v5TdlB47c9jm_NY(HomeScreen homeScreen, String str) {
        cycleMessage$lambda$84(homeScreen, str);
    }

    public static Unit m26$r8$lambda$W5u2bkFduVonSmA7_D2qUVY044(MainActivity mainActivity, View view) {
        return celebrateSection$lambda$25$lambda$23(mainActivity, view);
    }

    public static Unit $r8$lambda$ZntbR1SSma61VsKlFe4Oro1qJQM(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$56(homeScreen, layoutParams);
    }

    public static Unit $r8$lambda$_8E5FaNmHOKImBidnFWm6n6wRVY(MainActivity mainActivity, View view) {
        return revise$lambda$18(mainActivity, view);
    }

    public static Unit $r8$lambda$aZujsvI82OyCkYk6WqiJXOtCwS0(SheenCard sheenCard, LinearLayout.LayoutParams layoutParams) {
        return liveCard$lambda$15$lambda$12(sheenCard, layoutParams);
    }

    public static Unit $r8$lambda$cJ56cWpuok4rk3q5WwwN9cy1EDo(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$38(homeScreen, layoutParams);
    }

    public static Unit $r8$lambda$cN2JHIVJI6iDNQ6LKLvdvOhqCk0(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$60(homeScreen, layoutParams);
    }

    public static Unit $r8$lambda$dlz2o202sKyKKZ5y0Jc3WMmMAaI(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$63(homeScreen, layoutParams);
    }

    public static Unit m27$r8$lambda$eOYfxY8sITRFWFTtXl2zY9iomM(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$61(homeScreen, layoutParams);
    }

    public static Unit m28$r8$lambda$hTo2v9NNob4rSNfVQDF55dG7uE(TextView textView) {
        return celebrateBody$lambda$20(textView);
    }

    public static Unit $r8$lambda$iUhRDcfXKhlir4tkATkpuxTw7OM(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$37(homeScreen, layoutParams);
    }

    public static Unit m29$r8$lambda$kTKDPC5hmJdGg1flZsCL0qO32o(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$51(homeScreen, layoutParams);
    }

    public static Unit m30$r8$lambda$lAZsgrX7hqoP7yqr3afCLGoY(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$55(homeScreen, layoutParams);
    }

    public static void m31$r8$lambda$mObY48b_1QQrrB_vHEtlap1t7s(HomeScreen homeScreen, Exam exam, View view) {
        upcomingRow$lambda$83$lambda$82(homeScreen, exam, view);
    }

    public static void $r8$lambda$mmiGF9qAb0yDNRjgKaozeMc9kp4(MainActivity mainActivity, AvatarView avatarView, View view) {
        avatar$lambda$4$lambda$3(mainActivity, avatarView, view);
    }

    public static Unit $r8$lambda$nLUXjik9rLWQCnjKTzYMbScJeZk(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$52(homeScreen, layoutParams);
    }

    public static Unit m32$r8$lambda$ovBNCXYq3OfuhEHdJ7U39iEw5M(TextView textView) {
        return finalNote$lambda$19(textView);
    }

    public static Unit $r8$lambda$qHgz6Ot8MsxRPAMWKdZy6suumDA(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$59(homeScreen, layoutParams);
    }

    public static Unit $r8$lambda$r3QZO3dVNUq92IC7ixhwyrYXTSg(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return upcomingRow$lambda$83$lambda$80(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$rYo9LSBsb1l6GUGuYx2mgN83Ris(HomeScreen homeScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$58(homeScreen, layoutParams);
    }

    public static Unit $r8$lambda$r_QrlFXlh4fbU6DE6vAeADt3Mo8(TextView textView) {
        return trackCaption$lambda$16(textView);
    }

    public static CharSequence $r8$lambda$svJYvEruxC33l50qWbX6ZnIwWxs(ExamStatus examStatus) {
        return bindUpcoming$lambda$76(examStatus);
    }

    public static Unit $r8$lambda$w_4mUUu71ciuDyz2fRBHRJ9I_EM(HomeScreen homeScreen, ExamStatus examStatus) {
        return onMarkFinished$lambda$85(homeScreen, examStatus);
    }

    public static Unit $r8$lambda$zTXdClZM1ViFwQ9C_klfz1Xq5Jo(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return upcomingRow$lambda$83$lambda$81(linearLayout, layoutParams);
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public HomeScreen(MainActivity host) {
        super(host);
        Intrinsics.checkNotNullParameter(host, "host");
        ScrollView scrollView = new ScrollView(getCtx());
        scrollView.setVerticalScrollBarEnabled(false);
        scrollView.setOverScrollMode(1);
        scrollView.setFillViewport(true);
        this.scroll = scrollView;
        AuroraView auroraView = new AuroraView(getCtx());
        this.aurora = auroraView;
        FrameLayout frameLayout = new FrameLayout(getCtx());
        frameLayout.addView(auroraView, new FrameLayout.LayoutParams(-1, -1));
        frameLayout.addView(scrollView, new FrameLayout.LayoutParams(-1, -1));
        this.frame = frameLayout;
        LinearLayout linearLayout = new LinearLayout(getCtx());
        linearLayout.setOrientation(1);
        Unit unit = Unit.INSTANCE;
        this.content = linearLayout;
        ImageView imageView = new ImageView(getCtx());
        imageView.setImageResource(R.drawable.emblem_small);
        imageView.setContentDescription("Al-Ameen Academy emblem");
        this.emblem = imageView;
        TextView text$default = ThemeKt.text$default(getCtx(), "Al-Ameen Academy", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSerif(), null, 16, null);
        this.schoolName = text$default;
        TextView label = ThemeKt.label(getCtx(), "Badarpur · Estd. 1994", Ui.INSTANCE.getC().getGoldText(), 10.5f);
        this.schoolPlace = label;
        TextView heading$default = ThemeKt.heading$default(getCtx(), "", 30.0f, 0, 4, null);
        this.greeting = heading$default;
        TextView text$default2 = ThemeKt.text$default(getCtx(), "", 15.0f, Ui.INSTANCE.getC().getText2(), null, null, 24, null);
        this.identity = text$default2;
        AvatarView avatarView = new AvatarView(getCtx());
        avatarView.setContentDescription("Profile photo and frame. Double tap to change.");
        avatarView.setClickable(true);
        avatarView.setStateListAnimator(ControlsKt.pressScale(avatarView, 0.92f));
        avatarView.setOnClickListener(new HomeScreen$$ExternalSyntheticLambda10(host, avatarView));
        this.avatar = avatarView;
        TextView heading = ThemeKt.heading(getCtx(), "It’s exam time!", 24.0f, Ui.INSTANCE.getC().getOnGreen());
        this.liveTitle = heading;
        TextView text$default3 = ThemeKt.text$default(getCtx(), "", 15.5f, Ui.INSTANCE.withAlpha(Ui.INSTANCE.getC().getOnGreen(), 0.92f), Fonts.INSTANCE.getSansMedium(), null, 16, null);
        this.liveDetail = text$default3;
        TextView text$default4 = ThemeKt.text$default(getCtx(), "", 13.5f, Ui.INSTANCE.withAlpha(Ui.INSTANCE.getC().getOnGreen(), 0.78f), null, new HomeScreen$$ExternalSyntheticLambda21(), 8, null);
        this.liveDuration = text$default4;
        TextView text = ThemeKt.text(getCtx(), "Mark as finished", 15.0f, Ui.INSTANCE.getC().getOnGreen(), Fonts.INSTANCE.getSansSemibold(), new HomeScreen$$ExternalSyntheticLambda32(this));
        this.liveButton = text;
        PulseDot pulseDot = new PulseDot(getCtx(), Ui.INSTANCE.getC().getGold());
        this.liveDot = pulseDot;
        SheenCard sheenCard = new SheenCard(getCtx(), 18.0f);
        sheenCard.setOrientation(1);
        sheenCard.setBackground(Shapes.rounded$default(Shapes.INSTANCE, getCtx(), (Number) 18, Ui.INSTANCE.getC().getGreen(), 0, null, 24, null));
        SheenCard sheenCard2 = sheenCard;
        sheenCard.setPadding(ThemeKt.dp(sheenCard2, (Number) 18), ThemeKt.dp(sheenCard2, (Number) 16), ThemeKt.dp(sheenCard2, (Number) 18), ThemeKt.dp(sheenCard2, (Number) 16));
        LinearLayout linearLayout2 = new LinearLayout(getCtx());
        linearLayout2.setOrientation(0);
        linearLayout2.setGravity(16);
        LinearLayout linearLayout3 = linearLayout2;
        linearLayout2.addView(pulseDot, ThemeKt.lp$default(ThemeKt.dp(linearLayout3, (Number) 20), ThemeKt.dp(linearLayout3, (Number) 20), 0.0f, new HomeScreen$$ExternalSyntheticLambda43(linearLayout2), 4, null));
        linearLayout2.addView(ThemeKt.label(getCtx(), "Exam in progress", Ui.INSTANCE.withAlpha(Ui.INSTANCE.getC().getOnGreen(), 0.85f), 11.5f), ThemeKt.lp$default(-2, -2, 0.0f, new HomeScreen$$ExternalSyntheticLambda52(linearLayout2), 4, null));
        linearLayout2.setClipChildren(false);
        sheenCard.addView(linearLayout3);
        sheenCard.setClipChildren(false);
        sheenCard.setClipToPadding(false);
        sheenCard.addView(heading, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda53(sheenCard), 7, null));
        sheenCard.addView(text$default3, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda54(sheenCard), 7, null));
        sheenCard.addView(text$default4, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda55(sheenCard), 7, null));
        sheenCard.addView(text, ThemeKt.lp$default(-2, -2, 0.0f, new HomeScreen$$ExternalSyntheticLambda56(sheenCard), 4, null));
        this.liveCard = sheenCard;
        TextView label$default = ThemeKt.label$default(getCtx(), "Next exam", 0, 0.0f, 6, null);
        this.nextLabel = label$default;
        TextView heading$default2 = ThemeKt.heading$default(getCtx(), "", 30.0f, 0, 4, null);
        this.subject = heading$default2;
        CountdownView countdownView = new CountdownView(getCtx());
        this.countdown = countdownView;
        ProgressTrack progressTrack = new ProgressTrack(getCtx());
        this.track = progressTrack;
        TextView text$default5 = ThemeKt.text$default(getCtx(), "", 13.0f, Ui.INSTANCE.getC().getText3(), null, new HomeScreen$$ExternalSyntheticLambda57(), 8, null);
        this.trackCaption = text$default5;
        TextView detail = detail(R.drawable.ic_calendar);
        this.dateItem = detail;
        TextView detail2 = detail(R.drawable.ic_clock);
        this.timeItem = detail2;
        TextView detail3 = detail(R.drawable.ic_hall);
        this.hallItem = detail3;
        FlowRow flowRow = new FlowRow(getCtx());
        flowRow.addView(detail);
        flowRow.addView(detail2);
        flowRow.addView(detail3);
        this.details = flowRow;
        TextView text$default6 = ThemeKt.text$default(getCtx(), "", 13.0f, Ui.INSTANCE.getC().getText3(), null, null, 24, null);
        this.localNote = text$default6;
        TextView pillButton$default = ControlsKt.pillButton$default(getCtx(), "Revise", Integer.valueOf((int) R.drawable.ic_study), null, new HomeScreen$$ExternalSyntheticLambda11(host), 4, null);
        this.revise = pillButton$default;
        TextView text$default7 = ThemeKt.text$default(getCtx(), "This is your last paper. The celebration starts when it’s done.", 16.0f, Ui.INSTANCE.getC().getText2(), null, new HomeScreen$$ExternalSyntheticLambda12(), 8, null);
        this.finalNote = text$default7;
        LinearLayout linearLayout4 = new LinearLayout(getCtx());
        linearLayout4.setOrientation(1);
        Unit unit2 = Unit.INSTANCE;
        this.nextSection = linearLayout4;
        TextView heading$default3 = ThemeKt.heading$default(getCtx(), "", 32.0f, 0, 4, null);
        this.celebrateTitle = heading$default3;
        TextView text$default8 = ThemeKt.text$default(getCtx(), "", 16.0f, Ui.INSTANCE.getC().getText2(), null, new HomeScreen$$ExternalSyntheticLambda13(), 8, null);
        this.celebrateBody = text$default8;
        LinearLayout linearLayout5 = new LinearLayout(getCtx());
        linearLayout5.setOrientation(1);
        linearLayout5.addView(ThemeKt.label$default(getCtx(), "Exam season complete", Ui.INSTANCE.getC().getGoldText(), 0.0f, 4, null));
        linearLayout5.addView(heading$default3, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda14(linearLayout5), 7, null));
        linearLayout5.addView(text$default8, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda15(linearLayout5), 7, null));
        linearLayout5.addView(ControlsKt.pillButton(getCtx(), "Celebrate again", Integer.valueOf((int) R.drawable.ic_sparkle), ButtonStyle.SECONDARY, new HomeScreen$$ExternalSyntheticLambda16(host)), ThemeKt.lp$default(-2, -2, 0.0f, new HomeScreen$$ExternalSyntheticLambda17(linearLayout5), 4, null));
        this.celebrateSection = linearLayout5;
        TextView text2 = ThemeKt.text(getCtx(), "", 17.0f, Ui.INSTANCE.getC().getText2(), Fonts.INSTANCE.getSerifItalic(), new HomeScreen$$ExternalSyntheticLambda18());
        this.message = text2;
        LinearLayout linearLayout6 = new LinearLayout(getCtx());
        linearLayout6.setOrientation(0);
        linearLayout6.setGravity(16);
        linearLayout6.setGravity(48);
        View view = new View(getCtx());
        view.setBackground(Shapes.rounded$default(Shapes.INSTANCE, getCtx(), (Number) 2, Ui.INSTANCE.getC().getGold(), 0, null, 24, null));
        LinearLayout linearLayout7 = linearLayout6;
        linearLayout6.addView(view, ThemeKt.lp$default(ThemeKt.dp(linearLayout7, (Number) 3), -1, 0.0f, null, 12, null));
        linearLayout6.addView(text2, ThemeKt.lp(0, -2, 1.0f, new HomeScreen$$ExternalSyntheticLambda19(linearLayout6)));
        linearLayout6.setBackground(Shapes.INSTANCE.ripple(getCtx(), null, (Number) 8));
        linearLayout6.setPadding(0, ThemeKt.dp(linearLayout7, (Number) 4), 0, ThemeKt.dp(linearLayout7, (Number) 4));
        linearLayout6.setContentDescription(null);
        linearLayout6.setOnClickListener(new HomeScreen$$ExternalSyntheticLambda20(this));
        this.messageRow = linearLayout6;
        TextView text$default9 = ThemeKt.text$default(getCtx(), "", 14.0f, Ui.INSTANCE.getC().getText2(), Fonts.INSTANCE.getSansMedium(), null, 16, null);
        this.progressCount = text$default9;
        SeasonProgressView seasonProgressView = new SeasonProgressView(getCtx());
        this.progressBar = seasonProgressView;
        TextView text$default10 = ThemeKt.text$default(getCtx(), "", 13.0f, Ui.INSTANCE.getC().getText3(), null, null, 24, null);
        this.progressCaption = text$default10;
        TextView label$default2 = ThemeKt.label$default(getCtx(), "Coming up", 0, 0.0f, 6, null);
        this.upcomingLabel = label$default2;
        LinearLayout linearLayout8 = new LinearLayout(getCtx());
        linearLayout8.setOrientation(1);
        Unit unit3 = Unit.INSTANCE;
        this.upcomingList = linearLayout8;
        TextView text3 = ThemeKt.text(getCtx(), "Full timetable", 15.0f, Ui.INSTANCE.getC().getGreenText(), Fonts.INSTANCE.getSansSemibold(), new HomeScreen$$ExternalSyntheticLambda22(host));
        this.timetableLink = text3;
        this.subjectKey = "";
        this.upcomingKey = "";
        this.spokenMinute = -1L;
        this.avatarVersion = -1L;
        scrollView.addView(linearLayout, new FrameLayout.LayoutParams(-1, -2));
        LinearLayout linearLayout9 = new LinearLayout(getCtx());
        linearLayout9.setOrientation(0);
        linearLayout9.setGravity(16);
        LinearLayout linearLayout10 = linearLayout9;
        linearLayout9.addView(imageView, ThemeKt.lp$default(ThemeKt.dp(linearLayout10, (Number) 36), ThemeKt.dp(linearLayout10, (Number) 36), 0.0f, null, 12, null));
        LinearLayout linearLayout11 = new LinearLayout(getCtx());
        linearLayout11.setOrientation(1);
        linearLayout11.addView(text$default);
        linearLayout11.addView(label, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda23(linearLayout11), 7, null));
        linearLayout9.addView(linearLayout11, ThemeKt.lp(0, -2, 1.0f, new HomeScreen$$ExternalSyntheticLambda24(linearLayout9)));
        linearLayout.addView(linearLayout10, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda25(this), 7, null));
        linearLayout.addView(ThemeKt.separator(getCtx()), ThemeKt.lp$default(-1, -2, 0.0f, new HomeScreen$$ExternalSyntheticLambda26(this), 4, null));
        LinearLayout linearLayout12 = new LinearLayout(getCtx());
        linearLayout12.setOrientation(0);
        linearLayout12.setGravity(16);
        LinearLayout linearLayout13 = new LinearLayout(getCtx());
        linearLayout13.setOrientation(1);
        linearLayout13.addView(heading$default);
        linearLayout13.addView(text$default2, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda27(linearLayout13), 7, null));
        linearLayout12.addView(linearLayout13, ThemeKt.lp$default(0, -2, 1.0f, null, 8, null));
        LinearLayout linearLayout14 = linearLayout12;
        linearLayout12.addView(avatarView, ThemeKt.lp$default(ThemeKt.dp(linearLayout14, (Number) 62), ThemeKt.dp(linearLayout14, (Number) 62), 0.0f, new HomeScreen$$ExternalSyntheticLambda28(linearLayout12), 4, null));
        linearLayout.addView(linearLayout14, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda29(this), 7, null));
        linearLayout.addView(sheenCard, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda30(this), 7, null));
        linearLayout4.addView(label$default);
        linearLayout4.addView(heading$default2, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda31(this), 7, null));
        linearLayout4.addView(countdownView, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda33(this), 7, null));
        linearLayout4.addView(progressTrack, ThemeKt.lp$default(-1, ThemeKt.dp(getCtx(), (Number) 16), 0.0f, new HomeScreen$$ExternalSyntheticLambda34(this), 4, null));
        linearLayout4.addView(text$default5, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda35(this), 7, null));
        linearLayout4.addView(flowRow, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda36(this), 7, null));
        linearLayout4.addView(text$default6, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda37(this), 7, null));
        linearLayout4.addView(text$default7, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda38(this), 7, null));
        linearLayout4.addView(pillButton$default, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda39(this), 7, null));
        linearLayout.addView(linearLayout4, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda40(this), 7, null));
        linearLayout.addView(linearLayout5, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda41(this), 7, null));
        linearLayout.addView(linearLayout6, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda42(this), 7, null));
        linearLayout.addView(ThemeKt.separator(getCtx()), ThemeKt.lp$default(-1, -2, 0.0f, new HomeScreen$$ExternalSyntheticLambda44(this), 4, null));
        LinearLayout linearLayout15 = new LinearLayout(getCtx());
        linearLayout15.setOrientation(0);
        linearLayout15.setGravity(16);
        linearLayout15.addView(ThemeKt.label$default(getCtx(), "Exam progress", 0, 0.0f, 6, null), ThemeKt.lp$default(0, -2, 1.0f, null, 8, null));
        linearLayout15.addView(text$default9);
        linearLayout.addView(linearLayout15, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda45(this), 7, null));
        linearLayout.addView(seasonProgressView, ThemeKt.lp$default(-1, ThemeKt.dp(getCtx(), (Number) 6), 0.0f, new HomeScreen$$ExternalSyntheticLambda46(this), 4, null));
        linearLayout.addView(text$default10, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda47(this), 7, null));
        linearLayout.addView(label$default2, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda48(this), 7, null));
        linearLayout.addView(linearLayout8, ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda49(this), 7, null));
        linearLayout.addView(text3, ThemeKt.lp$default(-2, -2, 0.0f, new HomeScreen$$ExternalSyntheticLambda50(this), 4, null));
        scrollView.setOnScrollChangeListener(new HomeScreen$$ExternalSyntheticLambda51(this));
        onMotionChanged();
    }

    private enum Mode {
        COUNTDOWN,
        FINAL_LIVE,
        CELEBRATE;


        public static EnumEntries<Mode> getEntries() {
            return EnumEntriesKt.enumEntries(values());
        }

        Mode() {
        }
    }

    @Override
    public View getRoot() {
        return this.frame;
    }

    public final ImageView getEmblem() {
        return this.emblem;
    }

    public final AvatarView getAvatar() {
        return this.avatar;
    }

    private static final void avatar$lambda$4$lambda$3(MainActivity mainActivity, AvatarView avatarView, View view) {
        mainActivity.openProfileEditor(avatarView);
    }

    private static final Unit liveDuration$lambda$5(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit liveButton$lambda$7(HomeScreen homeScreen, TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setGravity(17);
        TextView textView = text;
        text.setMinHeight(ThemeKt.dp(textView, (Number) 44));
        text.setPadding(ThemeKt.dp(textView, (Number) 16), ThemeKt.dp(textView, (Number) 6), ThemeKt.dp(textView, (Number) 16), ThemeKt.dp(textView, (Number) 6));
        text.setBackground(Shapes.INSTANCE.ripple(homeScreen.getCtx(), Shapes.INSTANCE.rounded(homeScreen.getCtx(), (Number) 12, 0, Ui.INSTANCE.withAlpha(Ui.INSTANCE.getC().getOnGreen(), 0.6f), Float.valueOf(1.5f)), (Number) 12));
        ControlsKt.setLeadingIcon(text, R.drawable.ic_check, 18);
        text.setStateListAnimator(ControlsKt.pressScale$default(textView, 0.0f, 2, null));
        text.setOnClickListener(new HomeScreen$$ExternalSyntheticLambda4(homeScreen));
        return Unit.INSTANCE;
    }

    private static final void liveButton$lambda$7$lambda$6(HomeScreen homeScreen, View view) {
        homeScreen.onMarkFinished();
    }

    private static final Unit liveCard$lambda$15$lambda$10$lambda$8(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(-ThemeKt.dp(linearLayout, (Number) 6));
        return Unit.INSTANCE;
    }

    private static final Unit liveCard$lambda$15$lambda$10$lambda$9(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 2));
        return Unit.INSTANCE;
    }

    private static final Unit liveCard$lambda$15$lambda$11(SheenCard sheenCard, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(sheenCard, (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit liveCard$lambda$15$lambda$12(SheenCard sheenCard, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(sheenCard, (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit liveCard$lambda$15$lambda$13(SheenCard sheenCard, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(sheenCard, (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit liveCard$lambda$15$lambda$14(SheenCard sheenCard, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(sheenCard, (Number) 14);
        return Unit.INSTANCE;
    }

    private static final Unit trackCaption$lambda$16(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.25f);
        return Unit.INSTANCE;
    }

    private static final Unit revise$lambda$18(MainActivity mainActivity, View it) {
        Exam exam;
        Intrinsics.checkNotNullParameter(it, "it");
        ExamStatus next = mainActivity.getSeason().getNext();
        if (next == null) {
            next = mainActivity.getSeason().getLive();
        }
        mainActivity.openChecklist((next == null || (exam = next.getExam()) == null) ? null : exam.getSubject());
        return Unit.INSTANCE;
    }

    private static final Unit finalNote$lambda$19(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit celebrateBody$lambda$20(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.35f);
        return Unit.INSTANCE;
    }

    private static final Unit celebrateSection$lambda$25$lambda$21(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit celebrateSection$lambda$25$lambda$22(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 10);
        return Unit.INSTANCE;
    }

    private static final Unit celebrateSection$lambda$25$lambda$23(MainActivity mainActivity, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        mainActivity.celebrate(true);
        return Unit.INSTANCE;
    }

    private static final Unit celebrateSection$lambda$25$lambda$24(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 18);
        return Unit.INSTANCE;
    }

    private static final Unit message$lambda$26(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit messageRow$lambda$30$lambda$28(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 14));
        return Unit.INSTANCE;
    }

    private static final void messageRow$lambda$30$lambda$29(HomeScreen homeScreen, View view) {
        homeScreen.cycleMessage();
    }

    private static final Unit timetableLink$lambda$32(MainActivity mainActivity, TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        TextView textView = text;
        text.setPadding(0, ThemeKt.dp(textView, (Number) 12), ThemeKt.dp(textView, (Number) 12), ThemeKt.dp(textView, (Number) 12));
        ControlsKt.setLeadingIcon(text, R.drawable.ic_timeline, 18);
        text.setOnClickListener(new HomeScreen$$ExternalSyntheticLambda58(mainActivity));
        return Unit.INSTANCE;
    }

    private static final void timetableLink$lambda$32$lambda$31(MainActivity mainActivity, View view) {
        MainActivity.showTab$default(mainActivity, 1, false, 2, null);
    }

    public static final Unit lambda$36$lambda$34$lambda$33(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 3);
        return Unit.INSTANCE;
    }

    public static final Unit lambda$36$lambda$35(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 12));
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$37(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$38(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 14);
        return Unit.INSTANCE;
    }

    public static final Unit lambda$42$lambda$40$lambda$39(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 4);
        return Unit.INSTANCE;
    }

    public static final Unit lambda$42$lambda$41(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 8));
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$43(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 18);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$44(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 22);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$45(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$46(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 12);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$47(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$48(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$49(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 16);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$50(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$51(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 4);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$52(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 20);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$53(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 24);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$54(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 26);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$55(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 24);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$56(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 24);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$58(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 20);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$59(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 12);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$60(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$61(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 24);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$62(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 4);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$63(HomeScreen homeScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(homeScreen.getCtx(), (Number) 4);
        return Unit.INSTANCE;
    }

    private static final void _init_$lambda$64(HomeScreen homeScreen, View view, int i, int i2, int i3, int i4) {
        homeScreen.aurora.setScroll(i2);
    }

    private final TextView detail(int i) {
        return ThemeKt.text(getCtx(), "", 15.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansMedium(), new HomeScreen$$ExternalSyntheticLambda7(i));
    }

    private static final Unit detail$lambda$65(int i, TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setGravity(16);
        ControlsKt.setLeadingIcon(text, i, 18);
        text.setCompoundDrawablePadding(ThemeKt.dp(text, (Number) 6));
        Drawable drawable = text.getCompoundDrawablesRelative()[0];
        if (drawable != null) {
            drawable.setTint(Ui.INSTANCE.getC().getGreenText());
        }
        return Unit.INSTANCE;
    }

    public final List<View> entranceViews() {
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
        return arrayList2;
    }

    @Override
    public void onShow(boolean z) {
        bindHeader(getHost().getData().getProfile());
        tick(getHost().getSeason());
        getHost().getAmbient().add(this);
        if (!z || getHost().getIntroRunning()) {
            return;
        }
        playEntrance$default(this, false, 1, null);
    }

    @Override
    public void onHide() {
        getHost().getAmbient().remove(this);
    }

    public static void playEntrance$default(HomeScreen homeScreen, boolean z, int i, Object obj) {
        if ((i & 1) != 0) {
            z = false;
        }
        homeScreen.playEntrance(z);
    }

    public final void playEntrance(boolean z) {
        if (!this.entranceDone || z) {
            this.entranceDone = true;
            ArrayList arrayList = new ArrayList();
            for (Object obj : entranceViews()) {
                if (((View) obj) != this.content.getChildAt(0)) {
                    arrayList.add(obj);
                }
            }
            ScreenKt.staggerIn$default(arrayList, getHost().getPolicy().getMotion(), 0L, 4, null);
            if (getHost().getPolicy().getMotion()) {
                this.progressBar.playReveal();
            }
        }
    }

    public final void scrollToTop() {
        this.scroll.scrollTo(0, 0);
    }

    @Override
    public void onDataChanged() {
        this.subjectKey = "";
        this.upcomingKey = "";
        bindHeader(getHost().getData().getProfile());
    }

    @Override
    public void onMotionChanged() {
        this.countdown.setAnimateChanges(getHost().getPolicy().getMotion());
        this.avatar.setAnimateFrame(getHost().getFramesMoving());
        this.aurora.setMoving(getHost().getPolicy().getAmbient());
        if (getHost().getPolicy().getAmbient()) {
            return;
        }
        this.track.setShimmer(-1.0f);
        this.progressBar.setPulse(-1.0f);
        this.liveDot.setPhase(-1.0f);
        this.liveCard.setSheen(-1.0f);
    }

    @Override
    public void onAmbientFrame(long j) {
        if (getHost().getPolicy().getAmbient()) {
            this.aurora.frame(j);
            this.track.setShimmer(((((float) (j % 3200)) / 3200.0f) * 1.6f) - 0.3f);
            this.progressBar.setPulse(((float) (j % 2400)) / 2400.0f);
            if (this.liveCard.getVisibility() == 0) {
                this.liveDot.setPhase(((float) (j % 1800)) / 1800.0f);
                this.liveCard.setSheen(((float) (j % 4500)) / 4500.0f);
            }
        }
    }

    @Override
    public void applyInsets(int i, int i2) {
        this.content.setPadding(ThemeKt.dp(getCtx(), (Number) 20), i + ThemeKt.dp(getCtx(), (Number) 8), ThemeKt.dp(getCtx(), (Number) 20), ThemeKt.dp(getCtx(), (Number) 20));
    }

    @Override
    public long nextTickDelay(long j) {
        if (this.mode != Mode.COUNTDOWN || this.target <= j) {
            long j2 = 1000;
            return j2 - (j % j2);
        }
        return Countdown.Companion.delayToNextTick(this.target, j) + 5;
    }

    private final void bindHeader(Profile profile) {
        ThemeKt.update(this.greeting, profile.getFirstName().length() == 0 ? "Hey there" : "Hey, " + profile.getFirstName());
        TextView textView = this.identity;
        String[] strArr = new String[2];
        String str = "Class " + profile.getClassName();
        if (StringsKt.isBlank(profile.getClassName())) {
            str = null;
        }
        strArr[0] = str;
        String str2 = "Roll " + profile.getRoll();
        if (StringsKt.isBlank(profile.getRoll())) {
            str2 = null;
        }
        strArr[1] = str2;
        ThemeKt.update(textView, CollectionsKt.joinToString(CollectionsKt.filterNotNull(CollectionsKt.listOf(strArr)), " · ", "", "", -1, "...", null));
        TextView textView2 = this.schoolName;
        String substringBefore$default = StringsKt.substringBefore(profile.getSchool(), ",", profile.getSchool());
        if (StringsKt.isBlank(substringBefore$default)) {
            substringBefore$default = "Al-Ameen Academy";
        }
        ThemeKt.update(textView2, substringBefore$default);
        this.avatar.setInitials(profile.getInitials());
        this.avatar.setFrame(getHost().getData().getAvatarFrame(), this.avatar.isAttachedToWindow());
        long avatarVersion = getHost().getStore().getAvatarVersion();
        if (avatarVersion != this.avatarVersion) {
            this.avatarVersion = avatarVersion;
            this.avatar.setPhoto(getHost().avatarBitmap(ThemeKt.dp(getCtx(), (Number) 62)));
        }
    }

    @Override
    public void tick(Season season) {
        Mode mode;
        Intrinsics.checkNotNullParameter(season, "season");
        AppData data = getHost().getData();
        if (season.isOver()) {
            mode = Mode.CELEBRATE;
        } else {
            mode = season.isFinalLive() ? Mode.FINAL_LIVE : Mode.COUNTDOWN;
        }
        if (mode != this.mode) {
            applyMode(mode);
        }
        bindLive(season, data.getChoices(), data.getProfile());
        int i = WhenMappings.$EnumSwitchMapping$0[mode.ordinal()];
        if (i == 1) {
            bindCountdown(season, data.getChoices(), data.getProfile());
        } else if (i != 2) {
            if (i != 3) {
                throw new NoWhenBranchMatchedException();
            }
            bindCelebration(season, data.getProfile());
        }
        bindProgress(season, data.getChoices());
        ThemeKt.update(this.message, Messages.INSTANCE.pick(season, data.getChoices(), this.messageOffset));
    }

    private final void applyMode(Mode mode) {
        Mode mode2 = this.mode;
        this.mode = mode;
        this.subjectKey = "";
        ScreenKt.setVisible(this.nextSection, mode != Mode.CELEBRATE);
        ScreenKt.setVisible(this.celebrateSection, mode == Mode.CELEBRATE);
        boolean z = mode == Mode.COUNTDOWN;
        for (View view : CollectionsKt.listOf(new View[]{this.subject, this.countdown, this.track, this.trackCaption, this.details, this.revise})) {
            ScreenKt.setVisible(view, z);
        }
        ScreenKt.setVisible(this.localNote, false);
        ScreenKt.setVisible(this.finalNote, mode == Mode.FINAL_LIVE);
        if (mode == Mode.FINAL_LIVE) {
            ThemeKt.update(this.nextLabel, "AFTER THIS");
        }
        if (mode != Mode.CELEBRATE || mode2 == Mode.CELEBRATE) {
            return;
        }
        this.scroll.post(new HomeScreen$$ExternalSyntheticLambda8(this));
        if (getHost().getPolicy().getMotion()) {
            this.celebrateTitle.setScaleX(0.8f);
            this.celebrateTitle.setScaleY(0.8f);
            this.celebrateTitle.setPivotX(0.0f);
            this.celebrateTitle.animate().scaleX(1.0f).scaleY(1.0f).setStartDelay(200L).setDuration(420L).setInterpolator(new Spring(0.6f)).start();
        }
    }

    private static final void applyMode$lambda$73(HomeScreen homeScreen) {
        homeScreen.getHost().celebrate(false);
    }

    private final void bindCountdown(Season season, Choices choices, Profile profile) {
        String str;
        String str2;
        ExamStatus next = season.getNext();
        if (next == null) {
            return;
        }
        this.target = next.getStartMillis();
        Countdown until = Countdown.Companion.until(this.target, season.getNow());
        this.countdown.set(until);
        if (season.getLive() != null) {
            str = "FOLLOWING EXAM";
        } else {
            str = season.getNextIsFinal() ? "FINAL EXAM" : "NEXT EXAM";
        }
        TextView textView = this.nextLabel;
        StringBuilder append = new StringBuilder().append(str);
        String kicker = next.getExam().kicker(choices);
        if (kicker != null) {
            StringBuilder sb = new StringBuilder(" · ");
            String upperCase = kicker.toUpperCase(Locale.ROOT);
            Intrinsics.checkNotNullExpressionValue(upperCase, "toUpperCase(...)");
            str2 = sb.append(upperCase).toString();
        } else {
            str2 = "";
        }
        ThemeKt.update(textView, append.append(str2).toString());
        this.track.set(season.ringFraction(), !this.entranceDone);
        bindSubject(next, season, choices, profile);
        long now = (this.target - season.getNow()) / ModelKt.MINUTE;
        if (now != this.spokenMinute) {
            this.spokenMinute = now;
            this.nextSection.setContentDescription(null);
            this.countdown.setContentDescription(next.getExam().title(choices) + " starts in " + until.spoken());
        }
    }

    private final void bindSubject(ExamStatus examStatus, Season season, Choices choices, Profile profile) {
        Exam exam;
        Exam exam2 = examStatus.getExam();
        ExamStatus examStatus2 = (ExamStatus) CollectionsKt.getOrNull(season.getExams(), season.getExams().indexOf(examStatus) - 1);
        String str = exam2.getKey() + '|' + exam2.getDurationMinutes() + '|' + choices + '|' + profile.getHall() + '|' + ((examStatus2 == null || (exam = examStatus2.getExam()) == null) ? null : exam.getKey());
        if (Intrinsics.areEqual(str, this.subjectKey)) {
            ThemeKt.update(this.trackCaption, trackText(season, examStatus2, exam2, choices));
            return;
        }
        this.subjectKey = str;
        ThemeKt.update(this.subject, exam2.headline(choices));
        this.subject.setContentDescription(exam2.title(choices));
        ThemeKt.update(this.dateItem, Formats.INSTANCE.dateShort(exam2.getDate()));
        ThemeKt.update(this.timeItem, Formats.INSTANCE.time(exam2.getStart()) + " IST");
        ThemeKt.update(this.hallItem, StringsKt.isBlank(profile.getHall()) ? "Hall not set" : "Hall " + profile.getHall());
        Formats formats = Formats.INSTANCE;
        ZoneId systemDefault = ZoneId.systemDefault();
        Intrinsics.checkNotNullExpressionValue(systemDefault, "systemDefault(...)");
        String startInZone = formats.startInZone(exam2, systemDefault);
        ThemeKt.update(this.localNote, startInZone != null ? "That’s " + startInZone + " where you are now." : "");
        ScreenKt.setVisible(this.localNote, startInZone != null);
        this.revise.setText("Revise " + exam2.headline(choices));
        ControlsKt.setLeadingIcon$default(this.revise, R.drawable.ic_study, 0, 2, null);
        ThemeKt.update(this.trackCaption, trackText(season, examStatus2, exam2, choices));
    }

    private final String trackText(Season season, ExamStatus examStatus, Exam exam, Choices choices) {
        int round = Math.round(season.ringFraction() * 100);
        if (examStatus == null) {
            return round + "% of the final week before your first exam has passed.";
        }
        return round + "% of the time from " + examStatus.getExam().headline(choices) + " to " + exam.headline(choices) + " has passed.";
    }

    private final void bindLive(Season season, Choices choices, Profile profile) {
        String str;
        ExamStatus live = season.getLive();
        if (live == null) {
            ScreenKt.setVisible(this.liveCard, false);
            this.liveKey = null;
            return;
        }
        Exam exam = live.getExam();
        ThemeKt.update(this.liveDetail, exam.title(choices) + " · started " + Formats.INSTANCE.time(exam.getStart()) + (StringsKt.isBlank(profile.getHall()) ? "" : " · Hall " + profile.getHall()));
        Long confirmedEndMillis = exam.getConfirmedEndMillis();
        TextView textView = this.liveDuration;
        if (confirmedEndMillis != null) {
            StringBuilder append = new StringBuilder("Ends at ").append(Formats.time$default(Formats.INSTANCE, confirmedEndMillis.longValue(), null, 2, null)).append(" (");
            String lowerCase = Timetable.INSTANCE.durationLabel(exam.getDurationMinutes()).toLowerCase(Locale.ROOT);
            Intrinsics.checkNotNullExpressionValue(lowerCase, "toLowerCase(...)");
            str = append.append(lowerCase).append(", set in Settings).").toString();
        } else {
            str = "Duration not confirmed: 3 hours for core subjects, 1½ hours for non-core. Tap below once you’ve handed in your paper.";
        }
        ThemeKt.update(textView, str);
        this.liveCard.setContentDescription("It’s exam time! " + ((Object) this.liveDetail.getText()) + ". " + ((Object) this.liveDuration.getText()));
        if (Intrinsics.areEqual(exam.getKey(), this.liveKey)) {
            return;
        }
        this.liveKey = exam.getKey();
        ScreenKt.setVisible(this.liveCard, true);
        if (getHost().getPolicy().getMotion() && this.entranceDone) {
            this.liveCard.setAlpha(0.0f);
            this.liveCard.setScaleX(0.96f);
            this.liveCard.setScaleY(0.96f);
            this.liveCard.setTranslationY(ThemeKt.dp(getCtx(), (Number) 10));
            this.liveCard.animate().scaleX(1.0f).scaleY(1.0f).translationY(0.0f).setDuration(300L).setInterpolator(new Spring(0.8f)).start();
            FxKt.fadeTo$default(this.liveCard, 1.0f, 200L, 0L, 4, null);
        }
    }

    private final void bindCelebration(Season season, Profile profile) {
        ThemeKt.update(this.celebrateTitle, profile.getFirstName().length() == 0 ? "You did it! 🎉" : "You did it, " + profile.getFirstName() + "! 🎉");
        ThemeKt.update(this.celebrateBody, "All " + season.getTotal() + " exams are done. Time to relax — you’ve earned it.");
    }

    private final void bindProgress(Season season, Choices choices) {
        String str;
        SeasonProgressView.Segment segment;
        ThemeKt.update(this.progressCount, season.getCompleted() + " of " + season.getTotal() + " done");
        SeasonProgressView seasonProgressView = this.progressBar;
        List<ExamStatus> exams = season.getExams();
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(exams, 10));
        for (ExamStatus examStatus : exams) {
            if (examStatus.getPhase() == Phase.DONE) {
                segment = SeasonProgressView.Segment.DONE;
            } else if (examStatus.getPhase() == Phase.LIVE) {
                segment = SeasonProgressView.Segment.LIVE;
            } else {
                segment = examStatus.isToday() ? SeasonProgressView.Segment.TODAY : SeasonProgressView.Segment.UPCOMING;
            }
            arrayList.add(segment);
        }
        seasonProgressView.setSegments(arrayList);
        int round = Math.round(season.getProgress() * 100);
        TextView textView = this.progressCaption;
        if (season.isOver()) {
            str = "Every exam is complete.";
        } else if (season.getCompleted() == 0) {
            StringBuilder sb = new StringBuilder("Counted from completed exam dates. None yet — the first is ");
            String lowerCase = Formats.INSTANCE.relativeDay(((ExamStatus) CollectionsKt.first((List<? extends Object>) season.getExams())).getExam().getDate(), season.getNow()).toLowerCase(Locale.ROOT);
            Intrinsics.checkNotNullExpressionValue(lowerCase, "toLowerCase(...)");
            str = sb.append(lowerCase).append('.').toString();
        } else {
            str = round + "% complete, counted from completed exam dates.";
        }
        ThemeKt.update(textView, str);
        bindUpcoming(season, choices);
    }

    private final void bindUpcoming(Season season, Choices choices) {
        ExamStatus next = season.getNext();
        if (next == null) {
            next = season.getLive();
        }
        List take2 = CollectionsKt.take(CollectionsKt.drop(season.getExams(), next == null ? season.getExams().size() : season.getExams().indexOf(next) + 1), 2);
        String str = CollectionsKt.joinToString(take2, ", ", "", "", -1, "...", new HomeScreen$$ExternalSyntheticLambda9()) + choices;
        if (Intrinsics.areEqual(str, this.upcomingKey)) {
            return;
        }
        this.upcomingKey = str;
        this.upcomingList.removeAllViews();
        ScreenKt.setVisible(this.upcomingLabel, !take2.isEmpty());
        int i = 0;
        for (Object obj : take2) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            ExamStatus examStatus = (ExamStatus) obj;
            if (i > 0) {
                this.upcomingList.addView(ThemeKt.separator(getCtx()));
            }
            this.upcomingList.addView(upcomingRow(examStatus.getExam(), choices));
            i = i2;
        }
    }

    private static final CharSequence bindUpcoming$lambda$76(ExamStatus it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return it.getExam().getKey();
    }

    private final View upcomingRow(Exam exam, Choices choices) {
        LinearLayout linearLayout = new LinearLayout(getCtx());
        linearLayout.setOrientation(0);
        linearLayout.setGravity(16);
        LinearLayout linearLayout2 = linearLayout;
        linearLayout.setMinimumHeight(ThemeKt.dp(linearLayout2, (Number) 56));
        linearLayout.setPadding(0, ThemeKt.dp(linearLayout2, (Number) 8), 0, ThemeKt.dp(linearLayout2, (Number) 8));
        linearLayout.setBackground(Shapes.INSTANCE.ripple(getCtx(), null, (Number) 8));
        LinearLayout linearLayout3 = new LinearLayout(getCtx());
        linearLayout3.setOrientation(1);
        linearLayout3.addView(ThemeKt.label(getCtx(), Formats.INSTANCE.weekday(exam.getDate()), Ui.INSTANCE.getC().getText3(), 10.5f));
        linearLayout3.addView(ThemeKt.text$default(getCtx(), StringsKt.substringAfter(Formats.INSTANCE.dateShort(exam.getDate()), ", ", Formats.INSTANCE.dateShort(exam.getDate())), 15.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null), ThemeKt.lp$default(0, 0, 0.0f, new HomeScreen$$ExternalSyntheticLambda0(linearLayout3), 7, null));
        linearLayout.addView(linearLayout3, ThemeKt.lp$default(ThemeKt.dp(linearLayout2, (Number) 64), -2, 0.0f, null, 12, null));
        linearLayout.addView(ThemeKt.text$default(getCtx(), exam.title(choices), 16.0f, Ui.INSTANCE.getC().getText(), null, null, 24, null), ThemeKt.lp(0, -2, 1.0f, new HomeScreen$$ExternalSyntheticLambda1(linearLayout)));
        linearLayout.addView(ThemeKt.text$default(getCtx(), Formats.INSTANCE.time(exam.getStart()), 14.0f, Ui.INSTANCE.getC().getText2(), null, null, 24, null), ThemeKt.lp$default(-2, -2, 0.0f, new HomeScreen$$ExternalSyntheticLambda2(linearLayout), 4, null));
        linearLayout.setContentDescription(exam.title(choices) + ", " + Formats.INSTANCE.dateLong(exam.getDate()) + " at " + Formats.INSTANCE.time(exam.getStart()));
        linearLayout.setOnClickListener(new HomeScreen$$ExternalSyntheticLambda3(this, exam));
        return linearLayout2;
    }

    private static final Unit upcomingRow$lambda$83$lambda$79$lambda$78(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
        return Unit.INSTANCE;
    }

    private static final Unit upcomingRow$lambda$83$lambda$80(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 8));
        return Unit.INSTANCE;
    }

    private static final Unit upcomingRow$lambda$83$lambda$81(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 8));
        return Unit.INSTANCE;
    }

    private static final void upcomingRow$lambda$83$lambda$82(HomeScreen homeScreen, Exam exam, View view) {
        homeScreen.getHost().openChecklist(exam.getSubject());
    }

    private final void cycleMessage() {
        this.messageOffset++;
        String pick = Messages.INSTANCE.pick(getHost().getSeason(), getHost().getData().getChoices(), this.messageOffset);
        if (!getHost().getPolicy().getMotion()) {
            this.message.setText(pick);
        } else {
            this.message.animate().alpha(0.0f).translationY(-ThemeKt.dp(getCtx(), (Number) 8)).setDuration(120L).setInterpolator(Ease.INSTANCE.getExit()).withEndAction(new HomeScreen$$ExternalSyntheticLambda6(this, pick)).start();
        }
    }

    private static final void cycleMessage$lambda$84(HomeScreen homeScreen, String str) {
        homeScreen.message.setText(str);
        homeScreen.message.setTranslationY(ThemeKt.dp(homeScreen.getCtx(), (Number) 10));
        homeScreen.message.animate().translationY(0.0f).setDuration(260L).setInterpolator(Ease.INSTANCE.getOut()).start();
        FxKt.fadeTo$default(homeScreen.message, 1.0f, 200L, 0L, 4, null);
    }

    private final void onMarkFinished() {
        ExamStatus live = getHost().getSeason().getLive();
        if (live == null) {
            return;
        }
        Dialogs.confirm$default(Dialogs.INSTANCE, getHost(), "Finished " + live.getExam().title(getHost().getData().getChoices()) + '?', "Only do this once you’ve handed in your paper. The app will then count it as done.", "Mark as finished", false, new HomeScreen$$ExternalSyntheticLambda5(this, live), 16, null);
    }

    private static final Unit onMarkFinished$lambda$85(HomeScreen homeScreen, ExamStatus examStatus) {
        Haptics.INSTANCE.confirm(homeScreen.liveButton);
        homeScreen.getHost().popAt(homeScreen.liveButton, 1.3f);
        homeScreen.getHost().markFinished(examStatus.getExam());
        return Unit.INSTANCE;
    }
}

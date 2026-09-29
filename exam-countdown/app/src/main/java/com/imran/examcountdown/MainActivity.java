package com.imran.examcountdown;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.app.UiModeManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Insets;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ext.SdkExtensions;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.animation.LinearInterpolator;
import android.view.inputmethod.InputMethodManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Toast;
import android.window.SplashScreenView;
import com.imran.examcountdown.core.AvatarFrame;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.ModelKt;
import com.imran.examcountdown.core.MotionPref;
import com.imran.examcountdown.core.Profile;
import com.imran.examcountdown.core.ReminderSettings;
import com.imran.examcountdown.core.Season;
import com.imran.examcountdown.core.SeasonCalculator;
import com.imran.examcountdown.core.Subject;
import com.imran.examcountdown.core.ThemeMode;
import com.imran.examcountdown.data.AppClock;
import com.imran.examcountdown.data.Avatar;
import com.imran.examcountdown.data.Store;
import com.imran.examcountdown.notify.AppVisibility;
import com.imran.examcountdown.notify.Notifier;
import com.imran.examcountdown.notify.ReminderScheduler;
import com.imran.examcountdown.ui.AmbientTicker;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.Fonts;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.Haptics;
import com.imran.examcountdown.ui.MotionPolicy;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import com.imran.examcountdown.ui.screens.HomeScreen;
import com.imran.examcountdown.ui.screens.ProfileEditor;
import com.imran.examcountdown.ui.screens.Screen;
import com.imran.examcountdown.ui.screens.SettingsScreen;
import com.imran.examcountdown.ui.screens.SetupScreen;
import com.imran.examcountdown.ui.screens.StudyScreen;
import com.imran.examcountdown.ui.screens.TimetableScreen;
import com.imran.examcountdown.ui.widgets.AvatarView;
import com.imran.examcountdown.ui.widgets.ConfettiView;
import com.imran.examcountdown.ui.widgets.GoldRipple;
import com.imran.examcountdown.ui.widgets.IntroView;
import com.imran.examcountdown.ui.widgets.NavBar;
import java.util.List;
import kotlin.Deprecated;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.Pair;
import kotlin.TuplesKt;
import kotlin.Unit;
import kotlin.collections.ArraysKt;
import kotlin.collections.CollectionsKt;
import kotlin.collections.SetsKt;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.math.MathKt;
import kotlin.ranges.RangesKt;

public final class MainActivity extends Activity {
    public static final Companion Companion = new Companion(null);
    public static final String EXTRA_TAB = "com.imran.examcountdown.TAB";
    private static final float FLY_BACK_MS = 360.0f;
    private static final float FLY_MS = 400.0f;
    private static final int REQUEST_NOTIFICATIONS = 11;
    private static final int REQUEST_PHOTO = 12;
    private static final float SPRING_BACK_MS = 150.0f;
    private static final String STATE_TAB = "tab";
    public static final int TAB_HOME = 0;
    private static final float TAB_MS = 240.0f;
    public static final int TAB_SETTINGS = 3;
    public static final int TAB_STUDY = 2;
    public static final int TAB_TIMETABLE = 1;
    private Pair<Long, Bitmap> avatarCache;
    private boolean celebrated;
    private ConfettiView confetti;
    private FrameLayout content;
    private AppData data;
    private ProfileEditor editor;
    private AvatarView editorSource;
    private AvatarView flying;
    private int insetBottom;
    private int insetTop;
    private IntroView intro;
    private boolean introRunning;
    private NavBar nav;
    private Function1<? super Boolean, Unit> pendingPermission;
    private boolean powerReceiverRegistered;
    private ValueAnimator profileMotion;
    private boolean resumed;
    private FrameLayout root;
    private Season season;
    private SetupScreen setup;
    private Store store;
    private ValueAnimator transition;
    private MotionPolicy policy = new MotionPolicy(true, true);
    private final AmbientTicker ambient = new AmbientTicker(0, 1, null);
    private final Screen[] screens = new Screen[4];
    private final boolean[] shownBefore = new boolean[4];
    private int currentTab = -1;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable ticker = new MainActivity$$ExternalSyntheticLambda21(this);
    private final MainActivity$powerReceiver$1 powerReceiver = new MainActivity$powerReceiver$1(this);

    public class WhenMappings {
        public static final int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[ThemeMode.values().length];
            try {
                iArr[ThemeMode.LIGHT.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[ThemeMode.DARK.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            try {
                iArr[ThemeMode.SYSTEM.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    public static void $r8$lambda$2Cw9_DvKZ6rQtFrp_n8YQl8HARo(Function0 function0) {
        fade$lambda$38(function0);
    }

    public static void m0$r8$lambda$3OAYS_QvEigNZ0YRrStEIIYE0(boolean z, IntroView introView, boolean z2) {
        playIntro$lambda$19(z, introView, z2);
    }

    public static Unit m1$r8$lambda$CjRKrY2s0ktnC4CnSbOecVYu5g() {
        return openProfileEditor$lambda$25();
    }

    public static Unit $r8$lambda$GwMOqTPG79EGgm7vNpx6Uu2slfA(MainActivity mainActivity) {
        return playIntro$lambda$17(mainActivity);
    }

    public static ReminderSettings $r8$lambda$L7Cd_RDR4QaHczoP9boGbcKIahg(ReminderSettings reminderSettings) {
        return setExamReminders$lambda$48$lambda$47(reminderSettings);
    }

    public static Unit $r8$lambda$LqWKISnAl01zTssa57LYCaVxOuI(MainActivity mainActivity, ProfileEditor profileEditor) {
        return closeProfileEditor$lambda$32(mainActivity, profileEditor);
    }

    public static void m2$r8$lambda$O9UR5C65n8ghGzOOnji094ZCMY(MainActivity mainActivity, Bitmap bitmap) {
        handlePickedPhoto$lambda$41$lambda$40(mainActivity, bitmap);
    }

    public static Unit $r8$lambda$R4Ik6Hug6nCu9bZ31yuI689TAa0(MainActivity mainActivity, Function0 function0, boolean z) {
        return setFocusAlerts$lambda$51(mainActivity, function0, z);
    }

    public static void $r8$lambda$RX1BmlIQ5fsOx2_Z4r0Yc7RxEQA(GoldRipple goldRipple, ValueAnimator valueAnimator) {
        ripple$lambda$37$lambda$36(goldRipple, valueAnimator);
    }

    public static void $r8$lambda$VAZyuoFKQr5AGbpus3iH8Uip6Gg(MainActivity mainActivity, AvatarView avatarView, Rect rect, Rect rect2, ProfileEditor profileEditor, ValueAnimator valueAnimator) {
        closeProfileEditor$lambda$35$lambda$34(mainActivity, avatarView, rect, rect2, profileEditor, valueAnimator);
    }

    public static ReminderSettings $r8$lambda$VfLoMl3WgdlnsZXilMuK4yXc4L4(ReminderSettings reminderSettings) {
        return setFocusAlerts$lambda$51$lambda$50(reminderSettings);
    }

    public static WindowInsets m3$r8$lambda$_6IdMK7zD3NW5uQRvd00QtYBdM(MainActivity mainActivity, LinearLayout linearLayout, View view, WindowInsets windowInsets) {
        return buildViews$lambda$11(mainActivity, linearLayout, view, windowInsets);
    }

    public static void m4$r8$lambda$_ukBMvhccqb5ETMhXv8tnKsg8o(MainActivity mainActivity) {
        ticker$lambda$0(mainActivity);
    }

    public static Unit $r8$lambda$aJpBVSfB9nIAPFTJdz6o404G2Go(MainActivity mainActivity, Function0 function0, boolean z) {
        return setExamReminders$lambda$48(mainActivity, function0, z);
    }

    public static Unit m5$r8$lambda$bWyp4sMt4PqX7RxSoqLH3po9m8(MainActivity mainActivity, int i) {
        return buildViews$lambda$8(mainActivity, i);
    }

    public static void m6$r8$lambda$f08dvlMd_UAyZBCcbQiDmzevGY(SplashScreenView splashScreenView) {
        onCreate$lambda$3$lambda$2(splashScreenView);
    }

    public static ReminderSettings $r8$lambda$gz17c1ZiHk5hWC8z7sTw_qHyTPM(ReminderSettings reminderSettings) {
        return setFocusAlerts$lambda$49(reminderSettings);
    }

    public static Unit $r8$lambda$hnPTXONO1tfP_7fn43IqUzB_s_U(MainActivity mainActivity, ProfileEditor profileEditor, AvatarView avatarView) {
        return openProfileEditor$lambda$26(mainActivity, profileEditor, avatarView);
    }

    public static void $r8$lambda$jFw5oeTebPHQvB4dHGO8DpvzNY4(View view, float f, MainActivity mainActivity, View view2, float f2, ValueAnimator valueAnimator) {
        slide$lambda$22$lambda$21(view, f, mainActivity, view2, f2, valueAnimator);
    }

    public static void $r8$lambda$jPWXbjqJkIJqeJRWQ_Xj7stunc0(Context context, Uri uri, MainActivity mainActivity) {
        handlePickedPhoto$lambda$41(context, uri, mainActivity);
    }

    public static Unit $r8$lambda$jV8gP8jKKudfx5fXeI5BLdFs0KM(MainActivity mainActivity, boolean z) {
        return playIntro$lambda$16(mainActivity, z);
    }

    public static ReminderSettings $r8$lambda$kzDZmrar8N7lF7_t1lB7yS6XyPc(ReminderSettings reminderSettings) {
        return setExamReminders$lambda$46(reminderSettings);
    }

    public static View $r8$lambda$lUrPXCsfaGoV62laRmecEdby8y4(MainActivity mainActivity) {
        return playIntro$lambda$13(mainActivity);
    }

    public static void $r8$lambda$lV_CGqun7VjxJ0PCxIY0YmTUF38(boolean z, MainActivity mainActivity, SplashScreenView splashScreenView) {
        onCreate$lambda$3(z, mainActivity, splashScreenView);
    }

    public static void $r8$lambda$nfn9aXN55zm9bQ0bYJNvvjbZ8Os(MainActivity mainActivity, AvatarView avatarView, Rect rect, Rect rect2, Rect rect3, ProfileEditor profileEditor, ValueAnimator valueAnimator) {
        flyIn$lambda$29$lambda$28(mainActivity, avatarView, rect, rect2, rect3, profileEditor, valueAnimator);
    }

    public static Unit m7$r8$lambda$suwvhkbQEoCbaXPHAt_8qmng5E(MainActivity mainActivity) {
        return playIntro$lambda$18(mainActivity);
    }

    public static Unit $r8$lambda$ytHNxsl1O31dSpppnMBtB6q7uec(boolean z, MainActivity mainActivity) {
        return playIntro$lambda$14(z, mainActivity);
    }

    public static void $r8$lambda$z3k02M5Y2uYrIbCNeV0rwwM38Dc(MainActivity mainActivity, FrameLayout frameLayout) {
        finishSetup$lambda$23(mainActivity, frameLayout);
    }

    public static final AvatarView access$getFlying$p(MainActivity mainActivity) {
        return mainActivity.flying;
    }

    public static final FrameLayout access$getRoot$p(MainActivity mainActivity) {
        return mainActivity.root;
    }

    public static final void access$rest(MainActivity mainActivity, View view) {
        mainActivity.rest(view);
    }

    public static final void access$setFlying$p(MainActivity mainActivity, AvatarView avatarView) {
        mainActivity.flying = avatarView;
    }

    public static final void access$setProfileMotion$p(MainActivity mainActivity, ValueAnimator valueAnimator) {
        mainActivity.profileMotion = valueAnimator;
    }

    public static final void access$setTransition$p(MainActivity mainActivity, ValueAnimator valueAnimator) {
        mainActivity.transition = valueAnimator;
    }

    public static final class Companion {
        public Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }
    }

    public final Store getStore() {
        Store store = this.store;
        if (store != null) {
            return store;
        }
        Intrinsics.throwUninitializedPropertyAccessException("store");
        return null;
    }

    public final AppData getData() {
        AppData appData = this.data;
        if (appData != null) {
            return appData;
        }
        Intrinsics.throwUninitializedPropertyAccessException("data");
        return null;
    }

    public final Season getSeason() {
        Season season = this.season;
        if (season != null) {
            return season;
        }
        Intrinsics.throwUninitializedPropertyAccessException("season");
        return null;
    }

    public final MotionPolicy getPolicy() {
        return this.policy;
    }

    public final AmbientTicker getAmbient() {
        return this.ambient;
    }

    public final boolean getIntroRunning() {
        return this.introRunning;
    }

    private static final void ticker$lambda$0(MainActivity mainActivity) {
        mainActivity.tick();
    }

    private final Screen getCurrent() {
        int i = this.currentTab;
        if (i >= 0) {
            return this.screens[i];
        }
        return null;
    }

    public final ProfileEditor getProfileEditor() {
        return this.editor;
    }

    public final Screen getCurrentScreen() {
        return getCurrent();
    }

    public final AvatarView getFlyingAvatar() {
        return this.flying;
    }

    public final boolean getProfileTransitionRunning() {
        return this.profileMotion != null;
    }

    public final boolean getFramesMoving() {
        return this.resumed && this.policy.getAmbient() && getData().getFrameAnimated();
    }

    @Override
    protected void attachBaseContext(Context newBase) {
        Integer num;
        Intrinsics.checkNotNullParameter(newBase, "newBase");
        super.attachBaseContext(newBase);
        if (Build.VERSION.SDK_INT < 31) {
            int i = WhenMappings.$EnumSwitchMapping$0[new Store(newBase).getTheme().ordinal()];
            if (i == 1) {
                num = 16;
            } else if (i == 2) {
                num = 32;
            } else if (i != 3) {
                throw new NoWhenBranchMatchedException();
            } else {
                num = null;
            }
            if (num != null) {
                Configuration configuration = new Configuration();
                configuration.uiMode = num.intValue();
                applyOverrideConfiguration(configuration);
            }
        }
    }

    @Override
    protected void onCreate(Bundle bundle) {
        int intExtra;
        setTheme(R.style.Theme_ExamCountdown);
        super.onCreate(bundle);
        MainActivity mainActivity = this;
        Fonts.INSTANCE.init(mainActivity);
        Ui.INSTANCE.apply(mainActivity);
        this.store = new Store(mainActivity);
        Haptics.INSTANCE.setEnabled(getStore().getHaptics());
        this.data = loadData();
        this.season = SeasonCalculator.INSTANCE.compute(getData().getExams(), AppClock.INSTANCE.now(), getData().getMarkedDone());
        this.policy = MotionPolicy.Companion.resolve(mainActivity, getData().getMotion());
        buildViews();
        setupWindow();
        boolean introHandled = ExamCountdownApp.Companion.getIntroHandled();
        boolean z = true;
        ExamCountdownApp.Companion.setIntroHandled(true);
        if (bundle != null || introHandled || !getStore().getIntroEnabled() || !this.policy.getMotion() || getIntent().hasExtra(EXTRA_TAB)) {
            z = false;
        }
        if (Build.VERSION.SDK_INT >= 31) {
            getSplashScreen().setOnExitAnimationListener(new MainActivity$$ExternalSyntheticLambda19(z, this));
        }
        updateLaunchWindow();
        this.introRunning = z;
        if (bundle == null) {
            intExtra = getIntent().getIntExtra(EXTRA_TAB, 0);
        } else {
            intExtra = bundle.getInt(STATE_TAB, 0);
        }
        if (getStore().getSetupDone()) {
            showTab(intExtra, false);
        } else {
            showSetup();
        }
        if (z) {
            playIntro(false);
        }
    }

    private static final void onCreate$lambda$3(boolean z, MainActivity mainActivity, SplashScreenView view) {
        Intrinsics.checkNotNullParameter(view, "view");
        if (z || !mainActivity.policy.getMotion()) {
            view.remove();
        } else {
            view.animate().alpha(0.0f).setDuration(180L).withEndAction(new MainActivity$$ExternalSyntheticLambda24(view)).start();
        }
    }

    private static final void onCreate$lambda$3$lambda$2(SplashScreenView splashScreenView) {
        splashScreenView.remove();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        Intrinsics.checkNotNullParameter(intent, "intent");
        super.onNewIntent(intent);
        if (this.setup == null && intent.hasExtra(EXTRA_TAB)) {
            showTab(intent.getIntExtra(EXTRA_TAB, 0), true);
        }
    }

    @Override
    protected void onResume() {
        Screen[] screenArr;
        Screen current;
        super.onResume();
        this.resumed = true;
        AppVisibility.INSTANCE.setResumed(true);
        this.data = loadData();
        for (Screen screen : this.screens) {
            if (screen != null) {
                screen.onDataChanged();
            }
        }
        if (this.setup == null && !this.introRunning && (current = getCurrent()) != null) {
            current.onShow(false);
        }
        if (!this.powerReceiverRegistered) {
            registerReceiver(this.powerReceiver, new IntentFilter("android.os.action.POWER_SAVE_MODE_CHANGED"));
            this.powerReceiverRegistered = true;
        }
        applyMotion();
        ReminderScheduler.INSTANCE.onWake(this);
        tick();
    }

    @Override
    protected void onPause() {
        super.onPause();
        this.resumed = false;
        AppVisibility.INSTANCE.setResumed(false);
        this.handler.removeCallbacks(this.ticker);
        applyMotion();
        if (this.powerReceiverRegistered) {
            unregisterReceiver(this.powerReceiver);
            this.powerReceiverRegistered = false;
        }
    }

    @Override
    protected void onDestroy() {
        ValueAnimator valueAnimator = this.profileMotion;
        if (valueAnimator != null) {
            valueAnimator.cancel();
        }
        ValueAnimator valueAnimator2 = this.transition;
        if (valueAnimator2 != null) {
            valueAnimator2.cancel();
        }
        super.onDestroy();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        Intrinsics.checkNotNullParameter(outState, "outState");
        super.onSaveInstanceState(outState);
        int i = this.currentTab;
        if (i < 0) {
            i = 0;
        }
        outState.putInt(STATE_TAB, i);
    }

    @Override
    public void onBackPressed() {
        IntroView introView = this.intro;
        if (introView != null) {
            introView.skip();
            return;
        }
        ProfileEditor profileEditor = this.editor;
        if (profileEditor != null) {
            profileEditor.back();
            return;
        }
        SetupScreen setupScreen = this.setup;
        if (setupScreen != null) {
            if (setupScreen.back()) {
                return;
            }
            super.onBackPressed();
        } else if (this.currentTab != 0) {
            showTab(0, true);
        } else {
            super.onBackPressed();
        }
    }

    private final void setupWindow() {
        int i = 0;
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        }
        barsOnGreen(false);
        getWindow().setStatusBarColor(0);
        Window window = getWindow();
        if (Build.VERSION.SDK_INT < 27 && !Ui.INSTANCE.getC().getDark()) {
            i = 1711276032;
        }
        window.setNavigationBarColor(i);
    }

    private final void barsOnGreen(boolean z) {
        int i;
        boolean z2 = (z || Ui.INSTANCE.getC().getDark()) ? false : true;
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController windowInsetsController = getWindow().getDecorView().getWindowInsetsController();
            if (windowInsetsController != null) {
                windowInsetsController.setSystemBarsAppearance(z2 ? 24 : 0, 24);
                return;
            }
            return;
        }
        if (z2) {
            i = Build.VERSION.SDK_INT >= 27 ? 10000 : 9984;
        } else {
            i = 1792;
        }
        getWindow().getDecorView().setSystemUiVisibility(i);
    }

    private final void updateLaunchWindow() {
        if (Build.VERSION.SDK_INT < 33) {
            return;
        }
        try {
            getSplashScreen().setSplashScreenTheme(getStore().getIntroEnabled() && this.policy.getMotion() ? R.style.Theme_ExamCountdown_Launch : R.style.Theme_ExamCountdown);
        } catch (RuntimeException unused) {
        }
    }

    private final void buildViews() {
        MainActivity mainActivity = this;
        FrameLayout frameLayout = new FrameLayout(mainActivity);
        frameLayout.setBackgroundColor(Ui.INSTANCE.getC().getBg());
        this.root = frameLayout;
        this.content = new FrameLayout(mainActivity);
        this.nav = new NavBar(mainActivity, CollectionsKt.listOf(new String[]{"Home", "Timetable", "Study", "Settings"}), CollectionsKt.listOf(new Integer[]{Integer.valueOf((int) R.drawable.ic_home), Integer.valueOf((int) R.drawable.ic_timeline), Integer.valueOf((int) R.drawable.ic_study), Integer.valueOf((int) R.drawable.ic_settings)}), new MainActivity$$ExternalSyntheticLambda9(this));
        this.confetti = new ConfettiView(mainActivity);
        LinearLayout linearLayout = new LinearLayout(mainActivity);
        linearLayout.setOrientation(1);
        FrameLayout frameLayout2 = this.content;
        FrameLayout frameLayout3 = null;
        if (frameLayout2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("content");
            frameLayout2 = null;
        }
        linearLayout.addView(frameLayout2, new LinearLayout.LayoutParams(-1, 0, 1.0f));
        NavBar navBar = this.nav;
        if (navBar == null) {
            Intrinsics.throwUninitializedPropertyAccessException("nav");
            navBar = null;
        }
        linearLayout.addView(navBar, new LinearLayout.LayoutParams(-1, -2));
        FrameLayout frameLayout4 = this.root;
        if (frameLayout4 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            frameLayout4 = null;
        }
        frameLayout4.addView(linearLayout, ThemeKt.flp$default(-1, -1, 0, 4, null));
        FrameLayout frameLayout5 = this.root;
        if (frameLayout5 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            frameLayout5 = null;
        }
        ConfettiView confettiView = this.confetti;
        if (confettiView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("confetti");
            confettiView = null;
        }
        frameLayout5.addView(confettiView, ThemeKt.flp$default(-1, -1, 0, 4, null));
        FrameLayout frameLayout6 = this.root;
        if (frameLayout6 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            frameLayout6 = null;
        }
        frameLayout6.setOnApplyWindowInsetsListener(new MainActivity$$ExternalSyntheticLambda10(this, linearLayout));
        FrameLayout frameLayout7 = this.root;
        if (frameLayout7 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
        } else {
            frameLayout3 = frameLayout7;
        }
        setContentView(frameLayout3);
    }

    private static final Unit buildViews$lambda$8(MainActivity mainActivity, int i) {
        mainActivity.showTab(i, true);
        return Unit.INSTANCE;
    }

    private static final WindowInsets buildViews$lambda$11(MainActivity mainActivity, LinearLayout linearLayout, View view, WindowInsets insets) {
        int systemWindowInsetTop;
        int systemWindowInsetBottom;
        int systemWindowInsetLeft;
        int systemWindowInsetRight;
        int i;
        Screen[] screenArr;
        Intrinsics.checkNotNullParameter(view, "<unused var>");
        Intrinsics.checkNotNullParameter(insets, "insets");
        if (Build.VERSION.SDK_INT >= 30) {
            Insets insets2 = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            Intrinsics.checkNotNullExpressionValue(insets2, "getInsets(...)");
            systemWindowInsetTop = insets2.top;
            systemWindowInsetBottom = insets2.bottom;
            systemWindowInsetLeft = insets2.left;
            systemWindowInsetRight = insets2.right;
            i = insets.getInsets(WindowInsets.Type.ime()).bottom;
        } else {
            systemWindowInsetTop = insets.getSystemWindowInsetTop();
            systemWindowInsetBottom = insets.getSystemWindowInsetBottom();
            systemWindowInsetLeft = insets.getSystemWindowInsetLeft();
            systemWindowInsetRight = insets.getSystemWindowInsetRight();
            i = 0;
        }
        mainActivity.insetTop = systemWindowInsetTop;
        mainActivity.insetBottom = systemWindowInsetBottom;
        linearLayout.setPadding(systemWindowInsetLeft, 0, systemWindowInsetRight, 0);
        NavBar navBar = mainActivity.nav;
        if (navBar == null) {
            Intrinsics.throwUninitializedPropertyAccessException("nav");
            navBar = null;
        }
        navBar.setBottomInset(systemWindowInsetBottom);
        for (Screen screen : mainActivity.screens) {
            if (screen != null) {
                screen.applyInsets(systemWindowInsetTop, systemWindowInsetBottom);
            }
        }
        SetupScreen setupScreen = mainActivity.setup;
        if (setupScreen != null) {
            setupScreen.applyInsets(systemWindowInsetTop, systemWindowInsetBottom);
        }
        ProfileEditor profileEditor = mainActivity.editor;
        if (profileEditor != null) {
            profileEditor.applyInsets(systemWindowInsetTop, Math.max(systemWindowInsetBottom, i));
        }
        return insets;
    }

    private final void playIntro(boolean z) {
        if (this.intro != null) {
            return;
        }
        IntroView introView = new IntroView(this);
        this.intro = introView;
        this.introRunning = true;
        introView.setTarget(new MainActivity$$ExternalSyntheticLambda2(this));
        introView.setOnCovered(new MainActivity$$ExternalSyntheticLambda3(z, this));
        introView.setOnReveal(new MainActivity$$ExternalSyntheticLambda4(this, z));
        introView.setOnBackdropGone(new MainActivity$$ExternalSyntheticLambda5(this));
        introView.setOnFinished(new MainActivity$$ExternalSyntheticLambda6(this));
        FrameLayout frameLayout = this.root;
        if (frameLayout == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            frameLayout = null;
        }
        frameLayout.addView(introView, ThemeKt.flp$default(-1, -1, 0, 4, null));
        barsOnGreen(true);
        introView.post(new MainActivity$$ExternalSyntheticLambda7(true ^ this.policy.getMotion(), introView, z));
    }

    private static final View playIntro$lambda$13(MainActivity mainActivity) {
        ImageView emblem;
        ImageView emblem2;
        SetupScreen setupScreen = mainActivity.setup;
        if (setupScreen == null || (emblem2 = setupScreen.getEmblem()) == null) {
            Screen screen = mainActivity.screens[0];
            ImageView imageView = null;
            HomeScreen homeScreen = screen instanceof HomeScreen ? (HomeScreen) screen : null;
            if (homeScreen != null && (emblem = homeScreen.getEmblem()) != null && mainActivity.currentTab == 0) {
                imageView = emblem;
            }
            return imageView;
        }
        return emblem2;
    }

    private static final Unit playIntro$lambda$14(boolean z, MainActivity mainActivity) {
        if (z) {
            mainActivity.showTab(0, false);
            Screen screen = mainActivity.screens[0];
            HomeScreen homeScreen = screen instanceof HomeScreen ? (HomeScreen) screen : null;
            if (homeScreen != null) {
                homeScreen.scrollToTop();
            }
        }
        return Unit.INSTANCE;
    }

    private static final Unit playIntro$lambda$16(MainActivity mainActivity, boolean z) {
        Screen screen = mainActivity.screens[0];
        HomeScreen homeScreen = null;
        HomeScreen homeScreen2 = screen instanceof HomeScreen ? (HomeScreen) screen : null;
        if (homeScreen2 != null) {
            if (mainActivity.currentTab == 0 && mainActivity.setup == null) {
                homeScreen = homeScreen2;
            }
            if (homeScreen != null) {
                homeScreen.playEntrance(z);
            }
        }
        return Unit.INSTANCE;
    }

    private static final Unit playIntro$lambda$17(MainActivity mainActivity) {
        mainActivity.barsOnGreen(false);
        return Unit.INSTANCE;
    }

    private static final Unit playIntro$lambda$18(MainActivity mainActivity) {
        mainActivity.intro = null;
        mainActivity.introRunning = false;
        Screen current = mainActivity.getCurrent();
        if (current != null) {
            current.onShow(false);
        }
        mainActivity.tick();
        return Unit.INSTANCE;
    }

    private static final void playIntro$lambda$19(boolean z, IntroView introView, boolean z2) {
        if (z) {
            introView.playStill(z2);
        } else {
            introView.play(z2);
        }
    }

    public final void replayIntro() {
        if (this.intro == null && this.setup == null && this.editor == null) {
            playIntro(true);
        }
    }

    public final void setIntroEnabled(boolean z) {
        getStore().setIntroEnabled(z);
        updateLaunchWindow();
    }

    public static void showTab$default(MainActivity mainActivity, int i, boolean z, int i2, Object obj) {
        if ((i2 & 2) != 0) {
            z = true;
        }
        mainActivity.showTab(i, z);
    }

    public final void showTab(int i, boolean z) {
        View root;
        int coerceIn = RangesKt.coerceIn(i, 0, 3);
        if (this.setup != null) {
            return;
        }
        Screen current = getCurrent();
        if (coerceIn == this.currentTab && current != null) {
            current.onShow(false);
            return;
        }
        Screen screen = this.screens[coerceIn];
        NavBar navBar = null;
        if (screen == null) {
            screen = createScreen(coerceIn);
            this.screens[coerceIn] = screen;
            FrameLayout frameLayout = this.content;
            if (frameLayout == null) {
                Intrinsics.throwUninitializedPropertyAccessException("content");
                frameLayout = null;
            }
            frameLayout.addView(screen.getRoot(), ThemeKt.flp$default(-1, -1, 0, 4, null));
            screen.applyInsets(this.insetTop, this.insetBottom);
        }
        if (current != null) {
            current.onHide();
        }
        float f = coerceIn > this.currentTab ? 1.0f : -1.0f;
        this.currentTab = coerceIn;
        ValueAnimator valueAnimator = this.transition;
        if (valueAnimator != null) {
            valueAnimator.end();
        }
        View root2 = screen.getRoot();
        root2.setVisibility(0);
        if (z && this.policy.getMotion() && current != null) {
            slide(current.getRoot(), root2, f);
        } else {
            if (current != null && (root = current.getRoot()) != null) {
                root.setVisibility(8);
            }
            rest(root2);
        }
        NavBar navBar2 = this.nav;
        if (navBar2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("nav");
            navBar2 = null;
        }
        navBar2.setVisibility(0);
        NavBar navBar3 = this.nav;
        if (navBar3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("nav");
        } else {
            navBar = navBar3;
        }
        navBar.select(coerceIn, z);
        boolean[] zArr = this.shownBefore;
        boolean z2 = !zArr[coerceIn];
        zArr[coerceIn] = true;
        screen.onShow(z2);
        applyMotion();
        tick();
    }

    private final void slide(View view, View view2, float f) {
        float dpf = ThemeKt.dpf(this, (Number) 16);
        view2.setAlpha(0.0f);
        view2.setTranslationX(f * dpf);
        ValueAnimator ofFloat = ValueAnimator.ofFloat(0.0f, TAB_MS);
        ofFloat.setDuration(240L);
        ofFloat.setInterpolator(new LinearInterpolator());
        ofFloat.addUpdateListener(new MainActivity$$ExternalSyntheticLambda23(view, f, this, view2, dpf));
        ofFloat.addListener(new MainActivity$slide$1$2(view, this, view2));
        ofFloat.start();
        this.transition = ofFloat;
    }

    private static final void slide$lambda$22$lambda$21(View view, float f, MainActivity mainActivity, View view2, float f2, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        float floatValue = ((Float) animatedValue).floatValue();
        float cubicOut = Ease.INSTANCE.cubicOut(FxKt.window(floatValue, 0.0f, 120.0f));
        view.setAlpha(1.0f - cubicOut);
        view.setTranslationX((-f) * ThemeKt.dpf(mainActivity, (Number) 8) * cubicOut);
        float cubicOut2 = Ease.INSTANCE.cubicOut(FxKt.window(floatValue, 40.0f, 200.0f));
        view2.setAlpha(cubicOut2);
        view2.setTranslationX(f * f2 * (1.0f - cubicOut2));
    }

    private final void rest(View view) {
        view.setAlpha(1.0f);
        view.setTranslationX(0.0f);
        view.setTranslationY(0.0f);
        view.setScaleX(1.0f);
        view.setScaleY(1.0f);
    }

    private final Screen createScreen(int i) {
        if (i != 1) {
            if (i != 2) {
                if (i == 3) {
                    return new SettingsScreen(this);
                }
                return new HomeScreen(this);
            }
            return new StudyScreen(this);
        }
        return new TimetableScreen(this);
    }

    public final void openChecklist(Subject subject) {
        showTab(2, true);
        Screen screen = this.screens[2];
        StudyScreen studyScreen = screen instanceof StudyScreen ? (StudyScreen) screen : null;
        if (studyScreen != null) {
            studyScreen.reveal(subject);
        }
    }

    private final void showSetup() {
        SetupScreen setupScreen = new SetupScreen(this);
        this.setup = setupScreen;
        FrameLayout frameLayout = this.root;
        FrameLayout frameLayout2 = null;
        if (frameLayout == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            frameLayout = null;
        }
        FrameLayout root = setupScreen.getRoot();
        FrameLayout frameLayout3 = this.root;
        if (frameLayout3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            frameLayout3 = null;
        }
        ConfettiView confettiView = this.confetti;
        if (confettiView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("confetti");
            confettiView = null;
        }
        frameLayout.addView(root, frameLayout3.indexOfChild(confettiView), ThemeKt.flp$default(-1, -1, 0, 4, null));
        setupScreen.applyInsets(this.insetTop, this.insetBottom);
        FrameLayout frameLayout4 = this.root;
        if (frameLayout4 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
        } else {
            frameLayout2 = frameLayout4;
        }
        frameLayout2.requestApplyInsets();
    }

    public final void finishSetup() {
        getStore().setSetupDone(true);
        SetupScreen setupScreen = this.setup;
        if (setupScreen == null) {
            return;
        }
        FrameLayout frameLayout = null;
        this.setup = null;
        showTab(0, false);
        FrameLayout root = setupScreen.getRoot();
        if (this.policy.getMotion()) {
            root.animate().alpha(0.0f).scaleX(1.03f).scaleY(1.03f).setDuration(240L).setInterpolator(Ease.INSTANCE.getExit()).withEndAction(new MainActivity$$ExternalSyntheticLambda25(this, root)).start();
            Screen screen = this.screens[0];
            HomeScreen homeScreen = screen instanceof HomeScreen ? (HomeScreen) screen : null;
            if (homeScreen != null) {
                HomeScreen.playEntrance$default(homeScreen, false, 1, null);
                return;
            }
            return;
        }
        FrameLayout frameLayout2 = this.root;
        if (frameLayout2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
        } else {
            frameLayout = frameLayout2;
        }
        frameLayout.removeView(root);
    }

    private static final void finishSetup$lambda$23(MainActivity mainActivity, FrameLayout frameLayout) {
        FrameLayout frameLayout2 = mainActivity.root;
        if (frameLayout2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            frameLayout2 = null;
        }
        frameLayout2.removeView(frameLayout);
    }

    public static void openProfileEditor$default(MainActivity mainActivity, AvatarView avatarView, int i, Object obj) {
        if ((i & 1) != 0) {
            avatarView = null;
        }
        mainActivity.openProfileEditor(avatarView);
    }

    public final void openProfileEditor(AvatarView avatarView) {
        if (this.editor == null && this.intro == null) {
            ValueAnimator valueAnimator = this.profileMotion;
            if (valueAnimator != null) {
                valueAnimator.end();
            }
            ProfileEditor profileEditor = new ProfileEditor(this);
            this.editor = profileEditor;
            this.editorSource = avatarView;
            FrameLayout frameLayout = this.root;
            if (frameLayout == null) {
                Intrinsics.throwUninitializedPropertyAccessException("root");
                frameLayout = null;
            }
            FrameLayout root = profileEditor.getRoot();
            FrameLayout frameLayout2 = this.root;
            if (frameLayout2 == null) {
                Intrinsics.throwUninitializedPropertyAccessException("root");
                frameLayout2 = null;
            }
            ConfettiView confettiView = this.confetti;
            if (confettiView == null) {
                Intrinsics.throwUninitializedPropertyAccessException("confetti");
                confettiView = null;
            }
            frameLayout.addView(root, frameLayout2.indexOfChild(confettiView), ThemeKt.flp$default(-1, -1, 0, 4, null));
            profileEditor.applyInsets(this.insetTop, this.insetBottom);
            FrameLayout frameLayout3 = this.root;
            if (frameLayout3 == null) {
                Intrinsics.throwUninitializedPropertyAccessException("root");
                frameLayout3 = null;
            }
            frameLayout3.requestApplyInsets();
            if (avatarView == null || !this.policy.getMotion() || !avatarView.isShown() || avatarView.getWidth() <= 0) {
                avatarView = null;
            }
            if (avatarView == null) {
                fade(profileEditor.getRoot(), true, new MainActivity$$ExternalSyntheticLambda16());
                return;
            }
            ripple(avatarView);
            profileEditor.prepareEnter();
            onNextDraw(profileEditor.getRoot(), new MainActivity$$ExternalSyntheticLambda17(this, profileEditor, avatarView));
        }
    }

    private static final Unit openProfileEditor$lambda$25() {
        return Unit.INSTANCE;
    }

    private static final Unit openProfileEditor$lambda$26(MainActivity mainActivity, ProfileEditor profileEditor, AvatarView avatarView) {
        if (mainActivity.editor == profileEditor) {
            mainActivity.flyIn(profileEditor, avatarView);
        }
        return Unit.INSTANCE;
    }

    private final void flyIn(ProfileEditor profileEditor, AvatarView avatarView) {
        AvatarView avatarView2 = avatarView;
        FrameLayout frameLayout = null;
        Rect boundsInRoot$default = boundsInRoot$default(this, avatarView2, false, 2, null);
        Rect boundsInRoot$default2 = boundsInRoot$default(this, profileEditor.getAvatar(), false, 2, null);
        Rect boundsInRoot = boundsInRoot(avatarView2, true);
        AvatarView avatarView3 = new AvatarView(this);
        avatarView.copyTo(avatarView3);
        FrameLayout frameLayout2 = this.root;
        if (frameLayout2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
        } else {
            frameLayout = frameLayout2;
        }
        frameLayout.getOverlay().add(avatarView3);
        avatarView3.layout(boundsInRoot$default.left, boundsInRoot$default.top, boundsInRoot$default.right, boundsInRoot$default.bottom);
        this.flying = avatarView3;
        avatarView.setVisibility(4);
        ValueAnimator ofFloat = ValueAnimator.ofFloat(0.0f, 550.0f);
        ofFloat.setDuration((long) 550.0f);
        ofFloat.setInterpolator(new LinearInterpolator());
        ofFloat.addUpdateListener(new MainActivity$$ExternalSyntheticLambda20(this, avatarView3, boundsInRoot$default, boundsInRoot, boundsInRoot$default2, profileEditor));
        ofFloat.addListener(new MainActivity$flyIn$1$2(this, avatarView3, profileEditor, avatarView));
        ofFloat.start();
        this.profileMotion = ofFloat;
    }

    private static final void flyIn$lambda$29$lambda$28(MainActivity mainActivity, AvatarView avatarView, Rect rect, Rect rect2, Rect rect3, ProfileEditor profileEditor, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        float floatValue = ((Float) animatedValue).floatValue();
        if (floatValue < SPRING_BACK_MS) {
            mainActivity.place(avatarView, rect, rect2, FxKt.spring(floatValue / SPRING_BACK_MS, 0.75f));
            return;
        }
        float window = FxKt.window(floatValue, SPRING_BACK_MS, FLY_MS);
        mainActivity.place(avatarView, rect2, rect3, Ease.INSTANCE.getInOut().getInterpolation(window));
        profileEditor.setBackdrop(Ease.INSTANCE.cubicOut(FxKt.window(window, 0.0f, 0.6f)));
    }

    public final void closeProfileEditor() {
        ProfileEditor profileEditor = this.editor;
        if (profileEditor == null) {
            return;
        }
        FrameLayout frameLayout = null;
        this.editor = null;
        View currentFocus = getCurrentFocus();
        if (currentFocus != null) {
            Object systemService = getSystemService("input_method");
            InputMethodManager inputMethodManager = systemService instanceof InputMethodManager ? (InputMethodManager) systemService : null;
            if (inputMethodManager != null) {
                inputMethodManager.hideSoftInputFromWindow(currentFocus.getWindowToken(), 0);
            }
        }
        ValueAnimator valueAnimator = this.profileMotion;
        if (valueAnimator != null) {
            valueAnimator.end();
        }
        AvatarView avatarView = this.editorSource;
        AvatarView avatarView2 = (avatarView != null && this.policy.getMotion() && avatarView.isAttachedToWindow() && avatarView.isShown() && avatarView.getWidth() > 0) ? avatarView : null;
        this.editorSource = null;
        Screen current = getCurrent();
        if (current != null) {
            current.onShow(false);
        }
        if (avatarView2 == null) {
            fade(profileEditor.getRoot(), false, new MainActivity$$ExternalSyntheticLambda12(this, profileEditor));
            return;
        }
        profileEditor.hideControls();
        Rect boundsInRoot$default = boundsInRoot$default(this, profileEditor.getAvatar(), false, 2, null);
        Rect boundsInRoot$default2 = boundsInRoot$default(this, avatarView2, false, 2, null);
        AvatarView avatarView3 = new AvatarView(this);
        avatarView2.copyTo(avatarView3);
        AvatarView.setFrame$default(avatarView3, profileEditor.getAvatar().getFrame(), false, 2, null);
        avatarView3.setFrame(avatarView2.getFrame(), true);
        FrameLayout frameLayout2 = this.root;
        if (frameLayout2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
        } else {
            frameLayout = frameLayout2;
        }
        frameLayout.getOverlay().add(avatarView3);
        avatarView3.layout(boundsInRoot$default.left, boundsInRoot$default.top, boundsInRoot$default.right, boundsInRoot$default.bottom);
        this.flying = avatarView3;
        profileEditor.getAvatar().setVisibility(4);
        avatarView2.setVisibility(4);
        ValueAnimator ofFloat = ValueAnimator.ofFloat(0.0f, 1.0f);
        ofFloat.setStartDelay(60L);
        ofFloat.setDuration(360L);
        ofFloat.setInterpolator(new LinearInterpolator());
        ofFloat.addUpdateListener(new MainActivity$$ExternalSyntheticLambda13(this, avatarView3, boundsInRoot$default, boundsInRoot$default2, profileEditor));
        ofFloat.addListener(new MainActivity$closeProfileEditor$3$2(this, profileEditor, avatarView3, avatarView2));
        ofFloat.start();
        this.profileMotion = ofFloat;
    }

    private static final Unit closeProfileEditor$lambda$32(MainActivity mainActivity, ProfileEditor profileEditor) {
        FrameLayout frameLayout = mainActivity.root;
        if (frameLayout == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            frameLayout = null;
        }
        frameLayout.removeView(profileEditor.getRoot());
        return Unit.INSTANCE;
    }

    private static final void closeProfileEditor$lambda$35$lambda$34(MainActivity mainActivity, AvatarView avatarView, Rect rect, Rect rect2, ProfileEditor profileEditor, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        float floatValue = ((Float) animatedValue).floatValue();
        mainActivity.place(avatarView, rect, rect2, Ease.INSTANCE.getInOut().getInterpolation(floatValue));
        profileEditor.setBackdrop(1.0f - Ease.INSTANCE.cubicOut(FxKt.window(floatValue, 0.1f, 0.6f)));
    }

    private final void ripple(AvatarView avatarView) {
        FrameLayout frameLayout = null;
        Rect boundsInRoot$default = boundsInRoot$default(this, avatarView, false, 2, null);
        float exactCenterX = boundsInRoot$default.exactCenterX();
        float exactCenterY = boundsInRoot$default.exactCenterY();
        float width = boundsInRoot$default.width() / 2.0f;
        MainActivity mainActivity = this;
        GoldRipple goldRipple = new GoldRipple(exactCenterX, exactCenterY, width, ThemeKt.dpf(mainActivity, Integer.valueOf((int) REQUEST_PHOTO)), Ui.INSTANCE.getC().getGold(), ThemeKt.dpf(mainActivity, Float.valueOf(1.5f)));
        FrameLayout frameLayout2 = this.root;
        if (frameLayout2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
        } else {
            frameLayout = frameLayout2;
        }
        frameLayout.getOverlay().add(goldRipple);
        ValueAnimator ofFloat = ValueAnimator.ofFloat(0.0f, 1.0f);
        ofFloat.setDuration(420L);
        ofFloat.setInterpolator(new LinearInterpolator());
        ofFloat.addUpdateListener(new MainActivity$$ExternalSyntheticLambda18(goldRipple));
        ofFloat.addListener(new MainActivity$ripple$1$2(this, goldRipple));
        ofFloat.start();
    }

    private static final void ripple$lambda$37$lambda$36(GoldRipple goldRipple, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        goldRipple.setProgress(((Float) animatedValue).floatValue());
    }

    private final void place(View view, Rect rect, Rect rect2, float f) {
        int roundToInt = MathKt.roundToInt(FxKt.lerp(rect.width(), rect2.width(), f));
        float lerp = FxKt.lerp(rect.exactCenterX(), rect2.exactCenterX(), f);
        float lerp2 = FxKt.lerp(rect.exactCenterY(), rect2.exactCenterY(), f);
        float f2 = roundToInt / 2.0f;
        int roundToInt2 = MathKt.roundToInt(lerp - f2);
        int roundToInt3 = MathKt.roundToInt(lerp2 - f2);
        view.layout(roundToInt2, roundToInt3, roundToInt2 + roundToInt, roundToInt + roundToInt3);
    }

    static Rect boundsInRoot$default(MainActivity mainActivity, View view, boolean z, int i, Object obj) {
        if ((i & 2) != 0) {
            z = false;
        }
        return mainActivity.boundsInRoot(view, z);
    }

    private final Rect boundsInRoot(View view, boolean z) {
        int[] iArr = new int[2];
        int[] iArr2 = new int[2];
        FrameLayout frameLayout = this.root;
        if (frameLayout == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            frameLayout = null;
        }
        frameLayout.getLocationInWindow(iArr2);
        if (z) {
            view.getLocationInWindow(iArr);
            float width = (iArr[0] - iArr2[0]) + ((view.getWidth() * view.getScaleX()) / 2.0f);
            float height = (iArr[1] - iArr2[1]) + ((view.getHeight() * view.getScaleY()) / 2.0f);
            float width2 = view.getWidth() / 2.0f;
            return new Rect(MathKt.roundToInt(width - width2), MathKt.roundToInt(height - width2), MathKt.roundToInt(width + width2), MathKt.roundToInt(height + width2));
        }
        view.getLocationInWindow(iArr);
        int i = iArr[0] - iArr2[0];
        int i2 = iArr[1] - iArr2[1];
        return new Rect(i, i2, MathKt.roundToInt(view.getWidth() * view.getScaleX()) + i, MathKt.roundToInt(view.getHeight() * view.getScaleY()) + i2);
    }

    private final void onNextDraw(View view, Function0<Unit> function0) {
        view.getViewTreeObserver().addOnPreDrawListener(new MainActivity$onNextDraw$1(view, function0));
    }

    private final void fade(View view, boolean z, Function0<Unit> function0) {
        view.animate().cancel();
        view.setAlpha(z ? 0.0f : view.getAlpha());
        view.animate().alpha(z ? 1.0f : 0.0f).setDuration(150L).setStartDelay(0L).setInterpolator(z ? Ease.INSTANCE.getOut() : Ease.INSTANCE.getExit()).withEndAction(new MainActivity$$ExternalSyntheticLambda27(function0)).start();
    }

    private static final void fade$lambda$38(Function0 function0) {
        function0.invoke();
    }

    public static void popAt$default(MainActivity mainActivity, View view, float f, int i, Object obj) {
        if ((i & 2) != 0) {
            f = 1.0f;
        }
        mainActivity.popAt(view, f);
    }

    public final void popAt(View view, float f) {
        Intrinsics.checkNotNullParameter(view, "view");
        if (this.policy.getMotion() && view.isAttachedToWindow()) {
            int[] iArr = new int[2];
            int[] iArr2 = new int[2];
            view.getLocationInWindow(iArr);
            ConfettiView confettiView = this.confetti;
            ConfettiView confettiView2 = null;
            if (confettiView == null) {
                Intrinsics.throwUninitializedPropertyAccessException("confetti");
                confettiView = null;
            }
            confettiView.getLocationInWindow(iArr2);
            ConfettiView confettiView3 = this.confetti;
            if (confettiView3 == null) {
                Intrinsics.throwUninitializedPropertyAccessException("confetti");
            } else {
                confettiView2 = confettiView3;
            }
            confettiView2.burstAt((iArr[0] - iArr2[0]) + (view.getWidth() / 2.0f), (iArr[1] - iArr2[1]) + (view.getHeight() / 2.0f), f);
        }
    }

    public final void pickPhoto() {
        boolean z = Build.VERSION.SDK_INT >= 33 || (Build.VERSION.SDK_INT >= 30 && SdkExtensions.getExtensionVersion(30) >= 2);
        List createListBuilder = CollectionsKt.createListBuilder();
        if (z) {
            createListBuilder.add(new Intent("android.provider.action.PICK_IMAGES").setType("image/*"));
        }
        createListBuilder.add(new Intent("android.intent.action.OPEN_DOCUMENT").addCategory("android.intent.category.OPENABLE").setType("image/*"));
        createListBuilder.add(new Intent("android.intent.action.GET_CONTENT").addCategory("android.intent.category.OPENABLE").setType("image/*"));
        for (Object obj : CollectionsKt.build(createListBuilder)) {
            Intrinsics.checkNotNullExpressionValue(obj, "next(...)");
            try {
                startActivityForResult((Intent) obj, REQUEST_PHOTO);
                return;
            } catch (ActivityNotFoundException unused) {
            }
        }
        Toast.makeText(this, "No photo picker is available on this phone.", 1).show();
    }

    @Override
    @Deprecated(message = "Framework activity result API")
    protected void onActivityResult(int i, int i2, Intent intent) {
        super.onActivityResult(i, i2, intent);
        if (i != REQUEST_PHOTO) {
            return;
        }
        Uri data = intent != null ? intent.getData() : null;
        if (i2 != -1 || data == null) {
            ProfileEditor profileEditor = this.editor;
            if (profileEditor != null) {
                profileEditor.onPickCancelled();
                return;
            }
            return;
        }
        handlePickedPhoto(data);
    }

    public final void handlePickedPhoto(Uri uri) {
        Intrinsics.checkNotNullParameter(uri, "uri");
        new Thread(new MainActivity$$ExternalSyntheticLambda11(getApplicationContext(), uri, this)).start();
    }

    private static final void handlePickedPhoto$lambda$41(Context context, Uri uri, MainActivity mainActivity) {
        Avatar avatar = Avatar.INSTANCE;
        Intrinsics.checkNotNull(context);
        mainActivity.handler.post(new MainActivity$$ExternalSyntheticLambda8(mainActivity, Avatar.decodeForCrop$default(avatar, context, uri, 0, 4, null)));
    }

    private static final void handlePickedPhoto$lambda$41$lambda$40(MainActivity mainActivity, Bitmap bitmap) {
        ProfileEditor profileEditor = mainActivity.editor;
        if (profileEditor != null) {
            profileEditor.onPhotoPicked(bitmap);
        }
    }

    public final Bitmap avatarBitmap(int i) {
        long avatarVersion = getStore().getAvatarVersion();
        if (avatarVersion == 0) {
            return null;
        }
        Pair<Long, Bitmap> pair = this.avatarCache;
        if (pair == null || pair.getFirst().longValue() != avatarVersion) {
            MainActivity mainActivity = this;
            Bitmap load = Avatar.INSTANCE.load(mainActivity, Math.max(i, MathKt.roundToInt(ThemeKt.dpf(mainActivity, (Number) 150))));
            this.avatarCache = TuplesKt.to(Long.valueOf(avatarVersion), load);
            return load;
        }
        return pair.getSecond();
    }

    public final void onAvatarChanged() {
        Screen[] screenArr;
        this.avatarCache = null;
        this.data = loadData();
        for (Screen screen : this.screens) {
            if (screen != null) {
                screen.onDataChanged();
            }
        }
        Screen current = getCurrent();
        if (current != null) {
            current.onShow(false);
        }
    }

    public final void setAvatarFrame(AvatarFrame frame) {
        Screen[] screenArr;
        Intrinsics.checkNotNullParameter(frame, "frame");
        getStore().setAvatarFrame(frame);
        this.data = loadData();
        for (Screen screen : this.screens) {
            if (screen != null) {
                screen.onDataChanged();
            }
        }
    }

    public final void setFrameAnimated(boolean z) {
        getStore().setFrameAnimated(z);
        this.data = loadData();
        applyMotion();
    }

    private final void tick() {
        Screen current;
        Screen current2;
        this.handler.removeCallbacks(this.ticker);
        long now = AppClock.INSTANCE.now();
        this.season = SeasonCalculator.INSTANCE.compute(getData().getExams(), now, getData().getMarkedDone());
        if (this.setup == null && (current2 = getCurrent()) != null) {
            current2.tick(getSeason());
        }
        if (this.resumed) {
            long j = 1000;
            if (this.setup == null && (current = getCurrent()) != null) {
                j = current.nextTickDelay(now);
            }
            this.handler.postDelayed(this.ticker, RangesKt.coerceIn(j, 16L, (long) ModelKt.MINUTE));
        }
    }

    public final void requestTick() {
        tick();
    }

    public final void applyMotion() {
        Screen[] screenArr;
        this.policy = MotionPolicy.Companion.resolve(this, getData().getMotion());
        NavBar navBar = this.nav;
        if (navBar == null) {
            Intrinsics.throwUninitializedPropertyAccessException("nav");
            navBar = null;
        }
        navBar.setAnimateChanges(this.policy.getMotion());
        if (this.resumed && this.policy.getAmbient()) {
            this.ambient.start();
        } else {
            this.ambient.stop();
        }
        for (Screen screen : this.screens) {
            if (screen != null) {
                screen.onMotionChanged();
            }
        }
        ProfileEditor profileEditor = this.editor;
        if (profileEditor != null) {
            profileEditor.refreshFrameMotion();
        }
    }

    public final void celebrate(boolean z) {
        if (z || !this.celebrated) {
            this.celebrated = true;
            if (this.policy.getMotion()) {
                Haptics haptics = Haptics.INSTANCE;
                ConfettiView confettiView = this.confetti;
                ConfettiView confettiView2 = null;
                if (confettiView == null) {
                    Intrinsics.throwUninitializedPropertyAccessException("confetti");
                    confettiView = null;
                }
                haptics.confirm(confettiView);
                ConfettiView confettiView3 = this.confetti;
                if (confettiView3 == null) {
                    Intrinsics.throwUninitializedPropertyAccessException("confetti");
                } else {
                    confettiView2 = confettiView3;
                }
                confettiView2.burst();
            }
        }
    }

    private final AppData loadData() {
        return new AppData(getStore().getProfile(), getStore().getChoices(), getStore().getExams(), getStore().getMarkedDone(), getStore().getReminders(), getStore().getMotion(), getStore().getAvatarFrame(), getStore().getFrameAnimated());
    }

    private final void changed() {
        Screen[] screenArr;
        this.data = loadData();
        for (Screen screen : this.screens) {
            if (screen != null) {
                screen.onDataChanged();
            }
        }
        ReminderScheduler.INSTANCE.reschedule(this);
        tick();
    }

    public final void updateProfile(Profile profile) {
        Intrinsics.checkNotNullParameter(profile, "profile");
        getStore().setProfile(profile);
        changed();
    }

    public final void updateChoices(Choices choices) {
        Intrinsics.checkNotNullParameter(choices, "choices");
        getStore().setChoices(choices);
        changed();
    }

    public final void updateExams(List<Exam> exams) {
        Intrinsics.checkNotNullParameter(exams, "exams");
        getStore().setExams(exams);
        changed();
    }

    public final void markFinished(Exam exam) {
        Intrinsics.checkNotNullParameter(exam, "exam");
        getStore().setMarkedDone(SetsKt.plus(getStore().getMarkedDone(), exam.getKey()));
        changed();
    }

    public final void updateReminderSettings(Function1<? super ReminderSettings, ReminderSettings> change) {
        Intrinsics.checkNotNullParameter(change, "change");
        getStore().setReminders(change.invoke(getStore().getReminders()));
        changed();
    }

    public final void setMotion(MotionPref pref) {
        Intrinsics.checkNotNullParameter(pref, "pref");
        getStore().setMotion(pref);
        this.data = loadData();
        applyMotion();
        updateLaunchWindow();
    }

    public final void setHaptics(boolean z) {
        getStore().setHaptics(z);
        Haptics.INSTANCE.setEnabled(z);
    }

    public final void setTheme(ThemeMode mode) {
        UiModeManager uiModeManager;
        Intrinsics.checkNotNullParameter(mode, "mode");
        if (mode == getStore().getTheme()) {
            return;
        }
        getStore().setTheme(mode);
        if (Build.VERSION.SDK_INT >= 31 && (uiModeManager = (UiModeManager) getSystemService(UiModeManager.class)) != null) {
            int i = WhenMappings.$EnumSwitchMapping$0[mode.ordinal()];
            int i2 = 1;
            if (i != 1) {
                i2 = 2;
                if (i != 2) {
                    if (i != 3) {
                        throw new NoWhenBranchMatchedException();
                    }
                    i2 = 0;
                }
            }
            uiModeManager.setApplicationNightMode(i2);
        }
        recreate();
    }

    public final void rescheduleAlarms() {
        ReminderScheduler.INSTANCE.reschedule(this);
    }

    private static final ReminderSettings setExamReminders$lambda$46(ReminderSettings it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return ReminderSettings.copy$default(it, false, false, false, false, 0L, 30, null);
    }

    public final void setExamReminders(boolean z, Function0<Unit> done) {
        Intrinsics.checkNotNullParameter(done, "done");
        if (!z) {
            updateReminderSettings(new MainActivity$$ExternalSyntheticLambda14());
            done.invoke();
            return;
        }
        requestNotifications(new MainActivity$$ExternalSyntheticLambda15(this, done));
    }

    private static final Unit setExamReminders$lambda$48(MainActivity mainActivity, Function0 function0, boolean z) {
        if (z) {
            mainActivity.updateReminderSettings(new MainActivity$$ExternalSyntheticLambda26());
        }
        function0.invoke();
        return Unit.INSTANCE;
    }

    private static final ReminderSettings setExamReminders$lambda$48$lambda$47(ReminderSettings it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return ReminderSettings.copy$default(it, true, false, false, false, AppClock.INSTANCE.now(), 14, null);
    }

    private static final ReminderSettings setFocusAlerts$lambda$49(ReminderSettings it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return ReminderSettings.copy$default(it, false, false, false, false, 0L, 23, null);
    }

    public final void setFocusAlerts(boolean z, Function0<Unit> done) {
        Intrinsics.checkNotNullParameter(done, "done");
        if (!z) {
            updateReminderSettings(new MainActivity$$ExternalSyntheticLambda0());
            done.invoke();
            return;
        }
        requestNotifications(new MainActivity$$ExternalSyntheticLambda1(this, done));
    }

    private static final Unit setFocusAlerts$lambda$51(MainActivity mainActivity, Function0 function0, boolean z) {
        if (z) {
            mainActivity.updateReminderSettings(new MainActivity$$ExternalSyntheticLambda22());
        }
        function0.invoke();
        return Unit.INSTANCE;
    }

    private static final ReminderSettings setFocusAlerts$lambda$51$lambda$50(ReminderSettings it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return ReminderSettings.copy$default(it, false, false, false, true, 0L, 23, null);
    }

    private final void requestNotifications(Function1<? super Boolean, Unit> function1) {
        if (Build.VERSION.SDK_INT < 33 || checkSelfPermission("android.permission.POST_NOTIFICATIONS") == 0) {
            function1.invoke(Boolean.valueOf(Notifier.INSTANCE.canPost(this)));
            return;
        }
        this.pendingPermission = function1;
        requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQUEST_NOTIFICATIONS);
    }

    @Override
    public void onRequestPermissionsResult(int i, String[] permissions, int[] grantResults) {
        Intrinsics.checkNotNullParameter(permissions, "permissions");
        Intrinsics.checkNotNullParameter(grantResults, "grantResults");
        super.onRequestPermissionsResult(i, permissions, grantResults);
        if (i != REQUEST_NOTIFICATIONS) {
            return;
        }
        Integer firstOrNull = ArraysKt.firstOrNull(grantResults);
        boolean z = firstOrNull != null && firstOrNull.intValue() == 0 && Notifier.INSTANCE.canPost(this);
        Function1<? super Boolean, Unit> function1 = this.pendingPermission;
        if (function1 != null) {
            function1.invoke(Boolean.valueOf(z));
        }
        this.pendingPermission = null;
    }

    public final void openNotificationSettings() {
        Intent putExtra = new Intent("android.settings.APP_NOTIFICATION_SETTINGS").putExtra("android.provider.extra.APP_PACKAGE", getPackageName());
        Intrinsics.checkNotNullExpressionValue(putExtra, "putExtra(...)");
        try {
            startActivity(putExtra);
        } catch (RuntimeException unused) {
            startActivity(new Intent("android.settings.APPLICATION_DETAILS_SETTINGS", Uri.parse("package:" + getPackageName())));
        }
    }

    public final void resetAllData() {
        MainActivity mainActivity = this;
        Avatar.INSTANCE.remove(mainActivity);
        getStore().resetAll();
        ReminderScheduler.INSTANCE.reschedule(mainActivity);
        recreate();
    }

    public final String versionName() {
        try {
            String str = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            return str == null ? "1.3.0" : str;
        } catch (PackageManager.NameNotFoundException unused) {
            return "1.3.0";
        }
    }
}

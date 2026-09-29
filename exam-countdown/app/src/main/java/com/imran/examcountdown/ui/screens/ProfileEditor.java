package com.imran.examcountdown.ui.screens;

import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.drawable.ColorDrawable;
import android.view.View;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import com.imran.examcountdown.MainActivity;
import com.imran.examcountdown.R;
import com.imran.examcountdown.core.AvatarFrame;
import com.imran.examcountdown.core.Profile;
import com.imran.examcountdown.data.Avatar;
import com.imran.examcountdown.ui.Colors;
import com.imran.examcountdown.ui.DialogsKt;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.Fonts;
import com.imran.examcountdown.ui.Shapes;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import com.imran.examcountdown.ui.widgets.AvatarView;
import com.imran.examcountdown.ui.widgets.ButtonRow;
import com.imran.examcountdown.ui.widgets.ButtonStyle;
import com.imran.examcountdown.ui.widgets.ControlsKt;
import com.imran.examcountdown.ui.widgets.CropView;
import com.imran.examcountdown.ui.widgets.ToggleView;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;
import kotlin.KotlinVersion;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.collections.IntIterator;
import kotlin.enums.EnumEntries;
import kotlin.internal.ProgressionUtilKt;
import kotlin.io.ConstantsKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.IntRange;
import kotlin.ranges.RangesKt;
import kotlin.text.StringsKt;

public final class ProfileEditor {
    private final TextView animateNote;
    private final ToggleView animateToggle;
    private final TextView applyButton;
    private final AvatarView avatar;
    private final FrameLayout avatarHolder;
    private final ColorDrawable backdrop;
    private final TextView cancelButton;
    private final TextView choose;
    private final LinearLayout column;
    private final CropView crop;
    private final LinearLayout cropPanel;
    private boolean cropping;
    private final MainActivity ctx;
    private final LinearLayout editPanel;
    private final TextView frameStatus;
    private final MainActivity host;
    private final EditText nameField;
    private Bitmap pendingPhoto;
    private AvatarFrame previewFrame;
    private final TextView remove;
    private boolean removePending;
    private final TextView resetButton;
    private final FrameLayout root;
    private AvatarFrame savedFrame;
    private final ScrollView scroll;
    private final TextView status;
    private final ArrayList<FrameTile> tiles;
    private final LinearLayout topBar;
    private final View topRule;
    private final SeekBar zoom;

    public static Unit m33$r8$lambda$Qf5cuj3PJd6sMQZMzXwLSa3xAU(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$18(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$2GUXkppwkcJiRUjZRrbkGyMn5vQ(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$51(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$2hw_cZ1qJ0HOfdQqIGdRE3302bc(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$39(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$49GaBS1_JrJplKd92GjxTadfgVg(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$26(profileEditor, layoutParams);
    }

    public static Unit m34$r8$lambda$4kziCD8eeyMFlAYeWuTBpyOdik(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$44(profileEditor, layoutParams);
    }

    public static Unit m35$r8$lambda$5U_833v1XeYS6z6FvDTtZDIXQ4(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$48(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$5yxpFxgxKHutM9t_bgi8eekJAL0(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$21(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$7IqtDBvKC8D_BoOWhElxzLifrwM(ProfileEditor profileEditor, View view) {
        return cancelButton$lambda$9(profileEditor, view);
    }

    public static Unit $r8$lambda$7qo_OSaqwP6cVzgxqsXvhvlVF9U(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$57$lambda$54$lambda$53(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$EgRbFgvk8_wTgnT0MGwrJNeu_54(TextView textView) {
        return buildFrames$lambda$43(textView);
    }

    public static Unit $r8$lambda$GLzG3msidYS32DW2QsnRUm62gvM(TextView textView) {
        return frameStatus$lambda$7(textView);
    }

    public static Unit $r8$lambda$JJsXB_SPSk9idumW506oM1gxXQ0(ProfileEditor profileEditor, View view) {
        return resetButton$lambda$10(profileEditor, view);
    }

    public static Unit m36$r8$lambda$LVlwTS3f02Ar_o_yPqtJUvUbHM(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$20(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$NMCLSVoYJzEveydeSWKUb4xV8Js(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$41(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$Nh7tCNQkkeccZSFjTruPUhIRN0g(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$34(profileEditor, layoutParams);
    }

    public static Unit m37$r8$lambda$OUN2gW1aNItwfMPaiMDpO3s34s(TextView textView) {
        return _init_$lambda$25(textView);
    }

    public static void $r8$lambda$QX7A9WjfCfv8tUAFbVU1DsX9PSk(ProfileEditor profileEditor, View view) {
        buildFrames$lambda$57$lambda$56(profileEditor, view);
    }

    public static Unit $r8$lambda$T7wuO18ew_qF2eMkL4mHBjOavu0(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$17(profileEditor, layoutParams);
    }

    public static Unit m38$r8$lambda$V0UHof0iNAb9q3cC65IlyEz5oM(ProfileEditor profileEditor, View view) {
        return remove$lambda$5(profileEditor, view);
    }

    public static Unit $r8$lambda$_bWVmgfz6Riwje8IyADAj7s1NNA(ProfileEditor profileEditor, View view) {
        return applyButton$lambda$8(profileEditor, view);
    }

    public static Unit $r8$lambda$e8sGfkILpPTTlBm5N_proBViPlw(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$42(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$fch2VxShOY4WiPlNxXcbXoVpArQ(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$27(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$gww4O1ps3VzBXoSqZyA4UFikFj8(ProfileEditor profileEditor, int i, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$47(profileEditor, i, layoutParams);
    }

    public static Unit $r8$lambda$j1_ZGCGT8uKFd2ykyGm4sAkuQD0(ProfileEditor profileEditor, float f) {
        return _init_$lambda$31(profileEditor, f);
    }

    public static Unit m39$r8$lambda$kV1JoORIRPfDPH8jS2ju3GN1W0(TextView textView) {
        return status$lambda$6(textView);
    }

    public static Unit $r8$lambda$mVsOwQkgn6H4ymf5qe4FpY7g3D8(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$22(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$mfQG53fQH0z3mZ2ZyP_CKD1nkqM(ProfileEditor profileEditor, View view) {
        return choose$lambda$4(profileEditor, view);
    }

    public static Unit $r8$lambda$msCxKGr8SU7gqHmRn9NS7ZWVMM0(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$52(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$p_mq5pEipQesnDDyaAUHHZJlKYk(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$28(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$r5AFC5RL8mEH7kqq1v7FBghTiS8(int i, int i2, LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$46$lambda$45(i, i2, linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$r7M6Bz5shLLslSc6Qyj1WpPLrNw(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$30(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$rDlSs_L6vpq81JDioQEKOPevk_w(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$50$lambda$49(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$rfro4FISoxwlBgc1HxVHedz4OLg(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$58(profileEditor, layoutParams);
    }

    public static Unit m40$r8$lambda$seV0IBXHprIVGXUyPRzktVyGqI(TextView textView) {
        return animateNote$lambda$11(textView);
    }

    public static Unit m41$r8$lambda$tw0Il2aQDjxmwxVyyTn6kgb7ck(ProfileEditor profileEditor, boolean z) {
        return buildFrames$lambda$59(profileEditor, z);
    }

    public static Unit m42$r8$lambda$vHwPwNhu7DLU3X7HTLUgQwzzVU(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return buildFrames$lambda$57$lambda$55(linearLayout, layoutParams);
    }

    public static Unit m43$r8$lambda$vypKCH5B3FGq07_bysEiRZQNI0(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$24(profileEditor, layoutParams);
    }

    public static Unit $r8$lambda$xIG8rSOKJYNiW29z15Waj2AEGkg(ProfileEditor profileEditor, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$23(profileEditor, layoutParams);
    }

    public ProfileEditor(MainActivity host) {
        Intrinsics.checkNotNullParameter(host, "host");
        this.host = host;
        this.ctx = host;
        ColorDrawable colorDrawable = new ColorDrawable(Ui.INSTANCE.getC().getBg());
        this.backdrop = colorDrawable;
        FrameLayout frameLayout = new FrameLayout(host);
        frameLayout.setBackground(colorDrawable);
        frameLayout.setClickable(true);
        this.root = frameLayout;
        ScrollView scrollView = new ScrollView(host);
        scrollView.setVerticalScrollBarEnabled(false);
        this.scroll = scrollView;
        LinearLayout linearLayout = new LinearLayout(host);
        linearLayout.setOrientation(1);
        Unit unit = Unit.INSTANCE;
        this.column = linearLayout;
        AvatarView avatarView = new AvatarView(host);
        avatarView.setContentDescription("Your profile photo and frame");
        this.avatar = avatarView;
        FrameLayout frameLayout2 = new FrameLayout(host);
        frameLayout2.addView(avatarView, ThemeKt.flp(ThemeKt.dp(host, (Number) 150), ThemeKt.dp(host, (Number) 150), 1));
        this.avatarHolder = frameLayout2;
        View separator = ThemeKt.separator(host);
        this.topRule = separator;
        TextView compact = compact(ControlsKt.pillButton(host, "Choose photo", Integer.valueOf((int) R.drawable.ic_photo), ButtonStyle.SECONDARY, new ProfileEditor$$ExternalSyntheticLambda15(this)));
        this.choose = compact;
        TextView compact2 = compact(ControlsKt.pillButton(host, "Remove photo", Integer.valueOf((int) R.drawable.ic_delete), ButtonStyle.DANGER, new ProfileEditor$$ExternalSyntheticLambda26(this)));
        this.remove = compact2;
        EditText inputField = DialogsKt.inputField(host, "", "Your name", 8193);
        this.nameField = inputField;
        TextView text$default = ThemeKt.text$default(host, "", 14.0f, Ui.INSTANCE.getC().getText3(), null, new ProfileEditor$$ExternalSyntheticLambda37(), 8, null);
        this.status = text$default;
        LinearLayout linearLayout2 = new LinearLayout(host);
        linearLayout2.setOrientation(1);
        Unit unit2 = Unit.INSTANCE;
        this.editPanel = linearLayout2;
        this.tiles = new ArrayList<>();
        this.frameStatus = ThemeKt.text$default(host, "", 14.0f, Ui.INSTANCE.getC().getText2(), null, new ProfileEditor$$ExternalSyntheticLambda38(), 8, null);
        Integer valueOf = Integer.valueOf((int) R.drawable.ic_check);
        this.applyButton = ControlsKt.pillButton$default(host, "Apply", valueOf, null, new ProfileEditor$$ExternalSyntheticLambda39(this), 4, null);
        this.cancelButton = ControlsKt.pillButton$default(host, "Cancel", null, ButtonStyle.SECONDARY, new ProfileEditor$$ExternalSyntheticLambda40(this), 2, null);
        this.resetButton = ControlsKt.pillButton(host, "Reset to Default", Integer.valueOf((int) R.drawable.ic_restore), ButtonStyle.GHOST, new ProfileEditor$$ExternalSyntheticLambda41(this));
        this.animateToggle = new ToggleView(host);
        this.animateNote = ThemeKt.text$default(host, "", 14.0f, Ui.INSTANCE.getC().getText3(), null, new ProfileEditor$$ExternalSyntheticLambda42(), 8, null);
        AvatarFrame avatarFrame = host.getData().getAvatarFrame();
        this.savedFrame = avatarFrame;
        this.previewFrame = avatarFrame;
        CropView cropView = new CropView(host);
        this.crop = cropView;
        SeekBar seekBar = new SeekBar(host);
        this.zoom = seekBar;
        LinearLayout linearLayout3 = new LinearLayout(host);
        linearLayout3.setOrientation(1);
        Unit unit3 = Unit.INSTANCE;
        this.cropPanel = linearLayout3;
        LinearLayout linearLayout4 = new LinearLayout(host);
        linearLayout4.setOrientation(0);
        linearLayout4.setGravity(16);
        LinearLayout linearLayout5 = linearLayout4;
        linearLayout4.setMinimumHeight(ThemeKt.dp(linearLayout5, (Number) 56));
        ImageView imageView = new ImageView(host);
        imageView.setImageResource(R.drawable.ic_close);
        imageView.setImageTintList(ColorStateList.valueOf(Ui.INSTANCE.getC().getText()));
        ImageView imageView2 = imageView;
        imageView.setPadding(ThemeKt.dp(imageView2, (Number) 12), ThemeKt.dp(imageView2, (Number) 12), ThemeKt.dp(imageView2, (Number) 12), ThemeKt.dp(imageView2, (Number) 12));
        imageView.setBackground(Shapes.INSTANCE.ripple(host, null, (Number) 24));
        imageView.setContentDescription("Close without saving");
        imageView.setOnClickListener(new ProfileEditor$$ExternalSyntheticLambda43(this));
        linearLayout4.addView(imageView2, ThemeKt.lp$default(ThemeKt.dp(linearLayout5, (Number) 48), ThemeKt.dp(linearLayout5, (Number) 48), 0.0f, null, 12, null));
        linearLayout4.addView(ThemeKt.heading$default(host, "Profile", 22.0f, 0, 4, null), ThemeKt.lp(0, -2, 1.0f, new ProfileEditor$$ExternalSyntheticLambda44(linearLayout4)));
        linearLayout4.addView(ControlsKt.pillButton$default(host, "Save", null, null, new ProfileEditor$$ExternalSyntheticLambda16(this), 6, null), ThemeKt.lp$default(-2, -2, 0.0f, null, 12, null));
        this.topBar = linearLayout4;
        linearLayout.addView(linearLayout4);
        linearLayout.addView(separator, ThemeKt.lp$default(-1, -2, 0.0f, new ProfileEditor$$ExternalSyntheticLambda17(this), 4, null));
        linearLayout.addView(frameLayout2, ThemeKt.lp$default(-1, -2, 0.0f, new ProfileEditor$$ExternalSyntheticLambda18(this), 4, null));
        linearLayout2.setGravity(1);
        ButtonRow buttonRow = new ButtonRow(host, ThemeKt.dp(host, (Number) 10));
        buttonRow.addView(compact);
        buttonRow.addView(compact2);
        linearLayout2.addView(buttonRow, ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda19(this), 7, null));
        linearLayout2.addView(text$default, ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda20(this), 7, null));
        text$default.setGravity(17);
        buildFrames();
        linearLayout2.addView(ThemeKt.separator(host), ThemeKt.lp$default(-1, -2, 0.0f, new ProfileEditor$$ExternalSyntheticLambda21(this), 4, null));
        linearLayout2.addView(ThemeKt.label$default(host, "Display name", 0, 0.0f, 6, null), ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda22(this), 7, null));
        linearLayout2.addView(inputField, ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda23(this), 7, null));
        linearLayout2.addView(ThemeKt.text$default(host, "Your photo stays on this phone. The app uses Android’s photo picker, so it only ever sees the one photo you choose.", 14.0f, Ui.INSTANCE.getC().getText3(), null, new ProfileEditor$$ExternalSyntheticLambda24(), 8, null), ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda25(this), 7, null));
        linearLayout3.addView(ThemeKt.text$default(host, "Move and zoom", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null), ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda27(this), 7, null));
        linearLayout3.addView(ThemeKt.text$default(host, "Drag to reposition. Pinch or use the slider to zoom.", 14.0f, Ui.INSTANCE.getC().getText3(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda28(this), 7, null));
        FrameLayout frameLayout3 = new FrameLayout(host);
        frameLayout3.setBackground(Shapes.rounded$default(Shapes.INSTANCE, host, (Number) 16, -16777216, 0, null, 24, null));
        frameLayout3.setClipToOutline(true);
        frameLayout3.addView(cropView, ThemeKt.flp$default(-1, -1, 0, 4, null));
        linearLayout3.addView(frameLayout3, ThemeKt.lp$default(-1, ThemeKt.dp(host, (Number) 320), 0.0f, new ProfileEditor$$ExternalSyntheticLambda29(this), 4, null));
        seekBar.setMax(100);
        seekBar.setProgressTintList(ColorStateList.valueOf(Ui.INSTANCE.getC().getGreen()));
        seekBar.setThumbTintList(ColorStateList.valueOf(Ui.INSTANCE.getC().getGreen()));
        seekBar.setContentDescription("Zoom");
        seekBar.setOnSeekBarChangeListener(new AnonymousClass16());
        cropView.setOnZoomChanged(new ProfileEditor$$ExternalSyntheticLambda30(this));
        LinearLayout linearLayout6 = new LinearLayout(host);
        linearLayout6.setOrientation(0);
        linearLayout6.setGravity(16);
        linearLayout6.addView(ThemeKt.icon(host, R.drawable.ic_zoom, Ui.INSTANCE.getC().getText2(), 22));
        linearLayout6.addView(seekBar, ThemeKt.lp(0, -2, 1.0f, new ProfileEditor$$ExternalSyntheticLambda31(linearLayout6)));
        linearLayout3.addView(linearLayout6, ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda32(this), 7, null));
        LinearLayout linearLayout7 = new LinearLayout(host);
        linearLayout7.setOrientation(0);
        linearLayout7.setGravity(16);
        linearLayout7.setGravity(8388613);
        linearLayout7.addView(ControlsKt.pillButton$default(host, "Cancel", null, ButtonStyle.GHOST, new ProfileEditor$$ExternalSyntheticLambda33(this), 2, null), ThemeKt.lp$default(-2, -2, 0.0f, null, 12, null));
        linearLayout7.addView(ControlsKt.pillButton$default(host, "Use photo", valueOf, null, new ProfileEditor$$ExternalSyntheticLambda34(this), 4, null), ThemeKt.lp$default(-2, -2, 0.0f, new ProfileEditor$$ExternalSyntheticLambda35(linearLayout7), 4, null));
        linearLayout3.addView(linearLayout7, ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda36(this), 7, null));
        linearLayout.addView(linearLayout2);
        linearLayout.addView(linearLayout3);
        scrollView.addView(linearLayout, new FrameLayout.LayoutParams(-1, -2));
        frameLayout.addView(scrollView, ThemeKt.flp$default(-1, -1, 0, 4, null));
        load();
        showEdit();
    }

    public static final CropView access$getCrop$p(ProfileEditor profileEditor) {
        return profileEditor.crop;
    }

    public static final MainActivity access$getCtx$p(ProfileEditor profileEditor) {
        return profileEditor.ctx;
    }

    public static final void access$showPreview(ProfileEditor profileEditor, AvatarFrame avatarFrame) {
        profileEditor.showPreview(avatarFrame);
    }

    public final FrameLayout getRoot() {
        return this.root;
    }

    public final AvatarView getAvatar() {
        return this.avatar;
    }

    private static final Unit choose$lambda$4(ProfileEditor profileEditor, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        profileEditor.host.pickPhoto();
        return Unit.INSTANCE;
    }

    private static final Unit remove$lambda$5(ProfileEditor profileEditor, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        profileEditor.removePhoto();
        return Unit.INSTANCE;
    }

    private static final Unit status$lambda$6(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        text.setVisibility(8);
        return Unit.INSTANCE;
    }

    private static final Unit frameStatus$lambda$7(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        text.setVisibility(8);
        return Unit.INSTANCE;
    }

    private static final Unit applyButton$lambda$8(ProfileEditor profileEditor, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        profileEditor.applyFrame();
        return Unit.INSTANCE;
    }

    private static final Unit cancelButton$lambda$9(ProfileEditor profileEditor, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        profileEditor.cancelFrame();
        return Unit.INSTANCE;
    }

    private static final Unit resetButton$lambda$10(ProfileEditor profileEditor, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        profileEditor.resetFrame();
        return Unit.INSTANCE;
    }

    private static final Unit animateNote$lambda$11(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    public static final void lambda$16$lambda$13$lambda$12(ProfileEditor profileEditor, View view) {
        profileEditor.close();
    }

    public static final Unit lambda$16$lambda$14(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 8));
        return Unit.INSTANCE;
    }

    public static final Unit lambda$16$lambda$15(ProfileEditor profileEditor, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        profileEditor.save();
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$17(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$18(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 22);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$20(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 18);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$21(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 12);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$22(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 24);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$23(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 24);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$24(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 10);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$25(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$26(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 16);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$27(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 16);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$28(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 4);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$30(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 14);
        return Unit.INSTANCE;
    }

    public final class AnonymousClass16 implements SeekBar.OnSeekBarChangeListener {
        @Override
        public void onStartTrackingTouch(SeekBar bar) {
            Intrinsics.checkNotNullParameter(bar, "bar");
        }

        @Override
        public void onStopTrackingTouch(SeekBar bar) {
            Intrinsics.checkNotNullParameter(bar, "bar");
        }

        AnonymousClass16() {
        }

        @Override
        public void onProgressChanged(SeekBar bar, int i, boolean z) {
            Intrinsics.checkNotNullParameter(bar, "bar");
            if (z) {
                ProfileEditor.access$getCrop$p(ProfileEditor.this).setZoom(i / 100.0f);
            }
        }
    }

    private static final Unit _init_$lambda$31(ProfileEditor profileEditor, float f) {
        profileEditor.zoom.setProgress((int) (f * 100));
        return Unit.INSTANCE;
    }

    public static final Unit lambda$33$lambda$32(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 8));
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$34(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 14);
        return Unit.INSTANCE;
    }

    public static final Unit lambda$38$lambda$35(ProfileEditor profileEditor, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        profileEditor.showEdit();
        return Unit.INSTANCE;
    }

    public static final Unit lambda$38$lambda$36(ProfileEditor profileEditor, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        profileEditor.usePhoto();
        return Unit.INSTANCE;
    }

    public static final Unit lambda$38$lambda$37(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 8));
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$39(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 18);
        return Unit.INSTANCE;
    }

    private final TextView compact(TextView textView) {
        textView.setTextSize(15.0f);
        TextView textView2 = textView;
        textView.setPadding(ThemeKt.dp(textView2, (Number) 14), ThemeKt.dp(textView2, (Number) 8), ThemeKt.dp(textView2, (Number) 16), ThemeKt.dp(textView2, (Number) 8));
        return textView;
    }

    private final void buildFrames() {
        this.editPanel.addView(ThemeKt.separator(this.ctx), ThemeKt.lp$default(-1, -2, 0.0f, new ProfileEditor$$ExternalSyntheticLambda0(this), 4, null));
        this.editPanel.addView(ThemeKt.label$default(this.ctx, "Profile frames", 0, 0.0f, 6, null), ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda6(this), 7, null));
        this.editPanel.addView(ThemeKt.text$default(this.ctx, "Tap a frame to preview it. Only the border moves; your photo stays still.", 14.0f, Ui.INSTANCE.getC().getText3(), null, new ProfileEditor$$ExternalSyntheticLambda7(), 8, null), ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda8(this), 7, null));
        EnumEntries<AvatarFrame> entries = AvatarFrame.getEntries();
        int progressionLastElement = ProgressionUtilKt.getProgressionLastElement(0, entries.size() - 1, 3);
        if (progressionLastElement >= 0) {
            int i = 0;
            while (true) {
                LinearLayout linearLayout = this.editPanel;
                LinearLayout linearLayout2 = new LinearLayout(this.ctx);
                linearLayout2.setOrientation(0);
                linearLayout2.setGravity(16);
                linearLayout2.setGravity(48);
                int i2 = i + 3;
                int min = Math.min(i2, entries.size());
                for (int i3 = i; i3 < min; i3++) {
                    FrameTile frameTile = new FrameTile(this, (AvatarFrame) entries.get(i3));
                    this.tiles.add(frameTile);
                    linearLayout2.addView(frameTile.getView(), ThemeKt.lp(0, -2, 1.0f, new ProfileEditor$$ExternalSyntheticLambda9(i3, i, linearLayout2)));
                }
                linearLayout.addView(linearLayout2, ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda10(this, i), 7, null));
                if (i == progressionLastElement) {
                    break;
                }
                i = i2;
            }
        }
        this.editPanel.addView(this.frameStatus, ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda11(this), 7, null));
        LinearLayout linearLayout3 = this.editPanel;
        LinearLayout linearLayout4 = new LinearLayout(this.ctx);
        linearLayout4.setOrientation(0);
        linearLayout4.setGravity(16);
        linearLayout4.addView(this.cancelButton, ThemeKt.lp$default(0, -2, 1.0f, null, 8, null));
        linearLayout4.addView(this.applyButton, ThemeKt.lp(0, -2, 1.0f, new ProfileEditor$$ExternalSyntheticLambda12(linearLayout4)));
        linearLayout3.addView(linearLayout4, ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda13(this), 7, null));
        this.editPanel.addView(this.resetButton, ThemeKt.lp$default(-2, -2, 0.0f, new ProfileEditor$$ExternalSyntheticLambda14(this), 4, null));
        LinearLayout linearLayout5 = this.editPanel;
        LinearLayout linearLayout6 = new LinearLayout(this.ctx);
        linearLayout6.setOrientation(0);
        linearLayout6.setGravity(16);
        LinearLayout linearLayout7 = linearLayout6;
        linearLayout6.setMinimumHeight(ThemeKt.dp(linearLayout7, (Number) 64));
        linearLayout6.setPadding(0, ThemeKt.dp(linearLayout7, (Number) 8), 0, ThemeKt.dp(linearLayout7, (Number) 8));
        LinearLayout linearLayout8 = new LinearLayout(this.ctx);
        linearLayout8.setOrientation(1);
        linearLayout8.addView(ThemeKt.text$default(this.ctx, "Animate frame", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null));
        linearLayout8.addView(this.animateNote, ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda1(linearLayout8), 7, null));
        linearLayout6.addView(linearLayout8, ThemeKt.lp$default(0, -2, 1.0f, null, 8, null));
        linearLayout6.addView(this.animateToggle, ThemeKt.lp$default(-2, -2, 0.0f, new ProfileEditor$$ExternalSyntheticLambda2(linearLayout6), 4, null));
        this.animateToggle.setContentDescription("Animate frame");
        linearLayout6.setOnClickListener(new ProfileEditor$$ExternalSyntheticLambda3(this));
        linearLayout5.addView(linearLayout7, ThemeKt.lp$default(0, 0, 0.0f, new ProfileEditor$$ExternalSyntheticLambda4(this), 7, null));
        this.animateToggle.setOnChange(new ProfileEditor$$ExternalSyntheticLambda5(this));
    }

    private static final Unit buildFrames$lambda$41(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 22);
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$42(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 22);
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$43(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$44(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$46$lambda$45(int i, int i2, LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        if (i > i2) {
            lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 8));
        }
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$47(ProfileEditor profileEditor, int i, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, Integer.valueOf(i == 0 ? 14 : 8));
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$48(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 12);
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$50$lambda$49(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 10));
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$51(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 12);
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$52(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 4);
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$57$lambda$54$lambda$53(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$57$lambda$55(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 12));
        return Unit.INSTANCE;
    }

    private static final void buildFrames$lambda$57$lambda$56(ProfileEditor profileEditor, View view) {
        profileEditor.animateToggle.performClick();
    }

    private static final Unit buildFrames$lambda$58(ProfileEditor profileEditor, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(profileEditor.ctx, (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit buildFrames$lambda$59(ProfileEditor profileEditor, boolean z) {
        profileEditor.host.setFrameAnimated(z);
        profileEditor.refreshFrameMotion();
        return Unit.INSTANCE;
    }

    public final class FrameTile {
        private final ImageView badge;
        private final AvatarFrame frame;
        private final TextView name;
        private final AvatarView preview;
        final ProfileEditor this$0;
        private final FrameLayout view;

        public static void $r8$lambda$8twhoxnhUHbuLyDY_pJubsvdkFE(ProfileEditor profileEditor, FrameTile frameTile, View view) {
            view$lambda$7$lambda$6(profileEditor, frameTile, view);
        }

        public static Unit $r8$lambda$J7FTJKTjLtIZZFO44drPgG8Hjd0(TextView textView) {
            return name$lambda$1(textView);
        }

        public static Unit $r8$lambda$U8n6RZ8xiC_FAt7cGwecZEp0MY4(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
            return view$lambda$7$lambda$4$lambda$3(linearLayout, layoutParams);
        }

        public FrameTile(ProfileEditor profileEditor, AvatarFrame frame) {
            Intrinsics.checkNotNullParameter(frame, "frame");
            this.this$0 = profileEditor;
            this.frame = frame;
            AvatarView avatarView = new AvatarView(ProfileEditor.access$getCtx$p(profileEditor));
            avatarView.setImportantForAccessibility(2);
            AvatarView.setFrame$default(avatarView, frame, false, 2, null);
            this.preview = avatarView;
            TextView text = ThemeKt.text(ProfileEditor.access$getCtx$p(profileEditor), frame.getLabel(), 13.0f, Ui.INSTANCE.getC().getText2(), Fonts.INSTANCE.getSansMedium(), new ProfileEditor$FrameTile$$ExternalSyntheticLambda0());
            this.name = text;
            ImageView imageView = new ImageView(ProfileEditor.access$getCtx$p(profileEditor));
            imageView.setImageResource(R.drawable.ic_check);
            imageView.setImageTintList(ColorStateList.valueOf(Ui.INSTANCE.getC().getOnGreen()));
            imageView.setBackground(Shapes.oval$default(Shapes.INSTANCE, Ui.INSTANCE.getC().getGreen(), 0, 0, 6, null));
            ImageView imageView2 = imageView;
            imageView.setPadding(ThemeKt.dp(imageView2, (Number) 3), ThemeKt.dp(imageView2, (Number) 3), ThemeKt.dp(imageView2, (Number) 3), ThemeKt.dp(imageView2, (Number) 3));
            imageView.setImportantForAccessibility(2);
            this.badge = imageView;
            FrameLayout frameLayout = new FrameLayout(ProfileEditor.access$getCtx$p(profileEditor));
            LinearLayout linearLayout = new LinearLayout(ProfileEditor.access$getCtx$p(profileEditor));
            linearLayout.setOrientation(1);
            linearLayout.setGravity(1);
            LinearLayout linearLayout2 = linearLayout;
            linearLayout.setPadding(ThemeKt.dp(linearLayout2, (Number) 4), ThemeKt.dp(linearLayout2, (Number) 10), ThemeKt.dp(linearLayout2, (Number) 4), ThemeKt.dp(linearLayout2, (Number) 10));
            linearLayout.addView(avatarView, ThemeKt.lp$default(ThemeKt.dp(linearLayout2, (Number) 60), ThemeKt.dp(linearLayout2, (Number) 60), 0.0f, null, 12, null));
            linearLayout.addView(text, ThemeKt.lp$default(-1, -2, 0.0f, new ProfileEditor$FrameTile$$ExternalSyntheticLambda1(linearLayout), 4, null));
            frameLayout.addView(linearLayout2, ThemeKt.flp$default(-1, -2, 0, 4, null));
            FrameLayout frameLayout2 = frameLayout;
            FrameLayout.LayoutParams flp = ThemeKt.flp(ThemeKt.dp(frameLayout2, (Number) 20), ThemeKt.dp(frameLayout2, (Number) 20), 8388661);
            flp.topMargin = ThemeKt.dp(frameLayout2, (Number) 6);
            flp.setMarginEnd(ThemeKt.dp(frameLayout2, (Number) 6));
            Unit unit = Unit.INSTANCE;
            frameLayout.addView(imageView, flp);
            frameLayout.setClickable(true);
            frameLayout.setOnClickListener(new ProfileEditor$FrameTile$$ExternalSyntheticLambda2(profileEditor, this));
            this.view = frameLayout;
        }

        public final AvatarFrame getFrame() {
            return this.frame;
        }

        public final AvatarView getPreview() {
            return this.preview;
        }

        private static final Unit name$lambda$1(TextView text) {
            Intrinsics.checkNotNullParameter(text, "$this$text");
            text.setGravity(17);
            text.setMaxLines(2);
            return Unit.INSTANCE;
        }

        public final FrameLayout getView() {
            return this.view;
        }

        private static final Unit view$lambda$7$lambda$4$lambda$3(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
            Intrinsics.checkNotNullParameter(lp, "$this$lp");
            lp.topMargin = ThemeKt.dp(linearLayout, (Number) 6);
            return Unit.INSTANCE;
        }

        private static final void view$lambda$7$lambda$6(ProfileEditor profileEditor, FrameTile frameTile, View view) {
            ProfileEditor.access$showPreview(profileEditor, frameTile.frame);
        }

        public final void bind(boolean z, boolean z2) {
            Colors c = Ui.INSTANCE.getC();
            this.view.setBackground(Shapes.INSTANCE.ripple(ProfileEditor.access$getCtx$p(this.this$0), z ? Shapes.INSTANCE.rounded(ProfileEditor.access$getCtx$p(this.this$0), (Number) 14, c.getGreenSoft(), c.getGreenText(), Float.valueOf(1.5f)) : Shapes.rounded$default(Shapes.INSTANCE, ProfileEditor.access$getCtx$p(this.this$0), (Number) 14, c.getSurface(), c.getSeparator(), null, 16, null), (Number) 14));
            this.name.setTextColor(z ? c.getGreenText() : c.getText2());
            TextView textView = this.name;
            Fonts fonts = Fonts.INSTANCE;
            textView.setTypeface(z ? fonts.getSansSemibold() : fonts.getSansMedium());
            this.badge.setVisibility(z2 ? 0 : 8);
            this.view.setSelected(z);
            FrameLayout frameLayout = this.view;
            String str = "";
            StringBuilder append = new StringBuilder().append(this.frame.getLabel()).append(" frame").append(z2 ? ", saved" : "");
            if (z && !z2) {
                str = ", previewing";
            }
            frameLayout.setContentDescription(append.append(str).toString());
        }
    }

    private final void showPreview(AvatarFrame avatarFrame) {
        StringBuilder append;
        String str;
        this.previewFrame = avatarFrame;
        this.avatar.setFrame(avatarFrame, true);
        if (avatarFrame == this.savedFrame) {
            append = new StringBuilder().append(avatarFrame.getLabel());
            str = " is your saved frame.";
        } else {
            append = new StringBuilder("Previewing ").append(avatarFrame.getLabel());
            str = ". Tap Apply to keep it.";
        }
        setFrameStatus(append.append(str).toString());
        bindFrames();
    }

    private final void setFrameStatus(String str) {
        ThemeKt.update(this.frameStatus, str);
        this.frameStatus.setVisibility(0);
    }

    private final void applyFrame() {
        AvatarFrame avatarFrame = this.previewFrame;
        if (avatarFrame == this.savedFrame) {
            return;
        }
        this.savedFrame = avatarFrame;
        this.host.setAvatarFrame(avatarFrame);
        setFrameStatus(this.savedFrame.getLabel() + " saved.");
        bindFrames();
    }

    private final void cancelFrame() {
        AvatarFrame avatarFrame = this.previewFrame;
        AvatarFrame avatarFrame2 = this.savedFrame;
        if (avatarFrame == avatarFrame2) {
            return;
        }
        this.previewFrame = avatarFrame2;
        this.avatar.setFrame(avatarFrame2, true);
        setFrameStatus("Back to " + this.savedFrame.getLabel() + '.');
        bindFrames();
    }

    private final void resetFrame() {
        this.previewFrame = AvatarFrame.DEFAULT;
        this.avatar.setFrame(AvatarFrame.DEFAULT, true);
        if (this.savedFrame != AvatarFrame.DEFAULT) {
            this.savedFrame = AvatarFrame.DEFAULT;
            this.host.setAvatarFrame(AvatarFrame.DEFAULT);
        }
        setFrameStatus("Frame reset to Default.");
        bindFrames();
    }

    private final void bindFrames() {
        boolean z;
        for (FrameTile frameTile : this.tiles) {
            frameTile.bind(frameTile.getFrame() == this.previewFrame, frameTile.getFrame() == this.savedFrame);
        }
        z = true;
        boolean z3 = this.previewFrame != this.savedFrame;
        for (TextView textView : new TextView[]{this.applyButton, this.cancelButton}) {
            textView.setEnabled(z3);
            textView.setAlpha(z3 ? 1.0f : 0.4f);
        }
        if (this.savedFrame == AvatarFrame.DEFAULT && this.previewFrame == AvatarFrame.DEFAULT) {
            z = false;
        }
        this.resetButton.setEnabled(z);
        this.resetButton.setAlpha(z ? 1.0f : 0.4f);
    }

    public final void refreshFrameMotion() {
        String str;
        boolean framesMoving = this.host.getFramesMoving();
        this.avatar.setAnimateFrame(framesMoving);
        for (FrameTile frameTile : this.tiles) {
            frameTile.getPreview().setAnimateFrame(framesMoving);
        }
        ToggleView.setChecked$default(this.animateToggle, this.host.getData().getFrameAnimated(), false, 2, null);
        TextView textView = this.animateNote;
        if (this.host.getData().getFrameAnimated()) {
            str = !this.host.getPolicy().getAmbient() ? "Paused while motion is reduced or Battery Saver is on." : "The border moves gently. Your photo never moves.";
        } else {
            str = "Off: your chosen border stays still.";
        }
        ThemeKt.update(textView, str);
    }

    private final List<View> controls() {
        List listOf = CollectionsKt.listOf((Object[]) new View[]{this.topBar, this.topRule});
        IntRange until = RangesKt.until(0, this.editPanel.getChildCount());
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(until, 10));
        Iterator<Integer> it = until.iterator();
        while (it.hasNext()) {
            arrayList.add(this.editPanel.getChildAt(((IntIterator) it).nextInt()));
        }
        ArrayList arrayList2 = new ArrayList();
        for (Object obj : arrayList) {
            if (((View) obj).getVisibility() == 0) {
                arrayList2.add(obj);
            }
        }
        return CollectionsKt.plus((Collection) listOf, (Iterable) arrayList2);
    }

    public final void prepareEnter() {
        this.backdrop.setAlpha(0);
        this.avatar.setVisibility(4);
        for (View view : controls()) {
            view.setAlpha(0.0f);
        }
    }

    public final void setBackdrop(float f) {
        this.backdrop.setAlpha((int) (((float) KotlinVersion.MAX_COMPONENT_VALUE) * RangesKt.coerceIn(f, 0.0f, 1.0f)));
    }

    public final void revealControls() {
        float dp = ThemeKt.dp(this.ctx, (Number) 8);
        int i = 0;
        for (Object obj : controls()) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            View view = (View) obj;
            view.animate().cancel();
            view.setAlpha(0.0f);
            view.setTranslationY(dp);
            view.animate().alpha(1.0f).translationY(0.0f).setStartDelay(Math.min(i, 6) * 25).setDuration(200L).setInterpolator(Ease.INSTANCE.getOut()).start();
            i = i2;
        }
    }

    public final void hideControls() {
        for (View view : controls()) {
            view.animate().cancel();
            view.animate().alpha(0.0f).setStartDelay(0L).setDuration(120L).setInterpolator(Ease.INSTANCE.getExit()).start();
        }
    }

    private final void load() {
        Profile profile = this.host.getData().getProfile();
        this.nameField.setText(profile.getName());
        EditText editText = this.nameField;
        editText.setSelection(editText.getText().length());
        this.avatar.setInitials(profile.getInitials());
        AvatarView.setFrame$default(this.avatar, this.savedFrame, false, 2, null);
        showPhoto(this.host.avatarBitmap(ThemeKt.dp(this.ctx, (Number) 150)));
        refreshFrameMotion();
        bindFrames();
    }

    private final void showPhoto(Bitmap bitmap) {
        this.avatar.setPhoto(bitmap);
        String initials = this.host.getData().getProfile().getInitials();
        for (FrameTile frameTile : this.tiles) {
            frameTile.getPreview().setInitials(initials);
            frameTile.getPreview().setPhoto(bitmap);
        }
        updateButtons();
    }

    public final void applyInsets(int i, int i2) {
        this.column.setPadding(ThemeKt.dp(this.ctx, (Number) 16), i + ThemeKt.dp(this.ctx, (Number) 4), ThemeKt.dp(this.ctx, (Number) 16), i2 + ThemeKt.dp(this.ctx, (Number) 24));
    }

    public final boolean back() {
        if (this.cropping) {
            showEdit();
            return true;
        }
        close();
        return true;
    }

    private final void showEdit() {
        this.cropping = false;
        this.avatarHolder.setVisibility(0);
        this.editPanel.setVisibility(0);
        this.cropPanel.setVisibility(8);
    }

    public final void onPhotoPicked(Bitmap bitmap) {
        if (bitmap == null) {
            setStatus("That photo couldn’t be opened. Try a different one.");
            return;
        }
        this.cropping = true;
        this.avatarHolder.setVisibility(8);
        this.editPanel.setVisibility(8);
        this.cropPanel.setVisibility(0);
        this.crop.setBitmap(bitmap);
        this.zoom.setProgress(0);
        this.scroll.scrollTo(0, 0);
    }

    public final void onPickCancelled() {
        setStatus("No photo chosen. Your current picture is unchanged.");
    }

    private final void usePhoto() {
        Bitmap result = this.crop.result(ConstantsKt.MINIMUM_BLOCK_SIZE);
        if (result == null) {
            return;
        }
        this.pendingPhoto = result;
        this.removePending = false;
        showPhoto(result);
        showEdit();
        setStatus("Looks good! Tap Save to keep it.");
    }

    private final void removePhoto() {
        this.pendingPhoto = null;
        this.removePending = true;
        showPhoto(null);
        setStatus("Photo removed. Tap Save to confirm — your initials will show instead.");
    }

    private final void updateButtons() {
        boolean hasPhoto = this.avatar.getHasPhoto();
        this.choose.setText(hasPhoto ? "Replace photo" : "Choose photo");
        this.remove.setVisibility(hasPhoto ? 0 : 8);
    }

    private final void setStatus(String str) {
        this.status.setText(str);
        this.status.setVisibility(0);
    }

    private final void save() {
        String obj = StringsKt.trim((CharSequence) this.nameField.getText().toString()).toString();
        Bitmap bitmap = this.pendingPhoto;
        if (bitmap != null) {
            if (!Avatar.INSTANCE.save(this.ctx, bitmap)) {
                setStatus("Couldn’t save the photo. Please try again.");
                return;
            }
        } else if (this.removePending) {
            Avatar.INSTANCE.remove(this.ctx);
        }
        AvatarFrame avatarFrame = this.previewFrame;
        if (avatarFrame != this.savedFrame) {
            this.host.setAvatarFrame(avatarFrame);
        }
        if (obj.length() > 0 && !Intrinsics.areEqual(obj, this.host.getData().getProfile().getName())) {
            MainActivity mainActivity = this.host;
            mainActivity.updateProfile(Profile.copy$default(mainActivity.getData().getProfile(), obj, null, null, null, null, null, 62, null));
        }
        this.host.onAvatarChanged();
        close();
    }

    private final void close() {
        this.host.closeProfileEditor();
    }
}

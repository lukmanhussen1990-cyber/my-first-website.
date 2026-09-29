package com.imran.examcountdown.ui.widgets;

import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.animation.StateListAnimator;
import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.widget.TextView;
import com.imran.examcountdown.ui.Colors;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.Fonts;
import com.imran.examcountdown.ui.Haptics;
import com.imran.examcountdown.ui.Shapes;
import com.imran.examcountdown.ui.Spring;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.Unit;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Intrinsics;

public final class ControlsKt {

    public class WhenMappings {
        public static final int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[ButtonStyle.values().length];
            try {
                iArr[ButtonStyle.PRIMARY.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[ButtonStyle.SECONDARY.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            try {
                iArr[ButtonStyle.GHOST.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            try {
                iArr[ButtonStyle.DANGER.ordinal()] = 4;
            } catch (NoSuchFieldError unused4) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    public static Unit $r8$lambda$2ZvNUqIC1EtRtQNLtXHhXt_Mbhw(TextView textView) {
        return statusLabel$lambda$5(textView);
    }

    public static void $r8$lambda$XVgJVnDnwnAdHqqdpCuAIlKnl2A(Function1 function1, View view) {
        pillButton$lambda$1$lambda$0(function1, view);
    }

    public static Unit $r8$lambda$rWnYR7SWDkMqqn5KGbaH5Vfv4UI(ButtonStyle buttonStyle, Integer num, Function1 function1, TextView textView) {
        return pillButton$lambda$1(buttonStyle, num, function1, textView);
    }

    public static TextView pillButton$default(Context context, String str, Integer num, ButtonStyle buttonStyle, Function1 function1, int i, Object obj) {
        if ((i & 2) != 0) {
            num = null;
        }
        if ((i & 4) != 0) {
            buttonStyle = ButtonStyle.PRIMARY;
        }
        return pillButton(context, str, num, buttonStyle, function1);
    }

    public static final TextView pillButton(Context context, String label, Integer num, ButtonStyle style, Function1<? super View, Unit> onClick) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(label, "label");
        Intrinsics.checkNotNullParameter(style, "style");
        Intrinsics.checkNotNullParameter(onClick, "onClick");
        return ThemeKt.text(context, label, 16.0f, Ui.INSTANCE.getC().getOnGreen(), Fonts.INSTANCE.getSansSemibold(), new ControlsKt$$ExternalSyntheticLambda2(style, num, onClick));
    }

    private static final Unit pillButton$lambda$1(ButtonStyle buttonStyle, Integer num, Function1 function1, TextView text) {
        GradientDrawable rounded$default;
        int onGreen;
        Intrinsics.checkNotNullParameter(text, "$this$text");
        Colors c = Ui.INSTANCE.getC();
        text.setGravity(17);
        TextView textView = text;
        text.setMinHeight(ThemeKt.dp(textView, (Number) 50));
        text.setPadding(ThemeKt.dp(textView, (Number) 20), ThemeKt.dp(textView, (Number) 8), ThemeKt.dp(textView, (Number) 20), ThemeKt.dp(textView, (Number) 8));
        int i = WhenMappings.$EnumSwitchMapping$0[buttonStyle.ordinal()];
        if (i == 1) {
            Shapes shapes = Shapes.INSTANCE;
            Context context = text.getContext();
            Intrinsics.checkNotNullExpressionValue(context, "getContext(...)");
            rounded$default = Shapes.rounded$default(shapes, context, (Number) 14, c.getGreen(), 0, null, 24, null);
        } else if (i == 2) {
            Shapes shapes2 = Shapes.INSTANCE;
            Context context2 = text.getContext();
            Intrinsics.checkNotNullExpressionValue(context2, "getContext(...)");
            rounded$default = shapes2.rounded(context2, (Number) 14, 0, Ui.INSTANCE.withAlpha(c.getGreenText(), 0.55f), Float.valueOf(1.5f));
        } else if (i == 3) {
            rounded$default = null;
        } else if (i != 4) {
            throw new NoWhenBranchMatchedException();
        } else {
            Shapes shapes3 = Shapes.INSTANCE;
            Context context3 = text.getContext();
            Intrinsics.checkNotNullExpressionValue(context3, "getContext(...)");
            rounded$default = shapes3.rounded(context3, (Number) 14, 0, Ui.INSTANCE.withAlpha(c.getDanger(), 0.55f), Float.valueOf(1.5f));
        }
        int i2 = WhenMappings.$EnumSwitchMapping$0[buttonStyle.ordinal()];
        if (i2 == 1) {
            onGreen = c.getOnGreen();
        } else if (i2 == 4) {
            onGreen = c.getDanger();
        } else {
            onGreen = c.getGreenText();
        }
        text.setTextColor(onGreen);
        Shapes shapes4 = Shapes.INSTANCE;
        Context context4 = text.getContext();
        Intrinsics.checkNotNullExpressionValue(context4, "getContext(...)");
        text.setBackground(shapes4.ripple(context4, rounded$default, (Number) 14));
        if (num != null) {
            setLeadingIcon$default(text, num.intValue(), 0, 2, null);
        }
        text.setStateListAnimator(pressScale$default(textView, 0.0f, 2, null));
        text.setOnClickListener(new ControlsKt$$ExternalSyntheticLambda1(function1));
        return Unit.INSTANCE;
    }

    private static final void pillButton$lambda$1$lambda$0(Function1 function1, View view) {
        Haptics haptics = Haptics.INSTANCE;
        Intrinsics.checkNotNull(view);
        haptics.tap(view);
        function1.invoke(view);
    }

    public static void setLeadingIcon$default(TextView textView, int i, int i2, int i3, Object obj) {
        if ((i3 & 2) != 0) {
            i2 = 20;
        }
        setLeadingIcon(textView, i, i2);
    }

    public static final void setLeadingIcon(TextView textView, int i, int i2) {
        Drawable mutate;
        Intrinsics.checkNotNullParameter(textView, "<this>");
        Drawable drawable = textView.getContext().getDrawable(i);
        if (drawable == null || (mutate = drawable.mutate()) == null) {
            return;
        }
        mutate.setTintList(ColorStateList.valueOf(textView.getCurrentTextColor()));
        TextView textView2 = textView;
        mutate.setBounds(0, 0, ThemeKt.dp(textView2, Integer.valueOf(i2)), ThemeKt.dp(textView2, Integer.valueOf(i2)));
        textView.setCompoundDrawablesRelative(mutate, null, null, null);
        textView.setCompoundDrawablePadding(ThemeKt.dp(textView2, (Number) 8));
    }

    public static final StateListAnimator pressScale(View view, float f) {
        Intrinsics.checkNotNullParameter(view, "view");
        StateListAnimator stateListAnimator = new StateListAnimator();
        AnimatorSet animatorSet = new AnimatorSet();
        animatorSet.playTogether(ObjectAnimator.ofFloat(view, View.SCALE_X, f), ObjectAnimator.ofFloat(view, View.SCALE_Y, f));
        animatorSet.setDuration(90L);
        animatorSet.setInterpolator(Ease.INSTANCE.getOut());
        Unit unit = Unit.INSTANCE;
        stateListAnimator.addState(new int[]{16842919}, animatorSet);
        AnimatorSet animatorSet2 = new AnimatorSet();
        animatorSet2.playTogether(ObjectAnimator.ofFloat(view, View.SCALE_X, 1.0f), ObjectAnimator.ofFloat(view, View.SCALE_Y, 1.0f));
        animatorSet2.setDuration(240L);
        animatorSet2.setInterpolator(new Spring(0.75f));
        Unit unit2 = Unit.INSTANCE;
        stateListAnimator.addState(new int[0], animatorSet2);
        return stateListAnimator;
    }

    public static StateListAnimator pressScale$default(View view, float f, int i, Object obj) {
        if ((i & 2) != 0) {
            f = 0.96f;
        }
        return pressScale(view, f);
    }

    public static final TextView statusLabel(Context context) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        return ThemeKt.text(context, "", 13.0f, Ui.INSTANCE.getC().getText2(), Fonts.INSTANCE.getSansSemibold(), new ControlsKt$$ExternalSyntheticLambda0());
    }

    private static final Unit statusLabel$lambda$5(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setGravity(16);
        return Unit.INSTANCE;
    }

    public static void styleStatus$default(TextView textView, String str, int i, boolean z, int i2, Object obj) {
        if ((i2 & 4) != 0) {
            z = false;
        }
        styleStatus(textView, str, i, z);
    }

    public static final void styleStatus(TextView textView, String label, int i, boolean z) {
        Intrinsics.checkNotNullParameter(textView, "<this>");
        Intrinsics.checkNotNullParameter(label, "label");
        textView.setText(label);
        if (z) {
            textView.setTextColor(Ui.INSTANCE.getLIGHT().getText());
            Shapes shapes = Shapes.INSTANCE;
            Context context = textView.getContext();
            Intrinsics.checkNotNullExpressionValue(context, "getContext(...)");
            textView.setBackground(Shapes.rounded$default(shapes, context, (Number) 8, i, 0, null, 24, null));
            TextView textView2 = textView;
            textView.setPadding(ThemeKt.dp(textView2, (Number) 8), ThemeKt.dp(textView2, (Number) 3), ThemeKt.dp(textView2, (Number) 8), ThemeKt.dp(textView2, (Number) 3));
            return;
        }
        textView.setTextColor(i);
        textView.setBackground(null);
        textView.setPadding(0, 0, 0, 0);
    }
}

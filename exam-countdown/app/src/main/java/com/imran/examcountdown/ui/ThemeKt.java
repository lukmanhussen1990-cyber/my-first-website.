package com.imran.examcountdown.ui;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Locale;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Intrinsics;

public final class ThemeKt {
    public static final int MATCH = -1;
    public static final int WRAP = -2;

    public static Unit $r8$lambda$BRO3_SSD73IWMTfnVZkO003VAF0(TextView textView) {
        return text$lambda$2(textView);
    }

    public static Unit m13$r8$lambda$K2greJFJiMNz482OKBlx59DU8U(TextView textView) {
        return heading$lambda$4(textView);
    }

    public static Unit $r8$lambda$fwgQXinnxzBzngZBCqNMqyNjiJ4(TextView textView) {
        return label$lambda$5(textView);
    }

    public static Unit m14$r8$lambda$pPN5E_0ns1ZuHkLKGvPjWVERj8(LinearLayout.LayoutParams layoutParams) {
        return lp$lambda$8(layoutParams);
    }

    public static final int access$argb(long j) {
        return argb(j);
    }

    private static final int argb(long j) {
        return (int) j;
    }

    public static final int dp(Context context, Number value) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(value, "value");
        return (int) ((value.floatValue() * context.getResources().getDisplayMetrics().density) + 0.5f);
    }

    public static final float dpf(Context context, Number value) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(value, "value");
        return value.floatValue() * context.getResources().getDisplayMetrics().density;
    }

    public static final float sp(Context context, Number value) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(value, "value");
        return value.floatValue() * context.getResources().getDisplayMetrics().scaledDensity;
    }

    public static final int dp(View view, Number value) {
        Intrinsics.checkNotNullParameter(view, "<this>");
        Intrinsics.checkNotNullParameter(value, "value");
        Context context = view.getContext();
        Intrinsics.checkNotNullExpressionValue(context, "getContext(...)");
        return dp(context, value);
    }

    public static final float dpf(View view, Number value) {
        Intrinsics.checkNotNullParameter(view, "<this>");
        Intrinsics.checkNotNullParameter(value, "value");
        Context context = view.getContext();
        Intrinsics.checkNotNullExpressionValue(context, "getContext(...)");
        return dpf(context, value);
    }

    public static LinearLayout column$default(Context context, Function1 block, int i, Object obj) {
        if ((i & 1) != 0) {
            block = ThemeKt$column$1.INSTANCE;
        }
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(block, "block");
        LinearLayout linearLayout = new LinearLayout(context);
        linearLayout.setOrientation(1);
        block.invoke(linearLayout);
        return linearLayout;
    }

    public static final LinearLayout column(Context context, Function1<? super LinearLayout, Unit> block) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(block, "block");
        LinearLayout linearLayout = new LinearLayout(context);
        linearLayout.setOrientation(1);
        block.invoke(linearLayout);
        return linearLayout;
    }

    public static LinearLayout row$default(Context context, Function1 block, int i, Object obj) {
        if ((i & 1) != 0) {
            block = ThemeKt$row$1.INSTANCE;
        }
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(block, "block");
        LinearLayout linearLayout = new LinearLayout(context);
        linearLayout.setOrientation(0);
        linearLayout.setGravity(16);
        block.invoke(linearLayout);
        return linearLayout;
    }

    public static final LinearLayout row(Context context, Function1<? super LinearLayout, Unit> block) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(block, "block");
        LinearLayout linearLayout = new LinearLayout(context);
        linearLayout.setOrientation(0);
        linearLayout.setGravity(16);
        block.invoke(linearLayout);
        return linearLayout;
    }

    public static final FrameLayout frame(Context context, Function1<? super FrameLayout, Unit> block) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(block, "block");
        FrameLayout frameLayout = new FrameLayout(context);
        block.invoke(frameLayout);
        return frameLayout;
    }

    public static FrameLayout frame$default(Context context, Function1 block, int i, Object obj) {
        if ((i & 1) != 0) {
            block = ThemeKt$frame$1.INSTANCE;
        }
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(block, "block");
        FrameLayout frameLayout = new FrameLayout(context);
        block.invoke(frameLayout);
        return frameLayout;
    }

    public static TextView text$default(Context context, CharSequence charSequence, float f, int i, Typeface typeface, Function1 function1, int i2, Object obj) {
        if ((i2 & 1) != 0) {
            charSequence = "";
        }
        if ((i2 & 2) != 0) {
            f = 16.0f;
        }
        float f2 = f;
        if ((i2 & 4) != 0) {
            i = Ui.INSTANCE.getC().getText();
        }
        int i3 = i;
        if ((i2 & 8) != 0) {
            typeface = Fonts.INSTANCE.getSans();
        }
        Typeface typeface2 = typeface;
        if ((i2 & 16) != 0) {
            function1 = new ThemeKt$$ExternalSyntheticLambda0();
        }
        return text(context, charSequence, f2, i3, typeface2, function1);
    }

    private static final Unit text$lambda$2(TextView textView) {
        Intrinsics.checkNotNullParameter(textView, "<this>");
        return Unit.INSTANCE;
    }

    public static final TextView text(Context context, CharSequence value, float f, int i, Typeface font, Function1<? super TextView, Unit> block) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(value, "value");
        Intrinsics.checkNotNullParameter(font, "font");
        Intrinsics.checkNotNullParameter(block, "block");
        TextView textView = new TextView(context);
        textView.setText(value);
        textView.setTextSize(f);
        textView.setTextColor(i);
        textView.setTypeface(font);
        textView.setIncludeFontPadding(false);
        textView.setLineSpacing(0.0f, 1.2f);
        block.invoke(textView);
        return textView;
    }

    public static TextView heading$default(Context context, CharSequence charSequence, float f, int i, int i2, Object obj) {
        if ((i2 & 2) != 0) {
            f = 28.0f;
        }
        if ((i2 & 4) != 0) {
            i = Ui.INSTANCE.getC().getText();
        }
        return heading(context, charSequence, f, i);
    }

    public static final TextView heading(Context context, CharSequence value, float f, int i) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(value, "value");
        return text(context, value, f, i, Fonts.INSTANCE.getSerif(), new ThemeKt$$ExternalSyntheticLambda3());
    }

    private static final Unit heading$lambda$4(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.1f);
        return Unit.INSTANCE;
    }

    public static TextView label$default(Context context, CharSequence charSequence, int i, float f, int i2, Object obj) {
        if ((i2 & 2) != 0) {
            i = Ui.INSTANCE.getC().getGreenText();
        }
        if ((i2 & 4) != 0) {
            f = 12.0f;
        }
        return label(context, charSequence, i, f);
    }

    public static final TextView label(Context context, CharSequence value, int i, float f) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        Intrinsics.checkNotNullParameter(value, "value");
        String upperCase = value.toString().toUpperCase(Locale.ROOT);
        Intrinsics.checkNotNullExpressionValue(upperCase, "toUpperCase(...)");
        return text(context, upperCase, f, i, Fonts.INSTANCE.getSansSemibold(), new ThemeKt$$ExternalSyntheticLambda1());
    }

    private static final Unit label$lambda$5(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLetterSpacing(0.12f);
        return Unit.INSTANCE;
    }

    public static final void update(TextView textView, CharSequence value) {
        Intrinsics.checkNotNullParameter(textView, "<this>");
        Intrinsics.checkNotNullParameter(value, "value");
        if (Intrinsics.areEqual(textView.getText().toString(), value.toString())) {
            return;
        }
        textView.setText(value);
    }

    public static final ImageView icon(Context context, int i, int i2, int i3) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        ImageView imageView = new ImageView(context);
        imageView.setImageResource(i);
        imageView.setImageTintList(ColorStateList.valueOf(i2));
        imageView.setScaleType(ImageView.ScaleType.FIT_CENTER);
        ImageView imageView2 = imageView;
        imageView.setLayoutParams(new LinearLayout.LayoutParams(dp(imageView2, Integer.valueOf(i3)), dp(imageView2, Integer.valueOf(i3))));
        imageView.setImportantForAccessibility(2);
        return imageView;
    }

    public static ImageView icon$default(Context context, int i, int i2, int i3, int i4, Object obj) {
        if ((i4 & 4) != 0) {
            i3 = 20;
        }
        return icon(context, i, i2, i3);
    }

    public static final View separator(Context context) {
        Intrinsics.checkNotNullParameter(context, "<this>");
        Hairline hairline = new Hairline(context);
        hairline.setLayoutParams(new LinearLayout.LayoutParams(-1, -2));
        return hairline;
    }

    public static LinearLayout.LayoutParams lp$default(int i, int i2, float f, Function1 function1, int i3, Object obj) {
        if ((i3 & 1) != 0) {
            i = -1;
        }
        if ((i3 & 2) != 0) {
            i2 = -2;
        }
        if ((i3 & 4) != 0) {
            f = 0.0f;
        }
        if ((i3 & 8) != 0) {
            function1 = new ThemeKt$$ExternalSyntheticLambda2();
        }
        return lp(i, i2, f, function1);
    }

    private static final Unit lp$lambda$8(LinearLayout.LayoutParams layoutParams) {
        Intrinsics.checkNotNullParameter(layoutParams, "<this>");
        return Unit.INSTANCE;
    }

    public static final LinearLayout.LayoutParams lp(int i, int i2, float f, Function1<? super LinearLayout.LayoutParams, Unit> block) {
        Intrinsics.checkNotNullParameter(block, "block");
        LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(i, i2, f);
        block.invoke(layoutParams);
        return layoutParams;
    }

    public static FrameLayout.LayoutParams flp$default(int i, int i2, int i3, int i4, Object obj) {
        if ((i4 & 1) != 0) {
            i = -1;
        }
        if ((i4 & 2) != 0) {
            i2 = -2;
        }
        if ((i4 & 4) != 0) {
            i3 = 0;
        }
        return flp(i, i2, i3);
    }

    public static final FrameLayout.LayoutParams flp(int i, int i2, int i3) {
        return new FrameLayout.LayoutParams(i, i2, i3);
    }
}

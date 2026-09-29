package com.imran.examcountdown.ui;

import android.content.Context;
import kotlin.KotlinVersion;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class Ui {
    private static final Colors DARK;
    private static final int FOREST;
    public static final Ui INSTANCE = new Ui();
    private static final Colors LIGHT;
    private static volatile Colors c;

    private Ui() {
    }

    static {
        Colors colors = new Colors(false, ThemeKt.access$argb(4294439912L), ThemeKt.access$argb(4294966517L), ThemeKt.access$argb(4293912791L), ThemeKt.access$argb(4293122758L), ThemeKt.access$argb(4293320395L), ThemeKt.access$argb(4280165152L), ThemeKt.access$argb(4283784791L), ThemeKt.access$argb(4286415996L), ThemeKt.access$argb(4280244795L), ThemeKt.access$argb(4294703084L), ThemeKt.access$argb(4292996063L), ThemeKt.access$argb(4280244795L), ThemeKt.access$argb(4292124970L), ThemeKt.access$argb(4287259144L), ThemeKt.access$argb(4294173880L), ThemeKt.access$argb(4288821804L), ThemeKt.access$argb(639588923L));
        LIGHT = colors;
        DARK = new Colors(true, ThemeKt.access$argb(4279244307L), ThemeKt.access$argb(4279639577L), ThemeKt.access$argb(4280166690L), ThemeKt.access$argb(4280759083L), ThemeKt.access$argb(4280693034L), ThemeKt.access$argb(4293847775L), ThemeKt.access$argb(4289903023L), ThemeKt.access$argb(4287008646L), ThemeKt.access$argb(4281298506L), ThemeKt.access$argb(4294242532L), ThemeKt.access$argb(4280103718L), ThemeKt.access$argb(4286367386L), ThemeKt.access$argb(4292456005L), ThemeKt.access$argb(4293115230L), ThemeKt.access$argb(4281806362L), ThemeKt.access$argb(4293430140L), ThemeKt.access$argb(871295711L));
        FOREST = ThemeKt.access$argb(4279188262L);
        c = colors;
    }

    public final Colors getLIGHT() {
        return LIGHT;
    }

    public final Colors getDARK() {
        return DARK;
    }

    public final int getFOREST() {
        return FOREST;
    }

    public final Colors getC() {
        return c;
    }

    public final void setC(Colors colors) {
        Intrinsics.checkNotNullParameter(colors, "<set-?>");
        c = colors;
    }

    public final boolean isNight(Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        return (context.getResources().getConfiguration().uiMode & 48) == 32;
    }

    public final void apply(Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        c = isNight(context) ? DARK : LIGHT;
    }

    public final int withAlpha(int i, float f) {
        return (i & 16777215) | (((int) (RangesKt.coerceIn(f, 0.0f, 1.0f) * ((float) KotlinVersion.MAX_COMPONENT_VALUE))) << 24);
    }
}

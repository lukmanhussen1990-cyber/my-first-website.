package com.imran.examcountdown.ui;

import android.content.Context;
import android.content.res.Resources;
import android.graphics.Typeface;
import com.imran.examcountdown.R;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class Fonts {
    public static final Fonts INSTANCE = new Fonts();
    public static Typeface sans;
    public static Typeface sansMedium;
    public static Typeface sansSemibold;
    public static Typeface serif;
    public static Typeface serifItalic;

    private Fonts() {
    }

    public final Typeface getSerif() {
        Typeface typeface = serif;
        if (typeface != null) {
            return typeface;
        }
        Intrinsics.throwUninitializedPropertyAccessException("serif");
        return null;
    }

    public final void setSerif(Typeface typeface) {
        Intrinsics.checkNotNullParameter(typeface, "<set-?>");
        serif = typeface;
    }

    public final Typeface getSerifItalic() {
        Typeface typeface = serifItalic;
        if (typeface != null) {
            return typeface;
        }
        Intrinsics.throwUninitializedPropertyAccessException("serifItalic");
        return null;
    }

    public final void setSerifItalic(Typeface typeface) {
        Intrinsics.checkNotNullParameter(typeface, "<set-?>");
        serifItalic = typeface;
    }

    public final Typeface getSans() {
        Typeface typeface = sans;
        if (typeface != null) {
            return typeface;
        }
        Intrinsics.throwUninitializedPropertyAccessException("sans");
        return null;
    }

    public final void setSans(Typeface typeface) {
        Intrinsics.checkNotNullParameter(typeface, "<set-?>");
        sans = typeface;
    }

    public final Typeface getSansMedium() {
        Typeface typeface = sansMedium;
        if (typeface != null) {
            return typeface;
        }
        Intrinsics.throwUninitializedPropertyAccessException("sansMedium");
        return null;
    }

    public final void setSansMedium(Typeface typeface) {
        Intrinsics.checkNotNullParameter(typeface, "<set-?>");
        sansMedium = typeface;
    }

    public final Typeface getSansSemibold() {
        Typeface typeface = sansSemibold;
        if (typeface != null) {
            return typeface;
        }
        Intrinsics.throwUninitializedPropertyAccessException("sansSemibold");
        return null;
    }

    public final void setSansSemibold(Typeface typeface) {
        Intrinsics.checkNotNullParameter(typeface, "<set-?>");
        sansSemibold = typeface;
    }

    public final void init(Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        if (sansSemibold != null) {
            return;
        }
        Resources resources = context.getResources();
        setSerif(resources.getFont(R.font.serif_semibold));
        setSerifItalic(resources.getFont(R.font.serif_italic));
        setSans(resources.getFont(R.font.sans_regular));
        setSansMedium(resources.getFont(R.font.sans_medium));
        setSansSemibold(resources.getFont(R.font.sans_semibold));
    }
}

package com.imran.examcountdown.ui;

import android.app.Activity;
import android.content.Context;
import android.widget.EditText;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class DialogsKt {
    public static final EditText inputField(Activity activity, String initial, String hint, int i) {
        Intrinsics.checkNotNullParameter(activity, "<this>");
        Intrinsics.checkNotNullParameter(initial, "initial");
        Intrinsics.checkNotNullParameter(hint, "hint");
        EditText editText = new EditText(activity);
        editText.setText(initial);
        editText.setHint(hint);
        editText.setInputType(i);
        editText.setTextSize(17.0f);
        editText.setTypeface(Fonts.INSTANCE.getSans());
        editText.setTextColor(Ui.INSTANCE.getC().getText());
        editText.setHintTextColor(Ui.INSTANCE.getC().getText3());
        Shapes shapes = Shapes.INSTANCE;
        Context context = editText.getContext();
        Intrinsics.checkNotNullExpressionValue(context, "getContext(...)");
        editText.setBackground(shapes.rounded(context, (Number) 12, Ui.INSTANCE.getC().getBg(), Ui.INSTANCE.getC().getSeparator(), Float.valueOf(1.5f)));
        EditText editText2 = editText;
        editText.setPadding(ThemeKt.dp(editText2, (Number) 14), ThemeKt.dp(editText2, (Number) 12), ThemeKt.dp(editText2, (Number) 14), ThemeKt.dp(editText2, (Number) 12));
        editText.setSingleLine(true);
        editText.setImeOptions(6);
        editText.setSelection(editText.getText().length());
        return editText;
    }
}

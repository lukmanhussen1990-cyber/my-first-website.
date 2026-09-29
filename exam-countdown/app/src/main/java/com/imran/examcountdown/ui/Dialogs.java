package com.imran.examcountdown.ui;

import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import com.imran.examcountdown.MainActivity;
import com.imran.examcountdown.R;
import com.imran.examcountdown.ui.widgets.ButtonStyle;
import com.imran.examcountdown.ui.widgets.ControlsKt;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.functions.Function2;
import kotlin.jvm.internal.Intrinsics;
import kotlin.jvm.internal.Ref;
import kotlin.text.StringsKt;

public final class Dialogs {
    public static final Dialogs INSTANCE = new Dialogs();

    public static Unit $r8$lambda$3O72haT7YtoFueslYfUefDNQHlg(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return sheet$lambda$2$lambda$1(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$6m5jRZ8XAbvXhx2ZXsGRNjM7sS0(Dialog dialog) {
        return sheet$lambda$3(dialog);
    }

    public static boolean $r8$lambda$8n73nFDyu4G4gcPXb2x3CwHS9fI(Ref.ObjectRef objectRef, Function0 function0, Function1 function1, Function0 function02, TextView textView, int i, KeyEvent keyEvent) {
        return editText$lambda$15$lambda$10(objectRef, function0, function1, function02, textView, i, keyEvent);
    }

    public static Unit m10$r8$lambda$9OEM0Fmyj2RZhlNtgxwXy1Z_0(List list, Activity activity, int i, Function1 function1, LinearLayout linearLayout, Function0 function0) {
        return choice$lambda$23(list, activity, i, function1, linearLayout, function0);
    }

    public static Unit $r8$lambda$9ZBfQlKLU3XRnRm5KNa81ESXGJs(int i, LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return choice$lambda$23$lambda$21$lambda$20(i, linearLayout, layoutParams);
    }

    public static void $r8$lambda$AIZ1SR4t_rZlHuuPHYqDtFj_mjw(Function1 function1, int i, Function0 function0, View view) {
        choice$lambda$23$lambda$21$lambda$19$lambda$18(function1, i, function0, view);
    }

    public static Unit $r8$lambda$EBF9CYUDD963hT7NopoY8Pnb1Sw(Activity activity, String str, boolean z, Function0 function0, LinearLayout linearLayout, Function0 function02) {
        return confirm$lambda$26(activity, str, z, function0, linearLayout, function02);
    }

    public static Unit m11$r8$lambda$ESHPkNRrbaLKuAH1CgTyu11zqA(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return editText$lambda$15$lambda$11(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$GjNfRuGkAtUdemO24xbUEr_pthM(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return actions$lambda$9(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$HelXpprC61kEFBpcq6PtLLmJBvY(int i, LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return actions$lambda$8$lambda$7$lambda$6(i, linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$LeqKH_SPkR_NgnTiclwvO3hwZEA(Function0 function0, Function0 function02, View view) {
        return confirm$lambda$26$lambda$25(function0, function02, view);
    }

    public static Unit $r8$lambda$N_fJ2EsxehoRHhYRHWZb_gqTBCc(Function0 function0, Function0 function02, View view) {
        return editText$lambda$15$lambda$12(function0, function02, view);
    }

    public static Unit m12$r8$lambda$OL_BCHcV1VYn7qO8mBM0YkvX4k(Function0 function0, View view) {
        return confirm$lambda$26$lambda$24(function0, view);
    }

    public static Unit $r8$lambda$TVjyeDzbsHBi9OtF2TWeN6qDD3w(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return choice$lambda$23$lambda$21$lambda$19$lambda$17(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$cyy1Qjlwb1TEJdLnK9GQXF1g4so(TextView textView) {
        return sheet$lambda$2$lambda$0(textView);
    }

    public static Unit $r8$lambda$jtm3f8wzfXp4Iw3A4hb8f0J8Nns(Ref.ObjectRef objectRef, Function0 function0, Function1 function1, Function0 function02, View view) {
        return editText$lambda$15$lambda$14(objectRef, function0, function1, function02, view);
    }

    public static Unit $r8$lambda$r0YfD_7afTcshfwLmBnnmTBcRjQ(Function0 function0, View view) {
        return choice$lambda$23$lambda$22(function0, view);
    }

    public static Unit $r8$lambda$rdw2pu8BSzXBXLZSRW5BXZYB95k(Function0 function0, View view) {
        return editText$lambda$15$lambda$13(function0, view);
    }

    public static Unit $r8$lambda$wk5FJidyyPy34m_7lC4b8Z916C8(Ref.ObjectRef objectRef, Activity activity, String str, String str2, int i, Function0 function0, Function1 function1, LinearLayout linearLayout, Function0 function02) {
        return editText$lambda$15(objectRef, activity, str, str2, i, function0, function1, linearLayout, function02);
    }

    private Dialogs() {
    }

    public static Dialog sheet$default(Dialogs dialogs, Activity activity, String str, String str2, Function2 function2, int i, Object obj) {
        if ((i & 4) != 0) {
            str2 = null;
        }
        return dialogs.sheet(activity, str, str2, function2);
    }

    public final Dialog sheet(Activity activity, String title, String str, Function2<? super LinearLayout, ? super Function0<Unit>, Unit> build) {
        LinearLayout linearLayout;
        MotionPolicy policy;
        Intrinsics.checkNotNullParameter(activity, "activity");
        Intrinsics.checkNotNullParameter(title, "title");
        Intrinsics.checkNotNullParameter(build, "build");
        Activity activity2 = activity;
        Dialog dialog = new Dialog(activity2);
        boolean z = true;
        dialog.requestWindowFeature(1);
        LinearLayout linearLayout2 = new LinearLayout(activity2);
        linearLayout2.setOrientation(1);
        Shapes shapes = Shapes.INSTANCE;
        Context context = linearLayout2.getContext();
        Intrinsics.checkNotNullExpressionValue(context, "getContext(...)");
        linearLayout2.setBackground(Shapes.rounded$default(shapes, context, (Number) 22, Ui.INSTANCE.getC().getSurface(), Ui.INSTANCE.getC().getSeparator(), null, 16, null));
        LinearLayout linearLayout3 = linearLayout2;
        linearLayout2.setPadding(ThemeKt.dp(linearLayout3, (Number) 24), ThemeKt.dp(linearLayout3, (Number) 22), ThemeKt.dp(linearLayout3, (Number) 24), ThemeKt.dp(linearLayout3, (Number) 18));
        linearLayout2.addView(ThemeKt.heading$default(activity2, title, 21.0f, 0, 4, null));
        if (str != null) {
            linearLayout = linearLayout3;
            linearLayout2.addView(ThemeKt.text$default(activity2, str, 15.0f, Ui.INSTANCE.getC().getText2(), null, new Dialogs$$ExternalSyntheticLambda4(), 8, null), ThemeKt.lp$default(0, 0, 0.0f, new Dialogs$$ExternalSyntheticLambda5(linearLayout2), 7, null));
        } else {
            linearLayout = linearLayout3;
        }
        ((kotlin.jvm.functions.Function2) build).invoke(linearLayout2, new Dialogs$$ExternalSyntheticLambda6(dialog));
        ScrollView scrollView = new ScrollView(activity2);
        scrollView.setVerticalScrollBarEnabled(false);
        scrollView.addView(linearLayout);
        dialog.setContentView(scrollView);
        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawable(new ColorDrawable(0));
            window.setLayout(Math.min(activity.getResources().getDisplayMetrics().widthPixels - ThemeKt.dp(activity2, (Number) 32), ThemeKt.dp(activity2, (Number) 440)), -2);
            window.setDimAmount(0.45f);
            window.addFlags(2);
            MainActivity mainActivity = activity instanceof MainActivity ? (MainActivity) activity : null;
            if (mainActivity != null && (policy = mainActivity.getPolicy()) != null) {
                z = policy.getMotion();
            }
            window.setWindowAnimations(z ? R.style.Animation_ExamCountdown_Sheet : R.style.Animation_ExamCountdown_Fade);
        }
        dialog.show();
        return dialog;
    }

    private static final Unit sheet$lambda$2$lambda$0(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit sheet$lambda$2$lambda$1(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 10);
        return Unit.INSTANCE;
    }

    private static final Unit sheet$lambda$3(Dialog dialog) {
        dialog.dismiss();
        return Unit.INSTANCE;
    }

    public final void actions(LinearLayout linearLayout, View... buttons) {
        Intrinsics.checkNotNullParameter(linearLayout, "<this>");
        Intrinsics.checkNotNullParameter(buttons, "buttons");
        Context context = linearLayout.getContext();
        Intrinsics.checkNotNullExpressionValue(context, "getContext(...)");
        LinearLayout linearLayout2 = new LinearLayout(context);
        int i = 0;
        linearLayout2.setOrientation(0);
        linearLayout2.setGravity(16);
        linearLayout2.setGravity(8388629);
        int length = buttons.length;
        int i2 = 0;
        while (i < length) {
            linearLayout2.addView(buttons[i], ThemeKt.lp$default(-2, -2, 0.0f, new Dialogs$$ExternalSyntheticLambda17(i2, linearLayout2), 4, null));
            i++;
            i2++;
        }
        linearLayout.addView(linearLayout2, ThemeKt.lp$default(0, 0, 0.0f, new Dialogs$$ExternalSyntheticLambda18(linearLayout), 7, null));
    }

    private static final Unit actions$lambda$8$lambda$7$lambda$6(int i, LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        if (i > 0) {
            Context context = linearLayout.getContext();
            Intrinsics.checkNotNullExpressionValue(context, "getContext(...)");
            lp.setMarginStart(ThemeKt.dp(context, (Number) 8));
        }
        return Unit.INSTANCE;
    }

    private static final Unit actions$lambda$9(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        Context context = linearLayout.getContext();
        Intrinsics.checkNotNullExpressionValue(context, "getContext(...)");
        lp.topMargin = ThemeKt.dp(context, (Number) 20);
        return Unit.INSTANCE;
    }

    public static void editText$default(Dialogs dialogs, Activity activity, String str, String str2, String str3, int i, Function0 function0, Function1 function1, int i2, Object obj) {
        dialogs.editText(activity, str, str2, (i2 & 8) != 0 ? "" : str3, (i2 & 16) != 0 ? 8193 : i, (i2 & 32) != 0 ? null : function0, function1);
    }

    public final void editText(Activity activity, String title, String initial, String hint, int i, Function0<Unit> function0, Function1<? super String, Unit> onSave) {
        EditText editText;
        Intrinsics.checkNotNullParameter(activity, "activity");
        Intrinsics.checkNotNullParameter(title, "title");
        Intrinsics.checkNotNullParameter(initial, "initial");
        Intrinsics.checkNotNullParameter(hint, "hint");
        Intrinsics.checkNotNullParameter(onSave, "onSave");
        Ref.ObjectRef objectRef = new Ref.ObjectRef();
        Window window = sheet$default(this, activity, title, null, new Dialogs$$ExternalSyntheticLambda12(objectRef, activity, initial, hint, i, function0, onSave), 4, null).getWindow();
        if (window != null) {
            window.setSoftInputMode(4);
        }
        if (objectRef.element == null) {
            Intrinsics.throwUninitializedPropertyAccessException("field");
            editText = null;
        } else {
            editText = (EditText) objectRef.element;
        }
        editText.requestFocus();
    }

    /* JADX WARN: Type inference failed for: r9v1, types: [T, android.widget.EditText] */
    private static final Unit editText$lambda$15(Ref.ObjectRef objectRef, Activity activity, String str, String str2, int i, Function0 function0, Function1 function1, LinearLayout sheet, Function0 dismiss) {
        EditText editText;
        Intrinsics.checkNotNullParameter(sheet, "$this$sheet");
        Intrinsics.checkNotNullParameter(dismiss, "dismiss");
        objectRef.element = DialogsKt.inputField(activity, str, str2, i);
        EditText editText2 = null;
        if (objectRef.element == null) {
            Intrinsics.throwUninitializedPropertyAccessException("field");
            editText = null;
        } else {
            editText = (EditText) objectRef.element;
        }
        editText.setOnEditorActionListener(new Dialogs$$ExternalSyntheticLambda7(objectRef, function0, function1, dismiss));
        if (objectRef.element == null) {
            Intrinsics.throwUninitializedPropertyAccessException("field");
        } else {
            editText2 = (EditText) objectRef.element;
        }
        sheet.addView(editText2, ThemeKt.lp$default(0, 0, 0.0f, new Dialogs$$ExternalSyntheticLambda8(sheet), 7, null));
        ArrayList arrayList = new ArrayList();
        if (function0 != null) {
            arrayList.add(ControlsKt.pillButton(activity, "Delete", Integer.valueOf((int) R.drawable.ic_delete), ButtonStyle.DANGER, new Dialogs$$ExternalSyntheticLambda9(function0, dismiss)));
        }
        ArrayList arrayList2 = arrayList;
        Activity activity2 = activity;
        arrayList2.add(ControlsKt.pillButton$default(activity2, "Cancel", null, ButtonStyle.GHOST, new Dialogs$$ExternalSyntheticLambda10(dismiss), 2, null));
        arrayList2.add(ControlsKt.pillButton$default(activity2, "Save", null, null, new Dialogs$$ExternalSyntheticLambda11(objectRef, function0, function1, dismiss), 6, null));
        Dialogs dialogs = INSTANCE;
        View[] viewArr = (View[]) arrayList2.toArray(new View[0]);
        dialogs.actions(sheet, (View[]) Arrays.copyOf(viewArr, viewArr.length));
        return Unit.INSTANCE;
    }

    private static final boolean editText$lambda$15$lambda$10(Ref.ObjectRef objectRef, Function0 function0, Function1 function1, Function0 function02, TextView textView, int i, KeyEvent keyEvent) {
        EditText editText;
        if (i == 6) {
            if (objectRef.element == null) {
                Intrinsics.throwUninitializedPropertyAccessException("field");
                editText = null;
            } else {
                editText = (EditText) objectRef.element;
            }
            String obj = StringsKt.trim((CharSequence) editText.getText().toString()).toString();
            if (obj.length() > 0 || function0 == null) {
                function1.invoke(obj);
                function02.invoke();
            }
            return true;
        }
        return false;
    }

    private static final Unit editText$lambda$15$lambda$11(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 16);
        return Unit.INSTANCE;
    }

    private static final Unit editText$lambda$15$lambda$12(Function0 function0, Function0 function02, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        function0.invoke();
        function02.invoke();
        return Unit.INSTANCE;
    }

    private static final Unit editText$lambda$15$lambda$13(Function0 function0, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        function0.invoke();
        return Unit.INSTANCE;
    }

    private static final Unit editText$lambda$15$lambda$14(Ref.ObjectRef objectRef, Function0 function0, Function1 function1, Function0 function02, View it) {
        EditText editText;
        Intrinsics.checkNotNullParameter(it, "it");
        if (objectRef.element == null) {
            Intrinsics.throwUninitializedPropertyAccessException("field");
            editText = null;
        } else {
            editText = (EditText) objectRef.element;
        }
        String obj = StringsKt.trim((CharSequence) editText.getText().toString()).toString();
        if (obj.length() != 0 || function0 == null) {
            function1.invoke(obj);
            function02.invoke();
            return Unit.INSTANCE;
        }
        return Unit.INSTANCE;
    }

    public static void choice$default(Dialogs dialogs, Activity activity, String str, List list, int i, String str2, Function1 function1, int i2, Object obj) {
        if ((i2 & 16) != 0) {
            str2 = null;
        }
        dialogs.choice(activity, str, list, i, str2, function1);
    }

    public final void choice(Activity activity, String title, List<String> options, int i, String str, Function1<? super Integer, Unit> onPick) {
        Intrinsics.checkNotNullParameter(activity, "activity");
        Intrinsics.checkNotNullParameter(title, "title");
        Intrinsics.checkNotNullParameter(options, "options");
        Intrinsics.checkNotNullParameter(onPick, "onPick");
        sheet(activity, title, str, new Dialogs$$ExternalSyntheticLambda13(options, activity, i, onPick));
    }

    private static final Unit choice$lambda$23(List list, Activity activity, int i, Function1 function1, LinearLayout sheet, Function0 dismiss) {
        GradientDrawable gradientDrawable;
        Iterator it;
        GradientDrawable oval;
        Intrinsics.checkNotNullParameter(sheet, "$this$sheet");
        Intrinsics.checkNotNullParameter(dismiss, "dismiss");
        Context context = sheet.getContext();
        Intrinsics.checkNotNullExpressionValue(context, "getContext(...)");
        LinearLayout linearLayout = new LinearLayout(context);
        int i2 = 1;
        linearLayout.setOrientation(1);
        Iterator it2 = list.iterator();
        int i3 = 0;
        int i4 = 0;
        while (it2.hasNext()) {
            Object next = it2.next();
            int i5 = i4 + 1;
            if (i4 < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            String str = (String) next;
            int i6 = i4 == i ? i2 : i3;
            Context context2 = sheet.getContext();
            Intrinsics.checkNotNullExpressionValue(context2, "getContext(...)");
            LinearLayout linearLayout2 = new LinearLayout(context2);
            linearLayout2.setOrientation(i3);
            linearLayout2.setGravity(16);
            LinearLayout linearLayout3 = linearLayout2;
            linearLayout2.setMinimumHeight(ThemeKt.dp(linearLayout3, (Number) 52));
            linearLayout2.setPadding(ThemeKt.dp(linearLayout3, (Number) 12), ThemeKt.dp(linearLayout3, (Number) 8), ThemeKt.dp(linearLayout3, (Number) 12), ThemeKt.dp(linearLayout3, (Number) 8));
            Shapes shapes = Shapes.INSTANCE;
            Context context3 = linearLayout2.getContext();
            Intrinsics.checkNotNullExpressionValue(context3, "getContext(...)");
            if (i6 != 0) {
                Shapes shapes2 = Shapes.INSTANCE;
                Context context4 = linearLayout2.getContext();
                Intrinsics.checkNotNullExpressionValue(context4, "getContext(...)");
                gradientDrawable = Shapes.rounded$default(shapes2, context4, (Number) 12, Ui.INSTANCE.getC().getGreenSoft(), 0, null, 24, null);
            } else {
                gradientDrawable = null;
            }
            linearLayout2.setBackground(shapes.ripple(context3, gradientDrawable, (Number) 12));
            View view = new View(linearLayout2.getContext());
            if (i6 != 0) {
                it = it2;
                oval = Shapes.INSTANCE.oval(Ui.INSTANCE.getC().getGreen(), Ui.INSTANCE.getC().getGreen(), ThemeKt.dp(view, (Number) 2));
            } else {
                it = it2;
                oval = Shapes.INSTANCE.oval(0, Ui.INSTANCE.getC().getText3(), ThemeKt.dp(view, (Number) 2));
            }
            view.setBackground(oval);
            linearLayout2.addView(view, ThemeKt.lp$default(ThemeKt.dp(linearLayout3, (Number) 18), ThemeKt.dp(linearLayout3, (Number) 18), 0.0f, null, 12, null));
            Context context5 = linearLayout2.getContext();
            Intrinsics.checkNotNullExpressionValue(context5, "getContext(...)");
            String str2 = str;
            int text = Ui.INSTANCE.getC().getText();
            Fonts fonts = Fonts.INSTANCE;
            linearLayout2.addView(ThemeKt.text$default(context5, str2, 16.0f, text, i6 != 0 ? fonts.getSansSemibold() : fonts.getSans(), null, 16, null), ThemeKt.lp(0, -2, 1.0f, new Dialogs$$ExternalSyntheticLambda0(linearLayout2)));
            linearLayout2.setClickable(true);
            linearLayout2.setOnClickListener(new Dialogs$$ExternalSyntheticLambda1(function1, i4, dismiss));
            linearLayout.addView(linearLayout3, ThemeKt.lp$default(0, 0, 0.0f, new Dialogs$$ExternalSyntheticLambda2(i4, sheet), 7, null));
            i4 = i5;
            it2 = it;
            i2 = 1;
            i3 = 0;
        }
        sheet.addView(linearLayout);
        INSTANCE.actions(sheet, ControlsKt.pillButton$default(activity, "Cancel", null, ButtonStyle.GHOST, new Dialogs$$ExternalSyntheticLambda3(dismiss), 2, null));
        return Unit.INSTANCE;
    }

    private static final Unit choice$lambda$23$lambda$21$lambda$19$lambda$17(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 14));
        return Unit.INSTANCE;
    }

    private static final void choice$lambda$23$lambda$21$lambda$19$lambda$18(Function1 function1, int i, Function0 function0, View view) {
        function1.invoke(Integer.valueOf(i));
        function0.invoke();
    }

    private static final Unit choice$lambda$23$lambda$21$lambda$20(int i, LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, Integer.valueOf(i == 0 ? 12 : 4));
        return Unit.INSTANCE;
    }

    private static final Unit choice$lambda$23$lambda$22(Function0 function0, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        function0.invoke();
        return Unit.INSTANCE;
    }

    public static void confirm$default(Dialogs dialogs, Activity activity, String str, String str2, String str3, boolean z, Function0 function0, int i, Object obj) {
        if ((i & 16) != 0) {
            z = false;
        }
        dialogs.confirm(activity, str, str2, str3, z, function0);
    }

    public final void confirm(Activity activity, String title, String message, String confirmLabel, boolean z, Function0<Unit> onConfirm) {
        Intrinsics.checkNotNullParameter(activity, "activity");
        Intrinsics.checkNotNullParameter(title, "title");
        Intrinsics.checkNotNullParameter(message, "message");
        Intrinsics.checkNotNullParameter(confirmLabel, "confirmLabel");
        Intrinsics.checkNotNullParameter(onConfirm, "onConfirm");
        sheet(activity, title, message, new Dialogs$$ExternalSyntheticLambda16(activity, confirmLabel, z, onConfirm));
    }

    private static final Unit confirm$lambda$26(Activity activity, String str, boolean z, Function0 function0, LinearLayout sheet, Function0 dismiss) {
        Intrinsics.checkNotNullParameter(sheet, "$this$sheet");
        Intrinsics.checkNotNullParameter(dismiss, "dismiss");
        Dialogs dialogs = INSTANCE;
        View[] viewArr = new View[2];
        Activity activity2 = activity;
        viewArr[0] = ControlsKt.pillButton$default(activity2, "Cancel", null, ButtonStyle.GHOST, new Dialogs$$ExternalSyntheticLambda14(dismiss), 2, null);
        viewArr[1] = ControlsKt.pillButton$default(activity2, str, null, z ? ButtonStyle.DANGER : ButtonStyle.PRIMARY, new Dialogs$$ExternalSyntheticLambda15(function0, dismiss), 2, null);
        dialogs.actions(sheet, viewArr);
        return Unit.INSTANCE;
    }

    private static final Unit confirm$lambda$26$lambda$24(Function0 function0, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        function0.invoke();
        return Unit.INSTANCE;
    }

    private static final Unit confirm$lambda$26$lambda$25(Function0 function0, Function0 function02, View it) {
        Intrinsics.checkNotNullParameter(it, "it");
        function0.invoke();
        function02.invoke();
        return Unit.INSTANCE;
    }
}

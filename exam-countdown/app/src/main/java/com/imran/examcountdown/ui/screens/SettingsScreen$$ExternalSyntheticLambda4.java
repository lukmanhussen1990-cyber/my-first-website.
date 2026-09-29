package com.imran.examcountdown.ui.screens;

import android.widget.TextView;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.Subject;
import java.util.List;
import kotlin.jvm.functions.Function1;

public final class SettingsScreen$$ExternalSyntheticLambda4 implements Function1 {
    public final Exam f$0;
    public final List f$1;
    public final SettingsScreen f$2;
    public final Subject f$3;
    public final TextView f$4;
    public final TextView f$5;
    public final TextView f$6;

    public SettingsScreen$$ExternalSyntheticLambda4(Exam exam, List list, SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3) {
        this.f$0 = exam;
        this.f$1 = list;
        this.f$2 = settingsScreen;
        this.f$3 = subject;
        this.f$4 = textView;
        this.f$5 = textView2;
        this.f$6 = textView3;
    }

    @Override
    public final Object invoke(Object obj) {
        return SettingsScreen.m62$r8$lambda$mWsuqUmDqjRzACGP729hlcxiog(this.f$0, this.f$1, this.f$2, this.f$3, this.f$4, this.f$5, this.f$6, ((Integer) obj).intValue());
    }
}

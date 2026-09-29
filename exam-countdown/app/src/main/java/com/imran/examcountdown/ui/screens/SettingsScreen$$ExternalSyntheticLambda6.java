package com.imran.examcountdown.ui.screens;

import android.app.DatePickerDialog;
import android.widget.DatePicker;
import android.widget.TextView;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.Subject;

public final class SettingsScreen$$ExternalSyntheticLambda6 implements DatePickerDialog.OnDateSetListener {
    public final Exam f$0;
    public final SettingsScreen f$1;
    public final Subject f$2;
    public final TextView f$3;
    public final TextView f$4;
    public final TextView f$5;

    public SettingsScreen$$ExternalSyntheticLambda6(Exam exam, SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3) {
        this.f$0 = exam;
        this.f$1 = settingsScreen;
        this.f$2 = subject;
        this.f$3 = textView;
        this.f$4 = textView2;
        this.f$5 = textView3;
    }

    @Override
    public final void onDateSet(DatePicker datePicker, int i, int i2, int i3) {
        SettingsScreen.m59$r8$lambda$dmMsUD6GiN2gwkYbJI8Zb8hsU(this.f$0, this.f$1, this.f$2, this.f$3, this.f$4, this.f$5, datePicker, i, i2, i3);
    }
}

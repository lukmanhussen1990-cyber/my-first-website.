package com.imran.examcountdown.ui.screens;

import android.app.TimePickerDialog;
import android.widget.TextView;
import android.widget.TimePicker;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.Subject;

public final class SettingsScreen$$ExternalSyntheticLambda10 implements TimePickerDialog.OnTimeSetListener {
    public final Exam f$0;
    public final SettingsScreen f$1;
    public final Subject f$2;
    public final TextView f$3;
    public final TextView f$4;
    public final TextView f$5;

    public SettingsScreen$$ExternalSyntheticLambda10(Exam exam, SettingsScreen settingsScreen, Subject subject, TextView textView, TextView textView2, TextView textView3) {
        this.f$0 = exam;
        this.f$1 = settingsScreen;
        this.f$2 = subject;
        this.f$3 = textView;
        this.f$4 = textView2;
        this.f$5 = textView3;
    }

    @Override
    public final void onTimeSet(TimePicker timePicker, int i, int i2) {
        SettingsScreen.$r8$lambda$Bu34qedFSQdqTEvu1jnKQJ8sjK8(this.f$0, this.f$1, this.f$2, this.f$3, this.f$4, this.f$5, timePicker, i, i2);
    }
}

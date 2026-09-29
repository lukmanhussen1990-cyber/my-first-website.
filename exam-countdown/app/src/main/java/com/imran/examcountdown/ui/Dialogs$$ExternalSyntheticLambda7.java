package com.imran.examcountdown.ui;

import android.view.KeyEvent;
import android.widget.TextView;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Ref;

public final class Dialogs$$ExternalSyntheticLambda7 implements TextView.OnEditorActionListener {
    public final Ref.ObjectRef f$0;
    public final Function0 f$1;
    public final Function1 f$2;
    public final Function0 f$3;

    public Dialogs$$ExternalSyntheticLambda7(Ref.ObjectRef objectRef, Function0 function0, Function1 function1, Function0 function02) {
        this.f$0 = objectRef;
        this.f$1 = function0;
        this.f$2 = function1;
        this.f$3 = function02;
    }

    @Override
    public final boolean onEditorAction(TextView textView, int i, KeyEvent keyEvent) {
        return Dialogs.$r8$lambda$8n73nFDyu4G4gcPXb2x3CwHS9fI(this.f$0, this.f$1, this.f$2, this.f$3, textView, i, keyEvent);
    }
}

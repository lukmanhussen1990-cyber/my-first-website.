package com.imran.examcountdown.ui.screens;

import android.animation.ValueAnimator;
import android.view.View;
import android.view.animation.LinearInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import com.imran.examcountdown.AppData;
import com.imran.examcountdown.MainActivity;
import com.imran.examcountdown.R;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.DoneReason;
import com.imran.examcountdown.core.Exam;
import com.imran.examcountdown.core.ExamStatus;
import com.imran.examcountdown.core.Formats;
import com.imran.examcountdown.core.ModelKt;
import com.imran.examcountdown.core.Phase;
import com.imran.examcountdown.core.Season;
import com.imran.examcountdown.core.SeasonCalculator;
import com.imran.examcountdown.core.Subject;
import com.imran.examcountdown.core.Timetable;
import com.imran.examcountdown.ui.AmbientListener;
import com.imran.examcountdown.ui.Colors;
import com.imran.examcountdown.ui.Fonts;
import com.imran.examcountdown.ui.Shapes;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import com.imran.examcountdown.ui.widgets.ControlsKt;
import com.imran.examcountdown.ui.widgets.TimelineRailView;
import java.util.ArrayList;
import java.util.Locale;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;
import kotlin.text.StringsKt;

public final class TimetableScreen extends Screen implements AmbientListener {
    private String builtFor;
    private final LinearLayout content;
    private final LinearLayout list;
    private final ArrayList<Row> rows;
    private final ScrollView scroll;
    private final TextView subtitle;

    public static Unit $r8$lambda$0e_NHHYuaFYsl3LULjyrw87Rw6U(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return makeRow$lambda$25$lambda$23(linearLayout, layoutParams);
    }

    public static void $r8$lambda$0tRMkne3oqTWDReyAs4qbfcjXPk(TimetableScreen timetableScreen, View view) {
        note$lambda$14$lambda$12$lambda$11$lambda$10(timetableScreen, view);
    }

    public static Unit $r8$lambda$3N78raSUcIGEaM17Yq3XPmMMCYY(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return makeRow$lambda$30$lambda$29(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$BMk25q_c6omJ5NwyiEMbFYOPKyg(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return note$lambda$14$lambda$13(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$EHJeOed903m2RdQQFP3WhBUPTtM(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return makeRow$lambda$25$lambda$24(linearLayout, layoutParams);
    }

    public static void m85$r8$lambda$GlBE4klLDR7u9mgjKOFCFOGSeI(Row row, ValueAnimator valueAnimator) {
        playEntrance$lambda$36$lambda$35$lambda$34(row, valueAnimator);
    }

    public static Unit m86$r8$lambda$H_0gOcA2qf2X60QdPHb1HrVe6o(TimetableScreen timetableScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$4(timetableScreen, layoutParams);
    }

    public static Unit m87$r8$lambda$IcP5JlvfJvqH1P9znOeVtb6IuY(TimetableScreen timetableScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$5(timetableScreen, layoutParams);
    }

    public static void $r8$lambda$MoeZS4F8pmr0uYNB32UFmSwE7NI(TimetableScreen timetableScreen, Subject subject, View view) {
        build$lambda$19$lambda$18(timetableScreen, subject, view);
    }

    public static Unit m88$r8$lambda$UieX22Bw76JNXOj0UwY_MxqXYk(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return makeRow$lambda$30$lambda$28(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$XTQRma8_VdLMuh0666YV8AitMms(TimetableScreen timetableScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$3(timetableScreen, layoutParams);
    }

    public static CharSequence m89$r8$lambda$_ySloE16QOz6DKIFih62TeLYVA(Exam exam) {
        return onShow$lambda$15(exam);
    }

    public static Unit m90$r8$lambda$cJCDpr8BvqPB53wpo1ttMlrY0s(TextView textView) {
        return note$lambda$14$lambda$12$lambda$8(textView);
    }

    public static Unit $r8$lambda$nzeNhwPv3yYykphZmQwfvYPsVQk(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return note$lambda$14$lambda$12$lambda$9(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$rrSFUGWuV1s4uDioNqtS1EEbSw0(TimetableScreen timetableScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$1(timetableScreen, layoutParams);
    }

    public static Unit $r8$lambda$rslfIz5Is0C5fUDnPP3X_9MlJ_E(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return note$lambda$14$lambda$12$lambda$7(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$sWZASGgHUH4RIBSlXcngfS7tucU(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return makeRow$lambda$30$lambda$27(linearLayout, layoutParams);
    }

    public static Unit $r8$lambda$ySJ5PGwcS3uEtR1TbSgBetTywho(TimetableScreen timetableScreen, TextView textView) {
        return note$lambda$14$lambda$12$lambda$11(timetableScreen, textView);
    }

    public static Unit m91$r8$lambda$zHVu2ywSrt1Vw5OQIA2hL24V4s(TimetableScreen timetableScreen, LinearLayout.LayoutParams layoutParams) {
        return _init_$lambda$2(timetableScreen, layoutParams);
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public TimetableScreen(MainActivity host) {
        super(host);
        Intrinsics.checkNotNullParameter(host, "host");
        ScrollView scrollView = new ScrollView(getCtx());
        scrollView.setVerticalScrollBarEnabled(false);
        scrollView.setOverScrollMode(1);
        this.scroll = scrollView;
        LinearLayout linearLayout = new LinearLayout(getCtx());
        linearLayout.setOrientation(1);
        Unit unit = Unit.INSTANCE;
        this.content = linearLayout;
        TextView text$default = ThemeKt.text$default(getCtx(), "", 15.0f, Ui.INSTANCE.getC().getText2(), null, null, 24, null);
        this.subtitle = text$default;
        LinearLayout linearLayout2 = new LinearLayout(getCtx());
        linearLayout2.setOrientation(1);
        Unit unit2 = Unit.INSTANCE;
        this.list = linearLayout2;
        this.rows = new ArrayList<>();
        this.builtFor = "";
        scrollView.addView(linearLayout, new FrameLayout.LayoutParams(-1, -2));
        linearLayout.addView(ThemeKt.heading$default(getCtx(), "Timetable", 30.0f, 0, 4, null), ThemeKt.lp$default(0, 0, 0.0f, new TimetableScreen$$ExternalSyntheticLambda7(this), 7, null));
        linearLayout.addView(text$default, ThemeKt.lp$default(0, 0, 0.0f, new TimetableScreen$$ExternalSyntheticLambda8(this), 7, null));
        linearLayout.addView(note(), ThemeKt.lp$default(0, 0, 0.0f, new TimetableScreen$$ExternalSyntheticLambda9(this), 7, null));
        linearLayout.addView(linearLayout2, ThemeKt.lp$default(0, 0, 0.0f, new TimetableScreen$$ExternalSyntheticLambda10(this), 7, null));
        linearLayout.addView(ThemeKt.text$default(getCtx(), "Only dates with a Class VIII exam are listed.", 13.5f, Ui.INSTANCE.getC().getText3(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new TimetableScreen$$ExternalSyntheticLambda11(this), 7, null));
    }

    @Override
    public View getRoot() {
        return this.scroll;
    }

    public static final class Row {
        private final LinearLayout body;
        private final TextView day;
        private final TextView duration;
        private final TextView meta;
        private final TextView month;
        private final TimelineRailView rail;
        private String signature;
        private final TextView status;
        private final TextView title;
        private final LinearLayout view;
        private final TextView weekday;

        public Row(LinearLayout view, TimelineRailView rail, LinearLayout body, TextView title, TextView meta, TextView duration, TextView status, TextView weekday, TextView day, TextView month) {
            Intrinsics.checkNotNullParameter(view, "view");
            Intrinsics.checkNotNullParameter(rail, "rail");
            Intrinsics.checkNotNullParameter(body, "body");
            Intrinsics.checkNotNullParameter(title, "title");
            Intrinsics.checkNotNullParameter(meta, "meta");
            Intrinsics.checkNotNullParameter(duration, "duration");
            Intrinsics.checkNotNullParameter(status, "status");
            Intrinsics.checkNotNullParameter(weekday, "weekday");
            Intrinsics.checkNotNullParameter(day, "day");
            Intrinsics.checkNotNullParameter(month, "month");
            this.view = view;
            this.rail = rail;
            this.body = body;
            this.title = title;
            this.meta = meta;
            this.duration = duration;
            this.status = status;
            this.weekday = weekday;
            this.day = day;
            this.month = month;
            this.signature = "";
        }

        public final LinearLayout getView() {
            return this.view;
        }

        public final TimelineRailView getRail() {
            return this.rail;
        }

        public final LinearLayout getBody() {
            return this.body;
        }

        public final TextView getTitle() {
            return this.title;
        }

        public final TextView getMeta() {
            return this.meta;
        }

        public final TextView getDuration() {
            return this.duration;
        }

        public final TextView getStatus() {
            return this.status;
        }

        public final TextView getWeekday() {
            return this.weekday;
        }

        public final TextView getDay() {
            return this.day;
        }

        public final TextView getMonth() {
            return this.month;
        }

        public final String getSignature() {
            return this.signature;
        }

        public final void setSignature(String str) {
            Intrinsics.checkNotNullParameter(str, "<set-?>");
            this.signature = str;
        }
    }

    private static final Unit _init_$lambda$1(TimetableScreen timetableScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(timetableScreen.getCtx(), (Number) 8);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$2(TimetableScreen timetableScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(timetableScreen.getCtx(), (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$3(TimetableScreen timetableScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(timetableScreen.getCtx(), (Number) 18);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$4(TimetableScreen timetableScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(timetableScreen.getCtx(), (Number) 22);
        return Unit.INSTANCE;
    }

    private static final Unit _init_$lambda$5(TimetableScreen timetableScreen, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(timetableScreen.getCtx(), (Number) 10);
        return Unit.INSTANCE;
    }

    private final View note() {
        LinearLayout linearLayout = new LinearLayout(getCtx());
        linearLayout.setOrientation(0);
        linearLayout.setGravity(16);
        linearLayout.setGravity(48);
        View view = new View(getCtx());
        view.setBackground(Shapes.rounded$default(Shapes.INSTANCE, getCtx(), (Number) 2, Ui.INSTANCE.getC().getGold(), 0, null, 24, null));
        LinearLayout linearLayout2 = linearLayout;
        linearLayout.addView(view, ThemeKt.lp$default(ThemeKt.dp(linearLayout2, (Number) 3), -1, 0.0f, null, 12, null));
        LinearLayout linearLayout3 = new LinearLayout(getCtx());
        linearLayout3.setOrientation(1);
        linearLayout3.addView(ThemeKt.text$default(getCtx(), "Every paper starts at 12:30 PM, India time.", 16.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null));
        linearLayout3.addView(ThemeKt.text$default(getCtx(), Timetable.SESSION_NOTE, 14.5f, Ui.INSTANCE.getC().getText2(), null, null, 24, null), ThemeKt.lp$default(0, 0, 0.0f, new TimetableScreen$$ExternalSyntheticLambda14(linearLayout3), 7, null));
        linearLayout3.addView(ThemeKt.text$default(getCtx(), Timetable.DURATION_NOTE, 14.0f, Ui.INSTANCE.getC().getText3(), null, new TimetableScreen$$ExternalSyntheticLambda15(), 8, null), ThemeKt.lp$default(0, 0, 0.0f, new TimetableScreen$$ExternalSyntheticLambda16(linearLayout3), 7, null));
        linearLayout3.addView(ThemeKt.text(getCtx(), "Set durations in Settings", 15.0f, Ui.INSTANCE.getC().getGreenText(), Fonts.INSTANCE.getSansSemibold(), new TimetableScreen$$ExternalSyntheticLambda17(this)));
        linearLayout.addView(linearLayout3, ThemeKt.lp(0, -2, 1.0f, new TimetableScreen$$ExternalSyntheticLambda18(linearLayout)));
        return linearLayout2;
    }

    private static final Unit note$lambda$14$lambda$12$lambda$7(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 4);
        return Unit.INSTANCE;
    }

    private static final Unit note$lambda$14$lambda$12$lambda$8(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setLineSpacing(0.0f, 1.3f);
        return Unit.INSTANCE;
    }

    private static final Unit note$lambda$14$lambda$12$lambda$9(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 6);
        return Unit.INSTANCE;
    }

    private static final Unit note$lambda$14$lambda$12$lambda$11(TimetableScreen timetableScreen, TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        TextView textView = text;
        text.setPadding(0, ThemeKt.dp(textView, (Number) 10), ThemeKt.dp(textView, (Number) 12), ThemeKt.dp(textView, (Number) 6));
        ControlsKt.setLeadingIcon(text, R.drawable.ic_settings, 18);
        text.setOnClickListener(new TimetableScreen$$ExternalSyntheticLambda12(timetableScreen));
        return Unit.INSTANCE;
    }

    private static final void note$lambda$14$lambda$12$lambda$11$lambda$10(TimetableScreen timetableScreen, View view) {
        MainActivity.showTab$default(timetableScreen.getHost(), 3, false, 2, null);
    }

    private static final Unit note$lambda$14$lambda$13(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.setMarginStart(ThemeKt.dp(linearLayout, (Number) 14));
        return Unit.INSTANCE;
    }

    @Override
    public void onShow(boolean z) {
        getHost().getAmbient().add(this);
        AppData data = getHost().getData();
        ThemeKt.update(this.subtitle, data.getProfile().getExamination() + " · Class " + data.getProfile().getClassName());
        String str = CollectionsKt.joinToString(data.getExams(), ", ", "", "", -1, "...", new TimetableScreen$$ExternalSyntheticLambda0()) + data.getChoices() + data.getProfile().getHall();
        boolean areEqual = Intrinsics.areEqual(str, this.builtFor);
        if (!areEqual) {
            this.builtFor = str;
            build(getHost().getSeason());
        }
        tick(getHost().getSeason());
        if ((z || !areEqual) && getHost().getPolicy().getMotion()) {
            playEntrance();
            return;
        }
        for (Row row : this.rows) {
            row.getRail().setReveal(1.0f);
        }
    }

    private static final CharSequence onShow$lambda$15(Exam it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return it.getKey();
    }

    @Override
    public void onHide() {
        getHost().getAmbient().remove(this);
    }

    @Override
    public void onDataChanged() {
        this.builtFor = "";
    }

    @Override
    public void applyInsets(int i, int i2) {
        this.content.setPadding(ThemeKt.dp(getCtx(), (Number) 20), i + ThemeKt.dp(getCtx(), (Number) 8), ThemeKt.dp(getCtx(), (Number) 20), ThemeKt.dp(getCtx(), (Number) 24));
    }

    @Override
    public long nextTickDelay(long j) {
        Long nextChange = SeasonCalculator.INSTANCE.nextChange(getHost().getData().getExams(), j);
        return nextChange != null ? RangesKt.coerceIn((nextChange.longValue() - j) + 50, 250L, (long) ModelKt.MINUTE) : ModelKt.MINUTE;
    }

    @Override
    public void onAmbientFrame(long j) {
        float f = ((float) (j % 2200)) / 2200.0f;
        for (Row row : this.rows) {
            row.getRail().setPulse(f);
        }
    }

    private final void build(Season season) {
        this.list.removeAllViews();
        this.rows.clear();
        int i = 0;
        for (Object obj : season.getExams()) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            ExamStatus examStatus = (ExamStatus) obj;
            boolean z = true;
            boolean z2 = i == 0;
            if (i != CollectionsKt.getLastIndex(season.getExams())) {
                z = false;
            }
            Row makeRow = makeRow(z2, z);
            makeRow.getView().setOnClickListener(new TimetableScreen$$ExternalSyntheticLambda13(this, examStatus.getExam().getSubject()));
            this.rows.add(makeRow);
            this.list.addView(makeRow.getView(), ThemeKt.lp$default(0, 0, 0.0f, null, 15, null));
            i = i2;
        }
    }

    private static final void build$lambda$19$lambda$18(TimetableScreen timetableScreen, Subject subject, View view) {
        timetableScreen.getHost().openChecklist(subject);
    }

    private final Row makeRow(boolean z, boolean z2) {
        TextView label = ThemeKt.label(getCtx(), "", Ui.INSTANCE.getC().getText3(), 10.5f);
        label.setGravity(17);
        TextView heading$default = ThemeKt.heading$default(getCtx(), "", 24.0f, 0, 4, null);
        heading$default.setGravity(17);
        TextView label2 = ThemeKt.label(getCtx(), "", Ui.INSTANCE.getC().getText2(), 10.5f);
        label2.setGravity(17);
        LinearLayout linearLayout = new LinearLayout(getCtx());
        linearLayout.setOrientation(1);
        linearLayout.setGravity(1);
        LinearLayout linearLayout2 = linearLayout;
        linearLayout.setPadding(0, ThemeKt.dp(linearLayout2, (Number) 8), 0, 0);
        linearLayout.addView(label);
        linearLayout.addView(heading$default, ThemeKt.lp$default(-2, -2, 0.0f, new TimetableScreen$$ExternalSyntheticLambda2(linearLayout), 4, null));
        linearLayout.addView(label2, ThemeKt.lp$default(-2, -2, 0.0f, new TimetableScreen$$ExternalSyntheticLambda3(linearLayout), 4, null));
        TimelineRailView timelineRailView = new TimelineRailView(getCtx());
        timelineRailView.setHasTop(!z);
        timelineRailView.setHasBottom(!z2);
        timelineRailView.setNodeY(ThemeKt.dp(getCtx(), (Number) 27));
        TextView text$default = ThemeKt.text$default(getCtx(), "", 17.0f, Ui.INSTANCE.getC().getText(), Fonts.INSTANCE.getSansSemibold(), null, 16, null);
        TextView statusLabel = ControlsKt.statusLabel(getCtx());
        TextView text$default2 = ThemeKt.text$default(getCtx(), "", 14.5f, Ui.INSTANCE.getC().getText2(), null, null, 24, null);
        TextView text$default3 = ThemeKt.text$default(getCtx(), "", 13.5f, Ui.INSTANCE.getC().getText3(), null, null, 24, null);
        LinearLayout linearLayout3 = new LinearLayout(getCtx());
        linearLayout3.setOrientation(1);
        LinearLayout linearLayout4 = linearLayout3;
        linearLayout3.setPadding(0, ThemeKt.dp(linearLayout4, (Number) 14), 0, ThemeKt.dp(linearLayout4, (Number) 18));
        linearLayout3.addView(text$default);
        linearLayout3.addView(text$default2, ThemeKt.lp$default(0, 0, 0.0f, new TimetableScreen$$ExternalSyntheticLambda4(linearLayout3), 7, null));
        linearLayout3.addView(text$default3, ThemeKt.lp$default(0, 0, 0.0f, new TimetableScreen$$ExternalSyntheticLambda5(linearLayout3), 7, null));
        linearLayout3.addView(statusLabel, ThemeKt.lp$default(-2, -2, 0.0f, new TimetableScreen$$ExternalSyntheticLambda6(linearLayout3), 4, null));
        LinearLayout linearLayout5 = new LinearLayout(getCtx());
        linearLayout5.setOrientation(0);
        linearLayout5.setGravity(16);
        linearLayout5.setGravity(48);
        linearLayout5.setBackground(Shapes.INSTANCE.ripple(getCtx(), null, (Number) 12));
        linearLayout5.addView(linearLayout2, ThemeKt.lp$default(ThemeKt.dp(getCtx(), (Number) 48), -2, 0.0f, null, 12, null));
        linearLayout5.addView(timelineRailView, ThemeKt.lp$default(ThemeKt.dp(getCtx(), (Number) 34), -1, 0.0f, null, 12, null));
        linearLayout5.addView(linearLayout4, ThemeKt.lp$default(0, -2, 1.0f, null, 8, null));
        return new Row(linearLayout5, timelineRailView, linearLayout3, text$default, text$default2, text$default3, statusLabel, label, heading$default, label2);
    }

    private static final Unit makeRow$lambda$25$lambda$23(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
        return Unit.INSTANCE;
    }

    private static final Unit makeRow$lambda$25$lambda$24(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
        return Unit.INSTANCE;
    }

    private static final Unit makeRow$lambda$30$lambda$27(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 4);
        return Unit.INSTANCE;
    }

    private static final Unit makeRow$lambda$30$lambda$28(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
        return Unit.INSTANCE;
    }

    private static final Unit makeRow$lambda$30$lambda$29(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 8);
        return Unit.INSTANCE;
    }

    @Override
    public void tick(Season season) {
        Intrinsics.checkNotNullParameter(season, "season");
        if (this.rows.size() != season.getExams().size()) {
            build(season);
        }
        Choices choices = getHost().getData().getChoices();
        String hall = getHost().getData().getProfile().getHall();
        int i = 0;
        for (Object obj : season.getExams()) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            ExamStatus examStatus = (ExamStatus) obj;
            Row row = this.rows.get(i);
            Intrinsics.checkNotNullExpressionValue(row, "get(...)");
            Row row2 = row;
            ExamStatus examStatus2 = (ExamStatus) CollectionsKt.getOrNull(season.getExams(), i - 1);
            String relativeDay = Formats.INSTANCE.relativeDay(examStatus.getExam().getDate(), season.getNow());
            String str = examStatus.getExam().getKey() + '|' + examStatus.getPhase() + '|' + examStatus.isToday() + '|' + examStatus.getDoneReason() + '|' + relativeDay + '|' + (examStatus2 != null ? examStatus2.getPhase() : null) + '|' + examStatus.getExam().getDurationMinutes() + '|' + choices + '|' + hall;
            if (!Intrinsics.areEqual(str, row2.getSignature())) {
                row2.setSignature(str);
                bindRow(row2, examStatus, examStatus2, relativeDay, hall);
            }
            i = i2;
        }
    }

    private final void bindRow(Row row, ExamStatus examStatus, ExamStatus examStatus2, String str, String str2) {
        Colors c = Ui.INSTANCE.getC();
        Exam exam = examStatus.getExam();
        Choices choices = getHost().getData().getChoices();
        TextView weekday = row.getWeekday();
        String upperCase = Formats.INSTANCE.weekday(exam.getDate()).toUpperCase(Locale.ROOT);
        Intrinsics.checkNotNullExpressionValue(upperCase, "toUpperCase(...)");
        ThemeKt.update(weekday, upperCase);
        ThemeKt.update(row.getDay(), String.valueOf(exam.getDate().getDayOfMonth()));
        ThemeKt.update(row.getMonth(), Formats.INSTANCE.month(exam.getDate()));
        ThemeKt.update(row.getTitle(), exam.title(choices));
        String str3 = str2;
        ThemeKt.update(row.getMeta(), Formats.INSTANCE.time(exam.getStart()) + (StringsKt.isBlank(str3) ? "" : " · Hall " + str2));
        Long confirmedEndMillis = exam.getConfirmedEndMillis();
        ThemeKt.update(row.getDuration(), confirmedEndMillis != null ? Timetable.INSTANCE.durationLabel(exam.getDurationMinutes()) + " · ends " + Formats.time$default(Formats.INSTANCE, confirmedEndMillis.longValue(), null, 2, null) : "Duration not confirmed");
        row.getRail().setTopLit((examStatus2 != null ? examStatus2.getPhase() : null) == Phase.DONE);
        row.getRail().setBottomLit(examStatus.getPhase() == Phase.DONE);
        if (examStatus.getPhase() == Phase.DONE) {
            row.getRail().setNode(TimelineRailView.Node.DONE);
            ControlsKt.styleStatus$default(row.getStatus(), "✓ ".concat((examStatus.getDoneReason() == DoneReason.DATE_PASSED || examStatus.getDoneReason() == DoneReason.NEXT_STARTED) ? "Completed" : "Finished"), c.getGreenText(), false, 4, null);
        } else if (examStatus.getPhase() == Phase.LIVE) {
            row.getRail().setNode(TimelineRailView.Node.LIVE);
            ControlsKt.styleStatus(row.getStatus(), "Exam time", c.getGold(), true);
        } else if (examStatus.isToday()) {
            row.getRail().setNode(TimelineRailView.Node.TODAY);
            ControlsKt.styleStatus$default(row.getStatus(), "Today", c.getGoldText(), false, 4, null);
        } else {
            row.getRail().setNode(TimelineRailView.Node.UPCOMING);
            ControlsKt.styleStatus$default(row.getStatus(), str, c.getText2(), false, 4, null);
        }
        row.getTitle().setTextColor(examStatus.getPhase() == Phase.DONE ? c.getText2() : c.getText());
        row.getView().setContentDescription(exam.title(choices) + ", " + Formats.INSTANCE.dateLong(exam.getDate()) + ", " + Formats.INSTANCE.time(exam.getStart()) + (StringsKt.isBlank(str3) ? "" : ", hall " + str2) + ". " + ((Object) row.getStatus().getText()) + ". " + ((Object) row.getDuration().getText()) + ". Double tap to open its revision checklist.");
        row.getRail().invalidate();
    }

    private final void playEntrance() {
        ArrayList<Row> arrayList = this.rows;
        ArrayList arrayList2 = new ArrayList(CollectionsKt.collectionSizeOrDefault(arrayList, 10));
        for (Row row : arrayList) {
            arrayList2.add(row.getView());
        }
        ScreenKt.staggerIn$default(arrayList2, true, 0L, 4, null);
        int i = 0;
        for (Object obj : this.rows) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            Row row2 = (Row) obj;
            row2.getRail().setReveal(0.0f);
            ValueAnimator ofFloat = ValueAnimator.ofFloat(0.0f, 1.0f);
            ofFloat.setStartDelay((i * 40) + 40);
            ofFloat.setDuration(420L);
            ofFloat.setInterpolator(new LinearInterpolator());
            ofFloat.addUpdateListener(new TimetableScreen$$ExternalSyntheticLambda1(row2));
            ofFloat.start();
            i = i2;
        }
    }

    private static final void playEntrance$lambda$36$lambda$35$lambda$34(Row row, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        TimelineRailView rail = row.getRail();
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        rail.setReveal(((Float) animatedValue).floatValue());
    }
}

package com.imran.examcountdown.widget;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.util.DisplayMetrics;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import com.imran.examcountdown.R;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.Elective;
import com.imran.examcountdown.core.MilLanguage;
import com.imran.examcountdown.data.AppClock;
import com.imran.examcountdown.data.Store;
import harness.Shots;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

/** Renders the home-screen widget in each state, plus the launcher / shortcut icons. */
@RunWith(RobolectricTestRunner.class)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
public class WidgetShotTest {
    static long ist(int y, int m, int d, int h, int mi) {
        return ZonedDateTime.of(y, m, d, h, mi, 0, 0, ZoneId.of("Asia/Kolkata")).toInstant().toEpochMilli();
    }

    @After
    public void tearDown() {
        AppClock.INSTANCE.setPinnedWall(null);
    }

    private void widget(String name, boolean setup, long wall, int wdp, int hdp, boolean night) throws Exception {
        Context app = RuntimeEnvironment.getApplication();
        Store st = new Store(app);
        st.resetAll();
        st.setSetupDone(setup);
        st.setChoices(new Choices(MilLanguage.BENGALI, Elective.COMPUTER_SCIENCE));
        AppClock.INSTANCE.setPinnedWall(wall);
        RemoteViews rv = CountdownWidget.build(app);
        FrameLayout parent = new FrameLayout(app);
        View v = rv.apply(app, parent);
        DisplayMetrics dm = app.getResources().getDisplayMetrics();
        int w = Math.round(wdp * dm.density), h = Math.round(hdp * dm.density);
        v.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
        v.layout(0, 0, w, h);
        Bitmap bmp = Bitmap.createBitmap(w + 40, h + 40, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        c.drawColor(night ? Color.parseColor("#1B1B1B") : Color.parseColor("#C9D6CE"));
        c.translate(20, 20);
        v.draw(c);
        Shots.save(bmp, name);
    }

    @Test
    public void widgetStates() throws Exception {
        widget("widget_1_days", true, ist(2026, 9, 29, 10, 0), 300, 130, false);
        widget("widget_2_last_day", true, ist(2026, 9, 30, 5, 0), 300, 130, false);
        widget("widget_3_live", true, ist(2026, 9, 30, 13, 15), 300, 130, false);
        widget("widget_4_done", true, ist(2026, 10, 14, 9, 0), 300, 130, false);
        widget("widget_5_setup", false, ist(2026, 9, 29, 10, 0), 300, 130, false);
        widget("widget_6_small", true, ist(2026, 9, 29, 10, 0), 150, 150, false);
        widget("widget_7_night", true, ist(2026, 10, 2, 10, 0), 300, 130, true);
    }

    @Test
    public void icons() throws Exception {
        Context app = RuntimeEnvironment.getApplication();
        int[] ids = {R.mipmap.ic_launcher, R.mipmap.ic_launcher_round, R.drawable.ic_shortcut_study, R.drawable.ic_shortcut_timetable};
        int size = 432;
        Bitmap bmp = Bitmap.createBitmap(size * ids.length + 20 * (ids.length + 1), size + 40, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        c.drawColor(Color.parseColor("#E9E4D6"));
        for (int i = 0; i < ids.length; i++) {
            Drawable d = app.getDrawable(ids[i]).mutate();
            int x = 20 + i * (size + 20);
            d.setBounds(x, 20, x + size, 20 + size);
            d.draw(c);
        }
        Shots.save(bmp, "icons");
    }
}

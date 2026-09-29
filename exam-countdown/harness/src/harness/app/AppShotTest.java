package harness.app;

import static org.junit.Assert.assertNotNull;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import com.imran.examcountdown.ExamCountdownApp;
import com.imran.examcountdown.MainActivity;
import com.imran.examcountdown.core.Choices;
import com.imran.examcountdown.core.Elective;
import com.imran.examcountdown.core.MilLanguage;
import com.imran.examcountdown.data.AppClock;
import com.imran.examcountdown.data.Store;
import harness.Shots;
import harness.Views;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;

/** Launches the real MainActivity in the important states and writes screenshots to build/shots. */
@RunWith(RobolectricTestRunner.class)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
public class AppShotTest {
    static long ist(int y, int m, int d, int h, int mi) {
        return ZonedDateTime.of(y, m, d, h, mi, 0, 0, ZoneId.of("Asia/Kolkata")).toInstant().toEpochMilli();
    }

    @After
    public void tearDown() {
        AppClock.INSTANCE.setPinnedWall(null);
    }

    /** setupDone=false shows the setup flow; wall==0 uses the real clock. */
    private ActivityController<MainActivity> launch(boolean setupDone, long wall, boolean intro, Intent intent) {
        Context app = RuntimeEnvironment.getApplication();
        Store st = new Store(app);
        st.resetAll();
        st.setSetupDone(setupDone);
        st.setIntroEnabled(intro);
        st.setChoices(new Choices(MilLanguage.BENGALI, Elective.COMPUTER_SCIENCE));
        AppClock.INSTANCE.setPinnedWall(wall == 0 ? null : Long.valueOf(wall));
        ExamCountdownApp.Companion.setIntroHandled(!intro);
        ActivityController<MainActivity> c = intent == null
                ? Robolectric.buildActivity(MainActivity.class)
                : Robolectric.buildActivity(MainActivity.class, intent);
        c.setup();
        Views.settle(1500);
        return c;
    }

    private void snap(ActivityController<MainActivity> c, String name) throws Exception {
        Views.settle(600);
        Shots.shot(c.get(), name);
    }

    private ActivityController<MainActivity> tab(ActivityController<MainActivity> c, int i, String name) throws Exception {
        c.get().showTab(i, false);
        Views.settle(1200);
        snap(c, name);
        return c;
    }

    @Test
    public void a_firstRun() throws Exception {
        ActivityController<MainActivity> c = launch(false, ist(2026, 9, 29, 10, 0), true, null);
        snap(c, "app_01_first_run");
        assertNotNull(c.get());
    }

    @Test
    public void b_homeCountdown() throws Exception {
        ActivityController<MainActivity> c = launch(true, ist(2026, 9, 29, 10, 0), false, null);
        snap(c, "app_02_home_countdown");
        tab(c, 1, "app_03_timetable");
        tab(c, 2, "app_04_study");
        tab(c, 3, "app_05_settings");
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    public void c_homeCountdownNight() throws Exception {
        ActivityController<MainActivity> c = launch(true, ist(2026, 9, 29, 10, 0), false, null);
        snap(c, "app_06_home_night");
        tab(c, 1, "app_07_timetable_night");
        tab(c, 2, "app_08_study_night");
        tab(c, 3, "app_09_settings_night");
    }

    @Test
    public void d_examLive() throws Exception {
        ActivityController<MainActivity> c = launch(true, ist(2026, 9, 30, 13, 15), false, null);
        snap(c, "app_10_home_live");
    }

    @Test
    public void e_seasonOver() throws Exception {
        ActivityController<MainActivity> c = launch(true, ist(2026, 10, 14, 9, 0), false, null);
        snap(c, "app_11_home_celebrate");
    }

    @Test
    public void f_introRuns() throws Exception {
        ActivityController<MainActivity> c = launch(true, ist(2026, 9, 29, 10, 0), true, null);
        snap(c, "app_12_after_intro");
    }
}

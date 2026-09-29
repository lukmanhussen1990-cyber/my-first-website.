package harness.sandbox;

import static org.junit.Assert.assertNotNull;

import android.app.Activity;
import android.view.View;
import harness.Shots;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;

/** Proves the harness end to end on a tiny app: layout, gradients, blur mask, custom fonts, night mode. */
@RunWith(RobolectricTestRunner.class)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
public class SandboxShotTest {
    private void render(String name) throws Exception {
        ActivityController<SandboxActivity> c = Robolectric.buildActivity(SandboxActivity.class).setup();
        Activity a = c.get();
        View decor = a.getWindow().getDecorView();
        assertNotNull(decor);
        Shots.shot(a, name);
    }

    @Test
    public void light() throws Exception {
        render("sandbox_light");
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    public void night() throws Exception {
        render("sandbox_night");
    }

    @Test
    @Config(qualifiers = "w360dp-h640dp-xhdpi")
    public void smallPhone() throws Exception {
        render("sandbox_small");
    }

    /** Robolectric's ActivityController.setup() runs the clock past every animator started in onCreate: end states render. */
    @Test
    public void animation() throws Exception {
        ActivityController<SandboxActivity> c = Robolectric.buildActivity(SandboxActivity.class).setup();
        Activity a = c.get();
        Shots.shot(a, "sandbox_anim_t0");
        float x0 = ((SandboxActivity) a).animated.getTranslationX();
        org.robolectric.shadows.ShadowLooper.idleMainLooper(1000, java.util.concurrent.TimeUnit.MILLISECONDS);
        float x1 = ((SandboxActivity) a).animated.getTranslationX();
        System.out.println("translationX before=" + x0 + " after=" + x1 + " alpha=" + ((SandboxActivity) a).animated.getAlpha());
        Shots.shot(a, "sandbox_anim_t1000");
        org.junit.Assert.assertEquals(400f, x1, 0.5f);
    }
}

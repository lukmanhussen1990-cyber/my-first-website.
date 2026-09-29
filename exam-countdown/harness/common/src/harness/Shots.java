package harness;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/** Helpers to lay out a window and write it to a PNG. */
public final class Shots {
    private Shots() {}

    public static File outDir() {
        String d = System.getProperty("harness.shots.dir", "build/shots");
        File f = new File(d);
        f.mkdirs();
        return f;
    }

    /** Draws {@code v} at its current size into an ARGB bitmap. */
    public static Bitmap draw(View v) {
        int w = Math.max(1, v.getWidth()), h = Math.max(1, v.getHeight());
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        v.draw(c);
        return bmp;
    }

    public static File save(Bitmap bmp, String name) throws IOException {
        File out = new File(outDir(), name + ".png");
        try (FileOutputStream fos = new FileOutputStream(out)) {
            if (!bmp.compress(Bitmap.CompressFormat.PNG, 100, fos)) {
                throw new IOException("Bitmap.compress returned false for " + out);
            }
        }
        System.out.println("[shot] " + out.getAbsolutePath() + " " + bmp.getWidth() + "x" + bmp.getHeight());
        return out;
    }

    public static File shot(Activity a, String name) throws IOException {
        return save(draw(a.getWindow().getDecorView()), name);
    }
}

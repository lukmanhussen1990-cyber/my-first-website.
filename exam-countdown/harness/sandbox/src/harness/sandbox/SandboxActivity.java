package harness.sandbox;

import android.app.Activity;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

public class SandboxActivity extends Activity {
    public View animated;
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(24, 48, 24, 24);

        TextView title = new TextView(this);
        title.setText(R.string.hello);
        title.setTextSize(22);
        title.setTextColor(getColor(R.color.ink));
        Typeface sans = null;
        try { sans = getResources().getFont(R.font.sans_regular); } catch (Throwable t) { t.printStackTrace(); }
        if (sans != null) title.setTypeface(sans);
        root.addView(title);

        TextView sysFont = new TextView(this);
        sysFont.setText("System font (default): The quick brown fox jumps over the lazy dog");
        sysFont.setTextSize(15);
        sysFont.setTextColor(getColor(R.color.ink));
        root.addView(sysFont);

        TextView bold = new TextView(this);
        bold.setText("Bold + italic default");
        bold.setTextSize(15);
        bold.setTypeface(Typeface.DEFAULT_BOLD);
        bold.setTextColor(getColor(R.color.ink));
        root.addView(bold);

        GradientView gv = new GradientView(this);
        try { gv.serif = getResources().getFont(R.font.serif_italic); } catch (Throwable t) { t.printStackTrace(); }
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, 0, 1f);
        root.addView(gv, lp);

        // vector drawable + tint
        android.widget.ImageView iv = new android.widget.ImageView(this);
        iv.setImageResource(R.drawable.ic_star);
        root.addView(iv, new LinearLayout.LayoutParams(-2, -2));

        // RenderEffect blur (Blur.java in the real app does this)
        View blurred = new View(this);
        android.graphics.drawable.GradientDrawable gd = new android.graphics.drawable.GradientDrawable();
        gd.setColor(0xFFDC2626); gd.setCornerRadius(40);
        blurred.setBackground(gd);
        blurred.setRenderEffect(android.graphics.RenderEffect.createBlurEffect(24f, 24f, android.graphics.Shader.TileMode.DECAL));
        root.addView(blurred, new LinearLayout.LayoutParams(300, 120));

        // animated view: slides right over 500ms
        animated = new View(this);
        animated.setBackgroundColor(0xFF2563EB);
        root.addView(animated, new LinearLayout.LayoutParams(120, 60));
        animated.animate().translationX(400f).setDuration(500).start();
        android.animation.ObjectAnimator oa = android.animation.ObjectAnimator.ofFloat(animated, View.ALPHA, 0.2f, 1f);
        oa.setDuration(500); oa.start();

        setContentView(root);
    }
}

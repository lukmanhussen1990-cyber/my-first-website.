package com.loe.chat

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.PorterDuff
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.Drawable
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Renders the launcher, splash and notification icons with Android's own drawables, to app/build/screenshots/icons. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "xxhdpi")
class IconRenderTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private val outDir = File("build/screenshots/icons").apply { mkdirs() }

    private fun render(name: String, drawable: Drawable, size: Int, background: Int = Color.TRANSPARENT): Bitmap {
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(background)
        drawable.setBounds(0, 0, size, size)
        drawable.draw(canvas)
        File(outDir, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        return bitmap
    }

    private fun opaquePixels(bitmap: Bitmap): Int {
        var count = 0
        for (y in 0 until bitmap.height step 4) for (x in 0 until bitmap.width step 4) {
            if (Color.alpha(bitmap.getPixel(x, y)) > 200) count++
        }
        return count
    }

    @Test
    fun launcherIcon() {
        val icon = context.getDrawable(R.mipmap.ic_launcher) as AdaptiveIconDrawable
        val bitmap = render("launcher", icon, 432)
        assertTrue(opaquePixels(bitmap) > 5000)
        render("launcher_background", icon.background, 432)
        render("launcher_foreground", icon.foreground, 432)
        val mono = icon.monochrome!!.mutate().apply { setTint(Color.parseColor("#3F2B96")) }
        render("launcher_themed", mono, 432, Color.parseColor("#E4DDFF"))
    }

    @Test
    fun splashAndSmallIcons() {
        render("splash", context.getDrawable(R.drawable.splash_icon)!!, 576, Color.WHITE)
        val notification = context.getDrawable(R.drawable.ic_notification)!!.mutate().apply { setTintMode(PorterDuff.Mode.SRC_IN) }
        render("notification", notification, 96, Color.parseColor("#202124"))
        render("loe_icon", context.getDrawable(R.drawable.loe_icon)!!, 288)
        render("loe_mark", context.getDrawable(R.drawable.loe_mark)!!, 288, Color.WHITE)
    }
}

package com.imran.examcountdown

import android.app.Activity
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import com.imran.examcountdown.core.Timetable
import org.junit.Assert.fail
import org.robolectric.Shadows.shadowOf
import java.time.Duration
import java.time.LocalDateTime

/** Epoch millis for a wall-clock time in India. */
fun ist(year: Int, month: Int, day: Int, hour: Int, minute: Int, second: Int = 0): Long =
    LocalDateTime.of(year, month, day, hour, minute, second).atZone(Timetable.ZONE).toInstant().toEpochMilli()

fun idle(millis: Long = 0) {
    val looper = shadowOf(Looper.getMainLooper())
    if (millis > 0) looper.idleFor(Duration.ofMillis(millis)) else looper.idle()
}

fun View.allViews(): List<View> {
    val out = ArrayList<View>()
    fun walk(v: View) {
        out += v
        if (v is ViewGroup) for (i in 0 until v.childCount) walk(v.getChildAt(i))
    }
    walk(this)
    return out
}

fun Activity.root(): View = window.decorView

/** Visible text views whose text matches exactly. */
fun Activity.findText(text: String): List<TextView> =
    root().allViews().filterIsInstance<TextView>().filter { it.isShown && it.text.toString() == text }

fun Activity.hasText(text: String): Boolean = findText(text).isNotEmpty()

fun Activity.hasTextContaining(part: String): Boolean =
    root().allViews().filterIsInstance<TextView>().any { it.isShown && it.text.toString().contains(part) }

fun Activity.visibleTexts(): List<String> =
    root().allViews().filterIsInstance<TextView>().filter { it.isShown }.map { it.text.toString() }

/** Clicks the nearest clickable view around the text. */
fun Activity.click(text: String) {
    val view = findText(text).firstOrNull() ?: fail("No visible text “$text”. Visible: ${visibleTexts()}") as Nothing
    var v: View? = view
    while (v != null && !v.isClickable) v = v.parent as? View
    (v ?: fail("“$text” has no clickable ancestor") as Nothing).performClick()
    idle()
}

/** Simulates status and navigation bars (Android 11+ API), in dp. */
fun Activity.applySystemBars(topDp: Int, bottomDp: Int) {
    val d = resources.displayMetrics.density
    val insets = android.view.WindowInsets.Builder()
        .setInsets(
            android.view.WindowInsets.Type.systemBars(),
            android.graphics.Insets.of(0, (topDp * d).toInt(), 0, (bottomDp * d).toInt()),
        )
        .build()
    appRoot().dispatchApplyWindowInsets(insets)
    idle(50)
}

/** The app's root layout (the FrameLayout passed to setContentView). */
fun Activity.appRoot(): ViewGroup = findViewById<ViewGroup>(android.R.id.content)!!.getChildAt(0) as ViewGroup

fun View.windowRect(): android.graphics.Rect {
    val loc = IntArray(2)
    getLocationInWindow(loc)
    return android.graphics.Rect(loc[0], loc[1], loc[0] + width, loc[1] + height)
}

package com.runova.preview

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.PaintingStyle
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.platform.Font
import androidx.compose.ui.unit.Density
import com.runova.app.ui.components.LocalTileProvider
import com.runova.app.ui.components.TileProvider
import com.runova.app.ui.theme.RunovaFonts
import com.runova.app.ui.theme.RunovaTheme
import com.runova.core.geo.GeoMath
import com.runova.core.geo.LatLng
import kotlinx.coroutines.Dispatchers
import org.jetbrains.skia.EncodedImageFormat
import java.io.File
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

fun loadFonts(dir: File): RunovaFonts {
    fun f(name: String, w: FontWeight) = Font(File(dir, name), w)
    val text = FontFamily(
        f("barlow_regular.ttf", FontWeight.Normal),
        f("barlow_medium.ttf", FontWeight.Medium),
        f("barlow_semibold.ttf", FontWeight.SemiBold),
        f("barlow_bold.ttf", FontWeight.Bold),
        f("barlow_extrabold.ttf", FontWeight.ExtraBold),
    )
    val numbers = FontFamily(
        f("barlow_semicondensed_medium.ttf", FontWeight.Medium),
        f("barlow_semicondensed_semibold.ttf", FontWeight.SemiBold),
        f("barlow_semicondensed_bold.ttf", FontWeight.Bold),
    )
    val condensed = FontFamily(
        f("barlow_condensed_semibold.ttf", FontWeight.SemiBold),
        f("barlow_condensed_bold.ttf", FontWeight.Bold),
    )
    return RunovaFonts(text, numbers, condensed)
}

/**
 * Stand-in for the real network tile provider: paints dark, map-like tiles (streets, blocks,
 * water) so route styling can be judged in previews. Only used by this dev tool.
 */
class FakeTileProvider(private val dark: Boolean = true) : TileProvider {
    private val cache = HashMap<String, ImageBitmap>()
    override val version: State<Int> = mutableStateOf(0)
    override val attribution: String = "© OpenStreetMap contributors"

    override fun cachedTile(z: Int, x: Int, y: Int): ImageBitmap? = tile(z, x, y)

    override fun tile(z: Int, x: Int, y: Int): ImageBitmap? = cache.getOrPut("$z/$x/$y") {
        val size = 512
        val img = ImageBitmap(size, size)
        val canvas = Canvas(img)
        val paint = Paint()
        val rnd = Random(z * 1_000_003 + x * 7919 + y * 104729)
        val base = if (dark) Color(0xFF151E23) else Color(0xFFE9EEEB)
        paint.color = base
        canvas.drawRect(0f, 0f, size.toFloat(), size.toFloat(), paint)
        // blocks
        paint.color = if (dark) Color(0xFF19242A) else Color(0xFFDDE4E0)
        repeat(14) {
            val bx = rnd.nextFloat() * size
            val by = rnd.nextFloat() * size
            canvas.drawRect(bx, by, bx + 30 + rnd.nextFloat() * 70, by + 30 + rnd.nextFloat() * 70, paint)
        }
        // water
        if (rnd.nextFloat() < 0.25f) {
            paint.color = if (dark) Color(0xFF112637) else Color(0xFFB9D6EA)
            canvas.drawCircle(Offset(rnd.nextFloat() * size, rnd.nextFloat() * size), 60f + rnd.nextFloat() * 90f, paint)
        }
        // streets
        paint.style = PaintingStyle.Stroke
        paint.strokeCap = StrokeCap.Round
        repeat(9) { i ->
            val major = i < 2
            paint.color = if (dark) (if (major) Color(0xFF34424A) else Color(0xFF26323A)) else (if (major) Color.White else Color(0xFFF8FAF9))
            paint.strokeWidth = if (major) 7f else 3.5f
            val a = rnd.nextFloat() * PI.toFloat()
            val cx = rnd.nextFloat() * size
            val cy = rnd.nextFloat() * size
            val len = size * 1.5f
            canvas.drawLine(
                Offset(cx - cos(a) * len, cy - sin(a) * len),
                Offset(cx + cos(a) * len, cy + sin(a) * len),
                paint,
            )
        }
        img
    }
}

fun writePng(image: org.jetbrains.skia.Image, file: File) {
    file.parentFile.mkdirs()
    file.writeBytes(image.encodeToData(EncodedImageFormat.PNG)!!.bytes)
}

/** Renders [content] for [seconds] of simulated time so entrance animations settle. */
fun renderScreen(
    out: File,
    name: String,
    fonts: RunovaFonts,
    dark: Boolean = true,
    width: Int = 1080,
    height: Int = 2340,
    seconds: Float = 2.6f,
    content: @Composable () -> Unit,
) {
    val scene = ImageComposeScene(width, height, Density(3f), coroutineContext = Dispatchers.Unconfined) {
        RunovaTheme(dark = dark, fonts = fonts) {
            CompositionLocalProvider(LocalTileProvider provides FakeTileProvider(dark)) {
                content()
            }
        }
    }
    val frameNs = 16_666_667L
    val frames = (seconds * 60).toInt()
    var image = scene.render(0)
    for (i in 1..frames) image = scene.render(i * frameNs)
    writePng(image, File(out, "$name.png"))
    scene.close()
    println("rendered $name")
}

/** A blobby loop similar to a real park run, ~5 km. */
fun demoLoop(center: LatLng = LatLng(52.5145, 13.3501), radiusM: Double = 800.0, points: Int = 420, seed: Int = 3): List<LatLng> {
    val rnd = Random(seed)
    val k = DoubleArray(4) { rnd.nextDouble() * 0.25 }
    val ph = DoubleArray(4) { rnd.nextDouble() * 2 * PI }
    return (0..points).map { i ->
        val a = i.toDouble() / points * 2 * PI
        val r = radiusM * (1 + k[0] * sin(2 * a + ph[0]) + k[1] * sin(3 * a + ph[1]) + k[2] * sin(5 * a + ph[2]) + k[3] * 0.4 * sin(9 * a + ph[3]))
        GeoMath.offset(center, r, Math.toDegrees(a))
    }
}

/** An out-and-back style line route. */
fun demoLine(start: LatLng = LatLng(52.5089, 13.3762), lengthM: Double = 3200.0, points: Int = 300, seed: Int = 9): List<LatLng> {
    val rnd = Random(seed)
    var p = start
    var bearing = 55.0
    val out = ArrayList<LatLng>()
    out.add(p)
    repeat(points) {
        bearing += (rnd.nextDouble() - 0.5) * 18
        p = GeoMath.offset(p, lengthM / points, bearing)
        out.add(p)
    }
    return out
}

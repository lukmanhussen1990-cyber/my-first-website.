package com.runova.app.map

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.os.Handler
import android.os.Looper
import android.util.LruCache
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.runova.app.BuildConfig
import com.runova.app.ui.components.TileProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/**
 * OpenStreetMap's standard map tiles, cached in memory and on disk so routes you have already
 * viewed also show offline. The dark style is drawn from the same tiles on the device.
 *
 * Follows the OSM tile usage policy: an identifying User-Agent, a long-lived local cache, no
 * prefetching and at most two downloads at a time.
 */
class OsmTileProvider(context: Context, private val style: Style, private val scope: CoroutineScope) : TileProvider {

    enum class Style { DARK, LIGHT }

    private val dir = File(context.cacheDir, "tiles/osm")
    private val main = Handler(Looper.getMainLooper())
    private val versionState = mutableIntStateOf(0)
    private val inFlight: MutableSet<String> = ConcurrentHashMap.newKeySet()
    private val failedAt = ConcurrentHashMap<String, Long>()

    private val memory = object : LruCache<String, ImageBitmap>(cacheBytes()) {
        override fun sizeOf(key: String, value: ImageBitmap): Int = value.width * value.height * 2
    }

    override val version: State<Int> get() = versionState
    override val attribution: String = "© OpenStreetMap contributors"
    override val maxZoom: Int = 19
    override val tileSizePx: Int = 256

    override fun cachedTile(z: Int, x: Int, y: Int): ImageBitmap? = memory.get(key(z, x, y))

    override fun tile(z: Int, x: Int, y: Int): ImageBitmap? {
        val key = key(z, x, y)
        memory.get(key)?.let { return it }
        val failed = failedAt[key]
        if (failed != null && System.currentTimeMillis() - failed < RETRY_MS) return null
        if (inFlight.add(key)) {
            scope.launch(network) {
                try {
                    val bitmap = load(z, x, y)
                    if (bitmap != null) {
                        memory.put(key, bitmap)
                        failedAt.remove(key)
                        main.post { versionState.intValue++ }
                    } else {
                        failedAt[key] = System.currentTimeMillis()
                    }
                } finally {
                    inFlight.remove(key)
                }
            }
        }
        return null
    }

    private fun key(z: Int, x: Int, y: Int) = "$z/$x/$y"

    private fun load(z: Int, x: Int, y: Int): ImageBitmap? {
        val n = 1 shl z
        if (z < 0 || x !in 0 until n || y !in 0 until n) return null
        val file = File(dir, "$z/$x/$y.png")
        val fresh = file.exists() && System.currentTimeMillis() - file.lastModified() < MAX_AGE_MS
        val bytes = when {
            fresh -> file.readBytes()
            else -> download(z, x, y)?.also { save(file, it) }
                ?: file.takeIf { it.exists() }?.readBytes() // stale copy beats no map offline
        } ?: return null
        val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
        val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options) ?: return null
        return recolor(decoded).asImageBitmap()
    }

    /** The light tiles as they are, or redrawn through [DARK] for the dark map. Either way RGB_565 to halve memory. */
    private fun recolor(src: Bitmap): Bitmap {
        val out = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.RGB_565)
        val paint = Paint().apply { if (style == Style.DARK) colorFilter = ColorMatrixColorFilter(DARK) }
        Canvas(out).drawBitmap(src, 0f, 0f, paint)
        src.recycle()
        return out
    }

    private fun download(z: Int, x: Int, y: Int): ByteArray? {
        val conn = URL("https://tile.openstreetmap.org/$z/$x/$y.png").openConnection() as HttpURLConnection
        return try {
            conn.connectTimeout = 10_000
            conn.readTimeout = 15_000
            conn.setRequestProperty("User-Agent", USER_AGENT)
            if (conn.responseCode != HttpURLConnection.HTTP_OK) null else conn.inputStream.use { it.readBytes() }
        } catch (e: IOException) {
            null
        } finally {
            conn.disconnect()
        }
    }

    private fun save(file: File, bytes: ByteArray) {
        try {
            file.parentFile?.mkdirs()
            // Unique temp name: the dark and light providers share this cache.
            val tmp = File.createTempFile("tile", ".tmp", file.parentFile)
            tmp.writeBytes(bytes)
            if (!tmp.renameTo(file)) tmp.delete()
        } catch (e: IOException) {
            // Cache is best effort.
        }
    }

    private companion object {
        const val RETRY_MS = 20_000L
        const val MAX_AGE_MS = 30L * 24 * 60 * 60 * 1000
        val USER_AGENT = "RUNOVA/${BuildConfig.VERSION_NAME} (Android running app)"

        /** Shared by both styles, so the two never exceed the policy's two connections. */
        val network = Dispatchers.IO.limitedParallelism(2)

        /**
         * Light OSM colours to the app's dark map: invert, rotate hues back by 180° (so water stays
         * blue and parks green), mute, then darken towards the map background. Land ends up close
         * to #161D1F, water #223A43, parks #092517 and label text #A9B1B5.
         */
        val DARK = ColorMatrix(floatArrayOf(-1f, 0f, 0f, 0f, 255f, 0f, -1f, 0f, 0f, 255f, 0f, 0f, -1f, 0f, 255f, 0f, 0f, 0f, 1f, 0f)).apply {
            postConcat(
                ColorMatrix(
                    floatArrayOf(
                        -0.574f, 1.430f, 0.144f, 0f, 0f,
                        0.426f, 0.430f, 0.144f, 0f, 0f,
                        0.426f, 1.430f, -0.856f, 0f, 0f,
                        0f, 0f, 0f, 1f, 0f,
                    ),
                ),
            )
            postConcat(ColorMatrix().apply { setSaturation(0.55f) })
            postConcat(ColorMatrix(floatArrayOf(0.72f, 0f, 0f, 0f, 10f, 0f, 0.72f, 0f, 0f, 18f, 0f, 0f, 0.72f, 0f, 22f, 0f, 0f, 0f, 1f, 0f)))
        }

        fun cacheBytes(): Int = (Runtime.getRuntime().maxMemory() / 8).coerceAtMost(48L * 1024 * 1024).toInt()
    }
}

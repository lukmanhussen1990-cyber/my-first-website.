package com.runova.app.map

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
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
 * Map tiles from CARTO's basemaps (OpenStreetMap data), cached in memory and on disk so routes
 * you have already viewed also show offline.
 */
class CartoTileProvider(context: Context, private val style: Style, private val scope: CoroutineScope) : TileProvider {

    enum class Style(val path: String) { DARK("dark_all"), LIGHT("light_all") }

    private val dir = File(context.cacheDir, "tiles/${style.path}")
    private val main = Handler(Looper.getMainLooper())
    private val versionState = mutableIntStateOf(0)
    private val inFlight: MutableSet<String> = ConcurrentHashMap.newKeySet()
    private val failedAt = ConcurrentHashMap<String, Long>()
    private val network = Dispatchers.IO.limitedParallelism(4)

    private val memory = object : LruCache<String, ImageBitmap>(cacheBytes()) {
        override fun sizeOf(key: String, value: ImageBitmap): Int = value.width * value.height * 2
    }

    override val version: State<Int> get() = versionState
    override val attribution: String = "© OpenStreetMap contributors © CARTO"
    override val maxZoom: Int = 19

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
        val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.RGB_565 }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)?.asImageBitmap()
    }

    private fun download(z: Int, x: Int, y: Int): ByteArray? {
        val sub = "abcd"[(x + y).mod(4)]
        val url = URL("https://$sub.basemaps.cartocdn.com/${style.path}/$z/$x/$y@2x.png")
        val conn = url.openConnection() as HttpURLConnection
        return try {
            conn.connectTimeout = 10_000
            conn.readTimeout = 15_000
            conn.setRequestProperty("User-Agent", "RUNOVA/${BuildConfig.VERSION_NAME} (Android)")
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
            val tmp = File(file.path + ".tmp")
            tmp.writeBytes(bytes)
            tmp.renameTo(file)
        } catch (e: IOException) {
            // Cache is best effort.
        }
    }

    private companion object {
        const val RETRY_MS = 20_000L
        const val MAX_AGE_MS = 30L * 24 * 60 * 60 * 1000

        fun cacheBytes(): Int = (Runtime.getRuntime().maxMemory() / 8).coerceAtMost(48L * 1024 * 1024).toInt()
    }
}

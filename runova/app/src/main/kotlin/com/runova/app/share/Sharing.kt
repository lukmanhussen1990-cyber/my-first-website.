package com.runova.app.share

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.media.ExifInterface
import android.net.Uri
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import com.runova.app.R
import com.runova.app.data.AppRepository
import com.runova.core.export.Gpx
import com.runova.core.format.Fmt
import com.runova.core.geo.LatLng
import com.runova.core.geo.Mercator
import com.runova.core.model.RunRecord
import com.runova.core.model.UnitSystem
import com.runova.core.tracking.TrackPoint
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.math.max
import kotlin.math.min

/** Share sheets for run cards, GPX files and plain text, served through the app's FileProvider. */
object Sharing {
    private fun dir(context: Context) = File(context.cacheDir, "shared").apply { mkdirs() }

    private fun uri(context: Context, file: File): Uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)

    private fun chooser(send: Intent, uri: Uri?, title: String): Intent {
        if (uri != null) {
            send.putExtra(Intent.EXTRA_STREAM, uri)
            send.clipData = ClipData.newRawUri("", uri)
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        return Intent.createChooser(send, title)
    }

    fun summaryText(run: RunRecord, units: UnitSystem): String =
        "${run.title ?: "Run"}: ${Fmt.distance(run.distanceM, units)} in ${Fmt.durationCompact(run.movingTimeMs)} " +
            "(${Fmt.pace(run.avgPaceSecPerKm, units)} ${Fmt.paceUnit(units)}) with RUNOVA 🏃 #RunBurnLevelUp"

    fun runCard(context: Context, run: RunRecord, route: List<List<LatLng>>, units: UnitSystem, dateText: String): Intent {
        val file = File(dir(context), "runova-run-${run.id}.png")
        val bitmap = ShareCard.render(context, run, route, units, dateText)
        FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
        val send = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_TEXT, summaryText(run, units))
        return chooser(send, uri(context, file), "Share your run")
    }

    fun gpx(context: Context, run: RunRecord, points: List<TrackPoint>): Intent {
        val file = File(dir(context), fileName(run) + ".gpx")
        file.writeText(Gpx.build(run.title ?: "RUNOVA run", points))
        val send = Intent(Intent.ACTION_SEND).setType("application/gpx+xml").putExtra(Intent.EXTRA_SUBJECT, file.name)
        return chooser(send, uri(context, file), "Export GPX")
    }

    /** All runs as one zip of GPX files. */
    fun allGpx(context: Context, runs: List<Pair<RunRecord, List<TrackPoint>>>): Intent {
        val file = File(dir(context), "runova-runs.zip")
        ZipOutputStream(FileOutputStream(file)).use { zip ->
            val used = HashSet<String>()
            for ((run, points) in runs) {
                if (points.isEmpty()) continue
                var name = fileName(run)
                var n = 2
                while (!used.add(name)) name = fileName(run) + "-" + n++
                zip.putNextEntry(ZipEntry("$name.gpx"))
                zip.write(Gpx.build(run.title ?: "RUNOVA run", points).toByteArray(Charsets.UTF_8))
                zip.closeEntry()
            }
        }
        val send = Intent(Intent.ACTION_SEND).setType("application/zip").putExtra(Intent.EXTRA_SUBJECT, "RUNOVA runs (GPX)")
        return chooser(send, uri(context, file), "Export all runs")
    }

    fun text(text: String, title: String = "Share"): Intent =
        chooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), null, title)

    private fun fileName(run: RunRecord): String {
        val d = java.time.Instant.ofEpochMilli(run.startTimeMs).atZone(java.time.ZoneId.systemDefault())
        return String.format(java.util.Locale.US, "runova-%04d%02d%02d-%02d%02d", d.year, d.monthValue, d.dayOfMonth, d.hour, d.minute)
    }
}

/** Renders the 1080×1350 run card that is shared as an image. */
private object ShareCard {
    private const val W = 1080
    private const val H = 1350
    private const val LIME = 0xFFCBFB4E.toInt()
    private const val LIME_DEEP = 0xFF78D11B.toInt()
    private const val GREY = 0xFF8D989F.toInt()

    fun render(context: Context, run: RunRecord, route: List<List<LatLng>>, units: UnitSystem, dateText: String): Bitmap {
        val bold = font(context, R.font.barlow_bold)
        val condensed = font(context, R.font.barlow_condensed_bold)
        val medium = font(context, R.font.barlow_medium)
        val bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)

        p.shader = LinearGradient(0f, 0f, 0f, H.toFloat(), 0xFF0E1A1F.toInt(), 0xFF060B0E.toInt(), Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, W.toFloat(), H.toFloat(), p)
        p.shader = RadialGradient(W * 0.5f, 520f, 520f, 0x33CBFB4E, 0x00CBFB4E, Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, W.toFloat(), H.toFloat(), p)
        p.shader = null

        text(c, "RUNOVA", 72f, 120f, bold, 54f, LIME, letterSpacing = 0.08f)
        text(c, run.title ?: "Run", 72f, 196f, bold, 44f, 0xFFFFFFFF.toInt())
        text(c, dateText, 72f, 248f, medium, 32f, GREY)

        drawRoute(c, route, RectF(90f, 300f, W - 90f, 820f))

        val distance = Fmt.distanceValue(run.distanceM, units)
        val unit = Fmt.distanceUnit(units)
        val big = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = condensed; textSize = 230f; color = 0xFFFFFFFF.toInt() }
        c.drawText(distance, 72f, 1070f, big)
        text(c, unit, 72f + big.measureText(distance) + 20f, 1070f, bold, 64f, LIME)

        val cols = listOf(
            "Time" to Fmt.durationCompact(run.movingTimeMs),
            "Avg Pace" to "${Fmt.pace(run.avgPaceSecPerKm, units)}${Fmt.paceUnit(units)}",
            "Calories*" to "${Fmt.calories(run.calories)} kcal",
        )
        val colW = (W - 144f) / 3
        cols.forEachIndexed { i, (label, value) ->
            val x = 72f + i * colW
            text(c, label, x, 1150f, medium, 32f, GREY)
            text(c, value, x, 1212f, bold, 50f, 0xFFFFFFFF.toInt())
        }
        text(c, "Run. Burn. Level Up.", 72f, 1296f, bold, 34f, LIME)
        text(c, "*estimated", W - 72f - measure("*estimated", medium, 26f), 1296f, medium, 26f, GREY)
        return bmp
    }

    private fun font(context: Context, id: Int): Typeface = try {
        ResourcesCompat.getFont(context, id) ?: Typeface.DEFAULT_BOLD
    } catch (e: Exception) {
        Typeface.DEFAULT_BOLD
    }

    private fun measure(s: String, tf: Typeface, size: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = tf; textSize = size }.measureText(s)

    private fun text(c: Canvas, s: String, x: Float, y: Float, tf: Typeface, size: Float, color: Int, letterSpacing: Float = 0f) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = tf
            textSize = size
            this.color = color
            this.letterSpacing = letterSpacing
        }
        c.drawText(s, x, y, p)
    }

    private fun drawRoute(c: Canvas, route: List<List<LatLng>>, box: RectF) {
        val all = route.flatten()
        if (all.size < 2) {
            val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x22FFFFFF; style = Paint.Style.STROKE; strokeWidth = 3f }
            c.drawRoundRect(box, 36f, 36f, p)
            return
        }
        val xs = all.map { Mercator.x(it.lng) }
        val ys = all.map { Mercator.y(it.lat) }
        val minX = xs.min()
        val maxX = xs.max()
        val minY = ys.min()
        val maxY = ys.max()
        val span = max(maxX - minX, maxY - minY).coerceAtLeast(1e-9)
        val scale = min(box.width() / (maxX - minX).coerceAtLeast(span * 0.05), box.height() / (maxY - minY).coerceAtLeast(span * 0.05))
        val ox = box.centerX() - ((minX + maxX) / 2 * scale).toFloat()
        val oy = box.centerY() - ((minY + maxY) / 2 * scale).toFloat()
        fun px(l: LatLng) = (Mercator.x(l.lng) * scale).toFloat() + ox
        fun py(l: LatLng) = (Mercator.y(l.lat) * scale).toFloat() + oy

        val path = Path()
        for (segment in route) {
            segment.forEachIndexed { i, l -> if (i == 0) path.moveTo(px(l), py(l)) else path.lineTo(px(l), py(l)) }
        }
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        stroke.color = 0x40CBFB4E
        stroke.strokeWidth = 34f
        c.drawPath(path, stroke)
        stroke.shader = LinearGradient(box.left, box.top, box.right, box.bottom, LIME, LIME_DEEP, Shader.TileMode.CLAMP)
        stroke.strokeWidth = 13f
        c.drawPath(path, stroke)

        val dot = Paint(Paint.ANTI_ALIAS_FLAG)
        val start = all.first()
        val end = all.last()
        dot.color = 0xFFFFFFFF.toInt()
        c.drawCircle(px(start), py(start), 18f, dot)
        dot.color = LIME_DEEP
        c.drawCircle(px(start), py(start), 11f, dot)
        dot.color = LIME
        c.drawCircle(px(end), py(end), 22f, dot)
        dot.color = 0xFF060B0E.toInt()
        c.drawCircle(px(end), py(end), 9f, dot)
    }
}

/** The profile picture and run photos, stored in app-private files. */
object Images {
    private const val AVATAR_PX = 512

    fun avatarFile(context: Context) = File(context.filesDir, AppRepository.AVATAR_FILE)

    fun loadAvatar(context: Context): ImageBitmap? = avatarFile(context).takeIf { it.exists() }?.let { decodeSampled(it.path, AVATAR_PX) }?.asImageBitmap()

    fun removeAvatar(context: Context) {
        avatarFile(context).delete()
    }

    fun newPhotoFile(context: Context): File {
        val dir = File(context.filesDir, "photos").apply { mkdirs() }
        return File(dir, "IMG_${System.currentTimeMillis()}.jpg")
    }

    fun photoUri(context: Context, file: File): Uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)

    /** Crops the picked image to a square, scales it down and stores it as the avatar. */
    fun saveAvatar(context: Context, source: Uri): Boolean = try {
        val bytes = context.contentResolver.openInputStream(source)?.use { input -> input.readBytes() } ?: throw IOException("unreadable")
        val decoded = decodeBytes(bytes, AVATAR_PX * 2) ?: throw IOException("not an image")
        val side = min(decoded.width, decoded.height)
        val square = Bitmap.createBitmap(decoded, (decoded.width - side) / 2, (decoded.height - side) / 2, side, side)
        val scaled = Bitmap.createScaledBitmap(square, AVATAR_PX, AVATAR_PX, true)
        val target = avatarFile(context)
        val tmp = File(target.path + ".tmp")
        FileOutputStream(tmp).use { scaled.compress(Bitmap.CompressFormat.JPEG, 90, it) }
        tmp.renameTo(target)
    } catch (e: Exception) {
        false
    }

    fun decodeSampled(path: String, maxPx: Int): Bitmap? = try {
        decodeBytes(File(path).readBytes(), maxPx)
    } catch (e: Exception) {
        null
    }

    private fun decodeBytes(bytes: ByteArray, maxPx: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxPx) sample *= 2
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
        val rotation = try {
            when (ExifInterface(ByteArrayInputStream(bytes)).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        } catch (e: IOException) {
            0f
        }
        if (rotation == 0f) return bitmap
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(rotation) }, true)
    }
}

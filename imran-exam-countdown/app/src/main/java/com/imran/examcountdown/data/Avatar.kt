package com.imran.examcountdown.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import kotlin.math.max

/**
 * The profile photo, stored as a private file inside the app (never in shared storage).
 * Picking uses Android's photo picker, so no storage permission is needed.
 */
object Avatar {
    private const val FILE = "avatar.jpg"

    fun file(context: Context): File = File(context.filesDir, FILE)

    fun exists(context: Context): Boolean = Store(context).avatarVersion != 0L && file(context).exists()

    /** Loads the saved photo scaled to about [sizePx], or null if there is none. */
    fun load(context: Context, sizePx: Int): Bitmap? {
        if (!exists(context)) return null
        val path = file(context).absolutePath
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)
        if (bounds.outWidth <= 0) return null
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= sizePx) sample *= 2
        return BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
    }

    /** Saves a cropped square photo. Writes to a temporary file first so a crash can't corrupt it. */
    fun save(context: Context, bitmap: Bitmap): Boolean {
        val target = file(context)
        val temp = File(context.filesDir, "$FILE.tmp")
        return try {
            FileOutputStream(temp).use { out ->
                if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 92, out)) return false
            }
            if (!temp.renameTo(target)) {
                target.delete()
                if (!temp.renameTo(target)) return false
            }
            Store(context).avatarVersion = System.currentTimeMillis()
            true
        } catch (e: IOException) {
            temp.delete()
            false
        }
    }

    fun remove(context: Context) {
        file(context).delete()
        Store(context).avatarVersion = 0L
    }

    /**
     * Decodes a picked image at a manageable size, upright (camera photos often store their
     * rotation separately in EXIF data).
     */
    fun decodeForCrop(context: Context, uri: Uri, maxSide: Int = 2048): Bitmap? = try {
        if (Build.VERSION.SDK_INT >= 28) {
            val source = ImageDecoder.createSource(context.contentResolver, uri)
            ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
                val longest = max(info.size.width, info.size.height)
                if (longest > maxSide) {
                    val scale = maxSide.toFloat() / longest
                    decoder.setTargetSize((info.size.width * scale).toInt().coerceAtLeast(1), (info.size.height * scale).toInt().coerceAtLeast(1))
                }
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            }
        } else {
            decodeLegacy(context, uri, maxSide)
        }
    } catch (e: Exception) {
        // Unreadable, unsupported or revoked: treat like a cancelled pick.
        null
    }

    private fun decodeLegacy(context: Context, uri: Uri, maxSide: Int): Bitmap? {
        val resolver = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) } ?: return null
        if (bounds.outWidth <= 0) return null
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
        val bitmap = resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: return null
        val rotation = resolver.openInputStream(uri)?.use {
            when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        } ?: 0f
        if (rotation == 0f) return bitmap
        val m = Matrix().apply { postRotate(rotation) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m, true)
    }
}

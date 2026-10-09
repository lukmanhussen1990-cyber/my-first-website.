package com.loe.chat.util

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.provider.OpenableColumns
import androidx.exifinterface.media.ExifInterface
import com.loe.chat.data.Attachment
import java.io.File
import java.util.Base64
import java.util.UUID

/** Copies picked photos and files into app storage so chats keep working after the picker grant expires. */
object Attachments {
    private const val MAX_IMAGE_SIDE = 1568
    private const val MAX_TEXT_BYTES = 200_000

    fun importImage(context: Context, uri: Uri): Attachment? = runCatching {
        val resolver = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_IMAGE_SIDE) sample *= 2
        val decoded = resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: return null
        val rotated = rotateForExif(resolver, uri, decoded)
        val scaled = scaleDown(rotated, MAX_IMAGE_SIDE)
        val dir = File(context.filesDir, "attachments").apply { mkdirs() }
        val file = File(dir, "${UUID.randomUUID()}.jpg")
        file.outputStream().use { scaled.compress(Bitmap.CompressFormat.JPEG, 85, it) }
        Attachment("image", file.absolutePath, "image/jpeg", displayName(resolver, uri) ?: file.name)
    }.getOrNull()

    fun importFile(context: Context, uri: Uri): Attachment? = runCatching {
        val resolver = context.contentResolver
        val name = displayName(resolver, uri) ?: "file.txt"
        val bytes = resolver.openInputStream(uri)?.use { input ->
            val buffer = ByteArray(MAX_TEXT_BYTES)
            var total = 0
            while (total < MAX_TEXT_BYTES) {
                val n = input.read(buffer, total, MAX_TEXT_BYTES - total)
                if (n < 0) break
                total += n
            }
            buffer.copyOf(total)
        } ?: return null
        val dir = File(context.filesDir, "attachments").apply { mkdirs() }
        val file = File(dir, "${UUID.randomUUID()}-${name.replace(Regex("[^A-Za-z0-9._-]"), "_")}")
        file.writeBytes(bytes)
        Attachment("file", file.absolutePath, resolver.getType(uri) ?: "text/plain", name)
    }.getOrNull()

    fun importAvatar(context: Context, uri: Uri): String? = runCatching {
        val image = importImage(context, uri) ?: return null
        val dir = File(context.filesDir, "profile").apply { mkdirs() }
        val target = File(dir, "avatar-${System.currentTimeMillis()}.jpg")
        File(image.path).renameTo(target)
        target.absolutePath
    }.getOrNull()

    fun base64(file: File): String = Base64.getEncoder().encodeToString(file.readBytes())

    fun readText(attachment: Attachment): String =
        runCatching { File(attachment.path).readText() }.getOrDefault("")

    private fun displayName(resolver: ContentResolver, uri: Uri): String? = runCatching {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    }.getOrNull()

    private fun rotateForExif(resolver: ContentResolver, uri: Uri, bitmap: Bitmap): Bitmap {
        val orientation = runCatching {
            resolver.openInputStream(uri)?.use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
        }.getOrNull() ?: ExifInterface.ORIENTATION_NORMAL
        val degrees = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> return bitmap
        }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(degrees) }, true)
    }

    private fun scaleDown(bitmap: Bitmap, maxSide: Int): Bitmap {
        val longest = maxOf(bitmap.width, bitmap.height)
        if (longest <= maxSide) return bitmap
        val ratio = maxSide.toFloat() / longest
        return Bitmap.createScaledBitmap(bitmap, (bitmap.width * ratio).toInt(), (bitmap.height * ratio).toInt(), true)
    }
}

package com.loe.chat.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.imageResource

private val bitmapCache = HashMap<Int, ImageBitmap>()

/** A drawable-nodpi image decoded once per process; mipmaps keep it smooth when drawn small. */
@Composable
internal fun cachedBitmap(@DrawableRes id: Int): ImageBitmap {
    val resources = LocalContext.current.resources
    return remember(id) {
        bitmapCache.getOrPut(id) {
            ImageBitmap.imageResource(resources, id).also { it.asAndroidBitmap().setHasMipMap(true) }
        }
    }
}

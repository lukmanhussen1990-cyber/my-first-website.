package com.alarmhandler.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.res.stringResource
import com.alarmhandler.app.R

/**
 * Draws a bitmap with nearest-neighbour sampling.
 *
 * Compose's default is bilinear filtering, which turns pixel art into mush the
 * moment it is scaled. [FilterQuality.None] is what keeps the supplied images
 * looking exactly as they were drawn at every screen density.
 */
@Composable
fun PixelImage(
    resId: Int,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.FillWidth,
    alignment: Alignment = Alignment.Center,
) {
    val bitmap = androidx.compose.ui.graphics.ImageBitmap.imageResource(resId)
    val painter = remember(bitmap) {
        BitmapPainter(bitmap, filterQuality = FilterQuality.None)
    }
    Image(
        painter = painter,
        contentDescription = contentDescription,
        modifier = modifier,
        contentScale = contentScale,
        alignment = alignment,
    )
}

/** The wide pixel-city artwork used as the home-screen header. */
@Composable
fun CityHeaderImage(modifier: Modifier = Modifier) {
    PixelImage(
        resId = R.drawable.pixel_city_header,
        contentDescription = stringResource(R.string.cd_city),
        modifier = modifier,
        contentScale = ContentScale.FillWidth,
        alignment = Alignment.BottomCenter,
    )
}

/** The same scenery with extended sky, used behind the ringing screen. */
@Composable
fun CityBackdropImage(modifier: Modifier = Modifier) {
    PixelImage(
        resId = R.drawable.pixel_city_tall,
        contentDescription = null,
        modifier = modifier,
        contentScale = ContentScale.Crop,
        alignment = Alignment.BottomCenter,
    )
}

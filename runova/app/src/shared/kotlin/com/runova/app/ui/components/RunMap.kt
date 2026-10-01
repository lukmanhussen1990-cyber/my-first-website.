package com.runova.app.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.theme.Runova
import com.runova.core.geo.GeoBounds
import com.runova.core.geo.LatLng
import com.runova.core.geo.Mercator
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.log2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/** Raster tile source. Implementations must be cheap to call from draw code. */
interface TileProvider {
    /** The tile if it is available in memory; otherwise null (and loading is started). */
    fun tile(z: Int, x: Int, y: Int): ImageBitmap?

    /** Like [tile] but never triggers a network request (used for parent-tile fallbacks). */
    fun cachedTile(z: Int, x: Int, y: Int): ImageBitmap?

    /** Bumped whenever new tiles arrive, so maps redraw. */
    val version: State<Int>
    val attribution: String
    val maxZoom: Int get() = 19

    /** Pixel size of the tile images; maps on dense screens use deeper zoom levels of small tiles to stay sharp. */
    val tileSizePx: Int get() = 512
}

val LocalTileProvider = staticCompositionLocalOf<TileProvider?> { null }

/** Camera of a [RunMap], in normalized Web-Mercator coordinates. */
@Stable
class MapCamera(x: Double = 0.5, y: Double = 0.5, zoom: Double = 2.0) {
    var x by mutableStateOf(x)
    var y by mutableStateOf(y)
    var zoom by mutableStateOf(zoom)
    /** True once the user moved the map by hand. */
    var userMoved by mutableStateOf(false)

    fun center(lat: Double, lng: Double, zoom: Double = this.zoom) {
        x = Mercator.x(lng)
        y = Mercator.y(lat)
        this.zoom = zoom
    }

    /**
     * Fits [bounds] into the viewport. [topInsetPx] is space covered by overlays at the top
     * (toolbar, chips); the route is centred in the remaining area.
     */
    fun fit(bounds: GeoBounds, widthPx: Float, heightPx: Float, tilePx: Float, paddingPx: Float, maxZoom: Double = 17.0, topInsetPx: Float = 0f) {
        val usableH = (heightPx - topInsetPx).coerceAtLeast(heightPx * 0.4f)
        val z = Mercator.zoomToFit(bounds, widthPx.toDouble(), usableH.toDouble(), tilePx.toDouble(), paddingPx.toDouble(), maxZoom = maxZoom)
        val world = tilePx * 2.0.pow(z)
        x = (Mercator.x(bounds.minLng) + Mercator.x(bounds.maxLng)) / 2
        y = (Mercator.y(bounds.minLat) + Mercator.y(bounds.maxLat)) / 2 - (heightPx - usableH) / 2.0 / world
        zoom = z
    }
}

@Composable
fun rememberMapCamera(): MapCamera = remember { MapCamera() }

enum class MapMarkerStyle { NONE, START_END, LIVE }

/**
 * Map with the recorded route. The route is drawn as a neon line with a layered glow.
 *
 * @param follow keep [current] centred (live tracking) until the user pans the map.
 * @param fitKey when this changes the camera fits the whole route again.
 */
@Composable
fun RunMap(
    segments: List<List<LatLng>>,
    modifier: Modifier = Modifier,
    camera: MapCamera = rememberMapCamera(),
    current: LatLng? = null,
    follow: Boolean = false,
    markers: MapMarkerStyle = MapMarkerStyle.START_END,
    interactive: Boolean = true,
    routeWidth: Dp = 5.dp,
    fitPadding: Dp = 40.dp,
    fitKey: Any? = segments.size to segments.lastOrNull()?.size,
    followZoom: Double = 16.5,
    showAttribution: Boolean = true,
    topInset: Dp = 0.dp,
) {
    val c = Runova.colors
    val provider = LocalTileProvider.current
    val density = LocalDensity.current
    val tilePx = with(density) { 256.dp.toPx() }
    // Zoom levels deeper than the camera's, so each tile image is shown at 1-2x its pixel size.
    val detail = provider?.let { floor(log2(tilePx / it.tileSizePx)).toInt().coerceIn(0, 3) } ?: 0
    val pulse = if (markers == MapMarkerStyle.LIVE) {
        val infinite = rememberInfiniteTransition()
        infinite.animateFloat(0f, 1f, infiniteRepeatable(tween(1600, easing = LinearEasing), RepeatMode.Restart))
    } else null

    BoxWithConstraints(modifier) {
        val wPx = constraints.maxWidth.toFloat()
        val hPx = constraints.maxHeight.toFloat()
        val padPx = with(density) { fitPadding.toPx() }
        val topInsetPx = with(density) { topInset.toPx() }

        // Static maps fit the whole route once; live maps (follow) keep the route and the
        // current position in view, zooming in no further than [followZoom].
        LaunchedEffect(fitKey, wPx, hPx, current, camera.userMoved) {
            if (wPx <= 0 || hPx <= 0 || camera.userMoved) return@LaunchedEffect
            val pts = if (follow) segments.flatten() + listOfNotNull(current) else segments.flatten().ifEmpty { listOfNotNull(current) }
            val bounds = GeoBounds.of(pts) ?: return@LaunchedEffect
            camera.fit(bounds, wPx, hPx, tilePx, padPx, maxZoom = if (follow) followZoom else 17.0, topInsetPx = topInsetPx)
        }

        var gestures = Modifier.fillMaxSize()
        if (interactive) {
            gestures = gestures
                .pointerInput(camera) {
                    detectTransformGestures { centroid, pan, zoomChange, _ ->
                        camera.userMoved = true
                        applyZoom(camera, zoomChange, centroid, wPx, hPx, tilePx, provider?.maxZoom ?: 19)
                        val world = tilePx * 2.0.pow(camera.zoom)
                        camera.x = (camera.x - pan.x / world).coerceIn(0.0, 1.0)
                        camera.y = (camera.y - pan.y / world).coerceIn(0.0, 1.0)
                    }
                }
                .pointerInput(camera) {
                    detectTapGestures(onDoubleTap = { pos ->
                        camera.userMoved = true
                        applyZoom(camera, 2f, pos, wPx, hPx, tilePx, provider?.maxZoom ?: 19)
                    })
                }
        }

        Canvas(gestures) {
            @Suppress("UNUSED_VARIABLE")
            val v = provider?.version?.value // read to redraw when tiles arrive
            drawRect(c.mapBackground)
            drawTiles(provider, camera, tilePx, detail, c.mapGrid)
            val world = tilePx * 2.0.pow(camera.zoom)
            val ox = camera.x * world - size.width / 2
            val oy = camera.y * world - size.height / 2
            fun project(p: LatLng) = Offset((Mercator.x(p.lng) * world - ox).toFloat(), (Mercator.y(p.lat) * world - oy).toFloat())
            drawRoute(segments, ::project, routeWidth.toPx(), c.lime, c.isDark)
            val first = segments.firstOrNull()?.firstOrNull()
            val last = segments.lastOrNull()?.lastOrNull()
            when (markers) {
                MapMarkerStyle.START_END -> {
                    if (first != null) drawStartMarker(project(first), routeWidth.toPx())
                    if (last != null && last != first) drawEndMarker(project(last), routeWidth.toPx())
                }
                MapMarkerStyle.LIVE -> {
                    if (first != null) drawStartMarker(project(first), routeWidth.toPx() * 0.8f)
                    val here = current ?: last
                    if (here != null) drawLiveMarker(project(here), routeWidth.toPx(), c.lime, pulse?.value ?: 0f)
                }
                MapMarkerStyle.NONE -> Unit
            }
        }
        if (showAttribution && provider != null) {
            Text(
                provider.attribution,
                fontSize = 9.sp,
                color = c.textSecondary.copy(alpha = 0.75f),
                modifier = Modifier.align(Alignment.BottomEnd).padding(horizontal = 10.dp, vertical = 6.dp),
            )
        }
    }
}

private fun applyZoom(camera: MapCamera, factor: Float, focus: Offset, w: Float, h: Float, tilePx: Float, maxZoom: Int) {
    if (factor == 1f) return
    val oldZoom = camera.zoom
    val newZoom = (oldZoom + ln(factor.toDouble()) / ln(2.0)).coerceIn(2.0, maxZoom.toDouble())
    val oldWorld = tilePx * 2.0.pow(oldZoom)
    val newWorld = tilePx * 2.0.pow(newZoom)
    val fx = camera.x * oldWorld - w / 2 + focus.x
    val fy = camera.y * oldWorld - h / 2 + focus.y
    val nx = fx / oldWorld
    val ny = fy / oldWorld
    camera.zoom = newZoom
    camera.x = (nx - (focus.x - w / 2) / newWorld).coerceIn(0.0, 1.0)
    camera.y = (ny - (focus.y - h / 2) / newWorld).coerceIn(0.0, 1.0)
}

private fun DrawScope.drawTiles(provider: TileProvider?, camera: MapCamera, tilePx: Float, detail: Int, grid: Color) {
    val zoom = camera.zoom
    val z = (floor(zoom + 1e-6).toInt() + detail).coerceIn(1, provider?.maxZoom ?: 19)
    val scale = 2.0.pow(zoom - z)
    val tileWorld = tilePx * scale
    val world = tilePx * 2.0.pow(zoom)
    val ox = camera.x * world - size.width / 2
    val oy = camera.y * world - size.height / 2
    val n = 1 shl z
    val x0 = floor(ox / tileWorld).toInt()
    val x1 = floor((ox + size.width) / tileWorld).toInt()
    val y0 = max(0, floor(oy / tileWorld).toInt())
    val y1 = min(n - 1, floor((oy + size.height) / tileWorld).toInt())
    val sizeInt = (tileWorld + 0.999).toInt()
    for (ty in y0..y1) {
        for (tx in x0..x1) {
            val wx = ((tx % n) + n) % n
            val left = (tx * tileWorld - ox).roundToInt()
            val top = (ty * tileWorld - oy).roundToInt()
            val img = provider?.tile(z, wx, ty)
            if (img != null) {
                drawImage(
                    img,
                    srcOffset = IntOffset.Zero,
                    srcSize = IntSize(img.width, img.height),
                    dstOffset = IntOffset(left, top),
                    dstSize = IntSize(sizeInt, sizeInt),
                    filterQuality = FilterQuality.Low,
                )
                continue
            }
            // fall back to a scaled parent tile from memory, else a subtle grid
            var drawn = false
            if (provider != null) {
                var pz = z - 1
                var px = wx / 2
                var py = ty / 2
                var depth = 1
                while (pz >= 1 && depth <= 4 && !drawn) {
                    val parent = provider.cachedTile(pz, px, py)
                    if (parent != null) {
                        val cells = 1 shl depth
                        val sub = parent.width / cells
                        val sx = (wx - px * cells) * sub
                        val sy = (ty - py * cells) * sub
                        drawImage(parent, IntOffset(sx, sy), IntSize(sub, sub), IntOffset(left, top), IntSize(sizeInt, sizeInt), filterQuality = FilterQuality.Low)
                        drawn = true
                    }
                    pz--; px /= 2; py /= 2; depth++
                }
            }
            if (!drawn) {
                val step = tileWorld.toFloat() / 4f
                for (k in 0..4) {
                    val gx = left + k * step
                    val gy = top + k * step
                    drawLine(grid, Offset(gx, top.toFloat()), Offset(gx, top + tileWorld.toFloat()), strokeWidth = 1f)
                    drawLine(grid, Offset(left.toFloat(), gy), Offset(left + tileWorld.toFloat(), gy), strokeWidth = 1f)
                }
            }
        }
    }
}

internal fun DrawScope.drawRoute(segments: List<List<LatLng>>, project: (LatLng) -> Offset, width: Float, color: Color, dark: Boolean) {
    val paths = segments.filter { it.size >= 2 }.map { seg ->
        Path().apply {
            val first = project(seg[0])
            moveTo(first.x, first.y)
            var last = first
            for (i in 1 until seg.size) {
                val p = project(seg[i])
                // skip sub-pixel steps for speed on long runs
                if (i != seg.lastIndex && (p - last).getDistanceSquared() < 1.2f) continue
                lineTo(p.x, p.y)
                last = p
            }
        }
    }
    val glowLayers = if (dark) listOf(4.6f to 0.07f, 3.2f to 0.10f, 2.2f to 0.16f) else listOf(2.6f to 0.12f)
    for ((mult, alpha) in glowLayers) {
        for (p in paths) drawPath(p, color.copy(alpha = alpha), style = Stroke(width * mult, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
    val core = if (dark) color else Color(0xFF6CC11A)
    for (p in paths) drawPath(p, core, style = Stroke(width, cap = StrokeCap.Round, join = StrokeJoin.Round))
    for (p in paths) drawPath(p, Color.White.copy(alpha = if (dark) 0.35f else 0.0f), style = Stroke(width * 0.3f, cap = StrokeCap.Round, join = StrokeJoin.Round))
}

internal fun DrawScope.drawStartMarker(p: Offset, routeWidth: Float) {
    val r = routeWidth * 2.2f
    drawCircle(Brush.radialGradient(listOf(Color(0x6655E36B), Color.Transparent), center = p, radius = r * 2.2f), radius = r * 2.2f, center = p)
    drawCircle(Color(0xFF4CD964), radius = r, center = p)
    drawCircle(Color(0xFF1E5E2A), radius = r * 0.45f, center = p)
}

internal fun DrawScope.drawEndMarker(p: Offset, routeWidth: Float) {
    val r = routeWidth * 2.3f
    drawCircle(Brush.radialGradient(listOf(Color(0x66FF4B45), Color.Transparent), center = p, radius = r * 2.2f), radius = r * 2.2f, center = p)
    drawCircle(Color(0xFFFF4B45), radius = r, center = p)
    drawCircle(Color.White, radius = r * 0.42f, center = p)
}

internal fun DrawScope.drawLiveMarker(p: Offset, routeWidth: Float, lime: Color, pulse: Float) {
    val r = routeWidth * 2.4f
    val ring = r * (1.4f + pulse * 1.6f)
    drawCircle(lime.copy(alpha = 0.35f * (1f - pulse)), radius = ring, center = p)
    drawCircle(Brush.radialGradient(listOf(lime.copy(alpha = 0.55f), Color.Transparent), center = p, radius = r * 2.4f), radius = r * 2.4f, center = p)
    drawCircle(lime, radius = r, center = p)
    drawCircle(Color(0xFFF4FFD0), radius = r * 0.45f, center = p)
}

/** Small, non-interactive route preview used in lists. */
@Composable
fun RouteThumbnail(segments: List<List<LatLng>>, modifier: Modifier = Modifier) {
    RunMap(
        segments = segments,
        modifier = modifier,
        markers = MapMarkerStyle.START_END,
        interactive = false,
        routeWidth = 2.6.dp,
        fitPadding = 14.dp,
        showAttribution = false,
    )
}

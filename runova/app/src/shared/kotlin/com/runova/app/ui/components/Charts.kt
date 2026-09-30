package com.runova.app.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.runova.app.ui.theme.Runova
import com.runova.core.tracking.SeriesPoint
import kotlin.math.max
import kotlin.math.min

/**
 * Vertical bar chart with pill-shaped gradient bars. The [highlight] bar glows and shows a value
 * bubble. Bars grow in with a staggered animation whenever [animationKey] changes.
 */
@Composable
fun BarChart(
    values: List<Double>,
    labels: List<String>,
    modifier: Modifier = Modifier,
    highlight: Int? = values.indices.maxByOrNull { values[it] }?.takeIf { values[it] > 0 },
    valueLabel: (Double) -> String = { it.toInt().toString() },
    labelEvery: Int = 1,
    chartHeight: Dp = 170.dp,
    animationKey: Any? = values,
    onBarClick: ((Int) -> Unit)? = null,
) {
    val c = Runova.colors
    val progress = remember { Animatable(0f) }
    LaunchedEffect(animationKey) {
        progress.snapTo(0f)
        progress.animateTo(1f, tween(1100, easing = FastOutSlowInEasing))
    }
    val maxV = max(values.maxOrNull() ?: 0.0, 1e-9)
    val n = max(values.size, 1)
    Column(modifier) {
        BoxWithConstraints(Modifier.fillMaxWidth().height(chartHeight + 34.dp)) {
            val widthPx = constraints.maxWidth.toFloat()
            val slot = widthPx / n
            val bubbleSpace = 34.dp
            Canvas(
                Modifier
                    .fillMaxSize()
                    .padding(top = bubbleSpace)
                    .pointerInput(values, onBarClick) {
                        if (onBarClick != null) detectTapGestures { pos -> onBarClick((pos.x / slot).toInt().coerceIn(0, n - 1)) }
                    },
            ) {
                val barW = min(slot * if (n > 12) 0.62f else 0.5f, 24.dp.toPx())
                val h = size.height
                val stub = 5.dp.toPx()
                values.forEachIndexed { i, v ->
                    val stagger = (i.toFloat() / n) * 0.35f
                    val local = ((progress.value - stagger) / (1f - 0.35f)).coerceIn(0f, 1f)
                    val eased = 1f - (1f - local) * (1f - local)
                    val full = if (v <= 0) stub else max(stub, (v / maxV * h * 0.96).toFloat())
                    val bh = max(stub * eased, full * eased)
                    val left = slot * i + (slot - barW) / 2
                    val top = h - bh
                    val isHi = i == highlight
                    if (v <= 0) {
                        drawRoundRect(c.track, Offset(left, h - stub), Size(barW, stub), CornerRadius(barW / 2))
                        return@forEachIndexed
                    }
                    if (isHi && c.isDark) {
                        for (k in 1..6) {
                            val g = k * 3.dp.toPx()
                            drawRoundRect(
                                c.lime.copy(alpha = 0.05f),
                                Offset(left - g, top - g),
                                Size(barW + g * 2, bh + g * 2),
                                CornerRadius(barW / 2 + g),
                            )
                        }
                    }
                    val topColor = if (isHi) lerp(c.lime, Color.White, 0.08f) else c.lime
                    drawRoundRect(
                        Brush.verticalGradient(listOf(topColor, c.limeDeep.copy(alpha = if (isHi) 1f else 0.9f)), startY = top, endY = h),
                        Offset(left, top),
                        Size(barW, bh),
                        CornerRadius(barW / 2),
                    )
                }
            }
            // value bubble for the highlighted bar
            if (highlight != null && highlight in values.indices && values[highlight] > 0) {
                val v = values[highlight]
                val barH = (v / maxV * 0.96).toFloat() * progress.value
                val xDp = with(androidx.compose.ui.platform.LocalDensity.current) { (slot * highlight + slot / 2).toDp() }
                val yDp = bubbleSpace + chartHeight * (1f - barH) - 36.dp
                Box(
                    Modifier
                        .offset(x = xDp - 40.dp, y = yDp)
                        .width(80.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    ValueBubble(valueLabel(v))
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
            labels.forEachIndexed { i, label ->
                val show = labelEvery <= 1 || i % labelEvery == 0 || i == labels.lastIndex
                Text(
                    if (show) label else "",
                    style = Runova.type.label,
                    color = if (i == highlight) c.textPrimary else c.textSecondary,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    softWrap = false,
                    modifier = Modifier.weight(1f).wrapContentSize(unbounded = true),
                )
            }
        }
    }
}

private val BubbleShape = GenericShape { size, _ ->
    val r = 8f * (size.height / 30f)
    val tail = size.height * 0.22f
    val body = size.height - tail
    addRoundRect(androidx.compose.ui.geometry.RoundRect(0f, 0f, size.width, body, CornerRadius(r)))
    moveTo(size.width / 2 - tail, body - 1f)
    lineTo(size.width / 2, size.height)
    lineTo(size.width / 2 + tail, body - 1f)
    close()
}

@Composable
fun ValueBubble(text: String, modifier: Modifier = Modifier) {
    val c = Runova.colors
    Box(
        modifier
            .clip(BubbleShape)
            .background(Brush.verticalGradient(listOf(Color(0xFF7ACB2A), Color(0xFF4F9B18))))
            .padding(start = 11.dp, end = 11.dp, top = 3.dp, bottom = 8.dp),
    ) {
        Text(text, style = Runova.type.label, color = c.onLime)
    }
}

/**
 * Smooth line chart with a gradient fill. When [invertY] is true, lower values are drawn higher
 * (used for pace, where a lower number means faster).
 */
@Composable
fun LineChart(
    points: List<SeriesPoint>,
    color: Color,
    modifier: Modifier = Modifier,
    invertY: Boolean = false,
    yLabel: (Double) -> String = { it.toInt().toString() },
    xLabel: (Double) -> String = { it.toInt().toString() },
    height: Dp = 170.dp,
) {
    val c = Runova.colors
    val reveal = remember { Animatable(0f) }
    LaunchedEffect(points) {
        reveal.snapTo(0f)
        reveal.animateTo(1f, tween(1200, easing = FastOutSlowInEasing))
    }
    if (points.size < 2) {
        Box(modifier.fillMaxWidth().height(height), contentAlignment = Alignment.Center) {
            Text("Not enough data yet", style = Runova.type.bodyS, color = c.textSecondary)
        }
        return
    }
    val minY = points.minOf { it.value }
    val maxY = points.maxOf { it.value }
    val span = max(maxY - minY, 1e-6)
    val lo = minY - span * 0.12
    val hi = maxY + span * 0.12
    val minX = points.first().distanceM
    val maxX = max(points.last().distanceM, minX + 1)
    Column(modifier) {
        Row(Modifier.fillMaxWidth().height(height)) {
            Column(Modifier.width(46.dp).fillMaxSize().padding(vertical = 2.dp), verticalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceBetween) {
                val top = if (invertY) lo else hi
                val bottom = if (invertY) hi else lo
                Text(yLabel(top), style = Runova.type.caption, color = c.textTertiary)
                Text(yLabel((top + bottom) / 2), style = Runova.type.caption, color = c.textTertiary)
                Text(yLabel(bottom), style = Runova.type.caption, color = c.textTertiary)
            }
            Canvas(Modifier.weight(1f).fillMaxSize()) {
                val w = size.width
                val h = size.height
                for (k in 0..2) {
                    val y = h * k / 2f
                    drawLine(c.divider, Offset(0f, y), Offset(w, y), strokeWidth = 1.dp.toPx())
                }
                fun px(p: SeriesPoint): Offset {
                    val x = ((p.distanceM - minX) / (maxX - minX)).toFloat() * w
                    val t = ((p.value - lo) / (hi - lo)).toFloat()
                    val y = if (invertY) t * h else (1f - t) * h
                    return Offset(x, y)
                }
                val pts = points.map(::px)
                val line = Path().apply {
                    moveTo(pts[0].x, pts[0].y)
                    for (i in 1 until pts.size) {
                        val p0 = pts[max(0, i - 2)]
                        val p1 = pts[i - 1]
                        val p2 = pts[i]
                        val p3 = pts[min(pts.lastIndex, i + 1)]
                        val c1 = Offset(p1.x + (p2.x - p0.x) / 6f, p1.y + (p2.y - p0.y) / 6f)
                        val c2 = Offset(p2.x - (p3.x - p1.x) / 6f, p2.y - (p3.y - p1.y) / 6f)
                        cubicTo(c1.x, c1.y, c2.x, c2.y, p2.x, p2.y)
                    }
                }
                val fill = Path().apply {
                    addPath(line)
                    lineTo(pts.last().x, h)
                    lineTo(pts.first().x, h)
                    close()
                }
                clipRect(right = w * reveal.value) {
                    drawPath(fill, Brush.verticalGradient(listOf(color.copy(alpha = 0.32f), color.copy(alpha = 0.0f))))
                    drawPath(line, color.copy(alpha = 0.25f), style = Stroke(9.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
                    drawPath(line, color, style = Stroke(3.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(start = 46.dp, top = 6.dp)) {
            Text(xLabel(minX), style = Runova.type.caption, color = c.textTertiary, modifier = Modifier.weight(1f))
            Text(xLabel((minX + maxX) / 2), style = Runova.type.caption, color = c.textTertiary, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
            Text(xLabel(maxX), style = Runova.type.caption, color = c.textTertiary, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
        }
    }
}

package com.runova.app.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.CircleIconButton
import com.runova.app.ui.components.FlameBrush
import com.runova.app.ui.components.GhostButton
import com.runova.app.ui.components.GradientIcon
import com.runova.app.ui.components.HairlineDivider
import com.runova.app.ui.components.LimeButton
import com.runova.app.ui.components.LineChart
import com.runova.app.ui.components.MapMarkerStyle
import com.runova.app.ui.components.RunMap
import com.runova.app.ui.components.RunovaCard
import com.runova.app.ui.components.RunovaDialog
import com.runova.app.ui.components.RunovaIcons
import com.runova.app.ui.components.ScreenTopBar
import com.runova.app.ui.components.UnderlineTabs
import com.runova.app.ui.model.RunDetailsUiState
import com.runova.app.ui.theme.Runova
import com.runova.core.format.Fmt
import com.runova.core.format.UnitConv
import com.runova.core.model.UnitSystem
import kotlin.math.roundToInt

class RunDetailsActions(
    val onBack: () -> Unit = {},
    val onShare: () -> Unit = {},
    val onExportGpx: () -> Unit = {},
    val onDelete: () -> Unit = {},
)

@Composable
fun RunDetailsScreen(state: RunDetailsUiState, actions: RunDetailsActions, initialTab: Int = 0) {
    val c = Runova.colors
    var tab by remember { mutableStateOf(initialTab) }
    var confirmDelete by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            ScreenTopBar("Run Details", actions.onBack) {
                CircleIconButton(Icons.Rounded.Share, "Share run", actions.onShare, iconSize = 24.dp)
            }
            UnderlineTabs(listOf("Map", "Splits", "Stats", "Charts"), tab, { tab = it }, Modifier.padding(horizontal = 18.dp))
            Spacer(Modifier.height(14.dp))
            AnimatedContent(
                targetState = tab,
                transitionSpec = {
                    val dir = if (targetState > initialState) 1 else -1
                    (slideInHorizontally(tween(260)) { it / 6 * dir } + fadeIn(tween(260))) togetherWith (slideOutHorizontally(tween(200)) { -it / 6 * dir } + fadeOut(tween(160)))
                },
                modifier = Modifier.weight(1f),
            ) { t ->
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp)) {
                    when (t) {
                        0 -> MapTab(state, actions)
                        1 -> SplitsTab(state)
                        2 -> StatsTab(state, actions) { confirmDelete = true }
                        else -> ChartsTab(state)
                    }
                    Spacer(Modifier.navigationBarsPadding().height(24.dp))
                }
            }
        }
        RunovaDialog(
            visible = confirmDelete,
            onDismiss = { confirmDelete = false },
            title = "Delete this run?",
            message = "The route, stats and XP earned from this run will be removed. This can't be undone.",
            confirmText = "Delete run",
            onConfirm = { confirmDelete = false; actions.onDelete() },
            icon = Icons.Outlined.DeleteOutline,
            iconTint = c.red,
            destructive = true,
        )
    }
}

@Composable
private fun MapTab(state: RunDetailsUiState, actions: RunDetailsActions) {
    val c = Runova.colors
    RunMap(
        state.route,
        Modifier.fillMaxWidth().height(272.dp).clip(RoundedCornerShape(24.dp)),
        markers = MapMarkerStyle.START_END,
        routeWidth = 5.dp,
    )
    Spacer(Modifier.height(14.dp))
    Text(
        buildAnnotatedString {
            withStyle(SpanStyle(fontSize = 44.sp)) { append(Fmt.distanceValue(state.distanceM, state.units)) }
            withStyle(SpanStyle(fontSize = 26.sp)) { append(" ${Fmt.distanceUnit(state.units).uppercase()}") }
        },
        style = Runova.type.metricL.copy(fontFamily = Runova.type.titleXL.fontFamily, fontWeight = FontWeight.Bold),
        color = c.textPrimary,
    )
    Text(state.dateText, style = Runova.type.body, color = c.textSecondary)
    Spacer(Modifier.height(14.dp))
    StatGrid(state)
    if (state.photos.isNotEmpty()) {
        Spacer(Modifier.height(16.dp))
        Text("Photos", style = Runova.type.titleS, color = c.textPrimary)
        Spacer(Modifier.height(8.dp))
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            state.photos.forEach { p ->
                Box(Modifier.size(96.dp).clip(RoundedCornerShape(16.dp)).background(c.surfaceHigh)) {
                    p.image?.let { Image(it, contentDescription = "Run photo", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
                }
            }
        }
    }
    Spacer(Modifier.height(18.dp))
    LimeButton("Share Run", actions.onShare, Modifier.fillMaxWidth(), icon = Icons.Rounded.Share, textStyle = Runova.type.titleS.copy(fontWeight = FontWeight.Bold, fontSize = 18.sp))
}

@Composable
private fun StatGrid(state: RunDetailsUiState) {
    val c = Runova.colors
    val u = state.units
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            GridStat(null, Fmt.clock(state.movingTimeMs), null, "Duration", Modifier.weight(1.12f))
            GridStat({ GradientIcon(Icons.Rounded.LocalFireDepartment, FlameBrush, Modifier.size(24.dp)) }, Fmt.calories(state.calories), null, "Calories", Modifier.weight(1f))
            GridStat(null, Fmt.pace(state.avgPaceSecPerKm, u), null, "Pace ${Fmt.paceUnit(u).replace("/", "/ ")}", Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            GridStat({ Icon(RunovaIcons.Sneaker, null, tint = c.green, modifier = Modifier.size(24.dp)) }, state.steps?.let { Fmt.integer(it) } ?: "--", null, if (state.stepsEstimated) "Steps (est.)" else "Steps", Modifier.weight(1.12f))
            GridStat({ Icon(Icons.Rounded.TrendingUp, null, tint = c.textPrimary, modifier = Modifier.size(24.dp)) }, Fmt.elevationValue(state.elevationGainM, u), Fmt.elevationUnit(u), "Elevation", Modifier.weight(1f))
            GridStat({ Icon(Icons.Rounded.Favorite, null, tint = c.red, modifier = Modifier.size(24.dp)) }, state.avgHeartRate?.toString() ?: "--", null, "Avg. BPM", Modifier.weight(1f))
        }
    }
}

@Composable
private fun GridStat(icon: (@Composable () -> Unit)?, value: String, unit: String?, label: String, modifier: Modifier) {
    val c = Runova.colors
    RunovaCard(modifier.height(88.dp), shape = RoundedCornerShape(18.dp)) {
        androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 12.dp)) {
        // shrink long values (e.g. 01:02:03) so they never clip
        val iconSpace = if (icon != null) 30f else 0f
        val chars = value.length + (unit?.length ?: 0) * 0.6f
        val fit = ((maxWidth.value - iconSpace) / (chars * 0.47f)).coerceIn(18f, 29f)
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (icon != null) {
                    icon()
                    Spacer(Modifier.width(5.dp))
                }
                Text(
                    buildAnnotatedString {
                        append(value)
                        if (unit != null) withStyle(SpanStyle(fontSize = 17.sp, fontFamily = Runova.type.body.fontFamily, fontWeight = FontWeight.SemiBold)) { append(" $unit") }
                    },
                    style = Runova.type.metricXL.copy(fontSize = fit.sp),
                    color = c.textPrimary,
                    maxLines = 1,
                    softWrap = false,
                )
            }
            Spacer(Modifier.height(2.dp))
            Text(label, style = Runova.type.bodyS, color = c.textSecondary, maxLines = 1)
        }
        }
    }
}

@Composable
private fun SplitsTab(state: RunDetailsUiState) {
    val c = Runova.colors
    val unitM = UnitConv.unitMeters(state.units)
    val splits = state.splits
    if (splits.isEmpty()) {
        EmptyNote("Splits appear once you've covered at least one ${if (state.units == UnitSystem.METRIC) "kilometer" else "mile"}.")
        return
    }
    val paces = splits.mapNotNull { it.paceSecPerUnit(unitM) }
    val fastest = paces.minOrNull() ?: 0.0
    val slowest = paces.maxOrNull() ?: 1.0
    val grow = remember { Animatable(0f) }
    LaunchedEffect(splits) { grow.animateTo(1f, tween(900, easing = FastOutSlowInEasing)) }
    RunovaCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(vertical = 8.dp)) {
            Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text(if (state.units == UnitSystem.METRIC) "KM" else "MI", style = Runova.type.caption, color = c.textTertiary, modifier = Modifier.width(38.dp))
                Text("PACE", style = Runova.type.caption, color = c.textTertiary, modifier = Modifier.weight(1f))
                Text("ELEV", style = Runova.type.caption, color = c.textTertiary, modifier = Modifier.width(56.dp))
                Text("TIME", style = Runova.type.caption, color = c.textTertiary, modifier = Modifier.width(62.dp))
            }
            splits.forEach { sp ->
                val pace = sp.paceSecPerUnit(unitM)
                val isFast = pace != null && pace == fastest && splits.size > 1
                val frac = if (pace == null || slowest <= 0) 0f else (0.35 + 0.65 * (fastest / pace)).toFloat()
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                    val label = if (sp.distanceM < unitM * 0.999) String.format(java.util.Locale.US, "%.2f", sp.distanceM / unitM) else sp.index.toString()
                    Text(label, style = Runova.type.titleS, color = c.textPrimary, modifier = Modifier.width(38.dp))
                    Box(Modifier.weight(1f).height(26.dp)) {
                        Box(
                            Modifier
                                .fillMaxHeight()
                                .fillMaxWidth((frac * grow.value).coerceIn(0.05f, 1f))
                                .clip(CircleShape)
                                .background(
                                    if (isFast) Brush.horizontalGradient(listOf(c.limeDeep, c.lime))
                                    else Brush.horizontalGradient(listOf(c.surfaceHigh, c.track.copy(alpha = 1f))),
                                ),
                        )
                        Text(
                            Fmt.pace(pace?.let { it * 1000.0 / unitM }, state.units),
                            style = Runova.type.label.copy(fontWeight = FontWeight.Bold),
                            color = if (isFast) c.onLime else c.textPrimary,
                            modifier = Modifier.align(Alignment.CenterStart).padding(start = 12.dp),
                        )
                    }
                    val elev = sp.elevationDeltaM
                    Text(
                        if (elev == null) "--" else (if (elev >= 0) "+" else "−") + Fmt.elevationValue(kotlin.math.abs(elev), state.units),
                        style = Runova.type.bodyS,
                        color = c.textSecondary,
                        modifier = Modifier.width(56.dp).padding(start = 10.dp),
                    )
                    Text(Fmt.durationCompact(sp.durationMs), style = Runova.type.bodyS.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary, modifier = Modifier.width(62.dp))
                }
            }
        }
    }
    Spacer(Modifier.height(12.dp))
    Text("Fastest split highlighted. Elevation from GPS altitude.", style = Runova.type.bodyS, color = c.textTertiary)
}

@Composable
private fun StatsTab(state: RunDetailsUiState, actions: RunDetailsActions, onDelete: () -> Unit) {
    val c = Runova.colors
    val u = state.units
    val rows = listOf(
        "Distance" to Fmt.distance(state.distanceM, u),
        "Moving time" to Fmt.clock(state.movingTimeMs),
        "Elapsed time" to Fmt.clock(state.elapsedTimeMs),
        "Average pace" to "${Fmt.pace(state.avgPaceSecPerKm, u)} ${Fmt.paceUnit(u)}",
        "Average speed" to Fmt.speed(if (state.movingTimeMs > 0) state.distanceM / (state.movingTimeMs / 1000.0) else 0.0, u),
        "Max speed" to Fmt.speed(state.maxSpeedMps, u),
        "Calories (estimated)" to "${Fmt.calories(state.calories)} kcal",
        "Steps" to (state.steps?.let { Fmt.integer(it) + if (state.stepsEstimated) " (est.)" else "" } ?: "--"),
        "Elevation gain" to Fmt.elevation(state.elevationGainM, u),
        "Elevation loss" to Fmt.elevation(state.elevationLossM, u),
        "Average heart rate" to (state.avgHeartRate?.let { "$it bpm" } ?: "Not recorded"),
        "Max heart rate" to (state.maxHeartRate?.let { "$it bpm" } ?: "Not recorded"),
        "XP earned" to "+${state.xpEarned} XP",
    )
    RunovaCard(Modifier.fillMaxWidth()) {
        Column {
            rows.forEachIndexed { i, (k, v) ->
                Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 14.dp)) {
                    Text(k, style = Runova.type.body, color = c.textSecondary, modifier = Modifier.weight(1f))
                    Text(v, style = Runova.type.body.copy(fontWeight = FontWeight.SemiBold), color = if (k == "XP earned") c.accent else c.textPrimary)
                }
                if (i != rows.lastIndex) HairlineDivider(Modifier.padding(horizontal = 18.dp))
            }
        }
    }
    Spacer(Modifier.height(10.dp))
    Text(
        "Calories are estimates based on your weight, speed and elevation using the ACSM metabolic equations.",
        style = Runova.type.bodyS,
        color = c.textTertiary,
    )
    Spacer(Modifier.height(16.dp))
    GhostButton("Export GPX", actions.onExportGpx, Modifier.fillMaxWidth(), icon = Icons.Outlined.FileDownload)
    Spacer(Modifier.height(10.dp))
    GhostButton("Delete run", onDelete, Modifier.fillMaxWidth(), color = c.red, icon = Icons.Outlined.DeleteOutline)
}

@Composable
private fun ChartsTab(state: RunDetailsUiState) {
    val c = Runova.colors
    val u = state.units
    val kmFactor = UnitConv.unitMeters(u)
    fun xLabel(m: Double) = String.format(java.util.Locale.US, "%.1f %s", m / kmFactor, Fmt.distanceUnit(u))
    ChartCard("Pace", "${Fmt.pace(state.avgPaceSecPerKm, u)} ${Fmt.paceUnit(u)} avg") {
        LineChart(
            state.paceSeries,
            c.lime,
            invertY = true,
            yLabel = { Fmt.pace(it, u) },
            xLabel = ::xLabel,
        )
    }
    Spacer(Modifier.height(14.dp))
    ChartCard("Elevation", "+${Fmt.elevation(state.elevationGainM, u)}") {
        LineChart(
            state.elevationSeries,
            c.teal,
            yLabel = { Fmt.elevation(it, u) },
            xLabel = ::xLabel,
        )
    }
    Spacer(Modifier.height(14.dp))
    ChartCard("Heart rate", state.avgHeartRate?.let { "$it bpm avg" } ?: "No sensor connected") {
        if (state.heartRateSeries.size >= 2) {
            LineChart(state.heartRateSeries, c.red, yLabel = { "${it.roundToInt()}" }, xLabel = ::xLabel)
        } else {
            EmptyNote("Connect a Bluetooth heart-rate monitor in Profile › Heart Rate to record BPM during runs.")
        }
    }
}

@Composable
private fun ChartCard(title: String, subtitle: String, content: @Composable () -> Unit) {
    val c = Runova.colors
    RunovaCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = Runova.type.titleS, color = c.textPrimary, modifier = Modifier.weight(1f))
                Text(subtitle, style = Runova.type.bodyS, color = c.textSecondary)
            }
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
internal fun EmptyNote(text: String) {
    val c = Runova.colors
    Box(Modifier.fillMaxWidth().padding(vertical = 28.dp), contentAlignment = Alignment.Center) {
        Text(text, style = Runova.type.bodyS, color = c.textSecondary, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

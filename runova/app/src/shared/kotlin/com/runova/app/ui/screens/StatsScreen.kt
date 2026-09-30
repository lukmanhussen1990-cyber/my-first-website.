package com.runova.app.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.TaskAlt
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.BarChart
import com.runova.app.ui.components.CircleIconButton
import com.runova.app.ui.components.MainTab
import com.runova.app.ui.components.RunovaBottomBar
import com.runova.app.ui.components.RunovaCard
import com.runova.app.ui.components.ScreenTopBar
import com.runova.app.ui.components.SegmentedTabs
import com.runova.app.ui.model.StatsMetric
import com.runova.app.ui.model.StatsUiState
import com.runova.app.ui.theme.Runova
import com.runova.core.stats.StatsRange

class StatsActions(
    val onBack: () -> Unit = {},
    val onRange: (StatsRange) -> Unit = {},
    val onMetric: (StatsMetric) -> Unit = {},
    val onShift: (Int) -> Unit = {},
    val onTab: (MainTab) -> Unit = {},
)

@Composable
fun StatsScreen(state: StatsUiState, actions: StatsActions) {
    val c = Runova.colors
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            ScreenTopBar("Statistics", actions.onBack)
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp)) {
                SegmentedTabs(listOf("Week", "Month", "Year"), StatsRange.entries.indexOf(state.range), { actions.onRange(StatsRange.entries[it]) })
                Spacer(Modifier.height(4.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    CircleIconButton(Icons.Rounded.ChevronLeft, "Previous period", { actions.onShift(-1) }, iconSize = 28.dp)
                    Text(state.periodLabel, style = Runova.type.titleS, color = c.textPrimary, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    CircleIconButton(Icons.Rounded.ChevronRight, "Next period", { actions.onShift(1) }, iconSize = 28.dp, enabled = state.canGoForward)
                }
                Spacer(Modifier.height(4.dp))
                RunovaCard(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
                    Column(Modifier.padding(horizontal = 18.dp, vertical = 16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                when (state.metric) {
                                    StatsMetric.CALORIES -> "Calories Burned"
                                    StatsMetric.DISTANCE -> "Distance"
                                    StatsMetric.TIME -> "Active Time"
                                },
                                style = Runova.type.body.copy(fontSize = 18.sp, fontWeight = FontWeight.SemiBold),
                                color = c.textPrimary,
                                modifier = Modifier.weight(1f),
                            )
                            MetricChips(state.metric, actions.onMetric)
                        }
                        Spacer(Modifier.height(6.dp))
                        AnimatedContent(targetState = state.totalValue to state.totalUnit, transitionSpec = { fadeIn(tween(250)) togetherWith fadeOut(tween(150)) }) { (v, u) ->
                            Text(
                                buildAnnotatedString {
                                    withStyle(SpanStyle(fontSize = 44.sp)) { append(v) }
                                    withStyle(SpanStyle(fontSize = 22.sp, fontFamily = Runova.type.body.fontFamily, fontWeight = FontWeight.Medium)) { append(" $u") }
                                },
                                style = Runova.type.metricL,
                                color = c.textPrimary,
                            )
                        }
                        Spacer(Modifier.height(10.dp))
                        if (state.bars.all { it <= 0.0 }) {
                            Box(Modifier.fillMaxWidth().height(180.dp), contentAlignment = Alignment.Center) {
                                Text("No runs in this period yet", style = Runova.type.bodyS, color = c.textSecondary)
                            }
                        } else {
                            BarChart(
                                values = state.bars,
                                labels = state.labels,
                                highlight = state.highlight,
                                valueLabel = { v -> state.barValueLabels.getOrElse(state.bars.indexOf(v)) { v.toInt().toString() } },
                                labelEvery = state.labelEvery,
                                chartHeight = 132.dp,
                                animationKey = Triple(state.range, state.metric, state.periodLabel),
                            )
                        }
                    }
                }
                Spacer(Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatBox(Icons.Outlined.LocationOn, c.teal, "Distance", state.distanceValue, state.distanceUnit, Modifier.weight(1f))
                    StatBox(Icons.Outlined.Timer, c.yellow, "Total Time", state.timeText, null, Modifier.weight(1f))
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatBox(Icons.Outlined.Schedule, c.yellow, "Avg Pace", state.paceValue, state.paceUnit, Modifier.weight(1f))
                    StatBox(Icons.Rounded.TaskAlt, c.teal, "Active Days", "${state.activeDays} / ${state.totalDays}", null, Modifier.weight(1f))
                }
                Spacer(Modifier.height(120.dp))
            }
        }
        RunovaBottomBar(MainTab.STATS, actions.onTab, Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
private fun MetricChips(selected: StatsMetric, onSelect: (StatsMetric) -> Unit) {
    val c = Runova.colors
    Row(
        Modifier.clip(CircleShape).background(c.surfaceHigh).padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        for ((m, label) in listOf(StatsMetric.CALORIES to "kcal", StatsMetric.DISTANCE to "dist", StatsMetric.TIME to "time")) {
            val active = m == selected
            Box(
                Modifier
                    .clip(CircleShape)
                    .background(if (active) c.lime else Color.Transparent)
                    .clickable(role = Role.Tab) { onSelect(m) }
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            ) {
                Text(label, style = Runova.type.caption.copy(fontSize = 12.sp), color = if (active) c.onLime else c.textSecondary)
            }
        }
    }
}

@Composable
private fun StatBox(icon: ImageVector, tint: Color, label: String, value: String, unit: String?, modifier: Modifier = Modifier) {
    val c = Runova.colors
    RunovaCard(modifier.height(98.dp), shape = RoundedCornerShape(22.dp)) {
        Row(Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 16.dp)) {
            Icon(icon, null, tint = tint, modifier = Modifier.size(26.dp))
            Spacer(Modifier.width(10.dp))
            Column {
                Text(label, style = Runova.type.body, color = c.textSecondary)
                Spacer(Modifier.height(8.dp))
                Text(
                    buildAnnotatedString {
                        withStyle(SpanStyle(fontSize = 29.sp)) { append(value) }
                        if (unit != null) withStyle(SpanStyle(fontSize = 17.sp, fontFamily = Runova.type.body.fontFamily, fontWeight = FontWeight.Medium)) { append(" $unit") }
                    },
                    style = Runova.type.metricM,
                    color = c.textPrimary,
                    maxLines = 1,
                )
            }
        }
    }
}

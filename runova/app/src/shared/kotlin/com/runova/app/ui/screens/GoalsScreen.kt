package com.runova.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.DirectionsWalk
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.CircleIconButton
import com.runova.app.ui.components.GoalRing
import com.runova.app.ui.components.LimeButton
import com.runova.app.ui.components.MainTab
import com.runova.app.ui.components.RunovaBottomBar
import com.runova.app.ui.components.RunovaCard
import com.runova.app.ui.components.RunovaIcons
import com.runova.app.ui.components.RunovaSheet
import com.runova.app.ui.components.ScreenTopBar
import com.runova.app.ui.components.SegmentedTabs
import com.runova.app.ui.model.GoalItemUi
import com.runova.app.ui.model.GoalsUiState
import com.runova.app.ui.theme.Runova
import com.runova.app.ui.theme.RunovaColors
import com.runova.core.format.Fmt
import com.runova.core.format.UnitConv
import com.runova.core.model.GoalMetric
import com.runova.core.model.GoalPeriod
import com.runova.core.model.GoalTargets
import com.runova.core.model.UnitSystem
import java.util.Locale
import kotlin.math.roundToInt

class GoalsActions(
    val onBack: () -> Unit = {},
    val onPeriod: (GoalPeriod) -> Unit = {},
    val onSaveTargets: (GoalPeriod, GoalTargets) -> Unit = { _, _ -> },
    val onTab: (MainTab) -> Unit = {},
)

internal fun GoalMetric.title() = when (this) {
    GoalMetric.CALORIES -> "Calories"
    GoalMetric.DISTANCE -> "Running"
    GoalMetric.STEPS -> "Steps"
    GoalMetric.ACTIVE_MINUTES -> "Active Time"
}

internal fun GoalMetric.icon(): ImageVector = when (this) {
    GoalMetric.CALORIES -> Icons.Rounded.LocalFireDepartment
    GoalMetric.DISTANCE -> RunovaIcons.Sneaker
    GoalMetric.STEPS -> Icons.Rounded.DirectionsWalk
    GoalMetric.ACTIVE_MINUTES -> Icons.Rounded.Bolt
}

internal fun GoalMetric.color(c: RunovaColors): Color = when (this) {
    GoalMetric.CALORIES -> c.orange
    GoalMetric.DISTANCE -> c.green
    GoalMetric.STEPS -> c.blue
    GoalMetric.ACTIVE_MINUTES -> c.purple
}

internal fun formatGoalValue(metric: GoalMetric, v: Double, units: UnitSystem): String = when (metric) {
    GoalMetric.DISTANCE -> {
        val d = UnitConv.kmToDisplay(v, units)
        if (d >= 100 || d == d.roundToInt().toDouble()) d.roundToInt().toString() else String.format(Locale.US, "%.1f", d)
    }
    else -> Fmt.integer(v.roundToInt())
}

internal fun goalUnit(metric: GoalMetric, units: UnitSystem) = when (metric) {
    GoalMetric.CALORIES -> "kcal"
    GoalMetric.DISTANCE -> Fmt.distanceUnit(units)
    GoalMetric.STEPS -> ""
    GoalMetric.ACTIVE_MINUTES -> "min"
}

@Composable
fun GoalsScreen(state: GoalsUiState, actions: GoalsActions) {
    val c = Runova.colors
    var editing by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            ScreenTopBar("Goals", actions.onBack)
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                SegmentedTabs(
                    listOf("Daily", "Weekly", "Monthly"),
                    GoalPeriod.entries.indexOf(state.period),
                    { actions.onPeriod(GoalPeriod.entries[it]) },
                )
                Spacer(Modifier.height(16.dp))
                state.items.forEach { item ->
                    GoalCard(item, state.units)
                    Spacer(Modifier.height(14.dp))
                }
                Spacer(Modifier.height(8.dp))
                LimeButton("Set New Goal", { editing = true }, Modifier.fillMaxWidth(), height = 60.dp, textStyle = Runova.type.titleS.copy(fontWeight = FontWeight.Bold, fontSize = 19.sp))
                Spacer(Modifier.height(120.dp))
            }
        }
        RunovaBottomBar(MainTab.GOALS, actions.onTab, Modifier.align(Alignment.BottomCenter))
        GoalEditorSheet(editing, state, onDismiss = { editing = false }) { targets ->
            editing = false
            actions.onSaveTargets(state.period, targets)
        }
    }
}

@Composable
private fun GoalCard(item: GoalItemUi, units: UnitSystem) {
    val c = Runova.colors
    val color = item.metric.color(c)
    RunovaCard(Modifier.fillMaxWidth().height(100.dp), shape = RoundedCornerShape(22.dp)) {
        Row(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(lerp(color, Color.White, 0.25f), color, lerp(color, Color.Black, 0.25f)))),
                contentAlignment = Alignment.Center,
            ) {
                Icon(item.metric.icon(), contentDescription = null, tint = Color.White, modifier = Modifier.size(30.dp))
            }
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f)) {
                Text(item.metric.title(), style = Runova.type.titleS.copy(fontSize = 18.sp), color = c.textPrimary)
                Spacer(Modifier.height(4.dp))
                val unit = goalUnit(item.metric, units)
                Text(
                    buildAnnotatedString {
                        withStyle(SpanStyle(color = c.textPrimary, fontWeight = FontWeight.Bold)) { append(formatGoalValue(item.metric, item.current, units)) }
                        withStyle(SpanStyle(color = c.textSecondary)) {
                            append(" / ${formatGoalValue(item.metric, item.target, units)}")
                            if (unit.isNotEmpty()) append(" $unit")
                        }
                    },
                    style = Runova.type.body.copy(fontSize = 18.sp),
                )
            }
            GoalRing(item.fraction, color, Modifier.size(70.dp), strokeWidth = 9.5.dp) {
                Text("${(item.fraction * 100).roundToInt()}%", style = Runova.type.caption.copy(fontSize = 12.sp, fontWeight = FontWeight.Bold), color = c.textSecondary)
            }
        }
    }
}

private fun step(metric: GoalMetric, units: UnitSystem): Double = when (metric) {
    GoalMetric.CALORIES -> 50.0
    GoalMetric.DISTANCE -> if (units == UnitSystem.METRIC) 0.5 else UnitConv.displayToKm(0.5, units)
    GoalMetric.STEPS -> 500.0
    GoalMetric.ACTIVE_MINUTES -> 5.0
}

private fun bounds(metric: GoalMetric, period: GoalPeriod): ClosedFloatingPointRange<Double> {
    val m = when (period) { GoalPeriod.DAILY -> 1.0; GoalPeriod.WEEKLY -> 7.0; GoalPeriod.MONTHLY -> 31.0 }
    return when (metric) {
        GoalMetric.CALORIES -> 50.0..(3_000.0 * m)
        GoalMetric.DISTANCE -> 0.5..(60.0 * m)
        GoalMetric.STEPS -> 500.0..(60_000.0 * m)
        GoalMetric.ACTIVE_MINUTES -> 5.0..(480.0 * m)
    }
}

@Composable
private fun GoalEditorSheet(visible: Boolean, state: GoalsUiState, onDismiss: () -> Unit, onSave: (GoalTargets) -> Unit) {
    val c = Runova.colors
    var draft by remember(visible, state.period, state.targets) { mutableStateOf(state.targets) }
    RunovaSheet(visible, onDismiss) {
        val periodName = when (state.period) { GoalPeriod.DAILY -> "daily"; GoalPeriod.WEEKLY -> "weekly"; GoalPeriod.MONTHLY -> "monthly" }
        Text("Set new $periodName goals", style = Runova.type.titleM, color = c.textPrimary)
        Spacer(Modifier.height(4.dp))
        Text("Adjust your targets. Progress rings update instantly.", style = Runova.type.bodyS, color = c.textSecondary)
        Spacer(Modifier.height(14.dp))
        GoalMetric.entries.forEach { metric ->
            val value = draft.target(metric)
            val st = step(metric, state.units)
            val range = bounds(metric, state.period)
            Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(CircleShape).background(metric.color(c).copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
                    Icon(metric.icon(), null, tint = metric.color(c), modifier = Modifier.size(22.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(metric.title(), style = Runova.type.body, color = c.textPrimary)
                    val unit = goalUnit(metric, state.units)
                    Text("${formatGoalValue(metric, value, state.units)}${if (unit.isNotEmpty()) " $unit" else ""}", style = Runova.type.metricS, color = c.accent)
                }
                StepperButton(Icons.Rounded.Remove, "Decrease ${metric.title()}") {
                    draft = draft.with(metric, (value - st).coerceIn(range))
                }
                Spacer(Modifier.width(10.dp))
                StepperButton(Icons.Rounded.Add, "Increase ${metric.title()}") {
                    draft = draft.with(metric, (value + st).coerceIn(range))
                }
            }
        }
        Spacer(Modifier.height(18.dp))
        LimeButton("Save Goals", { onSave(draft) }, Modifier.fillMaxWidth(), height = 56.dp, glow = false, textStyle = Runova.type.titleS.copy(fontWeight = FontWeight.Bold))
    }
}

@Composable
private fun StepperButton(icon: ImageVector, description: String, onClick: () -> Unit) {
    val c = Runova.colors
    CircleIconButton(icon, description, onClick, Modifier.border(1.dp, c.border, CircleShape), size = 44.dp, background = c.surfaceHigh, tint = c.textPrimary)
}

package com.runova.app.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.CircleIconButton
import com.runova.app.ui.components.FlameBrush
import com.runova.app.ui.components.GradientIcon
import com.runova.app.ui.components.LimeButton
import com.runova.app.ui.components.LimeProgressBar
import com.runova.app.ui.components.MainTab
import com.runova.app.ui.components.ProgressRing
import com.runova.app.ui.components.RunovaBottomBar
import com.runova.app.ui.components.RunovaCard
import com.runova.app.ui.components.RunovaIcons
import com.runova.app.ui.components.StatTile
import com.runova.app.ui.components.animatedNumber
import com.runova.app.ui.components.neonGlow
import com.runova.app.ui.model.DayChip
import com.runova.app.ui.model.HomeUiState
import com.runova.app.ui.theme.Runova
import com.runova.core.format.Fmt
import kotlin.math.roundToInt

class HomeActions(
    val onSelectDay: (Int) -> Unit = {},
    val onStartRun: () -> Unit = {},
    val onOpenActiveRun: () -> Unit = {},
    val onOpenNotifications: () -> Unit = {},
    val onOpenCoach: () -> Unit = {},
    val onTab: (MainTab) -> Unit = {},
)

@Composable
fun HomeScreen(state: HomeUiState, actions: HomeActions) {
    val c = Runova.colors
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(c.backgroundTop, c.background)))) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .statusBarsPadding()
                .padding(horizontal = 20.dp),
        ) {
            Spacer(Modifier.height(14.dp))
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(state.greeting, style = Runova.type.body.copy(fontSize = 21.sp, fontWeight = FontWeight.Medium), color = c.textPrimary)
                    Spacer(Modifier.height(2.dp))
                    Text("${state.name} 👋", style = Runova.type.titleXL, color = c.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Box {
                    CircleIconButton(Icons.Outlined.NotificationsNone, "Notifications", actions.onOpenNotifications, iconSize = 30.dp, size = 48.dp)
                    if (state.hasUnread) {
                        Box(
                            Modifier
                                .align(Alignment.TopEnd)
                                .padding(top = 9.dp, end = 10.dp)
                                .size(9.dp)
                                .clip(CircleShape)
                                .background(c.orange),
                        )
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            DayChips(state.week, state.selectedDay, actions.onSelectDay)
            Spacer(Modifier.height(14.dp))

            // Calorie ring
            val day = state.day
            val caloriesAnimated = animatedNumber(day.calories.toDouble())
            val ringProgress = if (day.caloriesGoal > 0) day.calories / day.caloriesGoal.toFloat() else 0f
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                ProgressRing(
                    progress = ringProgress,
                    modifier = Modifier.fillMaxWidth(0.70f).aspectRatio(1f),
                    strokeWidth = 22.dp,
                    colors = listOf(c.lime, Color(0xFF8FDB2E)),
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        GradientIcon(Icons.Rounded.LocalFireDepartment, FlameBrush, Modifier.size(40.dp))
                        Text(
                            Fmt.integer(caloriesAnimated.roundToInt()),
                            style = Runova.type.displayWide.copy(fontSize = 54.sp),
                            color = c.textPrimary,
                            modifier = Modifier.semantics { contentDescription = "${day.calories} kilocalories" },
                        )
                        Text("KCAL", style = Runova.type.metricS.copy(fontWeight = FontWeight.Bold, fontSize = 21.sp), color = c.accent)
                        Text("/ ${Fmt.integer(day.caloriesGoal)}", style = Runova.type.label.copy(fontSize = 14.sp), color = c.textSecondary)
                        Spacer(Modifier.height(6.dp))
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatTile(RunovaIcons.Sneaker, Fmt.integer(day.steps), if (day.stepsEstimated) "Steps (est.)" else "Steps", Modifier.weight(1f))
                StatTile(Icons.Outlined.LocationOn, Fmt.distanceValue(day.distanceM, state.units, 1), Fmt.distanceUnit(state.units).uppercase(), Modifier.weight(1f))
                StatTile(Icons.Outlined.Schedule, day.activeMinutes.toString(), "MIN", Modifier.weight(1f))
            }
            Spacer(Modifier.height(12.dp))
            RunovaCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(horizontal = 18.dp, vertical = 13.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Today's Progress", style = Runova.type.body, color = c.textPrimary, modifier = Modifier.weight(1f))
                        Text("${(day.progress * 100).roundToInt()}%", style = Runova.type.titleS.copy(fontWeight = FontWeight.Bold), color = c.textPrimary)
                    }
                    Spacer(Modifier.height(10.dp))
                    LimeProgressBar(day.progress, height = 11.dp)
                }
            }
            Spacer(Modifier.height(16.dp))
            val active = state.activeRun
            if (active != null) {
                ActiveRunCard(active.distanceM, active.movingTimeMs, active.paused, state, actions.onOpenActiveRun)
            } else {
                LimeButton("START RUN", actions.onStartRun, Modifier.fillMaxWidth(), icon = Icons.Rounded.PlayArrow, height = 62.dp)
            }
            if (state.coachTip != null) {
                Spacer(Modifier.height(16.dp))
                CoachTipCard(state.coachTip, actions.onOpenCoach)
            }
            Spacer(Modifier.height(110.dp))
        }
        RunovaBottomBar(MainTab.HOME, actions.onTab, Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
private fun DayChips(days: List<DayChip>, selected: Int, onSelect: (Int) -> Unit) {
    val c = Runova.colors
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        days.forEachIndexed { i, d ->
            val isSel = i == selected
            val bg by animateColorAsState(
                when {
                    isSel -> c.lime
                    d.hasActivity -> if (c.isDark) Color(0xFF26361C) else Color(0xFFDDF5B8)
                    else -> c.surface
                },
            )
            val fg by animateColorAsState(
                when {
                    isSel -> c.onLime
                    d.hasActivity -> if (c.isDark) Color(0xFFC7E98A) else Color(0xFF3F6E0A)
                    d.isFuture -> c.textTertiary
                    else -> c.textSecondary
                },
            )
            Box(
                Modifier
                    .weight(1f)
                    .height(46.dp)
                    .neonGlow(c.lime, radius = 10.dp, alpha = if (isSel && c.isDark) 0.25f else 0f)
                    .clip(CircleShape)
                    .background(bg)
                    .then(if (d.isToday && !isSel) Modifier.border(1.2.dp, c.accent.copy(alpha = 0.6f), CircleShape) else Modifier)
                    .clickable(enabled = !d.isFuture, role = Role.Tab) { onSelect(i) },
                contentAlignment = Alignment.Center,
            ) {
                Text(d.label, style = Runova.type.label.copy(fontSize = 14.sp, fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium), color = fg, maxLines = 1)
            }
        }
    }
}

@Composable
private fun ActiveRunCard(distanceM: Double, movingMs: Long, paused: Boolean, state: HomeUiState, onOpen: () -> Unit) {
    val c = Runova.colors
    val pulse = rememberInfiniteTransition().animateFloat(0.4f, 1f, infiniteRepeatable(tween(900), RepeatMode.Reverse))
    RunovaCard(Modifier.fillMaxWidth().neonGlow(c.lime, 16.dp, cornerRadius = 22.dp, alpha = if (c.isDark) 0.18f else 0f), onClick = onOpen, border = c.lime.copy(alpha = 0.7f), borderWidth = 1.5.dp, shape = RoundedCornerShape(22.dp)) {
        Row(Modifier.padding(horizontal = 18.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(12.dp).graphicsLayer { alpha = if (paused) 1f else pulse.value }.clip(CircleShape).background(if (paused) c.yellow else c.lime))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(if (paused) "Run paused" else "Run in progress", style = Runova.type.titleS, color = c.textPrimary)
                Text(
                    "${Fmt.distance(distanceM, state.units)} • ${Fmt.clock(movingMs)}",
                    style = Runova.type.bodyS,
                    color = c.textSecondary,
                )
            }
            Box(Modifier.clip(CircleShape).background(c.lime).padding(horizontal = 16.dp, vertical = 9.dp)) {
                Text("OPEN", style = Runova.type.label.copy(fontWeight = FontWeight.ExtraBold), color = c.onLime)
            }
        }
    }
}

@Composable
internal fun CoachTipCard(text: String, onClick: () -> Unit) {
    val c = Runova.colors
    RunovaCard(Modifier.fillMaxWidth(), onClick = onClick) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(c.teal.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                Icon(RunovaIcons.CoachBot, contentDescription = null, tint = c.teal, modifier = Modifier.size(28.dp))
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text("AI Coach", style = Runova.type.label.copy(fontWeight = FontWeight.Bold), color = c.teal)
                Spacer(Modifier.height(2.dp))
                Text(text, style = Runova.type.bodyS, color = c.textPrimary, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.Rounded.ChevronRight, null, tint = c.textSecondary)
        }
    }
}

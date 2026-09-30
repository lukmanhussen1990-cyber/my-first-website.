package com.runova.app.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.AchievementBadge
import com.runova.app.ui.components.ConfettiBurst
import com.runova.app.ui.components.GhostButton
import com.runova.app.ui.components.LimeButton
import com.runova.app.ui.components.PlatformBackHandler
import com.runova.app.ui.components.RunovaCard
import com.runova.app.ui.components.circleGlow
import com.runova.app.ui.components.neonGlow
import com.runova.app.ui.model.RunCompleteUiState
import com.runova.app.ui.theme.Runova
import com.runova.core.format.Fmt
import com.runova.core.progress.Levels
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

class RunCompleteActions(
    val onViewDetails: () -> Unit = {},
    val onDone: () -> Unit = {},
    val onOpenAchievements: () -> Unit = {},
)

@Composable
fun RunCompleteScreen(state: RunCompleteUiState, actions: RunCompleteActions) {
    val c = Runova.colors
    PlatformBackHandler(onBack = actions.onDone)
    val check = remember { Animatable(0f) }
    val stats = remember { Animatable(0f) }
    val xp = remember { Animatable(0f) }
    val bar = remember { Animatable(state.levelBefore.fraction) }
    var shownLevel by remember { mutableIntStateOf(state.levelBefore.level) }
    var linesShown by remember { mutableIntStateOf(0) }
    var leveledUp by remember { mutableStateOf(false) }
    val levelBadge = remember { Animatable(0f) }
    val extras = remember { Animatable(0f) }
    var confettiKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(state.runId) {
        launch { check.animateTo(1f, spring(dampingRatio = 0.45f, stiffness = 220f)) }
        delay(250)
        launch { stats.animateTo(1f, tween(500, easing = FastOutSlowInEasing)) }
        delay(450)
        launch {
            for (i in state.xpLines.indices) {
                linesShown = i + 1
                delay(170)
            }
        }
        launch { xp.animateTo(state.xpGained.toFloat(), tween(1400, easing = FastOutSlowInEasing)) }
        // level bar: fill through every level gained
        var level = state.levelBefore.level
        while (level < state.levelAfter.level) {
            bar.animateTo(1f, tween(650, easing = FastOutSlowInEasing))
            level++
            shownLevel = level
            leveledUp = true
            confettiKey++
            launch { levelBadge.snapTo(0f); levelBadge.animateTo(1f, spring(dampingRatio = 0.4f, stiffness = 260f)) }
            bar.snapTo(0f)
        }
        bar.animateTo(state.levelAfter.fraction, tween(700, easing = FastOutSlowInEasing))
        extras.animateTo(1f, tween(450))
    }

    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF12230E).copy(alpha = if (c.isDark) 1f else 0.15f), c.background, c.background)))) {
        ConfettiBurst(trigger = "done-${state.runId}-$confettiKey", modifier = Modifier.fillMaxWidth().height(420.dp))
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().padding(horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(30.dp))
            Box(
                Modifier
                    .size(96.dp)
                    .graphicsLayer { scaleX = check.value; scaleY = check.value }
                    .circleGlow(c.lime, 26.dp, if (c.isDark) 0.4f else 0.15f)
                    .clip(CircleShape)
                    .background(c.lime),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Rounded.Check, null, tint = c.onLime, modifier = Modifier.size(58.dp))
            }
            Spacer(Modifier.height(16.dp))
            Text("Run Complete!", style = Runova.type.titleXL.copy(fontSize = 32.sp), color = c.textPrimary)
            Text("Great work — here's what you earned.", style = Runova.type.body, color = c.textSecondary)
            Spacer(Modifier.height(20.dp))

            // headline stats
            RunovaCard(
                Modifier.fillMaxWidth().graphicsLayer { alpha = stats.value; translationY = (1f - stats.value) * 60f },
                shape = RoundedCornerShape(24.dp),
            ) {
                Column(Modifier.padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(Fmt.distanceValue(state.distanceM, state.units), style = Runova.type.metricXL.copy(fontSize = 64.sp), color = c.textPrimary)
                        Text(" ${Fmt.distanceUnit(state.units)}", style = Runova.type.titleM, color = c.textSecondary, modifier = Modifier.padding(bottom = 12.dp))
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(Modifier.fillMaxWidth()) {
                        MiniStat(Fmt.durationCompact(state.movingTimeMs), "Time", Modifier.weight(1f))
                        MiniStat(Fmt.pace(state.avgPaceSecPerKm, state.units), "Pace ${Fmt.paceUnit(state.units)}", Modifier.weight(1f))
                        MiniStat(Fmt.calories(state.calories), "kcal (est.)", Modifier.weight(1f))
                    }
                }
            }
            Spacer(Modifier.height(14.dp))

            // XP card
            RunovaCard(
                Modifier.fillMaxWidth().graphicsLayer { alpha = stats.value }.neonGlow(c.lime, 14.dp, cornerRadius = 24.dp, alpha = if (c.isDark) 0.1f else 0f),
                shape = RoundedCornerShape(24.dp),
                border = c.lime.copy(alpha = 0.45f),
            ) {
                Column(Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("+${xp.value.roundToInt()} XP", style = Runova.type.displayWide.copy(fontSize = 40.sp), color = c.accent, modifier = Modifier.weight(1f))
                        if (leveledUp) {
                            Box(
                                Modifier
                                    .graphicsLayer { scaleX = levelBadge.value; scaleY = levelBadge.value }
                                    .circleGlow(c.lime, 10.dp, if (c.isDark) 0.35f else 0f)
                                    .clip(CircleShape)
                                    .background(c.lime)
                                    .padding(horizontal = 14.dp, vertical = 8.dp),
                            ) {
                                Text("LEVEL UP!", style = Runova.type.label.copy(fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp), color = c.onLime)
                            }
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    state.xpLines.forEachIndexed { i, line ->
                        val visible = i < linesShown
                        Row(Modifier.fillMaxWidth().padding(vertical = 3.dp).graphicsLayer { alpha = if (visible) 1f else 0f; translationX = if (visible) 0f else 30f }) {
                            Text(line.label, style = Runova.type.body, color = c.textSecondary, modifier = Modifier.weight(1f))
                            Text("+${line.amount}", style = Runova.type.body.copy(fontWeight = FontWeight.Bold), color = c.textPrimary)
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Level $shownLevel", style = Runova.type.titleS, color = c.textPrimary)
                        Spacer(Modifier.width(8.dp))
                        Text(Levels.title(shownLevel), style = Runova.type.label, color = c.accent)
                        Spacer(Modifier.weight(1f))
                        Text("${Fmt.integer(state.levelAfter.xpToNext)} XP to Level ${state.levelAfter.level + 1}", style = Runova.type.caption, color = c.textSecondary)
                    }
                    Spacer(Modifier.height(8.dp))
                    Box(Modifier.fillMaxWidth().height(12.dp).clip(CircleShape).background(c.track)) {
                        Box(Modifier.fillMaxWidth(bar.value.coerceIn(0.02f, 1f)).height(12.dp).clip(CircleShape).background(Brush.horizontalGradient(listOf(c.limeDeep, c.lime))))
                    }
                }
            }

            if (state.newAchievements.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                RunovaCard(Modifier.fillMaxWidth().graphicsLayer { alpha = extras.value }, onClick = actions.onOpenAchievements, shape = RoundedCornerShape(24.dp)) {
                    Column(Modifier.padding(18.dp)) {
                        Text(if (state.newAchievements.size == 1) "Achievement unlocked" else "${state.newAchievements.size} achievements unlocked", style = Runova.type.titleS, color = c.textPrimary)
                        Spacer(Modifier.height(12.dp))
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            state.newAchievements.forEachIndexed { i, def ->
                                val pop = ((extras.value - i * 0.15f) / 0.5f).coerceIn(0f, 1f)
                                Column(Modifier.width(86.dp).graphicsLayer { scaleX = 0.6f + 0.4f * pop; scaleY = 0.6f + 0.4f * pop; alpha = pop }, horizontalAlignment = Alignment.CenterHorizontally) {
                                    AchievementBadge(def.icon, def.tone, size = 72.dp)
                                    Spacer(Modifier.height(4.dp))
                                    Text(def.title, style = Runova.type.caption.copy(fontSize = 12.sp), color = c.textPrimary, textAlign = TextAlign.Center, maxLines = 2)
                                    Text("+${def.xp} XP", style = Runova.type.caption, color = c.accent)
                                }
                            }
                        }
                    }
                }
            }
            if (state.goalsCompleted.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                Column(Modifier.fillMaxWidth().graphicsLayer { alpha = extras.value }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    state.goalsCompleted.forEach { g ->
                        Row(
                            Modifier.fillMaxWidth().clip(CircleShape).background(c.surface).clickable {}.padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Rounded.CheckCircle, null, tint = c.accent, modifier = Modifier.size(22.dp))
                            Spacer(Modifier.width(10.dp))
                            Text(g, style = Runova.type.body, color = c.textPrimary)
                        }
                    }
                }
            }
            Spacer(Modifier.height(22.dp))
            LimeButton("VIEW DETAILS", actions.onViewDetails, Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
            GhostButton("Done", actions.onDone, Modifier.fillMaxWidth())
            Spacer(Modifier.navigationBarsPadding().height(24.dp))
        }
    }
}

@Composable
private fun MiniStat(value: String, label: String, modifier: Modifier = Modifier) {
    val c = Runova.colors
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = Runova.type.metricM, color = c.textPrimary)
        Text(label, style = Runova.type.caption.copy(fontSize = 12.sp), color = c.textSecondary)
    }
}

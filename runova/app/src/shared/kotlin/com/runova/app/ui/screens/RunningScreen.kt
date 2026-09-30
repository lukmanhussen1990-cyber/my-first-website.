package com.runova.app.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Flag
import androidx.compose.material.icons.rounded.LightMode
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.MyLocation
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PauseCircle
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.RecordVoiceOver
import androidx.compose.material.icons.rounded.Stop
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.CircleIconButton
import com.runova.app.ui.components.FlameBrush
import com.runova.app.ui.components.GhostButton
import com.runova.app.ui.components.GradientIcon
import com.runova.app.ui.components.HairlineDivider
import com.runova.app.ui.components.LimeButton
import com.runova.app.ui.components.MapMarkerStyle
import com.runova.app.ui.components.PlatformBackHandler
import com.runova.app.ui.components.RunMap
import com.runova.app.ui.components.RunovaIcons
import com.runova.app.ui.components.RunovaSheet
import com.runova.app.ui.components.ToggleRow
import com.runova.app.ui.components.TopToast
import com.runova.app.ui.components.circleGlow
import com.runova.app.ui.components.rememberMapCamera
import com.runova.app.ui.model.GpsSignal
import com.runova.app.ui.model.LiveStatus
import com.runova.app.ui.model.RunningUiState
import com.runova.app.ui.theme.Runova
import com.runova.core.format.Fmt
import com.runova.core.model.UnitSystem
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class RunningActions(
    val onMinimize: () -> Unit = {},
    val onPause: () -> Unit = {},
    val onResume: () -> Unit = {},
    val onFinish: () -> Unit = {},
    val onDiscard: () -> Unit = {},
    val onCamera: () -> Unit = {},
    val onVoiceChange: (Boolean) -> Unit = {},
    val onAutoPauseChange: (Boolean) -> Unit = {},
    val onKeepScreenOnChange: (Boolean) -> Unit = {},
)

@Composable
fun RunningScreen(state: RunningUiState, actions: RunningActions) {
    val c = Runova.colors
    var showFinish by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    val camera = rememberMapCamera()
    PlatformBackHandler(enabled = !showFinish && !showSettings, onBack = actions.onMinimize)

    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize()) {
            // ---------------------------------------------------------------- map
            Box(
                Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp)),
            ) {
                RunMap(
                    segments = state.route,
                    modifier = Modifier.fillMaxSize(),
                    camera = camera,
                    current = state.current,
                    follow = true,
                    markers = MapMarkerStyle.LIVE,
                    routeWidth = 5.5.dp,
                    fitPadding = 44.dp,
                    topInset = 120.dp,
                )
                Box(Modifier.fillMaxWidth().height(150.dp).background(Brush.verticalGradient(listOf(c.background.copy(alpha = 0.92f), Color.Transparent))))
                Column(Modifier.statusBarsPadding()) {
                    Box(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 8.dp)) {
                        CircleIconButton(Icons.Rounded.ArrowBack, "Minimize run", actions.onMinimize, Modifier.align(Alignment.CenterStart), iconSize = 26.dp)
                        Text("Running", style = Runova.type.titleM, color = c.textPrimary, modifier = Modifier.align(Alignment.Center))
                        CircleIconButton(Icons.Outlined.Settings, "Run settings", { showSettings = true }, Modifier.align(Alignment.CenterEnd), iconSize = 26.dp)
                    }
                    GpsChip(state.gps, Modifier.padding(start = 18.dp, top = 4.dp))
                }
                if (camera.userMoved) {
                    CircleIconButton(
                        Icons.Rounded.MyLocation,
                        "Recenter map",
                        { camera.userMoved = false },
                        Modifier.align(Alignment.BottomEnd).padding(14.dp),
                        background = c.surface.copy(alpha = 0.92f),
                        tint = c.accent,
                    )
                }
                StatusPill(state.status, Modifier.align(Alignment.BottomCenter).padding(bottom = 16.dp))
            }
            // ---------------------------------------------------------------- metrics
            Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(top = 22.dp)) {
                Row {
                    BigMetric(Fmt.distanceValue(state.distanceM, state.units), if (state.units == UnitSystem.METRIC) "Kilometers" else "Miles", Modifier.weight(0.85f))
                    BigMetric(Fmt.clock(state.movingTimeMs), "Duration", Modifier.weight(1.15f), alignEnd = false)
                }
                Spacer(Modifier.height(16.dp))
                HairlineDivider()
                Spacer(Modifier.height(16.dp))
                Row(verticalAlignment = Alignment.Top) {
                    SmallMetric(null, Fmt.pace(state.currentPaceSecPerKm ?: state.avgPaceSecPerKm, state.units), "Pace ${Fmt.paceUnit(state.units)}".replace("/", "/ "), Modifier.weight(1f))
                    SmallMetric({ GradientIcon(Icons.Rounded.LocalFireDepartment, FlameBrush, Modifier.size(26.dp)) }, Fmt.calories(state.calories), "KCAL", Modifier.weight(1f))
                    if (state.heartRateConnected) {
                        SmallMetric({ Icon(Icons.Rounded.Favorite, null, tint = c.red, modifier = Modifier.size(26.dp)) }, state.heartRate?.toString() ?: "--", "BPM", Modifier.weight(1f))
                    } else {
                        SmallMetric({ Icon(RunovaIcons.Sneaker, null, tint = c.accent, modifier = Modifier.size(26.dp)) }, Fmt.integer(state.steps), if (state.stepsEstimated) "STEPS (EST.)" else "STEPS", Modifier.weight(1f))
                    }
                }
            }
            // ---------------------------------------------------------------- controls
            Row(
                Modifier.fillMaxWidth().navigationBarsPadding().padding(top = 26.dp, bottom = 26.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RoundControl(Icons.Rounded.CameraAlt, "Take photo", 64.dp, c.surfaceHigh, c.textPrimary, actions.onCamera, badge = state.photos.takeIf { it > 0 })
                PauseResumeButton(state.status, actions)
                RoundControl(Icons.Rounded.Stop, "Finish run", 64.dp, c.red, Color.White, { showFinish = true }, glow = c.red)
            }
        }

        TopToast(state.splitToast, Modifier.align(Alignment.TopCenter), icon = Icons.Rounded.Flag)

        // countdown overlay
        AnimatedVisibility(state.status == LiveStatus.COUNTDOWN, enter = fadeIn(), exit = fadeOut(tween(400))) {
            Box(
                Modifier.fillMaxSize().background(c.background.copy(alpha = 0.97f)).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
                contentAlignment = Alignment.Center,
            ) {
                Countdown(state.countdown ?: 0)
            }
        }

        RunovaSheet(showSettings, { showSettings = false }) {
            Text("Run settings", style = Runova.type.titleM, color = c.textPrimary)
            Spacer(Modifier.height(8.dp))
            ToggleRow("Voice feedback", "Announce every ${if (state.units == UnitSystem.METRIC) "kilometer" else "mile"}", state.voiceEnabled, actions.onVoiceChange, Icons.Rounded.RecordVoiceOver)
            ToggleRow("Auto-pause", "Pause automatically when you stop moving", state.autoPauseEnabled, actions.onAutoPauseChange, Icons.Rounded.PauseCircle)
            ToggleRow("Keep screen on", "Keep the display awake on this screen", state.keepScreenOn, actions.onKeepScreenOnChange, Icons.Rounded.LightMode)
        }

        RunovaSheet(showFinish, { showFinish = false }) {
            val tooShort = state.distanceM < 50 && state.movingTimeMs < 60_000
            Text(if (tooShort) "Run too short" else "Finish your run?", style = Runova.type.titleM, color = c.textPrimary)
            Spacer(Modifier.height(6.dp))
            Text(
                if (tooShort) "Runs shorter than 50 m and 1 minute can't be saved. Keep running or discard it."
                else "${Fmt.distance(state.distanceM, state.units)} in ${Fmt.durationCompact(state.movingTimeMs)} · ~${Fmt.calories(state.calories)} kcal (estimated)",
                style = Runova.type.bodyS,
                color = c.textSecondary,
            )
            Spacer(Modifier.height(20.dp))
            if (!tooShort) {
                LimeButton("FINISH & SAVE", { showFinish = false; actions.onFinish() }, Modifier.fillMaxWidth(), icon = Icons.Rounded.Flag)
                Spacer(Modifier.height(10.dp))
            }
            GhostButton("Keep running", { showFinish = false }, Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
            GhostButton("Discard run", { showFinish = false; actions.onDiscard() }, Modifier.fillMaxWidth(), color = c.red)
        }
    }
}

@Composable
private fun BigMetric(value: String, label: String, modifier: Modifier = Modifier, alignEnd: Boolean = false) {
    val c = Runova.colors
    Column(modifier, horizontalAlignment = if (alignEnd) Alignment.End else Alignment.Start) {
        Text(value, style = Runova.type.metricXL, color = c.textPrimary, maxLines = 1, softWrap = false)
        Text(label, style = Runova.type.body, color = c.textSecondary)
    }
}

@Composable
private fun SmallMetric(icon: (@Composable () -> Unit)?, value: String, label: String, modifier: Modifier = Modifier) {
    val c = Runova.colors
    Column(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                icon()
                Spacer(Modifier.width(6.dp))
            }
            Text(value, style = Runova.type.metricM.copy(fontSize = 29.sp), color = c.textPrimary, maxLines = 1)
        }
        Text(label, style = Runova.type.bodyS, color = c.textSecondary, maxLines = 1)
    }
}

@Composable
fun GpsChip(signal: GpsSignal, modifier: Modifier = Modifier) {
    val c = Runova.colors
    val bars = when (signal) {
        GpsSignal.NONE -> 0
        GpsSignal.WEAK -> 1
        GpsSignal.FAIR -> 2
        GpsSignal.GOOD -> 4
    }
    val pulse = rememberInfiniteTransition().animateFloat(0.35f, 1f, infiniteRepeatable(tween(800), RepeatMode.Reverse))
    val dot = if (signal == GpsSignal.NONE) c.yellow else c.lime
    Row(
        modifier
            .clip(CircleShape)
            .background(c.background.copy(alpha = 0.72f))
            .border(1.3.dp, c.lime.copy(alpha = 0.75f), CircleShape)
            .padding(horizontal = 12.dp, vertical = 7.dp)
            .semantics { contentDescription = "GPS signal ${signal.name.lowercase()}" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(10.dp)
                .graphicsLayer { alpha = if (signal == GpsSignal.NONE) pulse.value else 1f }
                .circleGlow(dot, 4.dp, 0.6f)
                .clip(CircleShape)
                .background(dot),
        )
        Spacer(Modifier.width(7.dp))
        Text(if (signal == GpsSignal.NONE) "Searching GPS" else "GPS", style = Runova.type.label.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary)
        Spacer(Modifier.width(7.dp))
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            for (i in 1..4) {
                Box(
                    Modifier
                        .width(3.dp)
                        .height((4 + i * 3).dp)
                        .clip(RoundedCornerShape(1.dp))
                        .background(if (i <= bars) c.lime else c.textTertiary.copy(alpha = 0.5f)),
                )
            }
        }
    }
}

@Composable
private fun StatusPill(status: LiveStatus, modifier: Modifier = Modifier) {
    val c = Runova.colors
    val visible = status == LiveStatus.PAUSED || status == LiveStatus.AUTO_PAUSED
    val pulse = rememberInfiniteTransition().animateFloat(0.55f, 1f, infiniteRepeatable(tween(700), RepeatMode.Reverse))
    AnimatedVisibility(visible, modifier = modifier, enter = scaleIn(spring(dampingRatio = 0.6f)) + fadeIn(), exit = scaleOut() + fadeOut()) {
        Row(
            Modifier
                .clip(CircleShape)
                .background(c.yellow)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(8.dp).graphicsLayer { alpha = pulse.value }.clip(CircleShape).background(Color(0xFF3A2A00)))
            Spacer(Modifier.width(8.dp))
            Text(
                if (status == LiveStatus.AUTO_PAUSED) "AUTO-PAUSED" else "PAUSED",
                style = Runova.type.label.copy(fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp),
                color = Color(0xFF2A1F00),
            )
        }
    }
}

@Composable
private fun RoundControl(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    description: String,
    size: Dp,
    background: Color,
    tint: Color,
    onClick: () -> Unit,
    glow: Color? = null,
    badge: Int? = null,
) {
    val c = Runova.colors
    Box {
        Box(
            Modifier
                .size(size)
                .circleGlow(glow ?: Color.Transparent, 14.dp, if (glow != null && c.isDark) 0.35f else 0f)
                .clip(CircleShape)
                .background(background)
                .clickable(role = Role.Button, onClick = onClick)
                .semantics { contentDescription = description },
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, tint = tint, modifier = Modifier.size(size * if (icon == Icons.Rounded.Stop) 0.62f else 0.46f))
        }
        if (badge != null) {
            Box(
                Modifier.align(Alignment.TopEnd).size(22.dp).clip(CircleShape).background(c.lime),
                contentAlignment = Alignment.Center,
            ) { Text(badge.toString(), style = Runova.type.caption, color = c.onLime) }
        }
    }
}

@Composable
private fun PauseResumeButton(status: LiveStatus, actions: RunningActions) {
    val c = Runova.colors
    val haptics = LocalHapticFeedback.current
    val paused = status == LiveStatus.PAUSED || status == LiveStatus.AUTO_PAUSED
    val breathe = rememberInfiniteTransition().animateFloat(1f, 1.08f, infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse))
    var pressed by remember { mutableStateOf(false) }
    val press by animateFloatAsState(if (pressed) 0.9f else 1f, spring(dampingRatio = 0.45f, stiffness = Spring.StiffnessMedium))
    LaunchedEffect(pressed) { if (pressed) { delay(120); pressed = false } }
    Box(
        Modifier
            .size(104.dp)
            .graphicsLayer {
                val s = press * if (paused) breathe.value else 1f
                scaleX = s; scaleY = s
            }
            .circleGlow(c.lime, 22.dp, if (c.isDark) 0.42f else 0.2f)
            .clip(CircleShape)
            .background(Brush.verticalGradient(listOf(Color(0xFFDFFF7A), c.lime, Color(0xFFA9E534))))
            .clickable(role = Role.Button) {
                pressed = true
                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                if (paused) actions.onResume() else actions.onPause()
            }
            .semantics { contentDescription = if (paused) "Resume run" else "Pause run" },
        contentAlignment = Alignment.Center,
    ) {
        AnimatedContent(
            targetState = paused,
            transitionSpec = { (scaleIn(tween(220), initialScale = 0.6f) + fadeIn(tween(220))) togetherWith (scaleOut(tween(180), targetScale = 0.6f) + fadeOut(tween(180))) },
        ) { isPaused ->
            Icon(if (isPaused) Icons.Rounded.PlayArrow else Icons.Rounded.Pause, null, tint = c.onLime, modifier = Modifier.size(52.dp))
        }
    }
}

@Composable
private fun Countdown(value: Int) {
    val c = Runova.colors
    val scale = remember(value) { Animatable(1.6f) }
    val alpha = remember(value) { Animatable(0f) }
    LaunchedEffect(value) {
        alpha.snapTo(0f)
        scale.snapTo(1.6f)
        coroutineScope {
            launch { alpha.animateTo(1f, tween(180)) }
            launch { scale.animateTo(1f, spring(dampingRatio = 0.5f, stiffness = 260f)) }
        }
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier
                .size(200.dp)
                .graphicsLayer { scaleX = scale.value; scaleY = scale.value; this.alpha = alpha.value }
                .circleGlow(c.lime, 40.dp, 0.35f)
                .clip(CircleShape)
                .background(c.lime),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                if (value <= 0) "GO!" else value.toString(),
                style = Runova.type.display.copy(fontSize = if (value <= 0) 70.sp else 100.sp, fontWeight = FontWeight.Bold),
                color = c.onLime,
                textAlign = TextAlign.Center,
            )
        }
        Spacer(Modifier.height(30.dp))
        Text(if (value <= 0) "Let's go!" else "Get ready…", style = Runova.type.titleM, color = c.textPrimary)
        Spacer(Modifier.height(4.dp))
        Text("GPS tracking starts now", style = Runova.type.bodyS, color = c.textSecondary)
    }
}

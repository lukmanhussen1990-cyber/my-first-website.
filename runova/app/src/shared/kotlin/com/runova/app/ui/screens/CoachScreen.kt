package com.runova.app.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DeleteSweep
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Send
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.CircleIconButton
import com.runova.app.ui.components.GradientIcon
import com.runova.app.ui.components.RunovaCard
import com.runova.app.ui.components.RunovaIcons
import com.runova.app.ui.components.circleGlow
import com.runova.app.ui.model.ChatMessageUi
import com.runova.app.ui.model.ChatRole
import com.runova.app.ui.model.CoachUiState
import com.runova.app.ui.theme.Runova
import com.runova.core.coach.InsightKind

class CoachActions(
    val onBack: (() -> Unit)? = null,
    val onSend: (String) -> Unit = {},
    val onClear: () -> Unit = {},
    val onOpenSettings: () -> Unit = {},
)

private val suggestions = listOf("How far did I run this week?", "Suggest a workout", "What's my best pace?", "How is my streak?", "Recovery tips")

@Composable
fun CoachScreen(state: CoachUiState, actions: CoachActions) {
    val c = Runova.colors
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val itemCount = state.insights.size + state.messages.size + (if (state.thinking) 1 else 0)
    LaunchedEffect(state.messages.size, state.thinking) {
        if (state.messages.isNotEmpty()) listState.animateScrollToItem(itemCount.coerceAtLeast(1) - 1)
    }
    fun send(text: String) {
        val t = text.trim()
        if (t.isEmpty() || state.thinking) return
        actions.onSend(t)
        input = ""
    }
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding().imePadding()) {
            Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 10.dp, top = 12.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                if (actions.onBack != null) {
                    CircleIconButton(Icons.Rounded.ArrowBack, "Back", actions.onBack, iconSize = 26.dp)
                    Spacer(Modifier.width(4.dp))
                } else {
                    Spacer(Modifier.width(10.dp))
                }
                CoachAvatar(52.dp)
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text("AI Coach", style = Runova.type.titleXL.copy(fontSize = 29.sp), color = c.textPrimary)
                    Text(
                        if (state.usingClaude) "Powered by Claude · personalised" else "Offline coach · your data stays on device",
                        style = Runova.type.caption.copy(fontSize = 12.sp, fontWeight = FontWeight.Medium),
                        color = c.textSecondary,
                    )
                }
                if (state.messages.isNotEmpty()) CircleIconButton(Icons.Outlined.DeleteSweep, "Clear conversation", actions.onClear, iconSize = 24.dp, tint = c.textSecondary)
                CircleIconButton(Icons.Outlined.Tune, "Coach settings", actions.onOpenSettings, iconSize = 24.dp, tint = c.textSecondary)
            }
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                items(state.insights, key = { "insight-" + it.text }) { insight ->
                    InsightCard(insight.kind, insight.text)
                }
                items(state.messages, key = { "msg-${it.id}" }) { msg ->
                    ChatBubble(msg)
                }
                if (state.thinking) item(key = "thinking") { ThinkingBubble() }
                if (state.error != null) item(key = "error") {
                    Text(state.error, style = Runova.type.bodyS, color = c.orange, modifier = Modifier.padding(horizontal = 6.dp))
                }
            }
            if (state.messages.isEmpty()) {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    suggestions.forEach { s ->
                        Box(
                            Modifier
                                .clip(CircleShape)
                                .background(c.surface)
                                .border(1.dp, c.border, CircleShape)
                                .clickable { send(s) }
                                .padding(horizontal = 14.dp, vertical = 9.dp),
                        ) { Text(s, style = Runova.type.label, color = c.textPrimary) }
                    }
                }
            }
            InputBar(input, { input = it }, { send(input) }, enabled = !state.thinking)
        }
    }
}

@Composable
fun CoachAvatar(size: Dp) {
    val c = Runova.colors
    Box(
        Modifier
            .size(size)
            .circleGlow(c.teal, 8.dp, if (c.isDark) 0.25f else 0f),
        contentAlignment = Alignment.Center,
    ) {
        GradientIcon(RunovaIcons.CoachBot, Brush.verticalGradient(listOf(Color(0xFF7CF5C6), Color(0xFF34C98E))), Modifier.size(size))
    }
}

private fun InsightKind.mascotColor(): Color = when (this) {
    InsightKind.GOAL, InsightKind.STREAK -> Color(0xFFFFC94D)
    InsightKind.TREND, InsightKind.LEVEL, InsightKind.WELCOME -> Color(0xFF8BE04A)
    InsightKind.SUGGESTION, InsightKind.ACHIEVEMENT -> Color(0xFF55B6FF)
    InsightKind.RECOVERY -> Color(0xFFB9F23D)
}

/** Small friendly mascot face; colour depends on the kind of insight. */
@Composable
fun CoachMascot(kind: InsightKind, size: Dp = 42.dp) {
    val color = kind.mascotColor()
    val blink = rememberInfiniteTransition().animateFloat(1f, 0.1f, infiniteRepeatable(tween(160, delayMillis = 2600), RepeatMode.Reverse))
    Box(Modifier.size(size + 8.dp).clip(CircleShape).background(Color(0xFF0B1216)), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size)) {
            val w = this.size.width
            val h = this.size.height
            // body blob with a soft highlight
            drawCircle(Brush.radialGradient(listOf(lerp(color, Color.White, 0.35f), color, lerp(color, Color.Black, 0.3f)), center = Offset(w * 0.4f, h * 0.35f), radius = w * 0.6f), radius = w * 0.42f, center = Offset(w / 2, h * 0.54f))
            // little ears / antenna
            when (kind) {
                InsightKind.GOAL, InsightKind.STREAK -> drawCircle(Color(0xFFFF7A2F), radius = w * 0.09f, center = Offset(w / 2, h * 0.1f))
                InsightKind.SUGGESTION, InsightKind.ACHIEVEMENT -> {
                    drawCircle(color, radius = w * 0.11f, center = Offset(w * 0.2f, h * 0.24f))
                    drawCircle(color, radius = w * 0.11f, center = Offset(w * 0.8f, h * 0.24f))
                }
                else -> drawLine(color, Offset(w / 2, h * 0.14f), Offset(w / 2, h * 0.02f), strokeWidth = w * 0.06f, cap = StrokeCap.Round)
            }
            // eyes
            val eyeY = h * 0.5f
            val eyeH = w * 0.12f * blink.value
            for (ex in listOf(w * 0.36f, w * 0.64f)) {
                drawOval(Color(0xFF14191C), topLeft = Offset(ex - w * 0.055f, eyeY - eyeH / 2), size = Size(w * 0.11f, eyeH.coerceAtLeast(1f)))
            }
            // smile
            drawArc(Color(0xFF14191C), startAngle = 20f, sweepAngle = 140f, useCenter = false, topLeft = Offset(w * 0.38f, h * 0.52f), size = Size(w * 0.24f, h * 0.18f), style = Stroke(w * 0.05f, cap = StrokeCap.Round))
        }
    }
}

@Composable
private fun InsightCard(kind: InsightKind, text: String) {
    val c = Runova.colors
    RunovaCard(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 18.dp), verticalAlignment = Alignment.Top) {
            CoachMascot(kind)
            Spacer(Modifier.width(14.dp))
            Text(text, style = Runova.type.body.copy(fontSize = 17.sp, lineHeight = 25.sp), color = c.textPrimary, modifier = Modifier.weight(1f).padding(top = 2.dp))
        }
    }
}

@Composable
private fun ChatBubble(msg: ChatMessageUi) {
    val c = Runova.colors
    val mine = msg.role == ChatRole.USER
    AnimatedVisibility(visible = true, enter = fadeIn() + slideInVertically { it / 3 }) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start, verticalAlignment = Alignment.Top) {
            if (!mine) {
                CoachMascot(InsightKind.WELCOME, 30.dp)
                Spacer(Modifier.width(10.dp))
            }
            Box(
                Modifier
                    .widthIn(max = 290.dp)
                    .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp, bottomStart = if (mine) 22.dp else 6.dp, bottomEnd = if (mine) 6.dp else 22.dp))
                    .background(if (mine) c.lime else c.surface)
                    .then(if (mine) Modifier else Modifier.border(1.dp, c.border, RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp, bottomStart = 6.dp, bottomEnd = 22.dp)))
                    .padding(horizontal = 16.dp, vertical = 12.dp)
                    .animateContentSize(),
            ) {
                Text(msg.text, style = Runova.type.body.copy(lineHeight = 23.sp), color = if (mine) c.onLime else c.textPrimary)
            }
        }
    }
}

@Composable
private fun ThinkingBubble() {
    val c = Runova.colors
    val t = rememberInfiniteTransition()
    Row(verticalAlignment = Alignment.CenterVertically) {
        CoachMascot(InsightKind.WELCOME, 30.dp)
        Spacer(Modifier.width(10.dp))
        Row(
            Modifier.clip(RoundedCornerShape(22.dp)).background(c.surface).padding(horizontal = 18.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            for (i in 0 until 3) {
                val a = t.animateFloat(0.25f, 1f, infiniteRepeatable(tween(450, delayMillis = i * 150), RepeatMode.Reverse))
                Box(Modifier.size(8.dp).graphicsLayer { alpha = a.value }.clip(CircleShape).background(c.accent))
            }
        }
    }
}

@Composable
private fun InputBar(value: String, onChange: (String) -> Unit, onSend: () -> Unit, enabled: Boolean) {
    val c = Runova.colors
    Row(
        Modifier.fillMaxWidth().navigationBarsPadding().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .weight(1f)
                .height(60.dp)
                .clip(CircleShape)
                .background(c.surface)
                .border(1.dp, c.border, CircleShape)
                .padding(horizontal = 22.dp),
            contentAlignment = Alignment.CenterStart,
        ) {
            if (value.isEmpty()) Text("Ask me anything...", style = Runova.type.body.copy(fontSize = 17.sp), color = c.textSecondary)
            BasicTextField(
                value = value,
                onValueChange = onChange,
                singleLine = true,
                textStyle = Runova.type.body.copy(fontSize = 17.sp, color = c.textPrimary),
                cursorBrush = SolidColor(c.lime),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { onSend() }),
                modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Message the coach" },
            )
        }
        Spacer(Modifier.width(10.dp))
        val active = enabled && value.isNotBlank()
        Box(
            Modifier
                .size(60.dp)
                .circleGlow(c.lime, 10.dp, if (c.isDark) (if (active) 0.4f else 0.22f) else 0f)
                .clip(CircleShape)
                .background(if (enabled) c.lime else c.lime.copy(alpha = 0.6f))
                .clickable(enabled = active, onClick = onSend)
                .semantics { contentDescription = "Send" },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Rounded.Send, null, tint = c.onLime, modifier = Modifier.size(28.dp))
        }
    }
}

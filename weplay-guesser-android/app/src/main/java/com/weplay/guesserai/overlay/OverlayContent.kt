package com.weplay.guesserai.overlay

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.weplay.guesserai.domain.RankedGuess
import com.weplay.guesserai.service.AiStatus
import com.weplay.guesserai.service.OverlayUiState

private val Glass = Color(0xD60E081C)
private val Neon = Color(0xFFA855F7)
private val NeonDeep = Color(0xFF7C3AED)
private val NeonPink = Color(0xFFF0ABFC)
private val Lilac = Color(0xFFE9D5FF)
private val Muted = Color(0xFFA998C9)
private val Cyan = Color(0xFF67E8F9)
private val LiveGreen = Color(0xFF4ADE80)
private val Amber = Color(0xFFFBBF24)
private val ErrRed = Color(0xFFF87171)

interface OverlayActions {
    fun onMinimize()
    fun onExpand()
    fun onClose()
    fun onNextGuess()
    fun onRefresh()
    fun onTogglePause()
    fun onCopy(guess: RankedGuess)
    fun onMarkCorrect(guess: RankedGuess)
}

@Composable
fun OverlayRoot(state: OverlayUiState, minimized: Boolean, width: Dp, actions: OverlayActions) {
    if (minimized) Bubble(state, actions) else Panel(state, width, actions)
}

@Composable
private fun Bubble(state: OverlayUiState, actions: OverlayActions) {
    Box(Modifier.padding(6.dp)) {
        Box(
            Modifier
                .size(54.dp)
                .shadow(14.dp, CircleShape, ambientColor = Neon, spotColor = Neon)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(Color(0xFF2A1250), Color(0xFF120A24))))
                .border(1.5.dp, Brush.linearGradient(listOf(Lilac, Neon, Cyan)), CircleShape)
                .clickable { actions.onExpand() },
            contentAlignment = Alignment.Center,
        ) { Text("🤖", fontSize = 24.sp) }
        StatusDot(state.status, Modifier.align(Alignment.TopEnd).offset((-2).dp, 2.dp), size = 10.dp)
        state.guesses.firstOrNull()?.let {
            Text(
                "${it.confidence}%",
                color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .offset(y = 4.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(NeonDeep)
                    .padding(horizontal = 4.dp, vertical = 1.dp),
            )
        }
    }
}

@Composable
private fun Panel(state: OverlayUiState, width: Dp, actions: OverlayActions) {
    val shape = RoundedCornerShape(18.dp)
    Box(Modifier.padding(10.dp)) {
        Column(
            Modifier
                .width(width)
                .shadow(18.dp, shape, ambientColor = Neon, spotColor = Neon)
                .clip(shape)
                .background(Glass)
                .border(1.dp, Brush.linearGradient(listOf(Lilac, Neon, Color.Transparent, Cyan)), shape)
                .padding(horizontal = 9.dp, vertical = 8.dp)
                .animateContentSize(),
        ) {
            Box(
                Modifier.align(Alignment.CenterHorizontally).width(28.dp).height(3.dp)
                    .clip(RoundedCornerShape(2.dp)).background(Lilac.copy(alpha = 0.45f))
            )
            Spacer(Modifier.height(6.dp))
            Header(state, actions)
            NeonDivider()
            Thumbnail(state)
            Spacer(Modifier.height(6.dp))
            StatusLine(state)
            if (state.detectedObject.isNotBlank()) {
                Spacer(Modifier.height(5.dp))
                Detected(state)
            }
            Spacer(Modifier.height(7.dp))
            GuessesSection(state, actions)
            Spacer(Modifier.height(8.dp))
            Buttons(state, actions)
            Text(
                "Tap = copy • Hold = ✓ correct",
                color = Muted.copy(alpha = 0.8f), fontSize = 7.sp,
                modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 5.dp),
            )
        }
    }
}

@Composable
private fun Header(state: OverlayUiState, actions: OverlayActions) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(22.dp)
                .shadow(8.dp, RoundedCornerShape(7.dp), ambientColor = Neon, spotColor = Neon)
                .clip(RoundedCornerShape(7.dp))
                .background(Brush.linearGradient(listOf(Neon, Color(0xFF6D28D9)))),
            contentAlignment = Alignment.Center,
        ) { Text("🤖", fontSize = 12.sp) }
        Spacer(Modifier.width(6.dp))
        Column(Modifier.weight(1f)) {
            Text("WePlay AI", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically) {
                StatusDot(state.status, size = 6.dp)
                Spacer(Modifier.width(3.dp))
                Text(statusLabel(state.status), color = statusColor(state.status), fontSize = 8.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        WindowButton("–", Lilac) { actions.onMinimize() }
        Spacer(Modifier.width(4.dp))
        WindowButton("✕", Color(0xFFFCA5A5)) { actions.onClose() }
    }
}

@Composable
private fun WindowButton(label: String, color: Color, onClick: () -> Unit) {
    Box(
        Modifier.size(20.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(Color.White.copy(alpha = 0.08f))
            .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(6.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun StatusDot(status: AiStatus, modifier: Modifier = Modifier, size: Dp) {
    val pulse = rememberInfiniteTransition(label = "pulse")
    val a by pulse.animateFloat(
        0.35f, 1f, infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "a",
    )
    val c = statusColor(status)
    Box(
        modifier.size(size)
            .alpha(if (status == AiStatus.WATCHING || status == AiStatus.ANALYZING) a else 1f)
            .shadow(4.dp, CircleShape, ambientColor = c, spotColor = c)
            .clip(CircleShape)
            .background(c)
    )
}

private fun statusLabel(s: AiStatus) = when (s) {
    AiStatus.STARTING -> "Starting"
    AiStatus.ANALYZING, AiStatus.WATCHING -> "Live"
    AiStatus.PAUSED -> "Paused"
    AiStatus.GAME_AWAY -> "Sleeping"
    AiStatus.ERROR -> "Retrying"
}

private fun statusColor(s: AiStatus) = when (s) {
    AiStatus.ANALYZING, AiStatus.WATCHING, AiStatus.STARTING -> LiveGreen
    AiStatus.PAUSED, AiStatus.GAME_AWAY -> Amber
    AiStatus.ERROR -> ErrRed
}

@Composable
private fun NeonDivider() {
    Box(
        Modifier.padding(vertical = 7.dp).fillMaxWidth().height(1.dp)
            .background(Brush.horizontalGradient(listOf(Color.Transparent, Neon.copy(alpha = 0.6f), Color.Transparent)))
    )
}

@Composable
private fun Thumbnail(state: OverlayUiState) {
    val shape = RoundedCornerShape(10.dp)
    val scan = rememberInfiniteTransition(label = "scan")
    val y by scan.animateFloat(0f, 1f, infiniteRepeatable(tween(1400, easing = LinearEasing), RepeatMode.Reverse), label = "y")
    Box(
        Modifier.fillMaxWidth().heightIn(min = 54.dp, max = 92.dp)
            .clip(shape)
            .background(Color.White.copy(alpha = 0.05f))
            .border(1.dp, Neon.copy(alpha = 0.35f), shape),
        contentAlignment = Alignment.Center,
    ) {
        val bmp = state.thumbnail
        if (bmp != null && !bmp.isRecycled) {
            Image(bmp.asImageBitmap(), "Drawing preview", Modifier.fillMaxWidth(), contentScale = ContentScale.Crop)
        } else {
            Text("Waiting for drawing…", color = Muted, fontSize = 8.sp, modifier = Modifier.padding(vertical = 20.dp))
        }
        if (state.status == AiStatus.ANALYZING) {
            Box(
                Modifier.matchParentSize().drawBehind {
                    val yy = size.height * y
                    drawRect(
                        Brush.verticalGradient(listOf(Color.Transparent, Neon.copy(alpha = 0.35f)), startY = yy - 18f, endY = yy),
                        topLeft = Offset(0f, yy - 18f),
                        size = androidx.compose.ui.geometry.Size(size.width, 18f),
                    )
                    drawLine(NeonPink, Offset(0f, yy), Offset(size.width, yy), strokeWidth = 2f)
                }
            )
        }
        Text(
            "LIVE",
            color = Color.White, fontSize = 6.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.align(Alignment.TopStart).padding(4.dp)
                .clip(RoundedCornerShape(3.dp)).background(Color(0xCCDC2626)).padding(horizontal = 3.dp, vertical = 1.dp),
        )
    }
}

@Composable
private fun StatusLine(state: OverlayUiState) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Waveform(active = state.status == AiStatus.ANALYZING)
        Spacer(Modifier.width(5.dp))
        Text(
            state.message, color = if (state.status == AiStatus.ERROR) ErrRed else Color(0xFFC4B5FD),
            fontSize = 8.5.sp, maxLines = 2, overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun Waveform(active: Boolean) {
    val t = rememberInfiniteTransition(label = "wave")
    val phase by t.animateFloat(0f, 1f, infiniteRepeatable(tween(700, easing = LinearEasing)), label = "p")
    Row(Modifier.height(10.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(1.5.dp)) {
        listOf(0.4f, 0.8f, 0.5f, 1f, 0.3f, 0.7f).forEachIndexed { i, base ->
            val h = if (active) (0.25f + 0.75f * kotlin.math.abs(kotlin.math.sin((phase + i * 0.17f) * Math.PI)).toFloat()) else base * 0.6f
            Box(
                Modifier.width(2.dp).height((10 * h).dp).clip(RoundedCornerShape(1.dp))
                    .background(Brush.verticalGradient(listOf(Lilac, Neon)))
            )
        }
    }
}

@Composable
private fun Detected(state: OverlayUiState) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(9.dp))
            .background(Brush.horizontalGradient(listOf(Neon.copy(alpha = 0.28f), Neon.copy(alpha = 0.05f))))
            .border(1.dp, Color(0x4DC084FC), RoundedCornerShape(9.dp))
            .padding(horizontal = 6.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(state.emoji.ifBlank { "🎨" }, fontSize = 14.sp)
        Spacer(Modifier.width(5.dp))
        Column {
            Text(state.detectedObject, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (state.category.isNotBlank()) Text(state.category, color = Color(0xFFC4B5FD), fontSize = 7.5.sp, maxLines = 1)
        }
    }
}

@Composable
private fun GuessesSection(state: OverlayUiState, actions: OverlayActions) {
    var expanded by remember { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("AI GUESSES", color = Muted, fontSize = 7.5.sp, letterSpacing = 0.6.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.weight(1f))
    }
    state.hint?.let { hint ->
        Text("(${hint.label()})", color = Cyan, fontSize = 8.5.sp, fontWeight = FontWeight.Medium)
        hint.blanks()?.let { Text(it, color = Color(0xFFA5F3FC), fontSize = 7.sp, fontFamily = FontFamily.Monospace, maxLines = 1) }
    }
    if (state.hintMismatch) {
        Text("⚠ No guess fits the hint yet", color = Amber, fontSize = 7.5.sp)
    }
    Spacer(Modifier.height(4.dp))

    if (state.guesses.isEmpty()) {
        Text(
            if (state.status == AiStatus.ANALYZING) "Thinking…" else "No guesses yet",
            color = Muted, fontSize = 8.5.sp, modifier = Modifier.padding(vertical = 6.dp),
        )
        return
    }
    val shown = if (expanded) state.guesses else state.guesses.take(3)
    shown.forEachIndexed { i, g -> GuessRow(i + 1, g, top = i == 0, actions) }
    if (state.guesses.size > 3) {
        Text(
            if (expanded) "Show less ▴" else "+${state.guesses.size - 3} more ▾",
            color = Color(0xFFC4B5FD), fontSize = 8.sp,
            modifier = Modifier.clickable { expanded = !expanded }.padding(top = 3.dp),
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun GuessRow(rank: Int, g: RankedGuess, top: Boolean, actions: OverlayActions) {
    val fill by animateFloatAsState(g.confidence / 100f, tween(500), label = "bar")
    Column(
        Modifier.fillMaxWidth().padding(vertical = 2.5.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(if (top) Neon.copy(alpha = 0.12f) else Color.Transparent)
            .combinedClickable(onClick = { actions.onCopy(g) }, onLongClick = { actions.onMarkCorrect(g) })
            .padding(horizontal = 3.dp, vertical = 2.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("$rank", color = Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(4.dp))
            Text(
                g.answer + if (g.learned) " ★" else "",
                color = if (top) Color.White else Lilac, fontSize = if (top) 10.5.sp else 9.5.sp,
                fontWeight = if (top) FontWeight.Bold else FontWeight.Medium,
                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
            )
            Text(
                "${g.confidence}%", color = if (top) NeonPink else Lilac,
                fontSize = 9.5.sp, fontWeight = FontWeight.Bold,
            )
        }
        Box(Modifier.padding(top = 3.dp).fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color.White.copy(alpha = 0.08f))) {
            Box(
                Modifier.fillMaxWidth(fill).height(4.dp).clip(RoundedCornerShape(2.dp))
                    .background(Brush.horizontalGradient(if (top) listOf(Neon, NeonPink) else listOf(NeonDeep, Color(0xFFC084FC))))
            )
        }
    }
}

@Composable
private fun Buttons(state: OverlayUiState, actions: OverlayActions) {
    NeonButton("➤ Next Guess", primary = true, enabled = state.guesses.size > 1, modifier = Modifier.fillMaxWidth()) { actions.onNextGuess() }
    Spacer(Modifier.height(5.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        NeonButton("↻ Refresh", primary = false, modifier = Modifier.weight(1f)) { actions.onRefresh() }
        NeonButton(if (state.isPaused) "▶ Resume" else "❚❚ Pause AI", primary = false, modifier = Modifier.weight(1f)) { actions.onTogglePause() }
    }
}

@Composable
private fun NeonButton(label: String, primary: Boolean, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    val shape = RoundedCornerShape(9.dp)
    var m = modifier.height(26.dp)
    m = if (primary) m.shadow(10.dp, shape, ambientColor = Neon, spotColor = Neon).clip(shape)
        .background(Brush.linearGradient(listOf(Neon, NeonDeep)))
    else m.clip(shape).background(Color.White.copy(alpha = 0.06f)).border(1.dp, Color(0x66C084FC), shape)
    Box(
        m.alpha(if (enabled) 1f else 0.45f).clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = if (primary) Color.White else Lilac, fontSize = if (primary) 10.sp else 8.5.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

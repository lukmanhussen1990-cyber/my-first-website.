package com.weplay.guesserai.overlay

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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.weplay.guesserai.domain.OverlaySize
import com.weplay.guesserai.domain.RankedGuess
import com.weplay.guesserai.service.AiStatus
import com.weplay.guesserai.service.OverlayUiState
import kotlinx.coroutines.delay

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
private val Soft = Color(0xFFC4B5FD)
private val ClueBlue = Color(0xFFA5F3FC)

/** Guess rows always on show; more sit behind "+N more". */
private const val SHOWN_GUESSES = 3

/**
 * Line height as a multiple of the font size. Generous enough for glyphs from taller fallback
 * fonts (★ ✓ ⚠ 🔒), so a line keeps its height whatever it shows.
 */
private const val LINE_SPACING = 1.4f

/** How long "busy" outlasts a request, to bridge the gap before the next one starts. */
private const val BUSY_HOLD_MS = 1_500L

private val GuessTextSize = 10.sp

interface OverlayActions {
    fun onMinimize()
    fun onExpand()
    fun onClose()
    fun onNextGuess()
    fun onRefresh()
    fun onTogglePause()
    fun onCopy(guess: RankedGuess)
    fun onMarkCorrect(guess: RankedGuess)
    fun onAdjustHint(dWords: Int, dLetters: Int)
    fun onAutoHint()
}

/**
 * The floating window. Nothing in it animates on its own: it only redraws when the guesses or the
 * status change, so it costs the game no frames while it waits.
 */
@Composable
fun OverlayRoot(state: OverlayUiState, size: OverlaySize, width: Dp, actions: OverlayActions) {
    when (size) {
        OverlaySize.MINI -> MiniBar(state, width, actions)
        OverlaySize.COMPACT -> CompactPanel(state, width, actions)
        OverlaySize.LARGE -> Panel(state, width, actions)
    }
}

/** Answers shown as chips in the mini bar. */
private const val MINI_CHIPS = 3

/**
 * Mini window: one slim row under the drawing with the AI's top answers as chips — tap to copy,
 * hold to mark correct — plus "»" (next answer) and "⌄" (open the panel). Takes about as much room
 * as the game's toolbar, so the chat and the answer box stay free for typing.
 */
@Composable
private fun MiniBar(state: OverlayUiState, width: Dp, actions: OverlayActions) {
    val shape = RoundedCornerShape(16.dp)
    val busy = rememberBusy(state.status)
    Row(
        Modifier
            .padding(2.dp)
            .width(width)
            .height(32.dp)
            .clip(shape)
            .background(Glass)
            .border(1.dp, Neon.copy(alpha = 0.7f), shape)
            .padding(horizontal = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StatusDot(state.status, busy, size = 7.dp)
        Spacer(Modifier.width(5.dp))
        Row(
            Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val answer = state.answer
            val guesses = state.guesses.take(if (answer != null) MINI_CHIPS - 1 else MINI_CHIPS)
            val problem = state.problem
            if (problem != null) {
                // The answers are stale until this is fixed; say why, and tap to try again.
                Text(
                    "⚠ $problem", color = Amber, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.clickable(onClickLabel = "Try again") { actions.onTogglePause() },
                )
                return@Row
            }
            if (answer == null && guesses.isEmpty()) {
                Text(
                    state.message, color = if (state.status == AiStatus.ERROR) ErrRed else Soft,
                    fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            if (answer != null) {
                MiniChip(
                    RankedGuess(answer, 100, "shown by the game", matchesHint = true, learned = true),
                    label = "✓ $answer", top = false, gameAnswer = true, copied = state.copied == answer, actions = actions,
                    modifier = Modifier.weight(1f, fill = false),
                )
            }
            guesses.forEachIndexed { i, g ->
                key(g.answer) {
                    MiniChip(
                        g, label = null, top = i == 0 && answer == null, gameAnswer = false, copied = state.copied == g.answer,
                        actions = actions, modifier = Modifier.weight(1f, fill = false),
                    )
                }
            }
        }
        Spacer(Modifier.width(4.dp))
        WindowButton("»", "Next answer", Lilac, size = 22.dp, enabled = state.guesses.size > 1) { actions.onNextGuess() }
        Spacer(Modifier.width(3.dp))
        WindowButton("⌄", "Open the panel", Lilac, size = 22.dp) { actions.onExpand() }
    }
}

/** One answer in the mini bar: tap copies it (it turns green with ✓), hold marks it correct. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MiniChip(
    g: RankedGuess, label: String?, top: Boolean, gameAnswer: Boolean, copied: Boolean, actions: OverlayActions,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(10.dp)
    Row(
        modifier
            .height(24.dp)
            .clip(shape)
            .background(
                when {
                    copied || gameAnswer -> LiveGreen.copy(alpha = 0.22f)
                    top -> Neon.copy(alpha = 0.35f)
                    else -> Color.White.copy(alpha = 0.08f)
                }
            )
            .combinedClickable(
                onClickLabel = "Copy",
                onLongClickLabel = if (gameAnswer) null else "Mark as the right answer",
                onClick = { actions.onCopy(g) },
                onLongClick = if (gameAnswer) null else ({ actions.onMarkCorrect(g) }),
            )
            .padding(horizontal = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label ?: ((if (g.matchesHint) "" else "⚠ ") + g.answer),
            color = when {
                gameAnswer -> LiveGreen
                !g.matchesHint -> Lilac.copy(alpha = 0.6f)
                top -> Color.White
                else -> Lilac
            },
            fontSize = 10.5.sp, fontWeight = if (top || gameAnswer) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false),
        )
        when {
            copied -> Text(" ✓", color = LiveGreen, fontSize = 9.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            top -> Text(" ${g.confidence}%", color = NeonPink, fontSize = 8.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        }
    }
}

/** Fixed height of one text line at [fontSize]; every changing line uses it, so the window never jumps. */
@Composable
private fun lineHeight(fontSize: TextUnit): Dp = with(LocalDensity.current) { (fontSize * LINE_SPACING).toDp() }

/**
 * True while a request runs. Between back-to-back requests the status is WATCHING for a moment;
 * this holds through that gap, so the waveform and "Thinking…" do not flicker.
 */
@Composable
private fun rememberBusy(status: AiStatus): Boolean {
    var held by remember { mutableStateOf(false) }
    LaunchedEffect(status) {
        if (status == AiStatus.WATCHING && held) delay(BUSY_HOLD_MS)
        held = status == AiStatus.ANALYZING
    }
    return held || status == AiStatus.ANALYZING
}

/**
 * Small panel: header, one status line, the hint, the top guesses as big tap-to-copy rows, and
 * one row of buttons. No preview image, so it covers as little of the game as possible.
 * Every part has a fixed height: the window only grows when the hint editor or "+N more" is
 * opened, or when the game's answer is pinned at the end of a round.
 */
@Composable
private fun CompactPanel(state: OverlayUiState, width: Dp, actions: OverlayActions) {
    val shape = RoundedCornerShape(14.dp)
    val busy = rememberBusy(state.status)
    Box(Modifier.padding(8.dp)) {
        Column(
            Modifier
                .width(width)
                .shadow(12.dp, shape, ambientColor = Neon, spotColor = Neon)
                .clip(shape)
                .background(Glass)
                .border(1.dp, Brush.linearGradient(listOf(Lilac, Neon, Color.Transparent, Cyan)), shape)
                .padding(horizontal = 7.dp, vertical = 6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                StatusDot(state.status, busy, size = 6.dp)
                Spacer(Modifier.width(4.dp))
                Text(
                    "WePlay AI", color = Color.White, fontSize = 9.5.sp, fontWeight = FontWeight.Bold,
                    maxLines = 1, modifier = Modifier.weight(1f),
                )
                WindowButton("–", "Minimize", Lilac, size = 17.dp) { actions.onMinimize() }
                Spacer(Modifier.width(3.dp))
                WindowButton("✕", "Close", Color(0xFFFCA5A5), size = 17.dp) { actions.onClose() }
            }
            Spacer(Modifier.height(3.dp))
            StatusLine(state, busy, compact = true)
            HintLine(state, actions, compact = true)
            Spacer(Modifier.height(3.dp))
            AnswerBanner(state, actions)
            GuessList(state, busy, actions, compact = true)
            Spacer(Modifier.height(2.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                NeonButton("➤ Next", primary = true, enabled = state.guesses.size > 1, height = 24.dp, modifier = Modifier.weight(1f)) { actions.onNextGuess() }
                NeonButton("↻", primary = false, height = 24.dp, description = "Refresh", modifier = Modifier.width(24.dp)) { actions.onRefresh() }
                NeonButton(
                    if (state.isPaused) "▶" else "❚❚", primary = false, height = 24.dp,
                    description = if (state.isPaused) "Resume AI" else "Pause AI", modifier = Modifier.width(24.dp),
                ) { actions.onTogglePause() }
            }
        }
    }
}

/** Full panel with the drawing preview. Like the compact one, its parts keep a fixed height. */
@Composable
private fun Panel(state: OverlayUiState, width: Dp, actions: OverlayActions) {
    val shape = RoundedCornerShape(18.dp)
    val busy = rememberBusy(state.status)
    Box(Modifier.padding(10.dp)) {
        Column(
            Modifier
                .width(width)
                .shadow(18.dp, shape, ambientColor = Neon, spotColor = Neon)
                .clip(shape)
                .background(Glass)
                .border(1.dp, Brush.linearGradient(listOf(Lilac, Neon, Color.Transparent, Cyan)), shape)
                .padding(horizontal = 9.dp, vertical = 8.dp),
        ) {
            Box(
                Modifier.align(Alignment.CenterHorizontally).width(28.dp).height(3.dp)
                    .clip(RoundedCornerShape(2.dp)).background(Lilac.copy(alpha = 0.45f))
            )
            Spacer(Modifier.height(6.dp))
            Header(state, busy, actions)
            NeonDivider()
            Thumbnail(state, busy)
            Spacer(Modifier.height(6.dp))
            StatusLine(state, busy, compact = false)
            Spacer(Modifier.height(5.dp))
            Detected(state)
            Spacer(Modifier.height(7.dp))
            GuessesSection(state, busy, actions)
            Spacer(Modifier.height(4.dp))
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
private fun Header(state: OverlayUiState, busy: Boolean, actions: OverlayActions) {
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
                StatusDot(state.status, busy, size = 6.dp)
                Spacer(Modifier.width(3.dp))
                Text(statusLabel(state.status), color = statusColor(state.status), fontSize = 8.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        WindowButton("–", "Minimize", Lilac) { actions.onMinimize() }
        Spacer(Modifier.width(4.dp))
        WindowButton("✕", "Close", Color(0xFFFCA5A5)) { actions.onClose() }
    }
}

/** A small symbol button; [description] is what a screen reader says instead of the symbol. */
@Composable
private fun WindowButton(label: String, description: String, color: Color, size: Dp = 20.dp, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        Modifier.size(size)
            .alpha(if (enabled) 1f else 0.4f)
            .clip(RoundedCornerShape(6.dp))
            .background(Color.White.copy(alpha = 0.08f))
            .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(6.dp))
            .semantics { contentDescription = description }
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clearAndSetSemantics {}) }
}

/** Status as a plain dot: green live, purple while the AI looks at a frame, amber paused, red error. No animation. */
@Composable
private fun StatusDot(status: AiStatus, busy: Boolean, modifier: Modifier = Modifier, size: Dp) {
    val c = if (busy && status != AiStatus.PAUSED && status != AiStatus.ERROR) Neon else statusColor(status)
    Box(modifier.size(size).clip(CircleShape).background(c).semantics { contentDescription = "AI ${statusLabel(status)}" })
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

/** Drawing preview at a fixed height, cropped to fit, so the first frame does not resize the panel. */
@Composable
private fun Thumbnail(state: OverlayUiState, busy: Boolean) {
    val shape = RoundedCornerShape(10.dp)
    Box(
        Modifier.fillMaxWidth().height(88.dp)
            .clip(shape)
            .background(Color.White.copy(alpha = 0.05f))
            .border(1.dp, Neon.copy(alpha = if (busy) 0.9f else 0.35f), shape),
        contentAlignment = Alignment.Center,
    ) {
        val bmp = state.thumbnail
        if (bmp != null && !bmp.isRecycled) {
            Image(bmp.asImageBitmap(), "Drawing preview", Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        } else {
            Text("Waiting for drawing…", color = Muted, fontSize = 8.sp)
        }
        Text(
            "LIVE",
            color = Color.White, fontSize = 6.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.align(Alignment.TopStart).padding(4.dp)
                .clip(RoundedCornerShape(3.dp)).background(Color(0xCCDC2626)).padding(horizontal = 3.dp, vertical = 1.dp),
        )
    }
}

/** The status message: one line in the compact panel, two in the full one, never more or fewer. */
@Composable
private fun StatusLine(state: OverlayUiState, busy: Boolean, compact: Boolean) {
    val fontSize = if (compact) 7.5.sp else 8.5.sp
    val lines = if (compact) 1 else 2
    Row(
        Modifier.fillMaxWidth().height(maxOf(lineHeight(fontSize) * lines, 10.dp)),
        verticalAlignment = Alignment.CenterVertically,
    ) {

        Text(
            state.message, color = if (state.status == AiStatus.ERROR) ErrRed else Soft,
            fontSize = fontSize, maxLines = lines, overflow = TextOverflow.Ellipsis,
        )
    }
}

/** What the AI sees in the drawing. Always shown (with a placeholder), so it never pops in. */
@Composable
private fun Detected(state: OverlayUiState) {
    val seen = state.detectedObject.isNotBlank()
    Row(
        Modifier.fillMaxWidth().height(lineHeight(10.sp) + lineHeight(7.5.sp) + 6.dp)
            .clip(RoundedCornerShape(9.dp))
            .background(Brush.horizontalGradient(listOf(Neon.copy(alpha = 0.28f), Neon.copy(alpha = 0.05f))))
            .border(1.dp, Color(0x4DC084FC), RoundedCornerShape(9.dp))
            .padding(horizontal = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(state.emoji.takeIf { seen && it.isNotBlank() } ?: "🎨", fontSize = 14.sp, maxLines = 1)
        Spacer(Modifier.width(5.dp))
        Column {
            Text(
                if (seen) state.detectedObject else "Nothing seen yet",
                color = if (seen) Color.White else Muted, fontSize = 10.sp,
                fontWeight = if (seen) FontWeight.Bold else FontWeight.Normal,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            if (seen && state.category.isNotBlank()) {
                Text(state.category, color = Soft, fontSize = 7.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun GuessesSection(state: OverlayUiState, busy: Boolean, actions: OverlayActions) {
    Text("AI GUESSES", color = Muted, fontSize = 7.5.sp, letterSpacing = 0.6.sp, fontWeight = FontWeight.SemiBold)
    HintLine(state, actions, compact = false)
    Spacer(Modifier.height(4.dp))
    AnswerBanner(state, actions)
    GuessList(state, busy, actions, compact = false)
}

/** The answer the game itself showed (round over, or we guessed it). Tap to copy. */
@Composable
private fun AnswerBanner(state: OverlayUiState, actions: OverlayActions) {
    val answer = state.answer ?: return
    val asGuess = RankedGuess(answer, 100, "shown by the game", matchesHint = true, learned = true)
    Row(
        Modifier.fillMaxWidth().padding(bottom = 3.dp)
            .clip(RoundedCornerShape(7.dp))
            .background(LiveGreen.copy(alpha = 0.2f))
            .border(1.dp, LiveGreen.copy(alpha = 0.6f), RoundedCornerShape(7.dp))
            .clickable(onClickLabel = "Copy") { actions.onCopy(asGuess) }
            .padding(horizontal = 5.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("✓", color = LiveGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(4.dp))
        Column(Modifier.weight(1f)) {
            Text("ANSWER", color = LiveGreen, fontSize = 6.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.5.sp)
            Text(answer, color = Color.White, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (state.copied == answer) Text("✓", color = LiveGreen, fontSize = 9.sp, fontWeight = FontWeight.Bold)
    }
}

/**
 * The hint ("2 words • 9 letters"). Tap it to fix a misread with +/- buttons; a hand-set hint
 * shows 🔒 and stays until the round ends or "Auto" is tapped. An amber ⚠ in front means no
 * guess fits it. Below it, lines that are always there (blank until known): the category clue
 * and the word blanks — one line holding either in the compact panel.
 */
@Composable
private fun HintLine(state: OverlayUiState, actions: OverlayActions, compact: Boolean) {
    var editing by remember { mutableStateOf(false) }
    val hint = state.hint
    val fontSize = if (compact) 8.sp else 8.5.sp
    Row(
        Modifier.padding(top = 2.dp).height(lineHeight(fontSize) + 2.dp)
            .clip(RoundedCornerShape(5.dp)).clickable(onClickLabel = if (editing) "Close the hint editor" else "Correct the hint") { editing = !editing }
            .padding(horizontal = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (state.hintMismatch) Text("⚠ ", color = Amber, fontSize = fontSize, fontWeight = FontWeight.Bold, maxLines = 1)
        Text(
            (if (state.hintManual) "🔒 " else "") + (hint?.label() ?: "Hint: tap to set"),
            color = if (hint == null) Muted else Cyan,
            fontSize = fontSize, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        Text(if (editing) " ▴" else " ✎", color = Muted, fontSize = 7.sp, maxLines = 1)
    }
    val clue = hint?.clue?.takeIf { it.isNotBlank() }?.let { "“$it”" }
    val blanks = hint?.blanks()
    if (compact) {
        // One size for both, so the line keeps its height when the clue replaces the blanks.
        ReservedLine(clue ?: blanks, 7.5.sp, ClueBlue, mono = clue == null)
    } else {
        ReservedLine(clue, 8.sp, ClueBlue)
        ReservedLine(blanks, 7.sp, ClueBlue, mono = true)
    }
    if (editing) {
        Row(Modifier.padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            Stepper("W", "word", hint?.wordCount ?: 1, onMinus = { actions.onAdjustHint(-1, 0) }, onPlus = { actions.onAdjustHint(1, 0) })
            Spacer(Modifier.width(4.dp))
            Stepper("L", "letter", hint?.letterCount ?: 4, onMinus = { actions.onAdjustHint(0, -1) }, onPlus = { actions.onAdjustHint(0, 1) })
        }
        if (state.hintManual) {
            Text(
                "↺ Auto (read from game)", color = Soft, fontSize = 7.5.sp,
                modifier = Modifier.padding(top = 2.dp).clip(RoundedCornerShape(5.dp))
                    .clickable { actions.onAutoHint(); editing = false }.padding(2.dp),
            )
        }
    }
}

/** One line of [text] that keeps its height when there is nothing to show yet. */
@Composable
private fun ReservedLine(text: String?, fontSize: TextUnit, color: Color, mono: Boolean = false) {
    Box(Modifier.fillMaxWidth().height(lineHeight(fontSize)).padding(start = 2.dp), contentAlignment = Alignment.CenterStart) {
        if (!text.isNullOrBlank()) {
            Text(
                text, color = color, fontSize = fontSize, fontFamily = if (mono) FontFamily.Monospace else null,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun Stepper(label: String, unit: String, value: Int, onMinus: () -> Unit, onPlus: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Muted, fontSize = 7.5.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(2.dp))
        WindowButton("−", "One $unit fewer", Lilac, size = 16.dp, onClick = onMinus)
        Text(
            "$value", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 3.dp).semantics { contentDescription = "$value ${unit}s" },
        )
        WindowButton("+", "One $unit more", Lilac, size = 16.dp, onClick = onPlus)
    }
}

/**
 * The guesses: always [SHOWN_GUESSES] rows (empty ones when there are fewer guesses) and one
 * line for "+N more", so new or dropped guesses never change the window's height.
 */
@Composable
private fun GuessList(state: OverlayUiState, busy: Boolean, actions: OverlayActions, compact: Boolean) {
    var expanded by remember { mutableStateOf(false) }
    val more = state.guesses.size - SHOWN_GUESSES
    // Fold up once the list is short again, so the next long list does not open by itself.
    LaunchedEffect(more > 0) { if (more <= 0) expanded = false }
    val slot = lineHeight(GuessTextSize) + 14.dp
    val shown = if (expanded) state.guesses else state.guesses.take(SHOWN_GUESSES)
    shown.forEachIndexed { i, g ->
        // Keyed by answer, so a row's confidence bar follows its guess when the order changes.
        key(g.answer) {
            GuessRow(i + 1, g, top = i == 0, copied = state.copied == g.answer, compact = compact, height = slot, actions = actions)
        }
    }
    repeat((SHOWN_GUESSES - shown.size).coerceAtLeast(0)) { i ->
        Box(Modifier.fillMaxWidth().height(slot).padding(start = 4.dp), contentAlignment = Alignment.CenterStart) {
            if (shown.isEmpty() && i == 0) {
                Text(if (busy) "Thinking…" else "No guesses yet", color = Muted, fontSize = 8.5.sp, maxLines = 1)
            }
        }
    }
    Box(
        Modifier.fillMaxWidth().height(lineHeight(8.sp) + 4.dp).clip(RoundedCornerShape(4.dp))
            .then(if (more > 0) Modifier.clickable { expanded = !expanded } else Modifier)
            .padding(horizontal = 2.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (more > 0) Text(if (expanded) "Show less ▴" else "+$more more ▾", color = Soft, fontSize = 8.sp, maxLines = 1)
    }
}

/** One guess at a fixed [height]; tap copies it (✓ replaces the percentage), long-press marks it correct. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun GuessRow(
    rank: Int, g: RankedGuess, top: Boolean, copied: Boolean, compact: Boolean, height: Dp, actions: OverlayActions,
) {
    val fill = g.confidence / 100f
    Column(
        Modifier.fillMaxWidth().height(height).padding(vertical = if (compact) 1.5.dp else 2.5.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(
                when {
                    copied -> LiveGreen.copy(alpha = 0.16f)
                    top -> Neon.copy(alpha = 0.14f)
                    else -> Color.White.copy(alpha = 0.03f)
                }
            )
            .combinedClickable(
                onClickLabel = "Copy", onLongClickLabel = "Mark as the right answer",
                onClick = { actions.onCopy(g) }, onLongClick = { actions.onMarkCorrect(g) },
            )
            .padding(horizontal = 4.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Row(Modifier.height(lineHeight(GuessTextSize)), verticalAlignment = Alignment.CenterVertically) {
            if (!compact) {
                Text("$rank", color = Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(4.dp))
            }
            // An AI answer that does not fit the hint is still shown (after the ones that fit), marked ⚠.
            Text(
                (if (g.matchesHint) "" else "⚠ ") + g.answer + if (g.learned) " ★" else "",
                color = when {
                    !g.matchesHint -> Lilac.copy(alpha = 0.6f)
                    top -> Color.White
                    else -> Lilac
                },
                fontSize = if (top) GuessTextSize else 9.5.sp,
                fontWeight = if (top) FontWeight.Bold else FontWeight.Medium,
                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
            )
            Text(
                if (copied) "✓" else "${g.confidence}%",
                color = if (copied) LiveGreen else if (top) NeonPink else Lilac,
                fontSize = 9.sp, fontWeight = FontWeight.Bold, maxLines = 1,
            )
        }
        Box(Modifier.padding(top = 2.dp).fillMaxWidth().height(3.dp).clip(RoundedCornerShape(2.dp)).background(Color.White.copy(alpha = 0.08f))) {
            Box(
                Modifier.fillMaxWidth(fill).height(3.dp).clip(RoundedCornerShape(2.dp))
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
private fun NeonButton(
    label: String, primary: Boolean, modifier: Modifier = Modifier, enabled: Boolean = true,
    height: Dp = 26.dp, description: String? = null, onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(8.dp)
    var m = modifier.height(height)
    m = if (primary) m.shadow(10.dp, shape, ambientColor = Neon, spotColor = Neon).clip(shape)
        .background(Brush.linearGradient(listOf(Neon, NeonDeep)))
    else m.clip(shape).background(Color.White.copy(alpha = 0.06f)).border(1.dp, Color(0x66C084FC), shape)
    // Symbol-only buttons are read out by their [description].
    if (description != null) m = m.semantics { contentDescription = description }
    Box(
        m.alpha(if (enabled) 1f else 0.45f).clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label, color = if (primary) Color.White else Lilac, fontSize = if (primary) 10.sp else 8.5.sp, fontWeight = FontWeight.Bold, maxLines = 1,
            modifier = if (description != null) Modifier.clearAndSetSemantics {} else Modifier,
        )
    }
}
